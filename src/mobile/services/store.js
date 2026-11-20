/* NovaForge 软件版 · 会话与数据仓库
 * 关键行为（与小程序版一致）：
 *  - 登录不再被 HA 地址阻断：没有地址时以 pending 会话进入 App，先能用界面，控设备时再引导连接；
 *  - 有地址且已有 token 才视为「已连接」，refresh 才会真正拉数据。
 */
window.NF = window.NF || {};

(function (NF) {
  'use strict';

  var HA_KEY = 'nf-ha-url';
  var SESSION_KEY = 'nf-session';

  var state = {
    session: null,
    haUrl: '',
    data: null,
    ready: false,
    refreshing: false
  };

  var listeners = [];

  /** 只有 demo 会话，或（非 pending 且地址与令牌齐全）才算可连接 */
  function canConnect(session, haUrl) {
    return !!(session && (session.demo || (!session.pending && haUrl && session.token)));
  }

  function isConnected() {
    return canConnect(state.session, state.haUrl);
  }

  function emit() {
    listeners.slice().forEach(function (fn) {
      try {
        fn(state);
      } catch (err) {
        console.error('[Store] listener failed', err);
      }
    });
  }

  function subscribe(fn) {
    listeners.push(fn);
    return function () {
      var i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  function init() {
    if (state.ready) return;
    var session = NF.storage.getJSON(SESSION_KEY, null);
    var haUrl = NF.storage.get(HA_KEY, '') || '';

    NF.ha.configure({ haUrl: haUrl, token: (session && session.token) || '', demo: !!(session && session.demo) });
    state.session = session || null;
    state.haUrl = haUrl;
    state.ready = true;
    emit();

    if (canConnect(session, haUrl)) {
      refresh().catch(function (err) { console.error('[Store] boot refresh failed', err); });
    }
  }

  function signIn(session, haUrl) {
    var url = haUrl || '';
    NF.storage.set(SESSION_KEY, JSON.stringify(session));
    NF.storage.set(HA_KEY, url);

    NF.ha.configure({ haUrl: url, token: session.token || '', demo: !!session.demo });
    state.session = session;
    state.haUrl = url;
    state.data = null;
    emit();

    if (canConnect(session, url)) {
      refresh().catch(function (err) { console.error('[Store] refresh after login failed', err); });
    }
  }

  /** 补登 HA 地址：把 pending 会话升级为正式连接 */
  function bindHa(token, haUrl, extra) {
    var session = Object.assign({}, state.session || {}, extra || {}, {
      token: token,
      pending: false
    });
    signIn(session, haUrl);
    return session;
  }

  function signOut() {
    if (isConnected()) NF.ha.logoutRemote().catch(function () { return undefined; });
    NF.storage.remove(SESSION_KEY);
    NF.ha.configure({ haUrl: state.haUrl, token: '', demo: false });
    state.session = null;
    state.data = null;
    emit();
  }

  function demoSignIn() {
    signIn(
      { token: 'demo', email: 'demo@novaforge', name: '演示用户', provider: 'demo', demo: true },
      'demo://home-assistant'
    );
  }

  async function refresh() {
    if (!state.session) return undefined;
    if (!isConnected()) return '请先在“我的”中连接家庭';

    state.refreshing = true;
    emit();
    try {
      var res = await NF.ha.bootstrap();
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
        if (NF.app) NF.app.relaunch('login', { expired: '1' });
        return '登录已失效，请重新登录';
      }
      return err && err.message ? err.message : String(err);
    }
  }

  /** 页面守卫：未登录时回到登录页 */
  function ensureSession() {
    if (!state.ready) return true;
    if (!state.session) {
      if (NF.app) NF.app.relaunch('login');
      return false;
    }
    return true;
  }

  NF.store = {
    state: state,
    HA_KEY: HA_KEY,
    SESSION_KEY: SESSION_KEY,
    init: init,
    subscribe: subscribe,
    signIn: signIn,
    bindHa: bindHa,
    signOut: signOut,
    demoSignIn: demoSignIn,
    refresh: refresh,
    ensureSession: ensureSession,
    isConnected: isConnected
  };
}(window.NF));
