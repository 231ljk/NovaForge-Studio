import { app, safeStorage, shell } from 'electron'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { GITHUB_CLIENT_ID, GITHUB_SCOPES } from '../shared/auth'
import type { AuthProvider, AuthState, AuthUser } from '../shared/auth'

/**
 * 账号系统（双渠道，均为标准 OAuth，无自建密码体系）：
 *  - github：Device Flow（授权码轮询，本地 user_code 展示）
 *  - gitee：授权码模式（Gitee OAuth 应用 NovaForge Studio，
 *           gitee.com/oauth/applications/58851），本地回调 127.0.0.1:5599
 *
 * client_secret 只存在于主进程，绝不下发渲染进程。
 */

// —— Gitee OAuth 应用（NovaForge Studio）——
// ⚠ 应用详情页的"回调地址 URL"必须与下面完全一致：
//    http://127.0.0.1:5599/oauth/callback
const GITEE_CLIENT_ID = '4df6312f85d1a4da8739016f260fb7e08b0ec221a9a520ce359189a14cc0c479'
const GITEE_CLIENT_SECRET = '72a29395cf37fc03dc3b72ac22496a0c4df1ec2c74ef11ddc771053164ce4997'
const GITEE_REDIRECT_URI = 'http://127.0.0.1:5599/oauth/callback'
const GITEE_CALLBACK_PORT = 5599

const TOKEN_FILE = 'auth-token.bin'
const GITEE_TOKEN_FILE = 'gitee-auth-token.bin'
const PROVIDER_FILE = 'auth-provider.txt'
const POLL_INTERVAL_MS = 3000

function userDataPath(file: string): string {
  return path.join(app.getPath('userData'), file)
}

/** 加密存储（Windows：DPAPI 绑定当前系统用户） */
function saveEncrypted(file: string, value: string): void {
  const buf = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(value)
    : Buffer.from(value, 'utf8')
  fs.writeFileSync(userDataPath(file), buf)
}

function loadEncrypted(file: string): string | null {
  try {
    const buf = fs.readFileSync(userDataPath(file))
    return safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(buf)
      : buf.toString('utf8')
  } catch {
    return null
  }
}

export class AuthService {
  private state: AuthState = { phase: 'idle' }
  private pollTimer: NodeJS.Timeout | null = null
  private deviceCode: string | null = null
  private deadline = 0
  private giteeExpectedState: string | null = null
  private giteeServer: http.Server | null = null
  private cachedUser: AuthUser | null = null
  /** 授权成功回调：把仓库账号自动挂到当前邮箱账号下 */
  onAuthorized: ((provider: AuthProvider, user: AuthUser, token: string) => void) | null = null

  private fireAuthorized(provider: AuthProvider, user: AuthUser, token: string): void {
    try {
      this.onAuthorized?.(provider, user, token)
    } catch {
      /* 绑定失败不影响登录本身 */
    }
  }

  currentToken(provider: AuthProvider): string | null {
    return provider === 'gitee' ? this.loadGiteeToken() : this.loadToken()
  }

  // —— 对外状态 ——

  async status(): Promise<AuthState> {
    if (this.state.phase === 'waiting') {
      if (Date.now() > this.deadline) {
        if (this.state.provider === 'gitee') this.stopGiteeServer()
        this.stopPolling()
        this.state = {
          phase: 'error',
          provider: this.state.provider,
          error: '授权超时，未完成登录',
        }
      }
      return this.state
    }
    if (this.state.phase === 'authorized') return this.state

    // 启动恢复：优先最近一次激活的渠道
    const provider: AuthProvider | null = this.loadActiveProvider()
    const token = provider === 'gitee' ? this.loadGiteeToken() : provider === 'github' ? this.loadToken() : null
    if (!provider || !token) return { phase: 'idle' }

    const user = provider === 'gitee' ? await this.fetchGiteeUser(token) : await this.fetchGithubUser(token)
    if (user.status === 'unauthorized') {
      // 只有服务端明确判定令牌无效时才清除，网络离线不能删掉有效登录态
      this.clearToken(provider)
      return { phase: 'idle' }
    }
    if (user.status === 'offline') {
      const cached = this.loadCachedUser(provider)
      if (cached) {
        this.cachedUser = cached
        this.state = { phase: 'authorized', provider, user: cached }
        return this.state
      }
      // 无本地缓存可展示：保持未登录，但令牌仍保留在磁盘，联网后自动恢复
      return { phase: 'idle' }
    }
    this.cachedUser = user.user
    this.saveCachedUser(provider, user.user)
    this.state = { phase: 'authorized', provider, user: user.user }
    this.fireAuthorized(provider, user.user, token)
    return this.state
  }

  // —— GitHub Device Flow ——

  async startLogin(): Promise<AuthState> {
    this.stopPolling()
    // 已有有效 GitHub 令牌 → 静默登录，不再走浏览器
    const existing = this.loadToken()
    if (existing) {
      const res = await this.fetchGithubUser(existing)
      if (res.status === 'ok') {
        this.cachedUser = res.user
        this.saveCachedUser('github', res.user)
        this.state = { phase: 'authorized', provider: 'github', user: res.user }
        this.saveActiveProvider('github')
        this.fireAuthorized('github', res.user, existing)
        return this.state
      }
      if (res.status === 'unauthorized') this.clearToken('github')
    }

    // 注意：这里必须直接请求 GitHub 正式接口。
    // 之前用 NODE_ENV===development 切到 localhost:9999 的模拟接口，
    // 开发模式下该端口并不存在 → 请求直接失败 → 授权页永远弹不出来。
    try {
      const resp = await fetch('https://github.com/login/device/code', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: GITHUB_CLIENT_ID, scope: GITHUB_SCOPES }),
        signal: AbortSignal.timeout(20_000),
      })
      const data = (await resp.json().catch(() => ({}))) as {
        device_code?: string
        user_code?: string
        verification_uri?: string
        expires_in?: number
        interval?: number
        error?: string
        error_description?: string
      }
      if (!resp.ok || !data.device_code || !data.user_code) {
        const reason = data.error_description || data.error || `HTTP ${resp.status}`
        return {
          phase: 'error',
          provider: 'github',
          error: `GitHub 未返回设备码（${reason}）。请确认 GitHub OAuth App 已开启 Device Flow，或改用邮箱账号登录。`,
        }
      }
      this.deviceCode = data.device_code
      this.deadline = Date.now() + (data.expires_in ?? 900) * 1000
      this.state = {
        phase: 'waiting',
        provider: 'github',
        userCode: data.user_code,
        verificationUri: data.verification_uri || 'https://github.com/login/device',
      }
      // 打开浏览器失败不算致命：界面仍会显示一次性代码与链接，可手动打开
      try {
        await shell.openExternal(this.state.verificationUri!)
      } catch {
        /* 交给界面上的「点此打开」兜底 */
      }
      this.startPolling(Math.max(5, data.interval ?? 5))
      return this.state
    } catch (err) {
      return {
        phase: 'error',
        provider: 'github',
        error: `无法连接 GitHub（${String(err)}）。请检查网络，或改用邮箱账号登录。`,
      }
    }
  }

  private startPolling(intervalSec: number): void {
    this.stopPolling()
    this.pollTimer = setInterval(() => void this.poll(), intervalSec * 1000)
  }

  private stopPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.pollTimer = null
  }

  private async poll(): Promise<void> {
    if (!this.deviceCode || this.state.phase !== 'waiting') return
    try {
      const resp = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: GITHUB_CLIENT_ID,
          device_code: this.deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      })
      const data = (await resp.json()) as { access_token?: string; error?: string; error_description?: string; interval?: number }
      if (data.access_token) {
        this.saveToken(data.access_token)
        this.saveActiveProvider('github')
        const user = await this.fetchGithubUser(data.access_token)
        if (user.status === 'ok') {
          this.cachedUser = user.user
          this.saveCachedUser('github', user.user)
          this.state = { phase: 'authorized', provider: 'github', user: user.user }
          this.fireAuthorized('github', user.user, data.access_token)
        } else {
          this.state = { phase: 'error', provider: 'github', error: '已拿到令牌，但获取 GitHub 用户信息失败（网络问题，重启后会自动恢复登录）' }
        }
        this.stopPolling()
        return
      }
      if (data.interval && data.interval > 0) {
        const sec = Math.max(3, data.interval)
        if (this.pollTimer) {
          clearInterval(this.pollTimer)
          this.pollTimer = setInterval(() => void this.poll(), sec * 1000)
        }
      }
      if (data.error && !['authorization_pending', 'slow_down'].includes(data.error)) {
        this.state = {
          phase: 'error',
          provider: 'github',
          error: data.error_description || `GitHub 授权失败：${data.error}`,
        }
        this.stopPolling()
      }
    } catch {
      // 网络瞬时错误：等下一轮轮询
    }
  }

  // —— Gitee 授权码模式（APP 一键登录）——

  async startGiteeLogin(): Promise<AuthState> {
    this.stopPolling()
    this.stopGiteeServer()

    // 已有有效 Gitee 令牌 → 静默登录
    const existing = this.loadGiteeToken()
    if (existing) {
      const res = await this.fetchGiteeUser(existing)
      if (res.status === 'ok') {
        this.cachedUser = res.user
        this.saveCachedUser('gitee', res.user)
        this.state = { phase: 'authorized', provider: 'gitee', user: res.user }
        this.saveActiveProvider('gitee')
        this.fireAuthorized('gitee', res.user, existing)
        return this.state
      }
      if (res.status === 'unauthorized') this.clearToken('gitee')
    }

    const state = randomBytes(16).toString('hex')
    this.giteeExpectedState = state
    this.deadline = Date.now() + 5 * 60 * 1000
    this.state = { phase: 'waiting', provider: 'gitee' }
    this.startGiteeCallbackServer()

    const authorizeUrl = new URL('https://gitee.com/oauth/authorize')
    authorizeUrl.searchParams.set('client_id', GITEE_CLIENT_ID)
    authorizeUrl.searchParams.set('response_type', 'code')
    authorizeUrl.searchParams.set('redirect_uri', GITEE_REDIRECT_URI)
    authorizeUrl.searchParams.set('state', state)
    try {
      await shell.openExternal(authorizeUrl.toString())
    } catch {
      // 浏览器打不开时仍把地址交给界面，用户可复制到任意浏览器打开
      this.state = { phase: 'waiting', provider: 'gitee', verificationUri: authorizeUrl.toString() }
    }
    return this.state
  }

  private startGiteeCallbackServer(): void {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${GITEE_CALLBACK_PORT}`)
      const html = (status: number, body: string) => {
        res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`<html><body style="font-family:system-ui;padding:40px"><h2>NovaForge Studio</h2><p>${body}</p></body></html>`)
      }
      if (url.pathname !== '/oauth/callback') {
        html(404, 'Not Found')
        return
      }
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      if (!code || !state || state !== this.giteeExpectedState) {
        html(400, '授权参数无效，请返回软件重试。')
        this.stopGiteeServer()
        this.state = { phase: 'error', provider: 'gitee', error: 'Gitee 授权回调校验失败' }
        return
      }
      html(200, '登录成功，可以关闭此页面。')
      this.stopGiteeServer()
      void this.finishGiteeLogin(code)
    })
    server.on('error', () => {
      this.state = { phase: 'error', provider: 'gitee', error: `本地回调端口 ${GITEE_CALLBACK_PORT} 被占用` }
      this.stopGiteeServer()
    })
    server.listen(GITEE_CALLBACK_PORT, '127.0.0.1')
    this.giteeServer = server
  }

  private stopGiteeServer(): void {
    if (this.giteeServer) {
      // closeAllConnections 断开浏览器 keep-alive，避免端口长期占住导致"退不出/再登录失败"
      this.giteeServer.closeAllConnections?.()
      this.giteeServer.close()
      this.giteeServer = null
    }
    this.giteeExpectedState = null
  }

  private async finishGiteeLogin(code: string): Promise<void> {
    try {
      const resp = await fetch('https://gitee.com/oauth/token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: GITEE_CLIENT_ID,
          client_secret: GITEE_CLIENT_SECRET,
          code,
          redirect_uri: GITEE_REDIRECT_URI,
        }),
      })
      const data = (await resp.json()) as { access_token?: string; error_description?: string }
      if (!data.access_token) {
        this.state = { phase: 'error', provider: 'gitee', error: data.error_description || 'Gitee 令牌交换失败' }
        return
      }
      this.saveToken(data.access_token, true)
      this.saveActiveProvider('gitee')
      const user = await this.fetchGiteeUser(data.access_token)
      if (user.status === 'ok') {
        this.cachedUser = user.user
        this.saveCachedUser('gitee', user.user)
        this.state = { phase: 'authorized', provider: 'gitee', user: user.user }
        this.fireAuthorized('gitee', user.user, data.access_token)
      } else {
        this.state = { phase: 'error', provider: 'gitee', error: '已拿到令牌，但获取 Gitee 用户信息失败（网络问题，重启后会自动恢复登录）' }
      }
    } catch {
      this.state = { phase: 'error', provider: 'gitee', error: 'Gitee 授权请求失败，请检查网络' }
    }
  }

  // —— 登出 ——

  logout(): void {
    this.stopPolling()
    this.stopGiteeServer()
    this.deviceCode = null
    this.deadline = 0
    this.clearToken('github')
    this.clearToken('gitee')
    this.clearCachedUser()
    this.cachedUser = null
    this.state = { phase: 'idle' }
  }

  // —— 令牌与用户信息 ——

  private loadActiveProvider(): AuthProvider | null {
    try {
      const v = fs.readFileSync(userDataPath(PROVIDER_FILE), 'utf8').trim()
      return v === 'github' || v === 'gitee' ? v : null
    } catch {
      return null
    }
  }

  private saveActiveProvider(provider: AuthProvider): void {
    fs.writeFileSync(userDataPath(PROVIDER_FILE), provider, 'utf8')
  }

  private loadToken(): string | null {
    return loadEncrypted(TOKEN_FILE)
  }

  private loadGiteeToken(): string | null {
    return loadEncrypted(GITEE_TOKEN_FILE)
  }

  private saveToken(token: string, gitee = false): void {
    saveEncrypted(gitee ? GITEE_TOKEN_FILE : TOKEN_FILE, token)
  }

  private clearToken(provider: AuthProvider): void {
    try {
      fs.rmSync(userDataPath(provider === 'gitee' ? GITEE_TOKEN_FILE : TOKEN_FILE))
    } catch {
      /* ignore */
    }
    try {
      fs.rmSync(userDataPath(PROVIDER_FILE))
    } catch {
      /* ignore */
    }
  }

  // 账号信息本地缓存：离线启动时仍能显示已登录账号
  private userCachePath(provider: AuthProvider): string {
    return userDataPath(provider === 'gitee' ? 'gitee-user.json' : 'github-user.json')
  }

  private saveCachedUser(provider: AuthProvider, user: AuthUser): void {
    try {
      fs.writeFileSync(this.userCachePath(provider), JSON.stringify(user), 'utf8')
    } catch {
      /* ignore */
    }
  }

  private loadCachedUser(provider: AuthProvider): AuthUser | null {
    try {
      const raw = fs.readFileSync(this.userCachePath(provider), 'utf8')
      const u = JSON.parse(raw) as AuthUser
      return u && typeof u.login === 'string' ? u : null
    } catch {
      return null
    }
  }

  private clearCachedUser(): void {
    for (const p of ['github', 'gitee'] as AuthProvider[]) {
      try {
        fs.rmSync(this.userCachePath(p))
      } catch {
        /* ignore */
      }
    }
  }

  /** 令牌校验结果：ok=有效；unauthorized=令牌被吊销；offline=网络不可达（绝不能当作令牌失效） */
  private async fetchGithubUser(
    token: string
  ): Promise<{ status: 'ok'; user: AuthUser } | { status: 'unauthorized' } | { status: 'offline' }> {
    try {
      const resp = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'NovaForge-Studio' },
        signal: AbortSignal.timeout(10_000)
      })
      if (resp.status === 401 || resp.status === 403) return { status: 'unauthorized' }
      if (!resp.ok) return { status: 'offline' }
      const u = (await resp.json()) as { login: string; name?: string | null; avatar_url: string; html_url: string }
      return {
        status: 'ok',
        user: { login: u.login, name: u.name ?? null, avatarUrl: u.avatar_url, htmlUrl: u.html_url }
      }
    } catch {
      return { status: 'offline' }
    }
  }

  private async fetchGiteeUser(
    token: string
  ): Promise<{ status: 'ok'; user: AuthUser } | { status: 'unauthorized' } | { status: 'offline' }> {
    try {
      const resp = await fetch(
        `https://gitee.com/api/v5/user?access_token=${encodeURIComponent(token)}`,
        { signal: AbortSignal.timeout(10_000) }
      )
      if (resp.status === 401 || resp.status === 403) return { status: 'unauthorized' }
      if (!resp.ok) return { status: 'offline' }
      const u = (await resp.json()) as { login: string; name?: string | null; avatar_url: string; html_url: string }
      return {
        status: 'ok',
        user: { login: u.login, name: u.name ?? null, avatarUrl: u.avatar_url, htmlUrl: u.html_url }
      }
    } catch {
      return { status: 'offline' }
    }
  }
}

export const authService = new AuthService()
