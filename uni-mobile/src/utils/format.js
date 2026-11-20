const TITLES = {
  on: '开',
  off: '关',
  unavailable: '离线',
  unknown: '未知',
  playing: '播放中',
  paused: '已暂停',
  idle: '待机',
  open: '开',
  opening: '正在开',
  closed: '关',
  closing: '正在关',
  locked: '已锁',
  unlocked: '未锁',
  home: '在家',
  not_home: '离家',
  heat: '制热',
  cool: '制冷',
  auto: '自动',
  dry: '除湿',
  fan_only: '送风'
}

const ON_STATES = ['on', 'open', 'unlocked', 'playing', 'heat', 'cool', 'auto', 'dry', 'fan_only']
const READONLY_DOMAINS = ['sensor', 'binary_sensor', 'device_tracker', 'person', 'weather']

const stateText = (v) => TITLES[v] || v

const isOn = (item) => ON_STATES.indexOf(item.state) >= 0

const isReadonly = (item) => READONLY_DOMAINS.indexOf(item.domain) >= 0

const iconOf = (item) => {
  switch (item.domain) {
    case 'light':
      return '💡'
    case 'climate':
      return '🌡️'
    case 'cover':
      return '🪟'
    case 'lock':
      return '🔒'
    case 'media_player':
      return '🎵'
    case 'sensor':
      return '📊'
    case 'fan':
      return '🌀'
    case 'vacuum':
      return '🧹'
    case 'person':
    case 'device_tracker':
      return '📍'
    default:
      return '🔌'
  }
}

const greeting = () => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 11) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
}

const normalizeUrl = (v) => {
  let s = String(v || '').trim().replace(/\/+$/, '')
  if (!s) return ''
  if (!/^https?:\/\//i.test(s)) s = 'http://' + s
  return s
}

const errText = (err) => {
  const msg = err && err.message ? err.message : String(err)
  if (/timeout|超时/i.test(msg)) return '连接超时，请检查 HA 地址是否可从手机访问'
  return '网络请求失败：' + msg
}

/** 把 HA 实体补充成视图模型，避免在模板里写复杂表达式 */
const toViewEntity = (item) => ({
  id: item.id,
  name: item.name,
  domain: item.domain,
  state: item.state,
  unit: item.unit || '',
  on: isOn(item),
  readonly: isReadonly(item),
  icon: iconOf(item),
  stateLabel: isReadonly(item) && item.unit ? item.state + item.unit : stateText(item.state)
})

export {
  stateText,
  isOn,
  isReadonly,
  iconOf,
  greeting,
  normalizeUrl,
  errText,
  toViewEntity,
  // 页面里沿用的别名，与上面两个函数等价
  toViewEntity as entityView,
  stateText as statusText
}
