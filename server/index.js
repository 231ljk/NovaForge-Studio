const http = require('node:http')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const PORT = Number(process.env.PORT || 8801)
const MINIAPP_APPID = String(process.env.MINIAPP_APPID || '').trim()
const MINIAPP_SECRET = String(process.env.MINIAPP_SECRET || '').trim()
const TOKEN_SECRET = String(process.env.TOKEN_SECRET || '').trim()
const TOKEN_TTL = 7 * 24 * 60 * 60 * 1000

if (!TOKEN_SECRET) {
  console.error('缺少 TOKEN_SECRET：请在 server/.env 里填一个随机字符串')
  process.exit(1)
}

const DATA_DIR = path.join(__dirname, 'data')
const USERS_FILE = path.join(DATA_DIR, 'users.json')

const readUsers = () => {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'))
  } catch (err) {
    return {}
  }
}

const writeUsers = (users) => {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))
}

const maskPhone = (phone) => {
  const value = String(phone || '')
  return /^\d{11}$/.test(value) ? value.slice(0, 3) + '****' + value.slice(7) : value
}

// ---------------- access_token ----------------

let tokenCache = { value: '', expiresAt: 0 }

const getAccessToken = async () => {
  if (tokenCache.value && tokenCache.expiresAt > Date.now() + 60 * 1000) return tokenCache.value
  const url =
    'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential' +
    '&appid=' + encodeURIComponent(MINIAPP_APPID) +
    '&secret=' + encodeURIComponent(MINIAPP_SECRET)
  const res = await fetch(url)
  const data = await res.json()
  if (!data.access_token) {
    throw new Error('获取 access_token 失败：' + (data.errcode || '') + ' ' + (data.errmsg || ''))
  }
  tokenCache = {
    value: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in) || 7200) * 1000
  }
  return tokenCache.value
}

/** 用多端应用的 appid/secret 校验登录凭证，换用户标识。 */
const code2Verifyinfo = async (code) => {
  const accessToken = await getAccessToken()
  const res = await fetch(
    'https://api.weixin.qq.com/donut/code2verifyinfo?access_token=' + encodeURIComponent(accessToken),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appid: MINIAPP_APPID,
        appsecret: MINIAPP_SECRET,
        code,
        grant_type: 'authorization_code'
      })
    }
  )
  const data = await res.json()
  if (data.errcode) {
    throw new Error('微信校验失败：' + data.errcode + ' ' + (data.errmsg || ''))
  }
  return data
}

// ---------------- 登录态 ----------------

const signToken = (payload) => {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(body).digest('base64url')
  return body + '.' + sig
}

// ---------------- HTTP ----------------

const send = (res, status, body) => {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  })
  res.end(text)
}

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 32 * 1024) {
        reject(new Error('请求体过大'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch (err) {
        reject(new Error('请求体不是合法 JSON'))
      }
    })
    req.on('error', reject)
  })

const handlePhoneLogin = async (req, res) => {
  if (!MINIAPP_APPID || !MINIAPP_SECRET) {
    send(res, 503, {
      ok: false,
      message: '服务端还没配置多端应用 AppID / Secret，请填写 server/.env'
    })
    return
  }

  let body
  try {
    body = await readBody(req)
  } catch (err) {
    send(res, 400, { ok: false, message: err.message })
    return
  }

  const code = String(body.code || '').trim()
  if (!code) {
    send(res, 400, { ok: false, message: '缺少登录凭证' })
    return
  }

  let data
  try {
    data = await code2Verifyinfo(code)
  } catch (err) {
    send(res, 502, { ok: false, message: err.message })
    return
  }

  const userInfo = data.user_info || {}
  const phoneInfo = userInfo.phone_info || {}
  const openapp = userInfo.openapp_info || {}
  const uid = userInfo.user_id || openapp.openid || phoneInfo.phone || ''
  if (!uid) {
    send(res, 502, { ok: false, message: '微信没有返回用户标识' })
    return
  }

  const users = readUsers()
  const isNew = !users[uid]
  const now = Date.now()
  users[uid] = {
    uid,
    phone: phoneInfo.phone || (users[uid] && users[uid].phone) || '',
    openid: openapp.openid || (users[uid] && users[uid].openid) || '',
    unionid: openapp.unionid || (users[uid] && users[uid].unionid) || '',
    loginType: (data.login_info && data.login_info.type) || String(body.scene || ''),
    createdAt: (users[uid] && users[uid].createdAt) || now,
    lastLoginAt: now
  }
  writeUsers(users)

  send(res, 200, {
    ok: true,
    uid,
    name: '手机号用户',
    phone: users[uid].phone,
    masked: maskPhone(users[uid].phone),
    token: signToken({ uid, exp: now + TOKEN_TTL }),
    isNew
  })
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    send(res, 204, {})
    return
  }

  const url = new URL(req.url, 'http://localhost')

  if (req.method === 'GET' && url.pathname === '/health') {
    send(res, 200, { ok: true, configured: !!(MINIAPP_APPID && MINIAPP_SECRET) })
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/miniapp/phone-login') {
    handlePhoneLogin(req, res).catch((err) => {
      send(res, 500, { ok: false, message: err.message || '服务端异常' })
    })
    return
  }

  send(res, 404, { ok: false, message: '接口不存在' })
})

server.listen(PORT, () => {
  console.log('NovaForge 账号服务已启动：http://127.0.0.1:' + PORT)
  console.log('多端应用身份管理：' + (MINIAPP_APPID ? '已配置' : '未配置 MINIAPP_APPID'))
})
