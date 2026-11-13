import { app } from 'electron'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { getBoard } from '../shared/boards'
import type { BuildRequest, ProgressEvent } from '../shared/types'
import type { GatewayPairResult, GatewaySnapshots, GatewayStatus } from '../shared/gateway'
import { aiService } from './ai'
import type { AuthService } from './auth'
import type { AccountService } from './account'
import type { ToolchainService } from './toolchain'

/**
 * 局域网网关：把桌面端能力（AI 助手、编译/烧录、项目、HA 代理、账号）
 * 以带令牌的 HTTP + SSE 接口开放给同一 Wi-Fi 下的手机 APP。
 *
 * 鉴权模型：
 *  - 电脑端生成 6 位配对码（10 分钟有效），手机用码换取长效令牌；
 *  - 之后所有请求带 Authorization: Bearer <token>（SSE 用 ?token= 查询参数）；
 *  - 令牌落盘（gateway.json），换手机/重装电脑前都可复用；
 *  - 手机解除配对即吊销自己的令牌。
 *  - 账号不另建体系：手机配对后共享电脑端已登录的 Gitee/GitHub 账号。
 */

const GATEWAY_FILE = 'gateway.json'
const GATEWAY_PORT = 18700
const CODE_TTL_MS = 10 * 60 * 1000
const MAX_BODY = 2 * 1024 * 1024

interface TokenRecord {
  token: string
  name: string
  createdAt: number
}

interface GatewayStore {
  tokens: TokenRecord[]
}

function readStore(): GatewayStore {
  try {
    const raw = fs.readFileSync(path.join(app.getPath('userData'), GATEWAY_FILE), 'utf8')
    const parsed = JSON.parse(raw) as GatewayStore
    return Array.isArray(parsed.tokens) ? parsed : { tokens: [] }
  } catch {
    return { tokens: [] }
  }
}

function writeStore(store: GatewayStore): void {
  try {
    fs.writeFileSync(path.join(app.getPath('userData'), GATEWAY_FILE), JSON.stringify(store, null, 2))
  } catch {
    /* ignore */
  }
}

function lanAddresses(): string[] {
  const out: string[] = []
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const a of entries ?? []) {
      if (a.family === 'IPv4' && !a.internal) out.push(a.address)
    }
  }
  return out
}

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase()
  if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local')) return true
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) return false
  const [a, b] = [Number(m[1]), Number(m[2])]
  return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || a === 127
}

export class GatewayService {
  private toolchain: ToolchainService
  private auth: AuthService
  private accounts: AccountService
  private server: http.Server | null = null
  private port = 0
  private store: GatewayStore = readStore()
  private snapshot: GatewaySnapshots = { projects: [], activeProjectId: null, account: null }
  private code = ''
  private codeUntil = 0
  private sseClients = new Set<http.ServerResponse>()
  private heartbeat: NodeJS.Timeout | null = null
  private lastError = ''
  /** 手机端编译成功后，烧录需要复用同一次编译的 sketch 目录 */
  private lastSketch = new Map<string, { sketchPath: string; fqbn: string }>()
  /** 登录失败限流：同一 IP 每分钟最多 8 次，防止局域网内暴力破解 */
  private authAttempts = new Map<string, { count: number; resetAt: number }>()

  constructor(toolchain: ToolchainService, auth: AuthService, accounts: AccountService) {
    this.toolchain = toolchain
    this.auth = auth
    this.accounts = accounts
  }

  // —— 生命周期 ——

  async start(): Promise<GatewayStatus> {
    if (this.server) return this.status()
    this.regenerateCode()
    const server = http.createServer((req, res) => void this.handle(req, res))
    this.server = server
    this.lastError = ''
    const listen = (port: number): Promise<number> =>
      new Promise<number>((resolve, reject) => {
        const onError = (err: NodeJS.ErrnoException): void => {
          server.removeListener('listening', onListening)
          reject(err)
        }
        const onListening = (): void => {
          server.removeListener('error', onError)
          const addr = server.address()
          resolve(typeof addr === 'object' && addr ? addr.port : port)
        }
        server.once('error', onError)
        server.once('listening', onListening)
        server.listen(port, '0.0.0.0')
      })

    // 固定端口被占用时向后顺延，保证任何机器都能起来
    let bound = 0
    for (let i = 0; i < 10; i++) {
      try {
        bound = await listen(GATEWAY_PORT + i)
        break
      } catch (err) {
        const e = err as NodeJS.ErrnoException
        if (e.code !== 'EADDRINUSE') {
          this.lastError = String(err)
          break
        }
      }
    }
    if (!bound) {
      this.server = null
      server.close()
      return this.status()
    }
    this.port = bound
    this.heartbeat = setInterval(() => this.broadcast({ type: 'ping', at: Date.now() }), 25_000)
    return this.status()
  }

  stop(): void {
    if (this.heartbeat) clearInterval(this.heartbeat)
    this.heartbeat = null
    for (const res of this.sseClients) {
      try {
        res.end()
      } catch {
        /* ignore */
      }
    }
    this.sseClients.clear()
    if (this.server) {
      this.server.closeAllConnections?.()
      this.server.close()
      this.server = null
    }
    this.port = 0
  }

  status(): GatewayStatus {
    return {
      running: !!this.server,
      port: this.port,
      addresses: lanAddresses(),
      code: Date.now() < this.codeUntil ? this.code : '',
      codeExpiresAt: this.codeUntil,
      paired: this.store.tokens.length,
      error: this.lastError || undefined,
    }
  }

  regenerateCode(): GatewayStatus['code'] {
    this.code = String(Math.floor(100000 + Math.random() * 900000))
    this.codeUntil = Date.now() + CODE_TTL_MS
    return this.code
  }

  /** 渲染进程推送项目/账号快照 */
  publish(payload: GatewaySnapshots): void {
    this.snapshot = {
      projects: Array.isArray(payload.projects) ? payload.projects : [],
      activeProjectId: payload.activeProjectId ?? null,
      account: payload.account ?? null,
    }
  }

  /** 编译进度推送到所有已连接手机 */
  broadcastProgress(e: ProgressEvent): void {
    this.broadcast({ type: 'progress', scope: e.scope, line: e.line, percent: e.percent })
  }

  // —— HTTP ——

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    if (req.method === 'OPTIONS') {
      res.writeHead(204).end()
      return
    }

    const send = (status: number, body: unknown): void => {
      const text = typeof body === 'string' ? body : JSON.stringify(body)
      res.writeHead(status, {
        'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
      })
      res.end(text)
    }

    try {
      if (url.pathname === '/api/info') {
        send(200, {
          ok: true,
          app: 'NovaForge Studio',
          version: app.getVersion(),
          platform: process.platform,
          paired: this.store.tokens.length > 0,
          requiresPair: !this.hasToken(url, req),
        })
        return
      }
      // —— 邮箱验证码 ——
      if (url.pathname === '/api/auth/request-code' && req.method === 'POST') {
        const ip = req.socket.remoteAddress || 'unknown'
        if (this.tooManyAttempts(ip)) {
          send(429, { ok: false, error: '尝试次数过多，请 1 分钟后再试' })
          return
        }
        const body = await this.readJson<{ email?: string; purpose?: string }>(req)
        const purpose = body?.purpose === 'register' ? 'register' : 'login'
        const res = await this.accounts.requestCode((body?.email ?? '').trim(), purpose)
        if (!res.ok) this.recordAttempt(ip)
        send(res.ok ? 200 : 400, res)
        return
      }

      // —— 邮箱账号登录（推荐）：登录成功即获得令牌，无需配对码 ——
      if (
        (url.pathname === '/api/auth/login' ||
          url.pathname === '/api/auth/login-code' ||
          url.pathname === '/api/auth/register') &&
        req.method === 'POST'
      ) {
        const ip = req.socket.remoteAddress || 'unknown'
        if (this.tooManyAttempts(ip)) {
          send(429, { ok: false, error: '尝试次数过多，请 1 分钟后再试' })
          return
        }
        const body = await this.readJson<{
          email?: string
          password?: string
          code?: string
          name?: string
        }>(req)
        const email = (body?.email ?? '').trim()
        if (!email) {
          send(400, { ok: false, error: '请填写邮箱' })
          return
        }
        let account: { email: string; name: string | null } | null = null
        if (url.pathname === '/api/auth/register') {
          const reg = this.accounts.registerFromDevice(email, body?.code ?? '', body?.name, body?.password)
          if (!reg.ok) {
            this.recordAttempt(ip)
            send(400, { ok: false, error: reg.error || '注册失败' })
            return
          }
          account = { email, name: body?.name || null }
        } else if (url.pathname === '/api/auth/login-code') {
          const verified = this.accounts.verifyByCode(email, body?.code ?? '')
          if (!verified.ok || !verified.account) {
            this.recordAttempt(ip)
            send(403, { ok: false, error: verified.error || '验证码不正确' })
            return
          }
          account = { email: verified.account.email, name: verified.account.name }
          this.authAttempts.delete(ip)
        } else {
          const verified = this.accounts.verify(email, body?.password ?? '')
          if (!verified.ok || !verified.account) {
            this.recordAttempt(ip)
            send(403, { ok: false, error: verified.error || '邮箱或密码不正确' })
            return
          }
          account = { email: verified.account.email, name: verified.account.name }
          this.authAttempts.delete(ip)
        }
        const token = randomBytes(24).toString('hex')
        this.store.tokens.push({ token, name: `手机 ${account.email}`, createdAt: Date.now() })
        writeStore(this.store)
        send(200, { ok: true, token, account })
        return
      }

      if (url.pathname === '/api/pair' && req.method === 'POST') {
        const body = await this.readJson<{ code?: string; name?: string }>(req)
        if (!body?.code || body.code !== this.code || Date.now() > this.codeUntil) {
          send(403, { ok: false, error: '配对码错误或已过期，请在电脑端重新生成' })
          return
        }
        const token = randomBytes(24).toString('hex')
        this.store.tokens.push({
          token,
          name: (body.name || '手机').slice(0, 40),
          createdAt: Date.now(),
        })
        writeStore(this.store)
        const account = await this.currentAccount()
        this.regenerateCode()
        const result: GatewayPairResult = { ok: true, token, account }
        send(200, result)
        return
      }

      if (!this.hasToken(url, req)) {
        send(401, { ok: false, error: '未配对或令牌失效，请在手机端重新配对' })
        return
      }

      if (url.pathname === '/api/unpair' && req.method === 'DELETE') {
        const token = this.extractToken(url, req)
        this.store.tokens = this.store.tokens.filter((t) => t.token !== token)
        writeStore(this.store)
        send(200, { ok: true })
        return
      }

      if (url.pathname === '/api/events') {
        this.openSse(req, res)
        return
      }

      // 手机端同步账号清单（不含任何密码哈希）
      if (url.pathname === '/api/account/list') {
        send(200, { ok: true, accounts: this.accounts.list() })
        return
      }

      if (url.pathname === '/api/account') {
        const email = this.accounts.status()
        const repoState = await this.auth.status()
        send(200, {
          ok: true,
          account: email.phase === 'signedIn' ? email.account : null,
          repo:
            repoState.phase === 'authorized' && repoState.user
              ? { provider: repoState.provider ?? 'github', login: repoState.user.login, name: repoState.user.name }
              : null,
        })
        return
      }

      if (url.pathname === '/api/projects') {
        send(200, { ok: true, ...this.snapshot })
        return
      }

      if (url.pathname === '/api/toolchain') {
        send(200, { ok: true, status: await this.toolchain.status() })
        return
      }

      if (url.pathname === '/api/ports') {
        send(200, { ok: true, ports: await this.toolchain.listPorts() })
        return
      }

      if (url.pathname === '/api/build' && req.method === 'POST') {
        const body = await this.readJson<{ projectId?: string }>(req)
        const project = this.snapshot.projects.find((p) => p.id === body?.projectId)
        if (!project) {
          send(404, { ok: false, error: '电脑端没有这个项目，请先在电脑上创建' })
          return
        }
        const reqBuild = this.toBuildRequest(project)
        if (!reqBuild.fqbn) {
          send(400, { ok: false, error: '项目开发板未配置 FQBN，无法编译' })
          return
        }
        const result = await this.toolchain.build(reqBuild)
        if (result.success) {
          this.lastSketch.set(project.id, { sketchPath: result.sketchPath, fqbn: reqBuild.fqbn })
        }
        // 固件二进制体积大，手机端只要结果与日志
        send(200, {
          ok: result.success,
          success: result.success,
          output: result.output.slice(-8000),
          durationMs: result.durationMs,
          artifacts: result.artifacts.map((a) => ({ name: a.name, size: a.size })),
        })
        return
      }

      // 手机端一键烧录：复用电脑上刚刚编译好的固件
      if (url.pathname === '/api/upload' && req.method === 'POST') {
        const body = await this.readJson<{ projectId?: string; port?: string }>(req)
        const cached = body?.projectId ? this.lastSketch.get(body.projectId) : undefined
        if (!cached) {
          send(400, { ok: false, error: '请先在手机上编译成功，再执行烧录' })
          return
        }
        if (!body?.port) {
          send(400, { ok: false, error: '请选择电脑上连接的串口' })
          return
        }
        const up = await this.toolchain.avrdudeUpload({
          port: body.port,
          fqbn: cached.fqbn,
          sketchDir: cached.sketchPath,
        })
        send(200, { ok: up.ok, log: up.log.slice(-8000) })
        return
      }

      if (url.pathname === '/api/ai/status') {
        send(200, { ok: true, status: aiService.status() })
        return
      }
      if (url.pathname === '/api/ai/start' && req.method === 'POST') {
        const status = await aiService.start(this.aiCfg())
        this.broadcast({ type: 'ai', status })
        send(200, { ok: status.state === 'running', status })
        return
      }
      if (url.pathname === '/api/ai/stop' && req.method === 'POST') {
        const status = await aiService.stop()
        this.broadcast({ type: 'ai', status })
        send(200, { ok: true, status })
        return
      }
      if (url.pathname === '/api/ai/chat' && req.method === 'POST') {
        const body = await this.readJson<{ messages?: { role: string; content: string }[] }>(req)
        const messages = (body?.messages ?? []).filter(
          (m) => ['system', 'user', 'assistant'].includes(m.role) && typeof m.content === 'string',
        ) as { role: 'system' | 'user' | 'assistant'; content: string }[]
        if (messages.length === 0) {
          send(400, { ok: false, error: '消息为空' })
          return
        }
        const result = await aiService.chat(messages.slice(-24), this.aiCfg())
        send(200, result)
        return
      }

      // HA 代理：手机不在同一网段时，经电脑转发到内网 HA（仅允许私网地址）
      if (url.pathname === '/api/ha/proxy' && req.method === 'POST') {
        const body = await this.readJson<{
          url?: string
          method?: string
          headers?: Record<string, string>
          body?: string
        }>(req)
        let target: URL
        try {
          target = new URL(body?.url ?? '')
        } catch {
          send(400, { ok: false, error: 'HA 地址无效' })
          return
        }
        if (!/^http(s)?:/.test(target.protocol) || !isPrivateHost(target.hostname)) {
          send(403, { ok: false, error: '只允许访问内网 / 本地 HA 地址' })
          return
        }
        try {
          const r = await fetch(target, {
            method: (body?.method ?? 'GET').toUpperCase(),
            headers: body?.headers ?? {},
            body: body?.method && body.method.toUpperCase() !== 'GET' ? body?.body : undefined,
            signal: AbortSignal.timeout(12_000),
          })
          send(200, { ok: r.ok, status: r.status, body: await r.text() })
        } catch (err) {
          send(200, { ok: false, status: 0, body: '', error: String(err) })
        }
        return
      }

      send(404, { ok: false, error: '未知接口' })
    } catch (err) {
      send(500, { ok: false, error: String(err) })
    }
  }

  // —— 工具方法 ——

  private tooManyAttempts(ip: string): boolean {
    const rec = this.authAttempts.get(ip)
    if (!rec) return false
    if (Date.now() > rec.resetAt) {
      this.authAttempts.delete(ip)
      return false
    }
    return rec.count >= 8
  }

  private recordAttempt(ip: string): void {
    const rec = this.authAttempts.get(ip)
    if (!rec || Date.now() > rec.resetAt) {
      this.authAttempts.set(ip, { count: 1, resetAt: Date.now() + 60_000 })
      return
    }
    rec.count += 1
  }

  private aiCfg(): { server?: string; model?: string } {
    try {
      const raw = fs.readFileSync(path.join(app.getPath('userData'), 'ai-config.json'), 'utf8')
      return JSON.parse(raw) as { server?: string; model?: string }
    } catch {
      return {}
    }
  }

  private toBuildRequest(project: GatewaySnapshots['projects'][number]): BuildRequest {
    const board = getBoard(project.boardId)
    return {
      projectId: project.id,
      projectName: project.name,
      fqbn: board?.fqbn ?? '',
      coreIds: board?.coreId ? [board.coreId] : [],
      code: project.code,
    }
  }

  private async currentAccount(): Promise<GatewaySnapshots['account']> {
    if (this.snapshot.account) return this.snapshot.account
    const state = await this.auth.status()
    if (state.phase === 'authorized' && state.user) {
      return { provider: state.provider ?? 'github', login: state.user.login, name: state.user.name }
    }
    return null
  }

  private extractToken(url: URL, req: http.IncomingMessage): string {
    const header = req.headers.authorization
    if (header && header.startsWith('Bearer ')) return header.slice(7).trim()
    return url.searchParams.get('token') ?? ''
  }

  private hasToken(url: URL, req: http.IncomingMessage): boolean {
    const token = this.extractToken(url, req)
    return !!token && this.store.tokens.some((t) => t.token === token)
  }

  private readJson<T>(req: http.IncomingMessage): Promise<T | null> {
    return new Promise<T | null>((resolve) => {
      let size = 0
      let raw = ''
      req.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > MAX_BODY) {
          req.destroy()
          resolve(null)
          return
        }
        raw += chunk.toString('utf8')
      })
      req.on('end', () => {
        if (!raw) {
          resolve({} as T)
          return
        }
        try {
          resolve(JSON.parse(raw) as T)
        } catch {
          resolve(null)
        }
      })
      req.on('error', () => resolve(null))
    })
  }

  private openSse(req: http.IncomingMessage, res: http.ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    })
    res.write(`data: ${JSON.stringify({ type: 'hello', at: Date.now() })}\n\n`)
    this.sseClients.add(res)
    req.on('close', () => {
      this.sseClients.delete(res)
    })
  }

  private broadcast(payload: Record<string, unknown>): void {
    const line = `data: ${JSON.stringify(payload)}\n\n`
    for (const res of this.sseClients) {
      try {
        res.write(line)
      } catch {
        this.sseClients.delete(res)
      }
    }
  }
}
