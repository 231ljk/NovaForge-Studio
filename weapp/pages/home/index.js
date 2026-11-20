const store = require('../../services/store');
const ha = require('../../services/ha');
const fmt = require('../../utils/format');
const theme = require('../../services/theme');

Page({
  data: {
    ready: false,
    demo: false,
    connected: false,
    refreshing: false,
    greeting: '',
    displayName: '',
    homeName: '我的家庭',
    total: 0,
    active: 0,
    online: 0,
    entities: [],
    busyId: '',
    themeClass: ''
  },

  onLoad() {
    this.unsubscribe = store.subscribe(() => this.sync());
    this.themeUnsubscribe = theme.subscribe((dark) => {
      this.setData({ themeClass: dark ? 'theme-dark' : '' });
    });
    this.sync();
  },

  onUnload() {
    if (this.unsubscribe) this.unsubscribe();
    if (this.themeUnsubscribe) this.themeUnsubscribe();
  },

  onShow() {
    if (!store.ensureSession()) return;
    this.sync();
    if (store.isConnected()) {
      store.refresh().then((message) => {
        if (message) wx.showToast({ title: message, icon: 'none', duration: 2500 });
      });
    }
  },

  onPullDownRefresh() {
    if (!store.isConnected()) {
      wx.stopPullDownRefresh();
      return;
    }
    store.refresh().then((message) => {
      wx.stopPullDownRefresh();
      if (message) wx.showToast({ title: message, icon: 'none', duration: 2500 });
    });
  },

  sync() {
    const s = store.state;
    const data = s.data;
    const entities = ((data && data.entities) || []).map(fmt.toViewEntity);
    const session = s.session;
    const displayName = (session && (session.name || session.email)) || '家庭成员';

    this.setData({
      ready: s.ready,
      demo: !!(session && session.demo),
      connected: store.isConnected(),
      refreshing: s.refreshing,
      greeting: fmt.greeting(),
      displayName,
      homeName: (data && data.name) || '我的家庭',
      total: entities.length,
      active: entities.filter((item) => item.on).length,
      online: entities.filter((item) => item.state !== 'unavailable').length,
      entities
    });
  },

  goAddDevice() {
    wx.navigateTo({ url: '/pages/add-device/index' });
  },

  goMe() {
    wx.switchTab({ url: '/pages/me/index' });
  },

  onTapDevice(e) {
    const { id } = e.currentTarget.dataset;
    const item = this.data.entities.filter((v) => v.id === id)[0];
    if (!item || item.readonly || this.data.busyId) return;
    this.control(item);
  },

  async control(item) {
    const domain = item.domain;
    let service = item.on ? 'turn_off' : 'turn_on';

    if (domain === 'lock') service = item.state === 'locked' ? 'unlock' : 'lock';
    else if (domain === 'cover') service = item.state === 'open' ? 'close_cover' : 'open_cover';
    else if (domain === 'button') service = 'press';
    else if (domain === 'scene' || domain === 'script') service = 'turn_on';

    this.setData({ busyId: item.id });
    console.log('[Home] control', item.id, domain, service);
    try {
      const res = await ha.callService(domain, service, { entity_id: item.id });
      if (!res || !res.ok) throw new Error((res && res.error) || '设备控制失败');
      await store.refresh();
    } catch (err) {
      console.error('[Home] control failed', err);
      wx.showToast({ title: fmt.errText(err), icon: 'none', duration: 2500 });
    } finally {
      this.setData({ busyId: '' });
    }
  }
});
