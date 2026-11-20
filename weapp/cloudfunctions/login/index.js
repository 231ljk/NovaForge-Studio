const cloud = require('wx-server-sdk')
const crypto = require('node:crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

/**
 * 微信身份 + 用户档案 + 家庭通讯录云函数（v2.1.0）。
 *
 * 统一响应契约：
 *   { ok, code, message, data, version }
 * 同时保留旧字段（openid / unionid / ts / sig / signed / homes）在响应顶层，
 * 老版本小程序即使不升级也能照常工作。
 *
 * action:
 *   whoami   默认。身份 + 签名 + 用户档案 + 家庭通讯录（一次调用拿全）
 *   profile  只读，返回脱敏用户档案
 *   homes    只读，返回已关联家庭列表
 *   bind     绑定或刷新一个家庭地址
 *   unbind   解除某个家庭的关联
 *   touch    配对成功/失败后刷新 lastUsedAt 与 failCount
 *
 * 安全：
 *   - 所有记录都以微信上下文里的 OPENID 为准，不接收客户端传来的 openid
 *   - 如果设置了环境变量 NF_ACCOUNT_SECRET，签发两套签名：
 *       ^ 旧格式 sig   = HMAC_SHA256(secret, `${openid}.${ts}`)        （向后兼容）
 *       ^ v1 格式 sigV1 = HMAC_SHA256(secret, `${openid}.${ts}.${appid}.${purpose}`)
 *     HA 侧优先按 sigVersion=1 校验 sigV1，失败再回落旧签名。
 */

const VERSION = '2.1.0'

const COLLECTION_BINDINGS = 'nf_home_bindings'
const COLLECTION_USERS = 'nf_users'

const MAX_HOMES = 12
const FAIL_DEMOTE = 3 // 失败次数达到该值后排序降级
const SIG_VERSION = 1
const SIG_PURPOSE = 'weapp-login'

const RATE_WINDOW_MS = 60 * 1000
const RATE_LIMITS = { whoami: 30, profile: 30, homes: 60, bind: 30, unbind: 30, touch: 90 }

const CODE = {
  OK: 'OK',
  NO_IDENTITY: 'NO_IDENTITY',
  CLOUD_UNAVAILABLE: 'CLOUD_UNAVAILABLE',
  INVALID_PARAM: 'INVALID_PARAM',
  RATE_LIMITED: 'RATE_LIMITED',
  HOME_LIMIT: 'HOME_LIMIT',
  UNSUPPORTED_ACTION: 'UNSUPPORTED_ACTION',
  INTERNAL: 'INTERNAL'
}

const MESSAGE = {
  NO_IDENTITY: '没有拿到微信身份，请重新打开小程序',
  CLOUD_UNAVAILABLE: '云端数据库暂时不可用，请稍后重试或直接填写家庭地址登录',
  INVALID_PARAM: '参数不合法',
  RATE_LIMITED: '操作太频繁，请稍后再试',
  HOME_LIMIT: '关联家庭数量已达上限（最多 ' + MAX_HOMES + ' 个），请先移除不再使用的一个',
  UNSUPPORTED_ACTION: '不支持的 action',
  INTERNAL: '云端处理失败，请稍后重试'
}

const okRes = (data, extra) => {
  const body = {
    ok: true,
    code: CODE.OK,
    message: '',
    version: VERSION,
    data: data || {}
  }
  return Object.assign(body, extra || {})
}

/** 失败响应：error 字段是给旧版本小程序读的，message 是新契约 */
const failRes = (code, message, extra) => {
  const text = message || MESSAGE[code] || MESSAGE.INTERNAL
  const body = {
    ok: false,
    code: code || CODE.INTERNAL,
    message: text,
    error: text,
    version: VERSION,
    data: null
  }
  return Object.assign(body, extra || {})
}

const normalizeUrl = (value) => String(value || '').trim().replace(/\/+$/, '')
const isHttpUrl = (url) => /^https?:\/\/[^\s/]+/i.test(url)

const maskOpenid = (openid) => {
  const value = String(openid || '')
  if (!value) return ''
  if (value.length <= 8) return value.slice(0, 2) + '****'
  return value.slice(0, 4) + '****' + value.slice(-4)
}

const maskUnionid = (unionid) => {
  const value = String(unionid || '')
  if (!value) return ''
  return value.slice(0, 4) + '****' + value.slice(-4)
}

// ---------------- 数据库 ----------------

const db = () => cloud.database()

const errText = (err) => String((err && (err.errMsg || err.message)) || '')

const isDbUnavailable = (err) => {
  const msg = errText(err)
  return /env|environment|database|collection|not exist|-502|权限|permission|DATABASE/i.test(msg)
}

const created = { [COLLECTION_BINDINGS]: false, [COLLECTION_USERS]: false }

/** 首次运行时尝试建集合；已存在或权限不足都静默跳过，不影响主流程 */
const ensureCollection = async (name) => {
  if (created[name]) return
  try {
    await db().createCollection(name)
  } catch (err) {
    // 集合已存在（或环境未开通自定义集合）时忽略
  }
  created[name] = true
}

// ---------------- 频率限制（实例内滑动窗口） ----------------

const hits = new Map()

const rateLimited = (openid, action) => {
  const limit = RATE_LIMITS[action]
  if (!limit) return false
  const key = openid + '|' + action
  const now = Date.now()
  const list = (hits.get(key) || []).filter((ts) => now - ts < RATE_WINDOW_MS)
  list.push(now)
  hits.set(key, list)
  if (hits.size > 500) {
    hits.forEach((value, k) => {
      if (!value.length || now - value[value.length - 1] > RATE_WINDOW_MS) hits.delete(k)
    })
  }
  return list.length > limit
}

// ---------------- 用户档案 ----------------

const ensureUser = async (identity) => {
  await ensureCollection(COLLECTION_USERS)
  const col = db().collection(COLLECTION_USERS)
  const now = Date.now()
  const patch = {
    unionid: identity.unionid || '',
    appid: identity.appid || '',
    lastLoginAt: now
  }

  let doc = null
  try {
    const found = await col.where({ openid: identity.openid }).limit(1).get()
    doc = (found.data && found.data[0]) || null
  } catch (err) {
    throw err
  }

  if (doc) {
    const update = Object.assign({}, patch, {
      loginCount: db().command.inc(1)
    })
    await col.doc(doc._id).update({ data: update })
    doc = Object.assign({}, doc, patch, { loginCount: (doc.loginCount || 0) + 1 })
  } else {
    const record = Object.assign(
      {
        openid: identity.openid,
        unionid: identity.unionid || '',
        appid: identity.appid || '',
        createdAt: now,
        lastLoginAt: now,
        loginCount: 1
      },
      patch
    )
    const added = await col.add({ data: record })
    record._id = (added && added._id) || ''
    doc = record
  }

  return {
    openidMasked: maskOpenid(doc.openid || identity.openid),
    unionidMasked: maskUnionid(doc.unionid || identity.unionid),
    appid: doc.appid || identity.appid || '',
    createdAt: doc.createdAt || 0,
    lastLoginAt: doc.lastLoginAt || 0,
    loginCount: doc.loginCount || 1
  }
}

const readUser = async (openid) => {
  await ensureCollection(COLLECTION_USERS)
  const col = db().collection(COLLECTION_USERS)
  const found = await col.where({ openid }).limit(1).get()
  const doc = (found.data && found.data[0]) || null
  if (!doc) return null
  return {
    openidMasked: maskOpenid(doc.openid),
    unionidMasked: maskUnionid(doc.unionid),
    appid: doc.appid || '',
    createdAt: doc.createdAt || 0,
    lastLoginAt: doc.lastLoginAt || 0,
    loginCount: doc.loginCount || 1
  }
}

// ---------------- 家庭通讯录 ----------------

/** 排序：最近用过优先，失败次数过多的降级到后面 */
const sortHomes = (list) =>
  list.slice().sort((a, b) => {
    const aBad = (a.failCount || 0) >= FAIL_DEMOTE ? 1 : 0
    const bBad = (b.failCount || 0) >= FAIL_DEMOTE ? 1 : 0
    if (aBad !== bBad) return aBad - bBad
    if ((b.lastUsedAt || 0) !== (a.lastUsedAt || 0)) return (b.lastUsedAt || 0) - (a.lastUsedAt || 0)
    return (a.failCount || 0) - (b.failCount || 0)
  })

const listHomes = async (openid) => {
  await ensureCollection(COLLECTION_BINDINGS)
  try {
    const res = await db()
      .collection(COLLECTION_BINDINGS)
      .where({ openid })
      .orderBy('lastUsedAt', 'desc')
      .limit(MAX_HOMES * 2)
      .get()
    const list = (res.data || [])
      .map((item) => ({
        haUrl: item.haUrl || '',
        haName: item.haName || '',
        provider: item.provider || 'wechat',
        boundAt: item.boundAt || 0,
        lastUsedAt: item.lastUsedAt || 0,
        failCount: item.failCount || 0
      }))
      .filter((item) => !!item.haUrl)
    return sortHomes(list)
  } catch (err) {
    // 集合不存在或还没开通云数据库：按「没有关联家庭」处理，客户端会回落到手填地址
    return []
  }
}

const bindHome = async (openid, event) => {
  const haUrl = normalizeUrl(event.haUrl)
  if (!haUrl) return failRes(CODE.INVALID_PARAM, '缺少家庭地址')
  if (!isHttpUrl(haUrl)) return failRes(CODE.INVALID_PARAM, '家庭地址格式不对，需要以 http:// 或 https:// 开头')

  await ensureCollection(COLLECTION_BINDINGS)
  const col = db().collection(COLLECTION_BINDINGS)
  const now = Date.now()
  const haName = String(event.haName || '').slice(0, 64)
  const provider = String(event.provider || 'wechat').slice(0, 16)

  let existing = []
  try {
    const found = await col.where({ openid, haUrl }).limit(1).get()
    existing = (found.data || []).slice(0, 1)
    if (!existing.length) {
      // 上限校验只在新绑定时做，刷新已有家庭不受影响
      const countRes = await col.where({ openid }).count()
      if ((countRes.total || 0) >= MAX_HOMES) {
        return failRes(CODE.HOME_LIMIT, undefined, { data: { limit: MAX_HOMES, homes: await listHomes(openid) } })
      }
    }
  } catch (err) {
    return failRes(CODE.CLOUD_UNAVAILABLE, MESSAGE.CLOUD_UNAVAILABLE + '（' + (errText(err) || '查询失败') + '）')
  }

  try {
    if (existing.length) {
      // upsert：同一个人同一个地址只保留一条，重复绑定只刷新时间
      const patch = { lastUsedAt: now, failCount: 0, provider }
      if (haName) patch.haName = haName
      await col.doc(existing[0]._id).update({ data: patch })
    } else {
      await col.add({
        data: { openid, haUrl, haName, provider, boundAt: now, lastUsedAt: now, failCount: 0 }
      })
    }
  } catch (err) {
    return failRes(CODE.CLOUD_UNAVAILABLE, '云端没有记住这个家庭：' + (errText(err) || '数据库写入失败'))
  }

  const homes = await listHomes(openid)
  return okRes({ homes }, { homes })
}

const unbindHome = async (openid, event) => {
  const haUrl = normalizeUrl(event.haUrl)
  if (!haUrl) return failRes(CODE.INVALID_PARAM, '缺少家庭地址')
  await ensureCollection(COLLECTION_BINDINGS)
  try {
    await db().collection(COLLECTION_BINDINGS).where({ openid, haUrl }).remove()
  } catch (err) {
    return failRes(CODE.CLOUD_UNAVAILABLE, '解除关联失败：' + (errText(err) || '数据库删除失败'))
  }
  const homes = await listHomes(openid)
  return okRes({ homes, removed: haUrl }, { homes })
}

const touchHome = async (openid, event) => {
  const haUrl = normalizeUrl(event.haUrl)
  if (!haUrl) return failRes(CODE.INVALID_PARAM, '缺少家庭地址')
  await ensureCollection(COLLECTION_BINDINGS)
  const now = Date.now()
  const success = event.ok !== false
  try {
    const col = db().collection(COLLECTION_BINDINGS)
    const found = await col.where({ openid, haUrl }).limit(1).get()
    const doc = (found.data && found.data[0]) || null
    if (!doc) return okRes({ skipped: true })
    await col.doc(doc._id).update({
      data: {
        lastUsedAt: success ? now : doc.lastUsedAt || 0,
        failCount: success ? 0 : (doc.failCount || 0) + 1,
        haName: String(event.haName || doc.haName || '').slice(0, 64)
      }
    })
  } catch (err) {
    return failRes(CODE.CLOUD_UNAVAILABLE, errText(err) || '刷新状态失败')
  }
  return okRes({ skipped: false })
}

// ---------------- 签名 ----------------

const buildSign = (openid, ts, appid) => {
  const secret = process.env.NF_ACCOUNT_SECRET || ''
  if (!secret) {
    return { sig: '', sigV1: '', signed: false, sigVersion: SIG_VERSION, purpose: SIG_PURPOSE }
  }
  const legacy = crypto.createHmac('sha256', secret).update(`${openid}.${ts}`).digest('hex')
  const v1 = crypto
    .createHmac('sha256', secret)
    .update(`${openid}.${ts}.${appid}.${SIG_PURPOSE}`)
    .digest('hex')
  return { sig: legacy, sigV1: v1, signed: true, sigVersion: SIG_VERSION, purpose: SIG_PURPOSE }
}

// ---------------- 入口 ----------------

exports.main = async (event) => {
  const ctx = cloud.getWXContext() || {}
  const openid = ctx.OPENID || ''
  if (!openid) return failRes(CODE.NO_IDENTITY)

  const evt = event || {}
  const action = String(evt.action || 'whoami')

  const KNOWN = ['whoami', 'profile', 'homes', 'bind', 'unbind', 'touch']
  if (KNOWN.indexOf(action) < 0) {
    // 未知 action 直接报错，不消耗配额
    return failRes(CODE.UNSUPPORTED_ACTION, '不支持的 action：' + action)
  }

  if (rateLimited(openid, action)) return failRes(CODE.RATE_LIMITED)

  const base = {
    openid,
    unionid: ctx.UNIONID || '',
    appid: ctx.APPID || ''
  }

  try {
    if (action === 'homes') {
      const homes = await listHomes(openid)
      return okRes({ homes }, base)
    }
    if (action === 'bind') {
      const res = await bindHome(openid, evt)
      return Object.assign(res, base)
    }
    if (action === 'unbind') {
      const res = await unbindHome(openid, evt)
      return Object.assign(res, base)
    }
    if (action === 'touch') {
      const res = await touchHome(openid, evt)
      return Object.assign(res, base)
    }
    if (action === 'profile') {
      let profile = null
      try {
        profile = await readUser(openid)
      } catch (err) {
        if (isDbUnavailable(err)) {
          return failRes(CODE.CLOUD_UNAVAILABLE, MESSAGE.CLOUD_UNAVAILABLE, base)
        }
        throw err
      }
      return okRes({ profile }, Object.assign({ profile }, base))
    }

    // ---- whoami：身份 + 档案 + 通讯录 ----
    const ts = Date.now()
    const sign = buildSign(openid, ts, base.appid)

    let profile = null
    let homes = []
    try {
      await ensureUser({ openid, unionid: base.unionid, appid: base.appid })
      profile = await readUser(openid)
      homes = await listHomes(openid)
    } catch (err) {
      if (isDbUnavailable(err)) {
        // 云端数据库没开通/暂不可用：降级为「只签发身份」，前端会自动回落 wx.login code 通道
        homes = []
        profile = null
      } else {
        console.error('[login] whoami db failed', err)
        homes = []
        profile = null
      }
    }

    const payload = Object.assign({}, base, {
      ts,
      sig: sign.sig,
      sigV1: sign.sigV1,
      sigVersion: sign.sigVersion,
      purpose: sign.purpose,
      signed: sign.signed,
      openidMasked: maskOpenid(openid),
      profile,
      homes
    })

    return okRes(payload, payload)
  } catch (err) {
    console.error('[login] unhandled error', err)
    if (isDbUnavailable(err)) return failRes(CODE.CLOUD_UNAVAILABLE, MESSAGE.CLOUD_UNAVAILABLE, base)
    return failRes(CODE.INTERNAL, (err && (err.message || err.errMsg)) || MESSAGE.INTERNAL, base)
  }
}
