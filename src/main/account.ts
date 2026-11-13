import { app, safeStorage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomBytes, randomInt, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import type {
  AccountState,
  AuthResult,
  BoundRepo,
  CodePurpose,
  CodeResult,
  EmailAccount,
  PublicAccount,
  RepoProvider,
} from '../shared/account'
import { sendMail } from './mailer'

/**
 * 邮箱账号服务：验证码注册 / 验证码登录 / 密码登录 / 登出 / 绑定代码仓库。
 *
 * 全部为本地实现（无需自建服务器）：
 *  - 注册必须通过发往真实邮箱的 6 位验证码，随便填的邮箱收不到码，无法注册；
 *  - 密码 scrypt(随机盐, N=16384) 哈希后落盘，明文不存；
 *  - 会话记录在 session.json，重启电脑仍保持登录；
 *  - 仓库令牌用 safeStorage（Windows DPAPI）加密后挂在账号下。
 *
 * 手机端通过局域网网关调用同一套账号，因此「邮箱登录 = 连接电脑」，
 * 不再需要输入 6 位配对码。
 */

const STORE_FILE = 'accounts.json'
const SESSION_FILE = 'session.json'
const MIN_PASSWORD = 6
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** 验证码有效期 30 秒（与客户端倒计时严格同步，倒计时结束即刻作废） */
const CODE_TTL_MS = 30 * 1000
/** 同一邮箱 30 秒内只能获取一次（冷却时间与有效期一致） */
const CODE_COOLDOWN_MS = 30 * 1000
/** 单个验证码最多尝试 5 次 */
const CODE_MAX_ATTEMPTS = 5

interface PendingCode {
  email: string
  purpose: CodePurpose
  hash: string
  expiresAt: number
  sentAt: number
  attempts: number
}

interface StoredUser {
  id: string
  email: string
  name: string | null
  salt: string
  hash: string
  createdAt: number
  repos: BoundRepo[]
  /** provider -> safeStorage 加密后的令牌（base64） */
  repoTokens: Partial<Record<RepoProvider, string>>
}

interface Store {
  users: StoredUser[]
}

function dataPath(file: string): string {
  return path.join(app.getPath('userData'), file)
}

function readStore(): Store {
  try {
    const raw = fs.readFileSync(dataPath(STORE_FILE), 'utf8')
    const parsed = JSON.parse(raw) as Store
    return Array.isArray(parsed.users) ? parsed : { users: [] }
  } catch {
    return { users: [] }
  }
}

function writeStore(store: Store): void {
  fs.writeFileSync(dataPath(STORE_FILE), JSON.stringify(store, null, 2), 'utf8')
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 }).toString('hex')
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** 验证码只存哈希，避免明文落内存快照 */
function hashCode(email: string, code: string): string {
  return createHash('sha256').update(`${email}:${code.trim()}`).digest('hex')
}

function fail(error: string): AuthResult {
  return { ok: false, state: { phase: 'signedOut' }, error }
}

function toPublic(user: StoredUser): EmailAccount {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    repos: user.repos,
    devices: 0,
  }
}

export class AccountService {
  private currentUserId: string | null = null
  /** 待校验的验证码：key = `${purpose}:${email}` */
  private codes = new Map<string, PendingCode>()

  constructor() {
    this.currentUserId = this.readSession()
  }

  status(): AccountState {
    if (!this.currentUserId) return { phase: 'signedOut' }
    const user = readStore().users.find((u) => u.id === this.currentUserId)
    if (!user) {
      this.currentUserId = null
      this.writeSession(null)
      return { phase: 'signedOut' }
    }
    return { phase: 'signedIn', account: toPublic(user) }
  }

  /**
   * 账号清单，供手机端把本机账号库与电脑对齐。
   * 只暴露邮箱与昵称，不含密码哈希、验证码等任何敏感字段。
   */
  list(): PublicAccount[] {
    return readStore().users.map((u) => ({ email: u.email, name: u.name }))
  }

  /**
   * 发送邮箱验证码。只有真实可收信的邮箱才能拿到验证码，从而完成注册/登录。
   */
  async requestCode(email: string, purpose: CodePurpose): Promise<CodeResult> {
    const mail = normalizeEmail(email)
    if (!EMAIL_RE.test(mail)) return { ok: false, error: '邮箱格式不正确' }
    const exists = readStore().users.some((u) => u.email === mail)
    if (purpose === 'register' && exists) return { ok: false, error: '该邮箱已注册，请直接登录' }
    if (purpose === 'login' && !exists) return { ok: false, error: '该邮箱尚未注册' }

    const key = `${purpose}:${mail}`
    const prev = this.codes.get(key)
    const now = Date.now()
    if (prev && now - prev.sentAt < CODE_COOLDOWN_MS) {
      const left = Math.ceil((CODE_COOLDOWN_MS - (now - prev.sentAt)) / 1000)
      return { ok: false, error: `请 ${left} 秒后再获取验证码`, cooldown: left }
    }
    const code = String(randomInt(100000, 1000000))
    try {
      await sendMail(
        mail,
        `NovaForge 验证码 ${code}`,
        [
          `你的 NovaForge 验证码是：${code}`,
          '',
          `${CODE_TTL_MS / 1000} 秒内有效，过期自动作废，请立即填写。`,
          '如果这不是你本人的操作，请忽略本邮件。',
        ].join('\n')
      )
    } catch (err) {
      return { ok: false, error: `验证码发送失败：${err instanceof Error ? err.message : String(err)}` }
    }

    this.codes.set(key, {
      email: mail,
      purpose,
      hash: hashCode(mail, code),
      expiresAt: now + CODE_TTL_MS,
      sentAt: now,
      attempts: 0,
    })
    return { ok: true }
  }

  /** 注册：必须先收到发往该邮箱的验证码，密码可选（留空则只能用验证码登录） */
  register(email: string, code: string, name?: string, password?: string): AuthResult {
    const mail = normalizeEmail(email)
    if (!EMAIL_RE.test(mail)) return fail('邮箱格式不正确')
    if (!/^\d{6}$/.test((code ?? '').trim())) return fail('请输入 6 位数字验证码')
    const pwd = (password ?? '').trim()
    if (pwd && pwd.length < MIN_PASSWORD) return fail(`密码至少 ${MIN_PASSWORD} 位`)

    const store = readStore()
    if (store.users.some((u) => u.email === mail)) return fail('该邮箱已注册，请直接登录')
    const codeErr = this.checkCode(mail, 'register', code)
    if (codeErr) return fail(codeErr)

    // 未设密码时写入随机密码，避免空密码可登录
    const effective = pwd || randomBytes(24).toString('hex')
    const salt = randomBytes(16).toString('hex')
    const user: StoredUser = {
      id: randomUUID(),
      email: mail,
      name: name?.trim() || mail.split('@')[0],
      salt,
      hash: hashPassword(effective, salt),
      createdAt: Date.now(),
      repos: [],
      repoTokens: {},
    }
    store.users.push(user)
    writeStore(store)
    this.currentUserId = user.id
    this.writeSession(user.id)
    return { ok: true, state: { phase: 'signedIn', account: toPublic(user) } }
  }

  /** 验证码登录（电脑端） */
  loginWithCode(email: string, code: string): AuthResult {
    const mail = normalizeEmail(email)
    if (!EMAIL_RE.test(mail)) return fail('邮箱格式不正确')
    const user = readStore().users.find((u) => u.email === mail)
    if (!user) return fail('该邮箱尚未注册')
    const codeErr = this.checkCode(mail, 'login', code)
    if (codeErr) return fail(codeErr)
    this.currentUserId = user.id
    this.writeSession(user.id)
    return { ok: true, state: { phase: 'signedIn', account: toPublic(user) } }
  }

  login(email: string, password: string): AuthResult {
    const mail = normalizeEmail(email)
    const store = readStore()
    const user = store.users.find((u) => u.email === mail)
    // 统一错误文案，避免枚举已注册邮箱
    const fail: AuthResult = {
      ok: false,
      state: { phase: 'signedOut' },
      error: '邮箱或密码不正确',
    }
    if (!user) return fail
    const actual = Buffer.from(hashPassword(password, user.salt), 'hex')
    const expected = Buffer.from(user.hash, 'hex')
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return fail
    this.currentUserId = user.id
    this.writeSession(user.id)
    return { ok: true, state: { phase: 'signedIn', account: toPublic(user) } }
  }

  logout(): AccountState {
    this.currentUserId = null
    this.writeSession(null)
    return { phase: 'signedOut' }
  }

  /** 手机端登录：只校验，不改动电脑端当前登录态 */
  verify(email: string, password: string): { ok: boolean; account?: EmailAccount; error?: string } {
    const mail = normalizeEmail(email)
    const user = readStore().users.find((u) => u.email === mail)
    if (!user) return { ok: false, error: '邮箱或密码不正确' }
    const actual = Buffer.from(hashPassword(password, user.salt), 'hex')
    const expected = Buffer.from(user.hash, 'hex')
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      return { ok: false, error: '邮箱或密码不正确' }
    }
    return { ok: true, account: toPublic(user) }
  }

  /** 手机端注册：同样必须提供邮箱验证码 */
  registerFromDevice(
    email: string,
    code: string,
    name?: string,
    password?: string
  ): { ok: boolean; error?: string } {
    const res = this.register(email, code, name, password)
    return { ok: res.ok, error: res.error }
  }

  /** 手机端验证码登录：只校验，不改动电脑端当前登录态 */
  verifyByCode(email: string, code: string): { ok: boolean; account?: EmailAccount; error?: string } {
    const mail = normalizeEmail(email)
    const user = readStore().users.find((u) => u.email === mail)
    if (!user) return { ok: false, error: '该邮箱尚未注册' }
    const codeErr = this.checkCode(mail, 'login', code)
    if (codeErr) return { ok: false, error: codeErr }
    return { ok: true, account: toPublic(user) }
  }

  // —— 代码仓库绑定 ——

  bindRepo(provider: RepoProvider, login: string, displayName: string | null, token: string): AccountState {
    const store = readStore()
    const user = store.users.find((u) => u.id === this.currentUserId)
    if (!user) return { phase: 'signedOut', error: '请先登录邮箱账号' }
    const repo: BoundRepo = { provider, login, name: displayName, boundAt: Date.now() }
    user.repos = user.repos.filter((r) => r.provider !== provider).concat(repo)
    user.repoTokens[provider] = this.encrypt(token)
    writeStore(store)
    return { phase: 'signedIn', account: toPublic(user) }
  }

  unbindRepo(provider: RepoProvider): AccountState {
    const store = readStore()
    const user = store.users.find((u) => u.id === this.currentUserId)
    if (!user) return { phase: 'signedOut' }
    user.repos = user.repos.filter((r) => r.provider !== provider)
    delete user.repoTokens[provider]
    writeStore(store)
    return { phase: 'signedIn', account: toPublic(user) }
  }

  repoToken(provider: RepoProvider): string | null {
    if (!this.currentUserId) return null
    const user = readStore().users.find((u) => u.id === this.currentUserId)
    const enc = user?.repoTokens?.[provider]
    return enc ? this.decrypt(enc) : null
  }

  hasAccount(email: string): boolean {
    return readStore().users.some((u) => u.email === normalizeEmail(email))
  }

  // —— 内部 ——

  /** 校验并消费验证码；返回错误文案，null 表示通过 */
  private checkCode(email: string, purpose: CodePurpose, rawCode: string): string | null {
    const key = `${purpose}:${email}`
    const entry = this.codes.get(key)
    if (!entry) return '请先获取验证码'
    if (Date.now() > entry.expiresAt) {
      this.codes.delete(key)
      return '验证码已过期，请重新获取'
    }
    if (entry.attempts >= CODE_MAX_ATTEMPTS) {
      this.codes.delete(key)
      return '验证码尝试次数过多，请重新获取'
    }
    const actual = Buffer.from(hashCode(email, rawCode ?? ''), 'hex')
    const expected = Buffer.from(entry.hash, 'hex')
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      entry.attempts += 1
      return '验证码不正确'
    }
    this.codes.delete(key)
    return null
  }

  private encrypt(value: string): string {
    const buf = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(value)
      : Buffer.from(value, 'utf8')
    return buf.toString('base64')
  }

  private decrypt(value: string): string | null {
    try {
      const buf = Buffer.from(value, 'base64')
      return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buf) : buf.toString('utf8')
    } catch {
      return null
    }
  }

  private readSession(): string | null {
    try {
      const raw = JSON.parse(fs.readFileSync(dataPath(SESSION_FILE), 'utf8')) as { userId?: string }
      return raw.userId ?? null
    } catch {
      return null
    }
  }

  private writeSession(userId: string | null): void {
    try {
      if (!userId) {
        fs.rmSync(dataPath(SESSION_FILE), { force: true })
        return
      }
      fs.writeFileSync(dataPath(SESSION_FILE), JSON.stringify({ userId }), 'utf8')
    } catch {
      /* ignore */
    }
  }
}

export const accountService = new AccountService()
