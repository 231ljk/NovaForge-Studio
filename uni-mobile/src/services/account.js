import { API_BASE, USE_MOCK } from './config'

const SESSION_KEY = 'nf-session'
const mockCodes = {}

const request = (path, data) =>
  new Promise((resolve, reject) => {
    uni.request({
      url: API_BASE + path,
      method: 'POST',
      data,
      header: { 'content-type': 'application/json' },
      timeout: 15000,
      success: (res) => {
        const body = res.data || {}
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(body)
        else reject(new Error(body.message || '请求失败（' + res.statusCode + '）'))
      },
      fail: () => reject(new Error('网络连接失败，请检查后端地址'))
    })
  })

const uniLogin = () =>
  new Promise((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: resolve,
      fail: () => reject(new Error('调起微信登录失败，请确认已安装微信'))
    })
  })

/**
 * 当前是否运行在微信「多端应用」打包出来的 App 里。
 * 普通小程序、H5、HBuilderX 打的 App 都没有这套身份管理 API，按能力探测最稳。
 */
export const hasMiniappIdentity = () => {
  // #ifdef MP-WEIXIN
  return typeof wx !== 'undefined' && typeof wx.phoneSmsLogin === 'function'
  // #endif
  // #ifndef MP-WEIXIN
  return false
  // #endif
}

/** 多端应用的登录凭证统一交给服务端换用户标识（服务端调 code2Verifyinfo）。 */
const exchangeMiniappCode = async (code, scene) => {
  if (!code) throw new Error('没有拿到登录凭证，请重试')
  return normalize(await request('/api/auth/miniapp/phone-login', { code, scene }), 'phone')
}

export const maskId = (value) => {
  const text = String(value || '')
  if (!text) return ''
  if (text.length <= 8) return text.slice(0, 2) + '****'
  return text.slice(0, 4) + '****' + text.slice(-4)
}

const normalize = (data, provider) => {
  const body = data || {}
  const uid = body.uid || body.openid || ''
  return {
    provider,
    name: body.name || (provider === 'wechat' ? '微信用户' : '手机号用户'),
    uid,
    masked: maskId(uid),
    phone: body.phone || '',
    token: body.token || '',
    isNew: !!body.isNew
  }
}

let cloudReady = false
const initCloud = () => {
  // #ifdef MP-WEIXIN
  if (cloudReady) return
  if (!wx.cloud) throw new Error('当前微信版本不支持云开发，请升级微信')
  wx.cloud.init({ env: wx.cloud.DYNAMIC_CURRENT_ENV, traceUser: true })
  cloudReady = true
  // #endif
}

/**
 * 微信登录。
 * - 小程序：云函数直接给 openid；传 phoneCode 时同时返回手机号。
 * - App：uni.login 拿授权码，交给后端换 openid。
 */
export const wechatLogin = async (phoneCode) => {
  // #ifdef MP-WEIXIN
  initCloud()
  const res = await wx.cloud.callFunction({
    name: 'login',
    data: phoneCode ? { phoneCode } : {}
  })
  const data = (res && res.result) || {}
  if (!data.ok || !data.openid) throw new Error(data.error || '微信登录失败')
  return {
    provider: 'wechat',
    name: '微信用户',
    uid: data.openid,
    masked: maskId(data.openid),
    phone: data.phone || '',
    ts: data.ts,
    sig: data.sig
  }
  // #endif

  // #ifndef MP-WEIXIN
  const loginRes = await uniLogin()
  const code = loginRes && (loginRes.code || (loginRes.authResult && loginRes.authResult.code))
  if (!code) throw new Error('没有拿到微信授权码')
  return normalize(await request('/api/auth/wechat/login', { code }), 'wechat')
  // #endif
}

/** 发送短信验证码（App / H5）。Mock 模式下验证码直接返回给界面。 */
export const sendSms = async (phone) => {
  if (!/^1[3-9]\d{9}$/.test(phone)) throw new Error('请输入正确的手机号')
  if (USE_MOCK) {
    const debugCode = String(Math.floor(100000 + Math.random() * 900000))
    mockCodes[phone] = { code: debugCode, expiresAt: Date.now() + 5 * 60 * 1000 }
    return { ok: true, debugCode, expiresIn: 60 }
  }
  return request('/api/auth/sms/send', { phone })
}

/** 手机号 + 短信验证码登录（App / H5）。 */
export const verifySms = async (phone, code) => {
  if (USE_MOCK) {
    const item = mockCodes[phone]
    if (!item || item.expiresAt < Date.now()) throw new Error('验证码已过期，请重新获取')
    if (item.code !== code) throw new Error('验证码不正确')
    delete mockCodes[phone]
    return {
      provider: 'phone',
      name: '手机号用户',
      uid: 'mock-' + phone,
      masked: maskId(phone),
      phone,
      token: 'mock-' + Date.now()
    }
  }
  return normalize(await request('/api/auth/sms/verify', { phone, code }), 'phone')
}

/** 多端应用：读取本机号码掩码，同时为「一键登录」准备一次上下文。 */
export const miniappPhoneMask = () => {
  // #ifdef MP-WEIXIN
  return new Promise((resolve, reject) => {
    if (!hasMiniappIdentity() || typeof wx.getPhoneMask !== 'function') {
      reject(new Error('当前环境不支持本机号码登录'))
      return
    }
    wx.getPhoneMask({
      success: (res) => resolve(res || {}),
      fail: (err) => reject(new Error((err && err.errMsg) || '获取本机号码失败'))
    })
  })
  // #endif
  // #ifndef MP-WEIXIN
  return Promise.reject(new Error('当前环境不支持本机号码登录'))
  // #endif
}

/** 多端应用：短信验证码登录。短信由微信发送和校验，这里只收登录凭证。 */
export const miniappSmsLogin = (phone, code) => {
  // #ifdef MP-WEIXIN
  return new Promise((resolve, reject) => {
    wx.phoneSmsLogin({
      phoneNumber: phone,
      verifyCode: code,
      success: (res) => resolve(res || {}),
      fail: (err) => reject(new Error((err && err.errMsg) || '验证码登录失败'))
    })
  }).then((res) => exchangeMiniappCode(res && res.code, 'sms'))
  // #endif
  // #ifndef MP-WEIXIN
  return verifySms(phone, code)
  // #endif
}

/** 多端应用：本机号码一键登录，code 来自 button 的 bindphoneoneclicklogin 回调。 */
export const miniappOneClickLogin = (code) => exchangeMiniappCode(code, 'oneclick')

// ---------------- GitHub Device Flow ----------------

const GH_CLIENT_ID = 'Ov23liGYZuxISGkahFRw'
const GH_SCOPE = 'read:user gist'

/**
 * 统一的 GitHub 请求封装。
 * form 请求显式拼成 urlencoded 字符串，避免各端对对象序列化不一致。
 */
const githubRequest = (opt, failText) =>
  new Promise((resolve, reject) => {
    uni.request({
      url: opt.url,
      method: opt.method || 'GET',
      data: opt.form,
      header: {
        Accept: 'application/json',
        ...(opt.form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
        ...(opt.headers || {})
      },
      timeout: 15000,
      success: (res) => {
        let body = res.data || {}
        if (typeof body === 'string') {
          try {
            body = JSON.parse(body)
          } catch (err) {
            body = {}
          }
        }
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(body)
        else reject(new Error(body.error_description || failText))
      },
      fail: () => reject(new Error(failText))
    })
  })

const formBody = (data) =>
  Object.keys(data)
    .map((key) => encodeURIComponent(key) + '=' + encodeURIComponent(data[key]))
    .join('&')

/** 申请 device code：返回 { device_code, user_code, verification_uri, expires_in, interval } */
export const githubStart = () =>
  githubRequest(
    {
      url: 'https://github.com/login/device/code',
      method: 'POST',
      form: formBody({ client_id: GH_CLIENT_ID, scope: GH_SCOPE })
    },
    '获取 GitHub 授权码失败'
  )

/** 轮询换取 token：成功含 access_token，未授权时含 error */
export const githubPoll = (deviceCode) =>
  githubRequest(
    {
      url: 'https://github.com/login/oauth/access_token',
      method: 'POST',
      form: formBody({
        client_id: GH_CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
      })
    },
    '读取 GitHub 授权状态失败'
  )

/** 用 token 取当前 GitHub 用户：返回 { login, id, name, avatar_url } */
export const githubUser = (token) =>
  githubRequest(
    {
      url: 'https://api.github.com/user',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' }
    },
    '获取 GitHub 用户信息失败'
  )

export const saveSession = (session) => {
  try {
    uni.setStorageSync(SESSION_KEY, session)
  } catch (err) {
    // 存储失败不影响本次登录
  }
}

export const readSession = () => {
  try {
    return uni.getStorageSync(SESSION_KEY) || null
  } catch (err) {
    return null
  }
}

export const clearSession = () => {
  try {
    uni.removeStorageSync(SESSION_KEY)
  } catch (err) {
    // ignore
  }
}
