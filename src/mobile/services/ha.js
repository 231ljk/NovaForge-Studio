/* NovaForge 软件版 · 服务层
 * 与 HA（NovaForge 扩展）以及 GitHub Device Flow 通信。
 * 演示模式（demo）全部走本地 mock，无需后端即可体验完整交互。
 * 迁移自小程序版 weapp/services/ha.js，接口与返回结构保持一致。
 */
window.NF = window.NF || {};

(function (NF) {
  'use strict';

  var config = { haUrl: '', token: '', demo: false };

  var GH_CLIENT_ID = 'Ov23liGYZuxISGkahFRw'; // 与 HA 插件一致的公共 OAuth Client ID（非密钥）
  var GH_SCOPE = 'read:user gist';
  var GIST_FILE = 'novaforge-hub.json';

  var configure = function (c) { Object.assign(config, c); };

  function raw(opt) {
    var headers = opt.form
      ? { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }
      : { 'Content-Type': 'application/json' };
    Object.assign(headers, opt.headers || {});

    return NF.http(opt.url, {
      method: opt.method || 'GET',
      headers: headers,
      json: opt.form ? undefined : opt.data,
      form: opt.form ? opt.data : undefined,
      timeout: opt.timeout || 15000
    }).then(function (res) {
      return res.data;
    }, function (err) {
      console.error('[HA] request failed', opt.url, err && err.message);
      if (err && err.status === 401) throw err;
      throw new Error((err && err.message) || 'network error');
    });
  }

  // ---------------- 演示模式数据 ----------------

  var demoState = JSON.parse(JSON.stringify(NF.demo.bootstrap));

  function demoSnapshot() {
    return {
      ok: true,
      name: demoState.name,
      entities: demoState.entities.map(function (item) { return Object.assign({}, item); }),
      scenes: demoState.scenes.map(function (item) { return Object.assign({}, item); }),
      automations: demoState.automations.map(function (item) { return Object.assign({}, item); })
    };
  }

  function demoService(data) {
    var domain = String((data && data.domain) || '');
    var service = String((data && data.service) || '');
    var payload = (data && data.data) || {};
    var entityId = String(payload.entity_id || '');

    var entity = demoState.entities.filter(function (item) { return item.id === entityId; })[0];
    var automation = demoState.automations.filter(function (item) { return item.id === entityId; })[0];

    if (automation && domain === 'automation') {
      automation.state = service === 'turn_on' ? 'on' : 'off';
      return;
    }
    if (!entity) return;

    if (domain === 'lock') entity.state = service === 'lock' ? 'locked' : 'unlocked';
    else if (domain === 'cover') entity.state = service === 'open_cover' ? 'open' : 'closed';
    else if (domain === 'climate') entity.state = service === 'turn_off' ? 'off' : 'cool';
    else if (domain === 'media_player') entity.state = service === 'turn_off' ? 'paused' : 'playing';
    else if (domain === 'vacuum') entity.state = service === 'turn_off' ? 'idle' : 'on';
    else if (domain !== 'button' && domain !== 'scene' && domain !== 'script') {
      entity.state = service === 'turn_off' ? 'off' : 'on';
    }
  }

  function demoApi(path, data) {
    return new Promise(function (resolve) {
      console.log('[HA][demo]', path);

      switch (path) {
        case '/api/novaforge/mobile/bootstrap':
          resolve(demoSnapshot());
          break;

        case '/api/novaforge/mobile/service':
          demoService(data);
          resolve({ ok: true });
          break;

        case '/api/novaforge/mobile/scan':
          resolve({
            ok: true,
            subnet: '192.168.31.',
            devices: [{ name: 'NovaForge-ESP32 开发板', host: '192.168.31.66', port: 80 }]
          });
          break;

        case '/api/novaforge/mobile/add-device':
          resolve({ ok: true });
          break;

        default:
          resolve({ ok: true });
      }
    });
  }

  function api(path, opt) {
    var options = opt || {};
    if (config.demo) return demoApi(path, options.data);

    var headers = {};
    if (config.token) headers.Authorization = 'Bearer ' + config.token;

    return raw({
      url: config.haUrl + path,
      method: options.method || 'GET',
      data: options.data,
      headers: headers,
      timeout: options.timeout
    });
  }

  // ---------------- 业务接口 ----------------

  var bootstrap = function () { return api('/api/novaforge/mobile/bootstrap'); };

  var callService = function (domain, service, data) {
    return api('/api/novaforge/mobile/service', { method: 'POST', data: { domain: domain, service: service, data: data } });
  };

  var logoutRemote = function () {
    return api('/api/novaforge/mobile/logout', { method: 'POST', data: {} }).catch(function () { return { ok: false }; });
  };

  var scanDevices = function (subnet) {
    return api('/api/novaforge/mobile/scan', { method: 'POST', data: { subnet: subnet }, timeout: 30000 });
  };

  var addDevice = function (host, port, token) {
    return api('/api/novaforge/mobile/add-device', { method: 'POST', data: { host: host, port: port, token: token } });
  };

  // ---------------- 账号（GitHub / Gitee / 邮箱 → HA 会话） ----------------

  /** 探测地址是不是一台装了 NovaForge 扩展的 HA */
  var pingHa = function (base) {
    return raw({ url: base + '/api/novaforge/account/ping', timeout: 8000 }).then(
      function (res) {
        if (!res || res.ok !== true) throw new Error((res && res.error) || '这个地址没有 NovaForge 登录接口');
        return res;
      },
      function () {
        throw new Error('连不上这个地址，请检查 IP、端口，并确认手机在同一网络');
      }
    );
  };

  /** 用第三方账号令牌换 HA 会话：{ ok, token, expiresAt, account } */
  var tokenLogin = function (base, token, provider) {
    return raw({
      url: base + '/api/novaforge/account/token-login',
      method: 'POST',
      data: { provider: provider || 'github', token: token },
      timeout: 12000
    }).then(
      function (res) {
        if (!res || !res.ok) throw new Error((res && res.error) || '这个家庭没有绑定当前账号');
        if (!res.token) throw new Error('HA 没有返回登录令牌，请更新 NovaForge 扩展后重试');
        res.haUrl = base;
        return res;
      },
      function (err) {
        var msg = (err && err.message) || '';
        if (/timeout/i.test(msg)) throw new Error('登录超时，请确认手机能访问这个 HA 地址');
        throw new Error('连接 HA 失败：' + msg);
      }
    );
  };

  /** 邮箱验证码：发送 */
  var requestCode = function (base, email) {
    return raw({
      url: base + '/api/novaforge/account/request-code',
      method: 'POST',
      data: { email: email },
      timeout: 20000
    }).then(function (res) {
      if (!res || !res.ok) throw new Error((res && res.error) || '验证码发送失败');
      return res;
    });
  };

  /** 邮箱验证码：登录 */
  var loginByCode = function (base, email, code) {
    return raw({
      url: base + '/api/novaforge/account/login',
      method: 'POST',
      data: { email: email, code: code },
      timeout: 20000
    }).then(function (res) {
      if (!res || !res.ok) throw new Error((res && res.error) || '登录失败，请检查验证码');
      if (!res.token) throw new Error('HA 没有返回登录令牌，请更新 NovaForge 扩展后重试');
      res.haUrl = base;
      return res;
    });
  };

  /** Gitee OAuth：发起（返回授权地址或设备码） */
  var giteeStart = function (base) {
    return raw({ url: base + '/api/novaforge/account/gitee-start', method: 'POST', data: {}, timeout: 20000 });
  };

  /** Gitee OAuth：轮询换令牌 */
  var giteePoll = function (base, session) {
    return raw({
      url: base + '/api/novaforge/account/gitee-poll',
      method: 'POST',
      data: { session: session },
      timeout: 20000
    });
  };

  // ---------------- GitHub Device Flow（同账号自动对接） ----------------

  var githubStart = function () {
    return raw({
      url: 'https://github.com/login/device/code',
      method: 'POST',
      form: true,
      data: { client_id: GH_CLIENT_ID, scope: GH_SCOPE }
    });
  };

  var githubPoll = function (deviceCode) {
    return raw({
      url: 'https://github.com/login/oauth/access_token',
      method: 'POST',
      form: true,
      data: {
        client_id: GH_CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
      }
    });
  };

  var githubUser = function (token) {
    return raw({
      url: 'https://api.github.com/user',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' }
    });
  };

  var githubGists = function (token) {
    return raw({
      url: 'https://api.github.com/gists?per_page=100',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' }
    });
  };

  var githubRaw = function (url, token) {
    return raw({ url: url, headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' } });
  };

  /** 从 Gist 中找出 novaforge-hub.json 记录的 HA 地址列表 */
  var discoverHa = async function (token) {
    var gists = await githubGists(token);
    var list = Array.isArray(gists) ? gists : [];
    var target = list.filter(function (item) {
      var files = (item && item.files) || {};
      return Object.prototype.hasOwnProperty.call(files, GIST_FILE);
    })[0];

    if (!target) throw new Error('这个 GitHub 账号里还没有 ' + GIST_FILE + '，请先在 HA 扩展里生成');
    var file = target.files[GIST_FILE];
    var body = await githubRaw(file.raw_url, token);
    var urls = (body && (body.urls || body.hosts)) || [];
    if (typeof urls === 'string') urls = [urls];

    var clean = urls.map(function (item) { return NF.fmt.normalizeUrl(item); }).filter(Boolean);
    if (!clean.length) throw new Error('Gist 里没有可用的 HA 地址');
    return clean;
  };

  /** 依次尝试 Gist 中记录的 HA 地址，直到 token-login 成功 */
  var pairHa = async function (urls, token, provider) {
    for (var i = 0; i < urls.length; i += 1) {
      var base = urls[i];
      try {
        var res = await tokenLogin(base, token, provider);
        if (res && res.ok && res.token) {
          res.haUrl = base;
          return res;
        }
        throw new Error((res && res.error) || 'HA 拒绝了这次登录');
      } catch (err) {
        console.error('[HA] pair failed', base, err);
        if (i === urls.length - 1) {
          throw new Error('已找到家庭，但暂时无法连接。请确认 HA 扩展正在运行，且手机可以访问家庭网络');
        }
      }
    }
    throw new Error('这台 HA 没有可用地址');
  };

  NF.ha = {
    GIST_FILE: GIST_FILE,
    config: config,
    configure: configure,
    bootstrap: bootstrap,
    callService: callService,
    logoutRemote: logoutRemote,
    scanDevices: scanDevices,
    addDevice: addDevice,
    pingHa: pingHa,
    tokenLogin: tokenLogin,
    requestCode: requestCode,
    loginByCode: loginByCode,
    giteeStart: giteeStart,
    giteePoll: giteePoll,
    githubStart: githubStart,
    githubPoll: githubPoll,
    githubUser: githubUser,
    githubGists: githubGists,
    githubRaw: githubRaw,
    discoverHa: discoverHa,
    pairHa: pairHa
  };
}(window.NF));
