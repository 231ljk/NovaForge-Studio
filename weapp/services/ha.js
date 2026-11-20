const { demoBootstrap } = require('../data/demo');

/**
 * NovaForge 服务层：与 HA 插件、GitHub Device Flow 通信。
 * 演示模式（demo）下全部走本地 mock，方便无后端时体验。
 */

const config = { haUrl: '', token: '', demo: false };

const GH_CLIENT_ID = 'Ov23liGYZuxISGkahFRw'; // 与 HA 插件一致的公共 OAuth Client ID（非密钥）
const GH_SCOPE = 'read:user gist';
const GIST_FILE = 'novaforge-hub.json';
// 微信身份签名的用途域，需与云函数 / HA 扩展保持一致
const SIG_PURPOSE = 'weapp-login';

const configure = (c) => {
  Object.assign(config, c);
};

const raw = (opt) =>
  new Promise((resolve, reject) => {
    const header = opt.form
      ? { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }
      : { 'Content-Type': 'application/json' };
    Object.assign(header, opt.headers || {});

    wx.request({
      url: opt.url,
      method: opt.method || 'GET',
      data: opt.data,
      timeout: opt.timeout || 15000,
      header,
      success: (res) => {
        if (res.statusCode === 401) {
          const err = new Error('登录已失效');
          err.status = 401;
          reject(err);
          return;
        }
        resolve(res.data);
      },
      fail: (err) => {
        console.error('[HA] request failed', opt.url, err.errMsg);
        reject(new Error(err.errMsg || 'network error'));
      }
    });
  });

// ---------------- 演示模式数据 ----------------

const demoState = JSON.parse(JSON.stringify(demoBootstrap));

const demoSnapshot = () => ({
  ok: true,
  name: demoState.name,
  entities: demoState.entities.map((item) => Object.assign({}, item)),
  scenes: demoState.scenes.map((item) => Object.assign({}, item)),
  automations: demoState.automations.map((item) => Object.assign({}, item))
});

const demoService = (data) => {
  const domain = String((data && data.domain) || '');
  const service = String((data && data.service) || '');
  const payload = (data && data.data) || {};
  const entityId = String(payload.entity_id || '');
  const entity = demoState.entities.filter((item) => item.id === entityId)[0];
  const automation = demoState.automations.filter((item) => item.id === entityId)[0];

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
};

const demoApi = (path, data) =>
  new Promise((resolve) => {
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
      default:
        resolve({ ok: true });
    }
  });

const api = (path, opt) => {
  const options = opt || {};
  if (config.demo) return demoApi(path, options.data);

  const headers = {};
  if (config.token) headers.Authorization = 'Bearer ' + config.token;

  return raw({
    url: config.haUrl + path,
    method: options.method || 'GET',
    data: options.data,
    headers,
    timeout: options.timeout
  });
};

// ---------------- 业务接口 ----------------

const bootstrap = () => api('/api/novaforge/mobile/bootstrap');

const callService = (domain, service, data) =>
  api('/api/novaforge/mobile/service', { method: 'POST', data: { domain, service, data } });

const logoutRemote = () =>
  api('/api/novaforge/mobile/logout', { method: 'POST', data: {} }).catch(() => ({ ok: false }));

const scanDevices = (subnet) =>
  api('/api/novaforge/mobile/scan', { method: 'POST', data: { subnet }, timeout: 30000 });

const addDevice = (host, port, token) =>
  api('/api/novaforge/mobile/add-device', { method: 'POST', data: { host, port, token } });

// ---------------- 微信身份（云开发签发，HA 只校验签名） ----------------

/** 探测地址是不是一台装了 NovaForge 扩展的 HA；返回里带家庭名 name */
const pingHa = (base, timeout) =>
  raw({ url: base + '/api/novaforge/account/ping', timeout: timeout || 8000 }).then(
    (res) => {
      if (!res || res.ok !== true) throw new Error((res && res.error) || '这个地址没有 NovaForge 登录接口');
      return res;
    },
    (err) => {
      const msg = (err && err.message) || '';
      if (/timeout/i.test(msg)) throw new Error('这个地址连不上（超时）');
      throw new Error('连不上这个地址，请检查 IP、端口，并确认手机在同一网络');
    }
  );

/**
 * 把身份断言组装成 HA 侧请求体。
 * sigVersion >= 1 时带上用途域签名（openid+ts+appid+purpose），
 * 同时继续带旧 sig —— 老版本 HA 扩展只认旧签名也能登录。
 */
const identityPayload = (identity) => {
  const id = identity || {};
  const body = { openid: id.openid, ts: id.ts, sig: id.sig };
  const version = Number(id.sigVersion) || 0;
  if (version >= 1 && id.sigV1) {
    body.sigVersion = version;
    body.sigV1 = id.sigV1;
    body.purpose = id.purpose || SIG_PURPOSE;
    body.appid = id.appid || '';
  }
  return body;
};

/** 用云函数签发的微信身份换 HA 会话：{ ok, token, expiresAt, openidMasked } */
const openidLogin = (base, identity) =>
  raw({
    url: base + '/api/novaforge/account/openid-login',
    method: 'POST',
    data: identityPayload(identity),
    timeout: 20000
  }).then(
    (res) => {
      if (!res || !res.ok) {
        const err = new Error((res && (res.error || res.message)) || '微信登录失败，请重试');
        err.code = 'HA_AUTH_FAILED';
        throw err;
      }
      if (!res.token) {
        const err = new Error('HA 没有返回登录令牌，请更新 NovaForge 扩展后重试');
        err.code = 'HA_NO_TOKEN';
        throw err;
      }
      res.haUrl = base;
      return res;
    },
    (err) => {
      const msg = (err && err.message) || '';
      const e = new Error(/timeout/i.test(msg) ? '登录超时，请确认手机能访问这个 HA 地址' : '连接 HA 失败：' + msg);
      e.code = 'HA_UNREACHABLE';
      throw e;
    }
  );

/** 取小程序一次性登录 code（云开发不可用时的兜底通道，openid 由 HA 侧用 AppSecret 换） */
const wxLoginCode = () =>
  new Promise((resolve, reject) => {
    wx.login({
      success: (res) => {
        if (res && res.code) {
          resolve(res.code);
          return;
        }
        const err = new Error('没有拿到微信登录凭证，请检查网络后重试');
        err.code = 'WX_NO_CODE';
        reject(err);
      },
      fail: (err) => {
        const e = new Error((err && err.errMsg) || '微信登录失败');
        e.code = 'WX_LOGIN_FAILED';
        reject(e);
      }
    });
  });

/** 用 wx.login 的 code 直接让 HA 换 openid 并签发会话 */
const wxCodeLogin = (base, code) =>
  raw({
    url: base + '/api/novaforge/account/wx-login',
    method: 'POST',
    data: { code },
    timeout: 20000
  }).then(
    (res) => {
      if (!res || !res.ok) {
        const err = new Error((res && (res.error || res.message)) || '微信登录失败，请重试');
        err.code = 'HA_AUTH_FAILED';
        throw err;
      }
      if (!res.token) {
        const err = new Error('HA 没有返回登录令牌，请更新 NovaForge 扩展后重试');
        err.code = 'HA_NO_TOKEN';
        throw err;
      }
      res.haUrl = base;
      return res;
    },
    (err) => {
      const msg = (err && err.message) || '';
      const e = new Error(/timeout/i.test(msg) ? '登录超时，请确认手机能访问这个 HA 地址' : '连接 HA 失败：' + msg);
      e.code = 'HA_UNREACHABLE';
      throw e;
    }
  );

/**
 * 依次尝试云端记住的家庭地址，返回第一个配对成功的 { res, haUrl, haName }。
 * 每个地址最多 5 秒探测，避免多家庭时等待过久。
 * 云开发不可用（没签名）时自动走「每个地址各取一次 code」的直换通道，双通道兜底。
 * 调用方可用 error.failures 把失败明细展示给用户。
 */
const pairHomes = async (urls, identity) => {
  const list = (Array.isArray(urls) ? urls : []).filter(Boolean).slice(0, 5);
  if (!list.length) {
    const err = new Error('这个微信还没有关联家庭');
    err.code = 'NO_HOME';
    throw err;
  }
  const useCode = !(identity && identity.signed);
  const failures = [];
  for (let i = 0; i < list.length; i += 1) {
    const base = list[i];
    try {
      const ping = await pingHa(base, 5000);
      const res = useCode
        ? await wxCodeLogin(base, await wxLoginCode())
        : await openidLogin(base, identity);
      return {
        res,
        haUrl: base,
        haName: (ping && ping.name) || (res && res.ha) || '',
        channel: useCode ? 'wxcode' : 'openid'
      };
    } catch (err) {
      failures.push({ haUrl: base, code: (err && err.code) || 'PAIR_FAILED', message: (err && err.message) || '连不上' });
      console.error('[HA] pair home failed', base, err);
    }
  }
  const error = new Error('关联的 ' + list.length + ' 个家庭都连不上，请确认 HA 正在运行，且手机能访问家庭网络');
  error.code = 'HA_ALL_FAILED';
  error.details = failures.map((it) => it.haUrl + '：' + it.message);
  error.failures = failures;
  throw error;
};

// ---------------- GitHub Device Flow（同账号自动对接） ----------------

const githubStart = () =>
  raw({
    url: 'https://github.com/login/device/code',
    method: 'POST',
    form: true,
    data: { client_id: GH_CLIENT_ID, scope: GH_SCOPE }
  });

const githubPoll = (deviceCode) =>
  raw({
    url: 'https://github.com/login/oauth/access_token',
    method: 'POST',
    form: true,
    data: {
      client_id: GH_CLIENT_ID,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
    }
  });

const githubGists = (token) =>
  raw({
    url: 'https://api.github.com/gists?per_page=100',
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' }
  });

const githubRaw = (url, token) =>
  raw({ url, headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' } });

const tokenLogin = (base, token) =>
  raw({
    url: base + '/api/novaforge/account/token-login',
    method: 'POST',
    data: { provider: 'github', token },
    timeout: 8000
  });

/** 依次尝试 Gist 中记录的 HA 地址，直到 token-login 成功 */
const pairHa = async (urls, token) => {
  for (let i = 0; i < urls.length; i += 1) {
    const base = urls[i];
    try {
      const res = await tokenLogin(base, token);
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

module.exports = {
  GIST_FILE,
  configure,
  bootstrap,
  callService,
  logoutRemote,
  scanDevices,
  addDevice,
  pingHa,
  openidLogin,
  wxLoginCode,
  wxCodeLogin,
  pairHomes,
  githubStart,
  githubPoll,
  githubGists,
  githubRaw,
  tokenLogin,
  pairHa
};
