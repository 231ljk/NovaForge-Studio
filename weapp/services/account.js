/**
 * 微信登录（云开发）+ 用户档案 + 家庭通讯录。
 *
 * v2.0.0 生产化改造要点：
 *   1. 云函数调用带 12s 超时 + 一次网络类自动重试，避免弱网下一直转圈
 *   2. 错误统一归一化为 { code, message }，页面只按 code 决定兜底策略
 *   3. 本地家庭缓存按 openid 维度隔离，换微信号不再串号
 *   4. 提供 silentLogin() / getLastIdentity()，登录页可秒进、后台再刷新
 *   5. 云开发不可用时抛 CLOUD_UNAVAILABLE，页面据此降级到 wx.login code 通道
 *
 * 小程序不保存 AppSecret：身份由云函数从微信上下文里直接取得 openid。
 */

const CACHE_KEY = 'nf-homes';
const IDENTITY_KEY = 'nf-identity';
const SCOPE_KEY = 'nf-scope';
const MAX_HOMES = 12;

const CALL_TIMEOUT = 12000;
const RETRY_DELAY = 600;
const IDENTITY_TTL = 240000; // 4 分钟（HA 侧断言有效期 5 分钟，留 1 分钟余量）

const CODES = {
  NO_IDENTITY: 'NO_IDENTITY',
  CLOUD_UNAVAILABLE: 'CLOUD_UNAVAILABLE',
  // 云函数 login 未部署（-505005 FunctionName parameter could not be found）
  FUNCTION_NOT_FOUND: 'FUNCTION_NOT_FOUND',
  // 云开发环境未开通 / 环境 ID 不存在（-501000 ENV_NOT_FOUND）
  ENV_NOT_FOUND: 'ENV_NOT_FOUND',
  INVALID_PARAM: 'INVALID_PARAM',
  RATE_LIMITED: 'RATE_LIMITED',
  HOME_LIMIT: 'HOME_LIMIT',
  TIMEOUT: 'TIMEOUT',
  NETWORK: 'NETWORK',
  UNKNOWN: 'UNKNOWN'
};

let initialized = false;
let currentScope = '';

// ---------------- 基础工具 ----------------

const init = () => {
  if (initialized) return;
  if (!wx.cloud) {
    const err = new Error('当前微信版本不支持云开发，请升级微信后重试');
    err.code = CODES.CLOUD_UNAVAILABLE;
    throw err;
  }
  try {
    wx.cloud.init({ env: wx.cloud.DYNAMIC_CURRENT_ENV, traceUser: true });
  } catch (err) {
    console.error('[Account] cloud init failed', err);
  }
  initialized = true;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** openid → 稳定的短哈希，用作本地缓存分区键（不落盘 openid 原文） */
const scopeOf = (openid) => {
  const value = String(openid || '');
  if (!value) return '';
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return 's' + hash.toString(16);
};

const mask = (openid) => {
  const value = String(openid || '');
  if (!value) return '';
  if (value.length <= 8) return value.slice(0, 2) + '****';
  return value.slice(0, 4) + '****' + value.slice(-4);
};

const normalize = (url) => String(url || '').trim().replace(/\/+$/, '');

const makeError = (code, message) => {
  const err = new Error(message || '微信登录失败');
  err.code = code || CODES.UNKNOWN;
  err.message = message || '微信登录失败';
  return err;
};

/** 把 sdk / 云函数返回的各种错误收敛成 { code, message } */
const toAccountError = (err) => {
  // 已是归一化后的 { code, message }（makeError 产物）直接透传
  if (err && err.code && err.message && !err.errCode && !err.errMsg) return err;
  const msg = String((err && (err.errMsg || err.message)) || '');
  const errCode = String((err && (err.errCode !== undefined && err.errCode !== null ? err.errCode : '')) || '');
  const hay = (errCode + ' ' + msg).trim();

  // 云函数未部署：-505005 / FunctionName parameter could not be found
  if (/-505005|FunctionName\s*parameter\s*could\s*not\s*be\s*found|function\s*not\s*found|FunctionName/i.test(hay)) {
    return makeError(CODES.FUNCTION_NOT_FOUND, '云函数 login 不存在，请在开发者工具中上传部署 cloudfunctions/login');
  }
  // 云开发环境未开通 / 环境 ID 不存在：-501000 / ENV_NOT_FOUND
  if (/-501000|ENV_NOT_FOUND|env(ironment)?\s*(id\s*)?(not\s*found|not\s*exists|invalid|不存在|未开通)|环境(不存在|未开通)/i.test(hay)) {
    return makeError(CODES.ENV_NOT_FOUND, '云开发环境未开通或环境 ID 不存在，请先在开发者工具中开通云开发');
  }
  if (/timeout|超时/i.test(hay)) return makeError(CODES.TIMEOUT, '云端响应超时，请检查网络后重试');
  if (/Cloud API isn't enabled|cloud\s*api\s*not\s*enabled|cloud\.init|云开发未初始化/i.test(hay)) {
    return makeError(CODES.CLOUD_UNAVAILABLE, '微信云开发服务未启用，请先在开发者工具中开通云开发');
  }
  if (/network|fail request|ERR_|断网|net::/i.test(hay)) return makeError(CODES.NETWORK, '网络不太稳定，请检查网络后重试');
  // 其余形如 cloud.callFunction:fail 的未知云调用错误
  if (/cloud\.callFunction/i.test(msg)) {
    return makeError(CODES.CLOUD_UNAVAILABLE, '调用 login 云函数失败，请确认云开发已开通且 login 云函数已部署');
  }
  return makeError(CODES.UNKNOWN, msg || '微信登录失败');
};

const isRetryable = (err) => {
  const code = (err && err.code) || '';
  return code === CODES.NETWORK || code === CODES.TIMEOUT;
};

// ---------------- 云函数调用 ----------------

const rawCall = (data) =>
  new Promise((resolve, reject) => {
    try {
      wx.cloud.callFunction({
        name: 'login',
        data,
        success: (res) => resolve((res && res.result) || {}),
        fail: (err) => {
          // 保留原始 errCode / errMsg，交给 toAccountError 精确识别
          // （-505005 云函数不存在 / -501000 环境不存在，不能一律当成网络错误）
          const e = new Error((err && (err.errMsg || err.message)) || '云函数调用失败');
          if (err && err.errCode !== undefined && err.errCode !== null) e.errCode = err.errCode;
          e.errMsg = (err && err.errMsg) || e.message;
          reject(toAccountError(e));
        }
      });
    } catch (err) {
      // 客户端根本没有云开发能力（基础库过低 / wx.cloud 不可用）
      reject(makeError(CODES.CLOUD_UNAVAILABLE, '当前微信版本不支持云开发，请升级微信后重试'));
    }
  });

const withTimeout = (promise, ms) =>
  new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      const err = new Error('云端响应超时');
      err.code = CODES.TIMEOUT;
      reject(err);
    }, ms);
    promise.then(
      (value) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(err);
      }
    );
  });

/**
 * 调云函数：12s 超时 + 网络类错误自动重试一次。
 * 成功返回 body（含 ok/code/message/data/version 与旧字段），失败抛 { code, message }。
 */
const call = async (action, payload, options) => {
  init();
  const opts = options || {};
  const data = Object.assign({ action }, payload || {});
  const attempts = opts.retry === false ? 1 : 2;
  let lastErr = null;

  for (let i = 0; i < attempts; i += 1) {
    try {
      const body = await withTimeout(rawCall(data), opts.timeout || CALL_TIMEOUT);
      if (!body || typeof body !== 'object') {
        throw makeError(CODES.CLOUD_UNAVAILABLE, '云函数没有返回有效结果，请确认 login 云函数已部署');
      }
      if (body.ok === false) {
        throw makeError(body.code || CODES.UNKNOWN, body.message || body.error || '云端处理失败');
      }
      return body;
    } catch (err) {
      lastErr = toAccountError(err);
      if (i < attempts - 1 && isRetryable(lastErr)) {
        await sleep(RETRY_DELAY);
        continue;
      }
      throw lastErr;
    }
  }
  throw toAccountError(lastErr);
};

// ---------------- 本地缓存（按 openid 维度隔离） ----------------

const scopedKey = (key) => (currentScope ? key + ':' + currentScope : key);

/** 切换缓存分区：登录拿到 openid 后调用；传空串表示清除分区 */
const setScope = (scopeOrOpenid) => {
  const scope = /^s[0-9a-f]+$/i.test(String(scopeOrOpenid || '')) ? scopeOrOpenid : scopeOf(scopeOrOpenid);
  currentScope = scope || '';
  try {
    if (currentScope) wx.setStorageSync(SCOPE_KEY, currentScope);
    else wx.removeStorageSync(SCOPE_KEY);
  } catch (err) {
    // ignore
  }
  return currentScope;
};

/** 冷启动时恢复分区，避免未登录就读到别人（上一个微信号）的通讯录 */
const restoreScope = () => {
  if (currentScope) return currentScope;
  try {
    currentScope = wx.getStorageSync(SCOPE_KEY) || '';
  } catch (err) {
    currentScope = '';
  }
  return currentScope;
};

const pickHomes = (raw) => {
  try {
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((item) => item && item.haUrl) : [];
  } catch (err) {
    return [];
  }
};

const readCache = () => {
  restoreScope();
  try {
    const scoped = pickHomes(wx.getStorageSync(scopedKey(CACHE_KEY)));
    if (scoped.length) return scoped.slice(0, MAX_HOMES);
    // 老版本只存了全局键：读出来做一次性迁移，避免升级后通讯录「消失」
    const legacy = pickHomes(wx.getStorageSync(CACHE_KEY));
    if (legacy.length && currentScope) writeCache(legacy);
    return legacy.slice(0, MAX_HOMES);
  } catch (err) {
    return [];
  }
};

const writeCache = (list) => {
  restoreScope();
  const clean = (Array.isArray(list) ? list : []).filter((item) => item && item.haUrl).slice(0, MAX_HOMES);
  try {
    wx.setStorageSync(scopedKey(CACHE_KEY), JSON.stringify(clean));
  } catch (err) {
    console.error('[Account] cache homes failed', err);
  }
  return clean;
};

const mergeCache = (list) => {
  const incoming = Array.isArray(list) ? list : [];
  if (!incoming.length) return readCache();
  const merged = incoming.slice();
  readCache().forEach((item) => {
    if (!merged.some((it) => it.haUrl === item.haUrl)) merged.push(item);
  });
  return writeCache(merged);
};

/** 清掉当前账号维度的缓存（登出时调用），其它账号分区的数据不受影响 */
const clearCache = () => {
  restoreScope();
  try {
    wx.removeStorageSync(scopedKey(CACHE_KEY));
    wx.removeStorageSync(IDENTITY_KEY);
  } catch (err) {
    console.error('[Account] clear cache failed', err);
  }
  currentScope = '';
  try {
    wx.removeStorageSync(SCOPE_KEY);
  } catch (err) {
    // ignore
  }
};

// ---------------- 身份 ----------------

const readStoredIdentity = () => {
  try {
    const raw = wx.getStorageSync(IDENTITY_KEY);
    if (!raw) return null;
    const identity = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!identity || !identity.openid) return null;
    return identity;
  } catch (err) {
    return null;
  }
};

const storeIdentity = (identity) => {
  try {
    wx.setStorageSync(IDENTITY_KEY, JSON.stringify(identity));
  } catch (err) {
    // 缓存失败不影响登录主流程
  }
};

const buildIdentity = (res) => {
  const profile = res.profile || null;
  return {
    openid: res.openid,
    unionid: res.unionid || '',
    appid: res.appid || (profile && profile.appid) || '',
    ts: res.ts || Date.now(),
    sig: res.sig || '',
    sigV1: res.sigV1 || '',
    sigVersion: res.sigVersion || 0,
    purpose: res.purpose || '',
    signed: !!res.signed,
    profile,
    masked: mask(res.openid),
    homeCount: (res.homes || []).length
  };
};

/** 拉取（或复用）微信身份 */
const login = async () => {
  const res = await call('whoami');
  if (!res.openid) throw makeError(CODES.NO_IDENTITY, '没有拿到微信身份，请重新打开小程序');
  setScope(scopeOf(res.openid));
  const identity = buildIdentity(res);
  identity.homes = mergeCache(res.homes);
  identity.savedAt = Date.now();
  storeIdentity(identity);
  return identity;
};

/**
 * 静默登录：本地缓存的断言还在有效期内就直接复用（不发任何请求），
 * 过期后再走一次云函数。用于登录页秒进 / 页面恢复。
 */
const silentLogin = async () => {
  const cached = readStoredIdentity();
  if (cached && Date.now() - (cached.ts || 0) < IDENTITY_TTL) {
    setScope(scopeOf(cached.openid));
    return Object.assign({}, cached, { cached: true, homes: cached.homes || readCache() });
  }
  return login();
};

/** 同步读取上一次的微信身份（不发请求，可能已过期） */
const getLastIdentity = () => {
  const cached = readStoredIdentity();
  if (!cached) return null;
  return Object.assign({}, cached, {
    masked: cached.masked || mask(cached.openid),
    expired: Date.now() - (cached.ts || 0) >= IDENTITY_TTL
  });
};

// ---------------- 用户档案 ----------------

const getProfile = async () => {
  const res = await call('profile');
  return res.profile || (res.data && res.data.profile) || null;
};

// ---------------- 家庭通讯录 ----------------

/** 读取云端已关联的家庭；云开发不可用时回落到本地缓存 */
const resolveHomes = async () => {
  try {
    const res = await call('homes');
    return mergeCache(res.homes);
  } catch (err) {
    if (err && err.code !== CODES.CLOUD_UNAVAILABLE) console.error('[Account] resolve homes failed', err);
    return readCache();
  }
};

/** 记录/刷新一个家庭地址；失败不阻断登录，仅本地留痕 */
const bindHome = async (haUrl, meta) => {
  const url = normalize(haUrl);
  if (!url) return { ok: false, code: CODES.INVALID_PARAM, error: '缺少家庭地址', homes: readCache() };
  const info = meta || {};
  const local = writeCache(
    [{ haUrl: url, haName: info.haName || '', lastUsedAt: Date.now() }].concat(
      readCache().filter((item) => item.haUrl !== url)
    )
  );
  try {
    const res = await call('bind', {
      haUrl: url,
      haName: info.haName || '',
      provider: info.provider || 'wechat'
    });
    return { ok: true, code: 'OK', homes: mergeCache(res.homes) };
  } catch (err) {
    console.error('[Account] bind home failed', err);
    return {
      ok: false,
      code: (err && err.code) || CODES.UNKNOWN,
      error: (err && err.message) || '云端没有记住这个家庭',
      homes: local
    };
  }
};

const unbindHome = async (haUrl) => {
  const url = normalize(haUrl);
  const local = writeCache(readCache().filter((item) => item.haUrl !== url));
  try {
    const res = await call('unbind', { haUrl: url });
    return { ok: true, code: 'OK', homes: writeCache(res.homes) };
  } catch (err) {
    return {
      ok: false,
      code: (err && err.code) || CODES.UNKNOWN,
      error: (err && err.message) || '解除关联失败',
      homes: local
    };
  }
};

/** 配对结果回写：成功清零 failCount，失败累加，供下次排序降级 */
const touchHome = async (haUrl, ok, haName) => {
  const url = normalize(haUrl);
  if (!url) return;
  try {
    await call('touch', { haUrl: url, ok: ok !== false, haName: haName || '' }, { retry: false });
  } catch (err) {
    // 网络类失败静默，不打扰用户
  }
};

module.exports = {
  CODES,
  init,
  scopeOf,
  setScope,
  restoreScope,
  login,
  silentLogin,
  getLastIdentity,
  getProfile,
  mask,
  resolveHomes,
  bindHome,
  unbindHome,
  touchHome,
  readCache,
  writeCache,
  clearCache
};
