const store = require('../../services/store');
const theme = require('../../services/theme');
const permissions = require('../../services/permissions');
const ha = require('../../services/ha');
const account = require('../../services/account');
const fmt = require('../../utils/format');

const PROVIDER_LABEL = {
  wechat: '微信账号',
  github: 'GitHub 账号',
  gitee: 'Gitee 账号',
  email: '邮箱账号',
  demo: '演示模式'
};

Page({
  data: {
    displayName: '家庭成员',
    initial: '家',
    subtitle: '',
    providerLabel: '',
    demo: false,
    avatar: '',
    connected: false,
    connectionLabel: '待连接',
    haUrl: '',
    connecting: false,
    connectStatus: '',
    deviceCount: 0,
    sceneCount: 0,
    automationCount: 0,
    refreshing: false,
    version: '1.2.0',
    haName: '',
    homes: [],
    themeClass: '',
    themeMode: 'auto',
    themeLabel: '跟随系统',
    bluetoothStatus: '按需授权',
    wifiStatus: '按需授权',
    notificationStatus: '未开启',
    wechatMasked: ''
  },

  onLoad() {
    this.unsubscribe = store.subscribe(() => this.sync());
    this.themeUnsubscribe = theme.subscribe((dark, mode) => {
      this.setData({
        themeClass: dark ? 'theme-dark' : '',
        themeMode: mode,
        themeLabel: theme.modeLabel()
      });
    });
    const savedUrl = store.state.haUrl;
    if (savedUrl && !/^demo:\/\//.test(savedUrl)) this.setData({ haUrl: savedUrl });
    this.setData({ homes: account.readCache() });
    account.resolveHomes().then((list) => {
      if (!this.disposed && Array.isArray(list)) this.setData({ homes: list });
    }).catch(() => undefined);

    // 云端用户档案（脱敏）：仅展示微信身份掩码
    const cached = account.getLastIdentity();
    if (cached) {
      this.setData({
        wechatMasked: cached.masked || ''
      });
    }
    account.getProfile().then((profile) => {
      if (this.disposed || !profile) return;
      this.setData({
        wechatMasked: profile.openidMasked || this.data.wechatMasked
      });
    }).catch(() => undefined);
    this.sync();
  },

  onUnload() {
    this.disposed = true;
    if (this.unsubscribe) this.unsubscribe();
    if (this.themeUnsubscribe) this.themeUnsubscribe();
  },

  onShow() {
    if (!store.ensureSession()) return;
    let enabled = false;
    try {
      enabled = !!wx.getStorageSync('nf-system-notifications');
    } catch (err) {
      enabled = false;
    }
    this.setData({ notificationStatus: enabled ? '已开启' : '未开启' });
    this.sync();
  },

  sync() {
    const s = store.state;
    const session = s.session || {};
    const data = s.data || {};
    const displayName = session.name || session.email || '家庭成员';
    const connected = store.isConnected();
    const connectionLabel = session.demo ? '演示家庭' : (connected ? (s.refreshing ? '同步中' : '已连接') : '待连接');
    let subtitle = session.email || '';
    if (!subtitle && session.provider === 'wechat') {
      if (session.openidMasked) subtitle = '微信 ' + session.openidMasked;
    }
    // 续期失败：明确提示重新登录，不静默失败
    if (s.renewError && !this.renewNotified) {
      this.renewNotified = true;
      this.setData({ connectStatus: '登录状态已过期，请重新登录' });
      wx.showToast({ title: '登录已过期，请重新登录', icon: 'none', duration: 2500 });
    }
    if (!s.renewError) this.renewNotified = false;
    this.setData({
      displayName,
      initial: displayName.charAt(0).toUpperCase(),
      avatar: session.avatar || '',
      subtitle,
      providerLabel: PROVIDER_LABEL[session.provider] || (connected ? '已登录' : '待连接'),
      demo: !!session.demo,
      connected,
      connectionLabel,
      deviceCount: (data.entities || []).length,
      sceneCount: (data.scenes || []).length,
      automationCount: (data.automations || []).length,
      refreshing: s.refreshing,
      haName: session.haName || ''
    });
  },

  onRefresh() {
    if (!store.isConnected()) {
      wx.showToast({ title: '请先连接家庭', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '同步中' });
    store.refresh().then((message) => {
      wx.hideLoading();
      if (message) wx.showToast({ title: message, icon: 'none', duration: 2500 });
      else wx.showToast({ title: '已同步最新状态', icon: 'none' });
    });
  },

  onHaUrlInput(e) {
    this.setData({ haUrl: (e.detail && e.detail.value) || '', connectStatus: '' });
  },

  async onConnect() {
    if (this.data.connecting) return;
    const base = fmt.normalizeUrl(this.data.haUrl);
    if (!base) {
      this.setData({ connectStatus: '请填写 Home Assistant 地址' });
      return;
    }

    const session = store.state.session || {};
    this.setData({ connecting: true, haUrl: base, connectStatus: '正在检查地址…' });
    try {
      const ping = await ha.pingHa(base);
      const haName = (ping && ping.name) || '';
      let nextSession;
      if (session.provider === 'wechat') {
        this.setData({ connectStatus: '正在获取微信身份…' });
        let res;
        let identity = null;
        try {
          identity = await account.login();
          this.setData({ connectStatus: '正在连接家庭…' });
          res = identity && identity.signed
            ? await ha.openidLogin(base, identity)
            : await ha.wxCodeLogin(base, await ha.wxLoginCode());
        } catch (err) {
          // 云开发不可用时，用 wx.login 的 code 走 HA 侧直换
          console.error('[Me] cloud identity failed, fallback to code', err);
          this.setData({ connectStatus: '正在连接家庭…' });
          res = await ha.wxCodeLogin(base, await ha.wxLoginCode());
        }
        nextSession = {
          token: res.token,
          expiresAt: res.expiresAt || 0,
          email: '',
          name: session.name || '微信用户',
          avatar: session.avatar || '',
          provider: 'wechat',
          openidMasked: res.openidMasked || (identity && identity.masked) || '',
          haName
        };
      } else if (session.provider === 'github') {
        if (!session.providerToken) throw new Error('请退出后重新使用 GitHub 授权');
        this.setData({ connectStatus: '正在连接家庭…' });
        const res = await ha.tokenLogin(base, session.providerToken);
        if (!res || !res.ok || !res.token) {
          throw new Error((res && res.error) || '这个家庭没有绑定当前 GitHub 账号');
        }
        const ghAccount = res.account || {};
        nextSession = {
          token: res.token,
          expiresAt: res.expiresAt || 0,
          email: ghAccount.email || ghAccount.login || '',
          name: ghAccount.name || ghAccount.login || 'GitHub 用户',
          provider: 'github',
          haName
        };
      } else {
        throw new Error('请退出后重新选择登录方式');
      }

      store.signIn(nextSession, base);
      // 把「这个微信连过哪个家庭」写回云端通讯录，下次登录免填地址
      if (nextSession.provider === 'wechat') account.touchHome(base, true, haName);
      account.bindHome(base, { haName }).then((r) => {
        if (r && r.homes && !this.disposed) this.setData({ homes: r.homes });
      }).catch(() => undefined);
      this.setData({ connectStatus: '', haName });
      wx.showToast({ title: '家庭已连接', icon: 'none' });
    } catch (err) {
      console.error('[Me] connect failed', err);
      this.setData({ connectStatus: err.message || fmt.errText(err) });
    } finally {
      this.setData({ connecting: false });
    }
  },

  goAddDevice() {
    wx.navigateTo({ url: '/pages/add-device/index' });
  },

  onThemeMode(e) {
    theme.setMode(e.currentTarget.dataset.mode);
  },

  async onBluetoothPermission() {
    this.setData({ bluetoothStatus: '正在检查…' });
    const granted = await permissions.requestBluetooth();
    this.setData({ bluetoothStatus: granted ? '蓝牙可用' : '未授权或已关闭' });
  },

  async onWifiPermission() {
    this.setData({ wifiStatus: '正在检查…' });
    const granted = await permissions.requestWifi();
    this.setData({ wifiStatus: granted ? 'WiFi 可用' : '未授权或未连接' });
  },

  async onNotificationPermission() {
    if (!permissions.notificationsConfigured()) {
      this.setData({ notificationStatus: '待配置模板' });
    }
    const granted = await permissions.requestNotifications();
    this.setData({ notificationStatus: granted ? '已开启' : (permissions.notificationsConfigured() ? '未开启' : '待配置模板') });
  },

  /** 从云端通讯录里移除一个家庭（不影响已登录会话，只影响下次自动连接） */
  onForgetHome(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    wx.showModal({
      title: '移除关联',
      content: '仅从这个微信的家庭列表里移除，不会动 Home Assistant 里的任何数据。',
      confirmText: '移除',
      success: (res) => {
        if (!res.confirm) return;
        account.unbindHome(url).then((r) => {
          this.setData({ homes: (r && r.homes) || [] });
          if (url === store.state.haUrl) {
            this.setData({ connectStatus: '这个家庭已从云端列表移除，如需重连请重新填写地址' });
          }
          wx.showToast({ title: '已移除', icon: 'none' });
        }).catch((err) => {
          wx.showToast({ title: (err && err.message) || '移除失败，请稍后再试', icon: 'none' });
        });
      }
    });
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后需要重新使用账号对接家庭，确定继续吗？',
      confirmText: '退出',
      confirmColor: '#f53f3f',
      success: (res) => {
        if (!res.confirm) return;
        store.signOut();
        wx.reLaunch({ url: '/pages/login/index' });
      }
    });
  }
});
