/**
 * GitHub 账号体系（Device Flow，不自建密码）。
 *
 * 登录后拿到的账号身份在桌面端 / HA 集成 / 安卓 APP / AI 助手中互通；
 * 设备绑定 owner 账号（后续的授权校验都以 GitHub login 为准）。
 */

/**
 * GitHub OAuth App 的 client_id。
 * 去 https://github.com/settings/developers 新建一个 OAuth App，
 * 把 Client ID 填到这里（Homepage 随意，Callback URL 填 http://localhost，
 * 勾选 Enable Device Flow（若有该选项））。
 */
export const GITHUB_CLIENT_ID = 'Ov23liGYZuxISGkahFRw'

/** 请求的权限：读取用户身份 + gist（设备绑定关系用 Gist 做无服务器注册表） */
export const GITHUB_SCOPES = 'read:user gist'

export interface AuthUser {
  login: string
  name: string | null
  avatarUrl: string
  htmlUrl: string
}

export type AuthPhase = 'idle' | 'waiting' | 'authorized' | 'error'
export type AuthProvider = 'github' | 'gitee'

export interface AuthState {
  phase: AuthPhase
  /** 当前登录/正在登录的渠道 */
  provider?: AuthProvider
  user?: AuthUser
  /** GitHub 授权页显示的一次性用户码，如 DBCD-1234 */
  userCode?: string
  /** https://github.com/login/device */
  verificationUri?: string
  error?: string
}
