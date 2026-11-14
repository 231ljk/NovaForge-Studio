/* NovaForge 手机端
 * 定位：Home Assistant 遥控器 + AI 助手
 * 数据与控制全部经 HA 的 NovaForge 插件代理，不依赖电脑地址、不使用密码。
 */
(function () {
  'use strict'

  var $ = function (id) { return document.getElementById(id) }
  var HA_KEY = 'nf-ha-url'
  var SESSION_KEY = 'nf-session'

  var state = {
    haUrl: localStorage.getItem(HA_KEY) || '',
    session: null,
    data: null,
    tab: 'home',
    bleTimer: null,
    bleDevices: [],
    netDevices: [],
    busy: false
  }

  try { state.session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') } catch (e) { state.session = null }

  // ---------------- 基础工具 ----------------

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }

  var toastTimer = null
  function toast(msg) {
    var el = $('toast')
    if (!el) return
    el.textContent = msg
    el.classList.add('show')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(function () { el.classList.remove('show') }, 2600)
  }

  function normalizeUrl(v) {
    var s = String(v || '').trim().replace(/\/+$/, '')
    if (!s) return ''
    if (!/^https?:\/\//i.test(s)) s = 'http://' + s
    return s
  }

  function api(path, opt, timeout) {
    opt = opt || {}
    var ctrl = new AbortController()
    var timer = setTimeout(function () { ctrl.abort() }, timeout || 15000)
    var headers = Object.assign({ 'Content-Type': 'application/json' }, opt.headers || {})
    if (state.session && state.session.token) {
      headers.Authorization = 'Bearer ' + state.session.token
    }
    return fetch(state.haUrl + path, {
      method: opt.method || 'GET',
      headers: headers,
      body: opt.body ? JSON.stringify(opt.body) : undefined,
      signal: ctrl.signal
    }).then(function (resp) {
      clearTimeout(timer)
      return resp.json().catch(function () { return { ok: false, error: 'HA 返回了无法解析的内容' } })
        .then(function (data) {
          if (resp.status === 401) {
            clearSession()
            showLogin('登录已失效，请重新登录')
          }
          return data
        })
    }, function (err) {
      clearTimeout(timer)
      throw err
    })
  }

  function errText(err) {
    if (err && err.name === 'AbortError') return '连接超时，请检查 HA 地址是否可从手机访问'
    return '网络请求失败：' + (err && err.message ? err.message : err)
  }

  // ---------------- 登录 ----------------

  function showLogin(message) {
    $('view-app').style.display = 'none'
    $('view-login').style.display = 'flex'
    if (state.haUrl) $('login-ha-url').value = state.haUrl
    setLoginError(message || '')
  }

  function showApp() {
    $('view-login').style.display = 'none'
    $('view-app').style.display = ''
  }

  function setLoginError(msg) {
    var el = $('login-err')
    if (el) el.textContent = msg || ''
  }

  function clearSession() {
    state.session = null
    state.data = null
    localStorage.removeItem(SESSION_KEY)
  }

  function saveSession(token, account) {
    state.session = {
      token: token,
      email: account && account.email ? account.email : '',
      name: (account && (account.name || account.login)) || '',
      provider: (account && account.provider) || 'email'
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(state.session))
  }

  function requireHaUrl() {
    var url = normalizeUrl($('login-ha-url').value)
    if (!url) { setLoginError('请先填写 Home Assistant 地址'); return null }
    state.haUrl = url
    localStorage.setItem(HA_KEY, url)
    return url
  }

  function requestCode() {
    if (!requireHaUrl()) return
    var email = $('login-email').value.trim()
    if (email.indexOf('@') < 1) { setLoginError('请填写正确的邮箱'); return }
    var btn = $('btn-code')
    btn.disabled = true
    setLoginError('')
    api('/api/novaforge/account/request-code', { method: 'POST', body: { email: email } })
      .then(function (res) {
        if (res.ok) {
          toast('验证码已发送，30 秒内有效')
          var left = 30
          btn.textContent = left + 's'
          var tick = setInterval(function () {
            left--
            btn.textContent = left > 0 ? left + 's' : '获取验证码'
            if (left <= 0) { clearInterval(tick); btn.disabled = false }
          }, 1000)
        } else {
          btn.disabled = false
          setLoginError(res.error || '验证码发送失败')
        }
      })
      .catch(function (err) { btn.disabled = false; setLoginError(errText(err)) })
  }

  function loginByCode() {
    if (!requireHaUrl()) return
    var email = $('login-email').value.trim()
    var code = $('login-code').value.trim()
    if (email.indexOf('@') < 1) { setLoginError('请填写正确的邮箱'); return }
    if (code.length !== 6) { setLoginError('请填写 6 位验证码'); return }
    setLoginError('')
    $('btn-login').disabled = true
    api('/api/novaforge/account/login', { method: 'POST', body: { email: email, code: code } })
      .then(function (res) {
        $('btn-login').disabled = false
        if (!res.ok) { setLoginError(res.error || '登录失败'); return }
        saveSession(res.token, res.account)
        enterApp()
      })
      .catch(function (err) { $('btn-login').disabled = false; setLoginError(errText(err)) })
  }

  var oauthTimer = null
  var GH_CLIENT_ID = 'Ov23liGYZuxISGkahFRw'
  var GH_SCOPE = 'read:user gist'
  var GIST_FILE = 'novaforge-hub.json'

  function showOAuth(title, code, linkText, href, tip) {
    $('oauth-panel').style.display = 'block'
    $('oauth-title').textContent = title
    $('oauth-code').textContent = code
    $('oauth-link').textContent = linkText
    $('oauth-link').href = href
    $('oauth-tip').textContent = tip
  }

  function hideOAuth() {
    clearInterval(oauthTimer)
    clearTimeout(oauthTimer)
    $('oauth-panel').style.display = 'none'
  }

  function ghForm(url, params) {
    return fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString()
    }).then(function (r) { return r.json() })
  }

  function ghJson(url, token) {
    return fetch(url, {
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' }
    }).then(function (r) {
      if (!r.ok) throw new Error('GitHub 返回 HTTP ' + r.status)
      return r.json()
    })
  }

  /* 用同一个 GitHub 账号登录：授权 → 读取该账号 Gist 里的 HA 地址 → 配对。
     全程不需要用户填写任何地址，和米家第三方平台的账号绑定是同一思路。 */
  function githubLogin() {
    setLoginError('')
    $('btn-github').disabled = true
    ghForm('https://github.com/login/device/code', { client_id: GH_CLIENT_ID, scope: GH_SCOPE })
      .then(function (res) {
        $('btn-github').disabled = false
        if (!res || !res.device_code) {
          throw new Error(res && res.error_description ? res.error_description : 'GitHub 未返回授权码')
        }
        showOAuth('在浏览器中完成 GitHub 授权', res.user_code || '',
          '打开 github.com/login/device', res.verification_uri || 'https://github.com/login/device',
          '输入上面代码并同意授权，这里会自动登录')
        pollDevice(res.device_code, Number(res.interval) || 5)
      })
      .catch(function (err) {
        $('btn-github').disabled = false
        setLoginError('无法发起 GitHub 授权：' + (err && err.message ? err.message : err) +
          '（浏览器预览受跨域限制，请在 App 内登录）')
      })
  }

  function pollDevice(deviceCode, interval) {
    clearTimeout(oauthTimer)
    oauthTimer = setTimeout(function () {
      ghForm('https://github.com/login/oauth/access_token', {
        client_id: GH_CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
      }).then(function (res) {
        if (res && res.access_token) {
          discoverHa(res.access_token)
          return
        }
        if (res && (res.error === 'authorization_pending' || res.error === 'slow_down')) {
          pollDevice(deviceCode, res.error === 'slow_down' ? interval + 5 : interval)
          return
        }
        hideOAuth()
        setLoginError((res && res.error_description) || 'GitHub 授权失败，请重试')
      }).catch(function () {
        pollDevice(deviceCode, interval)
      })
    }, Math.max(interval, 5) * 1000)
  }

  function discoverHa(token) {
    $('oauth-tip').textContent = '正在查找你绑定的 Home Assistant…'
    ghJson('https://api.github.com/gists?per_page=100', token)
      .then(function (list) {
        if (!Array.isArray(list)) throw new Error('读取 GitHub 数据失败')
        var hit = null
        list.forEach(function (g) {
          if (!hit && g.files && g.files[GIST_FILE]) hit = g
        })
        if (!hit) {
          throw new Error('没找到已绑定的 HA：请先在 HA 的 NovaForge 插件里「绑定 GitHub 账号」，且用同一个账号登录')
        }
        return ghJson(hit.files[GIST_FILE].raw_url, token)
      })
      .then(function (hub) {
        var urls = (hub && hub.urls) || []
        if (!urls.length) throw new Error('这台 HA 没有配置可访问地址，请在 HA 的「设置 → 系统 → 网络」中填写')
        return pairHa(urls, token, 0)
      })
      .then(function (res) {
        hideOAuth()
        state.haUrl = res.haUrl
        localStorage.setItem(HA_KEY, res.haUrl)
        saveSession(res.token, res.account)
        toast('已连接到 ' + (res.ha || 'Home Assistant'))
        enterApp()
      })
      .catch(function (err) {
        hideOAuth()
        setLoginError((err && err.message) || '登录失败，请重试')
      })
  }

  function pairHa(urls, token, i) {
    if (i >= urls.length) {
      return Promise.reject(new Error('连不上这台 HA：' + urls.join(' / ') + '（请确认手机网络能访问该地址）'))
    }
    var base = normalizeUrl(urls[i])
    var ctrl = new AbortController()
    var timer = setTimeout(function () { ctrl.abort() }, 8000)
    return fetch(base + '/api/novaforge/account/token-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'github', token: token }),
      signal: ctrl.signal
    }).then(function (r) {
      clearTimeout(timer)
      return r.json()
    }, function (err) {
      clearTimeout(timer)
      return pairHa(urls, token, i + 1)
    }).then(function (res) {
      if (res && res.ok && res.token) {
        res.haUrl = base
        return res
      }
      throw new Error((res && res.error) || 'HA 拒绝了这次登录')
    })
  }

  function giteeLogin() {
    if (!requireHaUrl()) return
    setLoginError('')
    $('btn-gitee').disabled = true
    api('/api/novaforge/account/gitee-start', { method: 'POST', body: {} })
      .then(function (res) {
        $('btn-gitee').disabled = false
        if (!res.ok) { setLoginError(res.error || '无法发起 Gitee 授权'); return }
        showOAuth('在浏览器中完成 Gitee 授权', 'Gitee',
          '打开 Gitee 授权页', res.authorizeUrl,
          '授权后会自动跳回 HA，这里几秒内完成登录')
        pollOAuth('gitee-poll', res.session)
      })
      .catch(function (err) { $('btn-gitee').disabled = false; setLoginError(errText(err)) })
  }

  function pollOAuth(action, session) {
    clearInterval(oauthTimer)
    oauthTimer = setInterval(function () {
      if (!session) return
      api('/api/novaforge/account/' + action, { method: 'POST', body: { session: session } })
        .then(function (res) {
          if (res.ok && res.token) {
            hideOAuth()
            saveSession(res.token, res.account)
            enterApp()
          } else if (!res.ok) {
            hideOAuth()
            setLoginError(res.error || '授权失败')
          }
        })
        .catch(function () { /* 网络抖动时继续轮询 */ })
    }, 4000)
  }

  function cancelGithub() {
    hideOAuth()
  }

  function logout() {
    api('/api/novaforge/mobile/logout', { method: 'POST', body: {} }).catch(function () {})
    clearSession()
    showLogin('已退出登录')
  }

  // ---------------- 主界面 ----------------

  function enterApp() {
    showApp()
    switchTab('home')
    refresh()
  }

  function switchTab(tab) {
    state.tab = tab
    document.querySelectorAll('[data-tab]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab)
    })
    document.querySelectorAll('.sec').forEach(function (sec) {
      sec.classList.remove('active')
    })
    var target = $('sec-' + tab)
    if (target) target.classList.add('active')

    var titles = { home: 'NovaForge', scenes: '场景与自动化', ai: 'AI 助手', me: '我的' }
    $('hdr-title').textContent = titles[tab] || 'NovaForge'
    $('btn-add-device').style.display = tab === 'me' || tab === 'ai' ? 'none' : ''

    if (tab === 'me') renderMe()
    if (tab === 'ai') setTimeout(function () { var i = $('ai-input'); if (i) i.focus() }, 60)
  }

  function openAdd() {
    switchTab('add')
    $('hdr-title').textContent = '添加设备'
    $('btn-add-device').style.display = 'none'
    startScan()
  }

  function refresh() {
    if (!state.session) return Promise.resolve()
    return api('/api/novaforge/mobile/bootstrap')
      .then(function (res) {
        if (!res.ok) throw new Error(res.error || '读取 HA 数据失败')
        state.data = res
        renderHome(res)
        renderScenes(res)
        renderMe()
      })
      .catch(function (err) { toast(errText(err)) })
  }

  var TITLES = { on: '开', off: '关', unavailable: '离线', unknown: '未知', playing: '播放中', paused: '已暂停', idle: '待机', open: '开', opening: '正在开', closed: '关', closing: '正在关', locked: '已锁', unlocked: '未锁', home: '在家', not_home: '离家', heat: '制热', cool: '制冷', auto: '自动', dry: '除湿', fan_only: '送风', off: '关' }

  function stateText(v) {
    return TITLES[v] || v
  }

  function isOn(item) {
    return ['on', 'open', 'unlocked', 'playing', 'heat', 'cool', 'auto', 'dry', 'fan_only'].indexOf(item.state) >= 0
  }

  function isReadonly(item) {
    return ['sensor', 'binary_sensor', 'device_tracker', 'person', 'weather'].indexOf(item.domain) >= 0
  }

  function iconOf(item) {
    if (item.domain === 'light') return '💡'
    if (item.domain === 'climate') return '🌡️'
    if (item.domain === 'cover') return '🪟'
    if (item.domain === 'lock') return '🔒'
    if (item.domain === 'media_player') return '🎵'
    if (item.domain === 'sensor') return '📊'
    if (item.domain === 'fan') return '🌀'
    if (item.domain === 'vacuum') return '🧹'
    if (item.domain === 'person' || item.domain === 'device_tracker') return '📍'
    return '🔌'
  }

  function renderHome(data) {
    var list = data.entities || []
    $('home-ha-name').textContent = data.name || '我的家'
    $('home-dev-count').textContent = list.length ? '(' + list.length + ')' : ''
    $('home-greet').textContent = greeting()
    var onCount = list.filter(function (i) { return !isReadonly(i) && isOn(i) }).length
    $('home-sum').textContent = list.length
      ? '共 ' + list.length + ' 个实体，' + onCount + ' 个开启中'
      : 'HA 中还没有可用实体'

    var grid = $('home-grid')
    grid.innerHTML = list.map(function (item) {
      var readonly = isReadonly(item)
      var on = isOn(item)
      var value = item.state
      if (item.domain === 'sensor') value = item.state + (item.unit ? ' ' + item.unit : '')
      else value = stateText(item.state)
      return '<button class="dev-card' + (on && !readonly ? ' on' : '') + (readonly ? ' readonly' : '') + '"' +
        ' data-entity="' + esc(item.id) + '" data-domain="' + esc(item.domain) + '">' +
        '<span class="dev-ico">' + iconOf(item) + '</span>' +
        '<span class="dev-name">' + esc(item.name) + '</span>' +
        '<span class="dev-state">' + esc(value) + '</span>' +
        '</button>'
    }).join('')
    $('home-empty').style.display = list.length ? 'none' : 'block'

    grid.querySelectorAll('.dev-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var id = card.getAttribute('data-entity')
        var domain = card.getAttribute('data-domain')
        var item = list.filter(function (x) { return x.id === id })[0]
        if (item && !isReadonly(item)) control(item)
      })
    })
  }

  function greeting() {
    var h = new Date().getHours()
    if (h < 6) return '夜深了'
    if (h < 11) return '早上好'
    if (h < 14) return '中午好'
    if (h < 18) return '下午好'
    return '晚上好'
  }

  function control(item) {
    var id = item.id
    var domain = item.domain
    var service = 'toggle'
    var data = { entity_id: id }

    if (domain === 'lock') service = item.state === 'locked' ? 'unlock' : 'lock'
    else if (domain === 'cover') service = item.state === 'open' ? 'close_cover' : 'open_cover'
    else if (domain === 'button' || domain === 'input_button') { service = 'press'; data = {} }
    else if (domain === 'script' || domain === 'scene') { service = 'turn_on'; data = {} }
    if (domain === 'script' || domain === 'scene') data = {}

    callService(domain, service, data)
      .then(function (res) {
        if (!res.ok) { toast(res.error || '控制失败'); return }
        setTimeout(refresh, 350)
      })
  }

  function callService(domain, service, data) {
    return api('/api/novaforge/mobile/service', {
      method: 'POST',
      body: { domain: domain, service: service, data: data }
    }).catch(function (err) { return { ok: false, error: errText(err) } })
  }

  // ---------------- 场景与自动化 ----------------

  function renderScenes(data) {
    var scenes = data.scenes || []
    var autos = data.automations || []
    $('scene-empty').style.display = (scenes.length || autos.length) ? 'none' : 'block'
    $('auto-count').textContent = autos.length ? '(' + autos.length + ')' : ''

    $('scene-list').innerHTML = scenes.map(function (item) {
      return '<button class="dev-card scene" data-scene="' + esc(item.id) + '">' +
        '<span class="dev-ico">🎬</span>' +
        '<span class="dev-name">' + esc(item.name) + '</span>' +
        '<span class="dev-state">执行场景</span>' +
        '</button>'
    }).join('')

    $('scene-list').querySelectorAll('[data-scene]').forEach(function (card) {
      card.addEventListener('click', function () {
        var id = card.getAttribute('data-scene')
        callService('scene', 'turn_on', { entity_id: id }).then(function (res) {
          toast(res.ok ? '场景已执行' : (res.error || '执行失败'))
          if (res.ok) setTimeout(refresh, 400)
        })
      })
    })

    $('auto-list').innerHTML = autos.map(function (item) {
      var on = item.state === 'on'
      return '<div class="auto-row">' +
        '<div class="auto-info"><b>' + esc(item.name) + '</b>' +
        '<span class="small muted">' + (on ? '已启用' : '已停用') + '</span></div>' +
        '<button class="switch' + (on ? ' on' : '') + '" data-auto="' + esc(item.id) + '" data-on="' + (on ? '1' : '0') + '">' +
        '<i></i></button></div>'
    }).join('')

    $('auto-list').querySelectorAll('[data-auto]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-auto')
        var on = btn.getAttribute('data-on') === '1'
        callService('automation', on ? 'turn_off' : 'turn_on', { entity_id: id }).then(function (res) {
          if (!res.ok) { toast(res.error || '操作失败'); return }
          btn.classList.toggle('on', !on)
          btn.setAttribute('data-on', on ? '0' : '1')
          var label = btn.parentNode.querySelector('.small')
          if (label) label.textContent = on ? '已停用' : '已启用'
        })
      })
    })
  }

  // ---------------- 搜索添加设备 ----------------

  function ble() {
    return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BluetoothLe) || null
  }

  function setScanStatus(text) {
    $('scan-status').textContent = text
  }

  function startScan() {
    state.bleDevices = []
    state.netDevices = []
    $('scan-results').innerHTML = ''
    $('scan-title').textContent = '正在搜索附近设备…'
    $('scan-bar').style.width = '8%'
    setScanStatus('正在申请蓝牙与局域网权限…')
    scanBle()
    scanNetwork()
  }

  function scanBle() {
    var plugin = ble()
    if (!plugin) {
      setScanStatus('当前环境不支持蓝牙搜索（浏览器预览可忽略），已改用局域网搜索')
      return
    }
    Promise.resolve()
      .then(function () { return plugin.requestPermissions ? plugin.requestPermissions() : null })
      .then(function () { return plugin.initialize({ androidNeverForLocation: false }) })
      .then(function () { return plugin.requestEnable() })
      .then(function () {
        plugin.addListener('onScanResult', function (result) {
          var device = result && result.device
          if (!device || !device.deviceId) return
          var name = device.localName || device.name || ''
          if (!name) return
          if (state.bleDevices.some(function (d) { return d.deviceId === device.deviceId })) return
          state.bleDevices.push({ deviceId: device.deviceId, name: name, rssi: result.rssi })
          renderScanResults()
        })
        return plugin.startLEScan({ allowDuplicates: false })
      })
      .catch(function (err) {
        setScanStatus('蓝牙搜索不可用：' + (err && err.message ? err.message : err))
      })
      .then(function () {
        clearTimeout(state.bleTimer)
        state.bleTimer = setTimeout(function () { plugin.stopLEScan().catch(function () {}) }, 12000)
      })
  }

  function scanNetwork() {
    var subnet = ($('in-net').value || '').trim()
    api('/api/novaforge/mobile/scan', { method: 'POST', body: { subnet: subnet } }, 30000)
      .then(function (res) {
        if (!res.ok) { setScanStatus(res.error || '局域网搜索不可用'); return }
        state.netDevices = res.devices || []
        if (res.subnet) $('in-net').value = res.subnet
        if (!state.netDevices.length) setScanStatus('局域网内暂未发现开发板，可手动填写 IP 添加')
        renderScanResults()
      })
      .catch(function (err) { setScanStatus(errText(err)) })
  }

  function renderScanResults() {
    var html = ''
    state.netDevices.forEach(function (d) {
      html += '<div class="scan-item"><div><b>' + esc(d.name) + '</b>' +
        '<div class="small muted mono">' + esc(d.host) + ' · WiFi</div></div>' +
        '<button class="btn sm" data-pick="' + esc(d.host) + '">添加</button></div>'
    })
    state.bleDevices.forEach(function (d) {
      html += '<div class="scan-item"><div><b>' + esc(d.name) + '</b>' +
        '<div class="small muted mono">蓝牙 ' + esc(d.deviceId) + '</div></div>' +
        '<span class="badge">已发现</span></div>'
    })
    $('scan-results').innerHTML = html
    $('scan-results').querySelectorAll('[data-pick]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $('add-host').value = btn.getAttribute('data-pick')
        $('add-token').focus()
        toast('已填入 IP，请补充控制授权码')
      })
    })
    if (state.netDevices.length || state.bleDevices.length) {
      $('scan-title').textContent = '发现 ' + (state.netDevices.length + state.bleDevices.length) + ' 个设备'
      $('scan-bar').style.width = '100%'
      setScanStatus('选择局域网设备添加，或手动填写 IP')
    }
  }

  function manualAdd() {
    var host = $('add-host').value.trim()
    var port = parseInt($('add-port').value, 10) || 80
    var token = $('add-token').value.trim()
    $('add-err').textContent = ''
    if (!host) { $('add-err').textContent = '请填写设备 IP'; return }
    if (!token) { $('add-err').textContent = '请填写控制授权码'; return }
    $('btn-manual-add').disabled = true
    api('/api/novaforge/mobile/add-device', { method: 'POST', body: { host: host, port: port, token: token } })
      .then(function (res) {
        $('btn-manual-add').disabled = false
        if (!res.ok) { $('add-err').textContent = res.error || '添加失败'; return }
        toast('已接入 Home Assistant')
        $('add-token').value = ''
        refresh()
        switchTab('home')
      })
      .catch(function (err) { $('btn-manual-add').disabled = false; $('add-err').textContent = errText(err) })
  }

  // ---------------- 我的 ----------------

  function renderMe() {
    if (!state.session) return
    var s = state.session
    $('me-provider').textContent = s.provider === 'github' ? 'GitHub' : '邮箱'
    $('me-email').textContent = s.email || '—'
    if (state.data) {
      $('me-ha-name').textContent = state.data.name || 'Home Assistant'
      $('me-ha-url').textContent = state.haUrl || ''
    }
    $('hdr-avatar').textContent = (s.name || s.email || 'N').charAt(0).toUpperCase()
  }

  // ---------------- AI 助手 ----------------

  function pushMessage(role, text) {
    var thread = $('ai-thread')
    var el = document.createElement('div')
    el.className = 'msg ' + role
    el.innerHTML = role === 'ai'
      ? '<div class="msg-role">AI</div><div class="msg-body">' + esc(text) + '</div>'
      : '<div class="msg-body">' + esc(text) + '</div>'
    thread.appendChild(el)
    thread.scrollTop = thread.scrollHeight
    $('ai-hero').style.display = 'none'
    return el
  }

  function sendAi(text) {
    var value = (text || $('ai-input').value || '').trim()
    if (!value || state.busy) return
    state.busy = true
    $('ai-input').value = ''
    pushMessage('user', value)
    var pending = pushMessage('ai', '正在思考…')
    api('/api/novaforge/mobile/chat', { method: 'POST', body: { text: value } }, 60000)
      .then(function (res) {
        pending.querySelector('.msg-body').textContent = res.ok
          ? (res.reply || '（没有返回内容）')
          : (res.error || 'AI 暂时不可用')
      })
      .catch(function (err) {
        pending.querySelector('.msg-body').textContent = errText(err)
      })
      .then(function () { state.busy = false })
  }

  // ---------------- 事件绑定 ----------------

  function bind() {
    $('btn-code').addEventListener('click', requestCode)
    $('btn-login').addEventListener('click', loginByCode)
    $('btn-github').addEventListener('click', githubLogin)
    $('btn-gitee').addEventListener('click', giteeLogin)
    $('btn-more').addEventListener('click', function () {
      var box = $('login-advanced')
      var open = box.style.display === 'none' || !box.style.display
      box.style.display = open ? 'block' : 'none'
    })
    $('oauth-cancel').addEventListener('click', cancelGithub)
    $('login-code').addEventListener('keydown', function (e) { if (e.key === 'Enter') loginByCode() })

    document.querySelectorAll('[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tab = btn.getAttribute('data-tab')
        if (!state.session) return
        switchTab(tab)
      })
    })

    $('btn-add-device').addEventListener('click', openAdd)
    $('hdr-avatar').addEventListener('click', function () { if (state.session) switchTab('me') })

    $('btn-rescan').addEventListener('click', startScan)
    $('btn-manual-add').addEventListener('click', manualAdd)

    $('btn-logout').addEventListener('click', logout)
    $('btn-relogin').addEventListener('click', function () {
      clearSession()
      showLogin('请重新登录')
    })

    $('btn-ai-send').addEventListener('click', function () { sendAi() })
    $('ai-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendAi()
      }
    })
    document.querySelectorAll('.ai-chips .chip').forEach(function (chip) {
      chip.addEventListener('click', function () { sendAi(chip.getAttribute('data-prompt')) })
    })

    window.addEventListener('online', function () { if (state.session) refresh() })
  }

  function boot() {
    bind()
    if (state.session && state.session.token && state.haUrl) {
      showApp()
      switchTab('home')
      refresh()
    } else {
      showLogin('')
    }
  }

  window.NF = {
    refresh: refresh,
    openAdd: openAdd
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot)
  } else {
    boot()
  }
})()
