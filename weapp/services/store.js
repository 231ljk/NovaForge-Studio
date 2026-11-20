const ha = require('./ha');
const account = require('./account');

const HA_KEY = 'nf-ha-url';
const SESSION_KEY = 'nf-session';
const RENEW_AHEAD = 60 * 1000; // 到期前 60s 静默续期
const RENEW_MIN_DELAY = 2000;

const state = {
  session: null,
  haUrl: '',
  data: null,
  ready: false,
  refreshing: false,
  renewing: false,
  renewError: ''
};

const listeners = [];
let renewTimer = null;

const canConnect = (session, haUrl) =>
  !!(session && (session.demo || (!session.pending && haUrl && session.token)));

const isConnected = () => canConnect(state.session, state.haUrl);

const emit = () => {
  listeners.forEach((fn) => {
    try {
      fn(state);
    } catch (err) {
      console.error('[Store] listener failed', err);
    }
  });
};

const subscribe = (fn) => {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
};

const clearRenewTimer = () => {
  if (renewTimer) {
    clearTimeout(renewTimer);
    renewTimer = null;
  }
};

const init = () => {
  if (state.ready) return;
  let session = null;
  let haUrl = '';
  try {
    const rawSession = wx.getStorageSync(SESSION_KEY);
    session = rawSession ? JSON.parse(rawSession) : null;
    haUrl = wx.getStorageSync(HA_KEY) || '';
  } catch (err) {
    console.error('[Store] restore session failed', err);
  }
  ha.configure({ haUrl, token: (session && session.token) || '', demo: !!(session && session.demo) });
  state.session = session;
  state.haUrl = haUrl;
  state.ready = true;
  emit();
  if (canConnect(session, haUrl)) {
    scheduleRenewal();
    refresh().catch((err) => console.error('[Store] boot refresh failed', err));
  }
};

const signIn = (session, haUrl) => {
  const url = haUrl || '';
  try {
    wx.setStorageSync(SESSION_KEY, JSON.stringify(session));
    wx.setStorageSync(HA_KEY, url);
  } catch (err) {
    console.error('[Store] persist session failed', err);
  }
  ha.configure({ haUrl: url, token: session.token || '', demo: !!session.demo });
  state.session = session;
  state.haUrl = url;
  state.data = null;
  state.renewError = '';
  emit();
  scheduleRenewal();
  if (canConnect(session, url)) {
    refresh().catch((err) => console.error('[Store] refresh after login failed', err));
  }
};

/**
 * 用微信身份换一个全新的 HA 会话。
 * 优先用「云端签名的身份断言」，云开发不可用时退回 wx.login code 直换通道。
 */
const renewByWechat = async (haUrl) => {
  let identity = null;
  try {
    identity = account.getLastIdentity();
    if (!identity || identity.expired) identity = await account.login();
    const res = await ha.openidLogin(haUrl, identity);
    return res;
  } catch (err) {
    // 云端不可用 / 云端没配置密钥 → 走 code 直换，保证续期不断
    if (err && (err.code === 'CLOUD_UNAVAILABLE' || err.code === 'HA_AUTH_FAILED' || err.code === 'HA_NO_TOKEN')) {
      const code = await ha.wxLoginCode();
      return ha.wxCodeLogin(haUrl, code);
    }
    throw err;
  }
};

/** 到期前静默续期；失败不清会话，只标记 renewError 让页面提示「请重新登录」 */
const renewSession = async () => {
  const session = state.session;
  if (!session || session.demo || !session.token || session.pending) return false;
  if (!state.haUrl || !/^https?:\/\//i.test(state.haUrl)) return false;
  if (state.renewing) return false;

  state.renewing = true;
  state.renewError = '';
  emit();
  try {
    const res = await renewByWechat(state.haUrl);
    if (!res || !res.token) throw new Error('HA 没有返回新的登录令牌');
    state.renewing = false;
    signIn(
      Object.assign({}, session, {
        token: res.token,
        expiresAt: res.expiresAt || 0,
        pending: false,
        openidMasked: res.openidMasked || session.openidMasked || ''
      }),
      state.haUrl
    );
    return true;
  } catch (err) {
    console.error('[Store] renew session failed', err);
    state.renewing = false;
    state.renewError = (err && err.message) || '会话续期失败，请重新登录';
    emit();
    return false;
  }
};

/** 按 expiresAt 安排下一次续期；没有 expiresAt 的会话不做定时续期（靠 401 兜底） */
const scheduleRenewal = () => {
  clearRenewTimer();
  const session = state.session;
  if (!session || session.demo || !session.token || session.pending) return;
  const expiresAt = Number(session.expiresAt) || 0;
  if (!expiresAt) return;
  const delay = Math.max(expiresAt - Date.now() - RENEW_AHEAD, RENEW_MIN_DELAY);
  // setTimeout 上限约 24.8 天，超长会话改为到期前再算
  if (delay > 2147480000) return;
  renewTimer = setTimeout(() => {
    renewTimer = null;
    renewSession().then((ok) => {
      if (!ok) {
        // 续期失败：把续期错误挂到 state，tab 页可据此提示重新登录
        emit();
      }
    });
  }, delay);
};

const signOut = () => {
  clearRenewTimer();
  if (isConnected()) {
    ha.logoutRemote().catch(() => undefined);
  }
  try {
    wx.removeStorageSync(SESSION_KEY);
    wx.removeStorageSync(HA_KEY);
  } catch (err) {
    console.error('[Store] clear session failed', err);
  }
  // 清账号维度缓存：换微信号登录后不会读到上一个人的通讯录
  try {
    account.clearCache();
  } catch (err) {
    console.error('[Store] clear account cache failed', err);
  }
  ha.configure({ haUrl: '', token: '', demo: false });
  state.session = null;
  state.haUrl = '';
  state.data = null;
  state.renewing = false;
  state.renewError = '';
  emit();
};

const demoSignIn = () => {
  signIn(
    { token: 'demo', email: 'demo@novaforge', name: '演示用户', provider: 'demo', demo: true },
    'demo://home-assistant'
  );
};

const refresh = async () => {
  if (!state.session) return undefined;
  if (!isConnected()) return '请先在“我的”中连接家庭';

  // 快到期时先续期再拉数据，避免拿到 401
  const expiresAt = Number(state.session.expiresAt) || 0;
  if (expiresAt && expiresAt - Date.now() <= RENEW_AHEAD) {
    await renewSession();
  }

  state.refreshing = true;
  emit();
  try {
    const res = await ha.bootstrap();
    if (!res || !res.ok) throw new Error('读取 HA 数据失败');
    state.data = res;
    state.refreshing = false;
    emit();
    return undefined;
  } catch (err) {
    console.error('[Store] refresh failed', err);
    state.refreshing = false;
    emit();
    if (err && err.status === 401) {
      signOut();
      wx.reLaunch({ url: '/pages/login/index?expired=1' });
      return '登录已失效，请重新登录';
    }
    return err && err.message ? err.message : String(err);
  }
};

/** tab 页登录守卫：未登录时跳转到登录页 */
const ensureSession = () => {
  if (!state.ready) return true;
  if (!state.session) {
    wx.reLaunch({ url: '/pages/login/index' });
    return false;
  }
  return true;
};

module.exports = {
  state,
  init,
  subscribe,
  signIn,
  signOut,
  demoSignIn,
  refresh,
  renewSession,
  ensureSession,
  isConnected
};
