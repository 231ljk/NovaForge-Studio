const store = require('../../services/store');
const ha = require('../../services/ha');
const fmt = require('../../utils/format');
const theme = require('../../services/theme');

const SCENE_ICONS = ['🎬', '🌙', '🛡️', '☀️', '🍽️', '📖'];

Page({
  data: {
    refreshing: false,
    connected: false,
    scenes: [],
    automations: [],
    activeAutomations: 0,
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
        if (message) wx.showToast({ title: message, icon: 'none' });
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
      if (message) wx.showToast({ title: message, icon: 'none' });
    });
  },

  sync() {
    const s = store.state;
    const data = s.data;
    const scenes = ((data && data.scenes) || []).map((item, index) => ({
      id: item.id,
      name: item.name,
      icon: SCENE_ICONS[index % SCENE_ICONS.length]
    }));
    const automations = ((data && data.automations) || []).map((item) => ({
      id: item.id,
      name: item.name,
      on: item.state === 'on',
      stateLabel: item.state === 'on' ? '已启用' : '已停用'
    }));

    this.setData({
      refreshing: s.refreshing,
      connected: store.isConnected(),
      scenes,
      automations,
      activeAutomations: automations.filter((item) => item.on).length
    });
  },

  goMe() {
    wx.switchTab({ url: '/pages/me/index' });
  },

  async onRunScene(e) {
    if (!store.isConnected()) return;
    const { id, name } = e.currentTarget.dataset;
    if (this.data.busyId) return;
    this.setData({ busyId: id });
    console.log('[Scenes] run', id);
    try {
      const res = await ha.callService('scene', 'turn_on', { entity_id: id });
      if (!res || !res.ok) throw new Error((res && res.error) || '场景执行失败');
      wx.showToast({ title: '已执行「' + name + '」', icon: 'none' });
    } catch (err) {
      console.error('[Scenes] run failed', err);
      wx.showToast({ title: fmt.errText(err), icon: 'none', duration: 2500 });
    } finally {
      this.setData({ busyId: '' });
    }
  },

  async onToggleAutomation(e) {
    if (!store.isConnected()) return;
    const { id } = e.currentTarget.dataset;
    const enabled = e.detail.value;
    if (this.data.busyId) return;
    this.setData({ busyId: id });
    console.log('[Scenes] automation', id, enabled);
    try {
      const res = await ha.callService('automation', enabled ? 'turn_on' : 'turn_off', {
        entity_id: id
      });
      if (!res || !res.ok) throw new Error((res && res.error) || '自动化设置失败');
      const message = await store.refresh();
      if (message) throw new Error(message);
    } catch (err) {
      console.error('[Scenes] automation failed', err);
      wx.showToast({ title: fmt.errText(err), icon: 'none', duration: 2500 });
    } finally {
      this.setData({ busyId: '' });
    }
  }
});
