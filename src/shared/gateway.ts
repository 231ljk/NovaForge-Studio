/** 手机（安卓 / 未来鸿蒙）与电脑端之间的局域网网关协议 */

export interface GatewayStatus {
  running: boolean
  port: number
  /** 本机局域网地址，手机填入 地址:端口 */
  addresses: string[]
  /** 当前配对码（6 位），过期为短横线 */
  code: string
  codeExpiresAt: number
  /** 已配对的手机数量 */
  paired: number
  error?: string
}

/** 渲染进程推送给网关的项目快照（手机端编译用） */
export interface GatewayProject {
  id: string
  name: string
  boardId: string
  code: string
  pinLabels: { label: string; gpio: number; mode: string }[]
}

export interface GatewaySnapshots {
  projects: GatewayProject[]
  activeProjectId: string | null
  /** 当前桌面端登录账号（手机端共享同一账号） */
  account: { provider: string; login: string; name: string | null } | null
}

export interface GatewayPairResult {
  ok: boolean
  token?: string
  account?: { provider: string; login: string; name: string | null } | null
  error?: string
}
