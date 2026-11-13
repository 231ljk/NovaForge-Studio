/**
 * 邮箱账号体系（本地主账号）。
 *
 * 设计目标：一个邮箱账号统领所有端（电脑端软件 / 安卓 / 鸿蒙 / HA 集成），
 * 代码仓库账号（GitHub / Gitee）作为「绑定」挂到邮箱账号下，不再各自为政。
 *
 * 账号数据只保存在本机（userData/accounts.json），密码用 scrypt 加盐哈希，
 * 明文密码永不落盘、永不出本机。
 */

export type RepoProvider = 'github' | 'gitee'

export interface BoundRepo {
  provider: RepoProvider
  login: string
  name: string | null
  boundAt: number
}

export interface EmailAccount {
  id: string
  email: string
  name: string | null
  createdAt: number
  /** 已绑定的代码仓库账号 */
  repos: BoundRepo[]
  /** 绑定的手机 / 设备数量（统计用） */
  devices: number
}

export interface AccountState {
  phase: 'signedOut' | 'signedIn'
  account?: EmailAccount
  error?: string
}

export interface AuthResult {
  ok: boolean
  state: AccountState
  error?: string
}

/** 只用于渲染进程/手机端的公开字段（绝不含哈希） */
export interface PublicAccount {
  email: string
  name: string | null
}

/** 邮箱验证码用途：注册 / 登录 */
export type CodePurpose = 'register' | 'login'

export interface CodeResult {
  ok: boolean
  error?: string
  /** 重新获取验证码的冷却剩余秒数 */
  cooldown?: number
}
