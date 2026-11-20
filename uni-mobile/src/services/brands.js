/**
 * 全品牌生态注册表（开发版）。
 *
 * NovaForge 的设备来源最终要覆盖小米米家、华为鸿蒙智联、涂鸦、Matter 等主流生态。
 * 这里只做声明式登记：客户端据此展示接入状态与所需授权方式；
 * 真正的协议适配跑在 HA 扩展侧（custom_components/novaforge），
 * 客户端不直连厂商云，端侧不存放任何厂商 AppSecret。
 *
 * status: ready 已接入 / beta 内测中 / planned 规划中
 * auth:   openid 微信身份直连 / account_oauth 厂商账号授权 / pairing_code 配对码
 */

const BRANDS = [
  {
    key: 'ha_native',
    name: 'Home Assistant 原生',
    status: 'ready',
    priority: 0,
    auth: 'openid',
    note: '已支持：微信身份直连 HA，HA 里接入的设备小程序立即可用'
  },
  {
    key: 'matter',
    name: 'Matter / Thread',
    status: 'planned',
    priority: 1,
    auth: 'pairing_code',
    note: '跨品牌统一协议，一条链路覆盖多家，开发版优先落地'
  },
  {
    key: 'xiaomi',
    name: '小米米家',
    status: 'planned',
    priority: 2,
    auth: 'account_oauth',
    note: '米家账号授权后由 HA 侧同步设备列表'
  },
  {
    key: 'huawei',
    name: '华为鸿蒙智联',
    status: 'planned',
    priority: 3,
    auth: 'account_oauth',
    note: '鸿蒙智联授权，与手机端账号体系打通'
  },
  {
    key: 'tuya',
    name: '涂鸦智能',
    status: 'planned',
    priority: 4,
    auth: 'account_oauth',
    note: '覆盖大量白电 OEM，授权后可批量导入'
  },
  {
    key: 'homekit',
    name: 'Apple HomeKit',
    status: 'planned',
    priority: 5,
    auth: 'pairing_code',
    note: '经 HA 的 HomeKit Controller 反向接入'
  }
]

const STATUS_LABEL = {
  ready: '已接入',
  beta: '内测中',
  planned: '规划中'
}

const AUTH_LABEL = {
  openid: '微信身份',
  account_oauth: '账号授权',
  pairing_code: '配对码'
}

const list = () => BRANDS.slice().sort((a, b) => a.priority - b.priority)

const get = (key) => BRANDS.filter((item) => item.key === key)[0] || null

/** 供页面直接渲染的展示结构 */
const displayList = () =>
  list().map((item) => ({
    key: item.key,
    name: item.name,
    note: item.note,
    ready: item.status === 'ready',
    statusLabel: STATUS_LABEL[item.status] || item.status,
    authLabel: AUTH_LABEL[item.auth] || ''
  }))

const summary = () => ({
  total: BRANDS.length,
  ready: BRANDS.filter((item) => item.status === 'ready').length
})

export { list, get, summary, displayList, STATUS_LABEL }
