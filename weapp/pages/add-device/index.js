const store = require('../../services/store');
const ha = require('../../services/ha');
const fmt = require('../../utils/format');
const theme = require('../../services/theme');

Page({
  data: {
    demo: false,
    connected: false,
    scanning: false,
    scanned: false,
    scanError: false,
    devices: [],
    selectedDevice: null,
    showManual: false,
    host: '',
    port: '80',
    token: '',
    adding: false,
    status: '',
    themeClass: ''
  },

  onLoad() {
    this.themeUnsubscribe = theme.subscribe((dark) => {
      this.setData({ themeClass: dark ? 'theme-dark' : '' });
    });
    const connected = store.isConnected();
    this.setData({ demo: !!(store.state.session && store.state.session.demo), connected });
    if (connected) this.onScan();
  },

  onUnload() {
    this.disposed = true;
    if (this.themeUnsubscribe) this.themeUnsubscribe();
  },

  onHostInput(e) {
    this.setData({ host: e.detail.value });
  },

  onPortInput(e) {
    this.setData({ port: e.detail.value });
  },

  onTokenInput(e) {
    this.setData({ token: e.detail.value });
  },

  goMe() {
    wx.switchTab({ url: '/pages/me/index' });
  },

  async onScan() {
    if (!store.isConnected()) {
      this.setData({ status: '请先连接家庭' });
      return;
    }
    if (this.data.scanning) return;
    this.disposed = false;
    this.setData({
      scanning: true,
      scanned: false,
      scanError: false,
      showManual: false,
      selectedDevice: null,
      devices: [],
      status: '正在搜索局域网设备…'
    });
    console.log('[AddDevice] automatic scan start');
    try {
      // 空网段由 HA 扩展根据自身网络自动判断，手机无需填写任何地址。
      const res = await ha.scanDevices('');
      if (this.disposed) return;
      if (!res || !res.ok) throw new Error((res && res.error) || '扫描失败');
      const devices = (res.devices || []).map((item) => ({
        name: item.name || 'NovaForge 设备',
        host: item.host,
        port: String(item.port || 80),
        label: item.host
      }));
      this.setData({
        devices,
        scanned: true,
        scanError: false,
        showManual: devices.length === 0,
        status: devices.length
          ? '找到 ' + devices.length + ' 台设备'
          : '未发现设备，请检查电源和 WiFi'
      });
    } catch (err) {
      console.error('[AddDevice] scan failed', err);
      if (this.disposed) return;
      this.setData({
        scanned: true,
        scanError: true,
        showManual: true,
        status: '自动搜索未完成：' + fmt.errText(err)
      });
    } finally {
      if (!this.disposed) this.setData({ scanning: false });
    }
  },

  onPickDevice(e) {
    const host = e.currentTarget.dataset.host;
    const selected = this.data.devices.filter((item) => item.host === host)[0];
    if (!selected) return;
    this.setData({
      selectedDevice: selected,
      host: selected.host,
      port: selected.port || '80',
      status: '请输入设备配对密钥'
    });
  },

  onCancelPair() {
    this.setData({ selectedDevice: null, token: '', status: '请选择要配对的设备' });
  },

  async onAdd() {
    if (!store.isConnected()) {
      wx.showToast({ title: '请先连接家庭', icon: 'none' });
      return;
    }
    if (this.data.adding) return;
    if (this.data.demo) {
      wx.showToast({ title: '演示模式不会写入真实设备', icon: 'none' });
      return;
    }
    const host = String(this.data.host || '').trim();
    const port = String(this.data.port || '80').trim();
    const token = String(this.data.token || '').trim();
    if (!host) {
      wx.showToast({ title: '请填写设备地址', icon: 'none' });
      return;
    }
    if (!token) {
      wx.showToast({ title: '请填写设备配对密钥', icon: 'none' });
      return;
    }
    this.setData({ adding: true, status: '正在写入 Home Assistant…' });
    console.log('[AddDevice] add', host, port);
    try {
      const res = await ha.addDevice(host, port, token);
      if (!res || !res.ok) throw new Error((res && res.error) || '添加失败');
      const message = await store.refresh();
      if (message) throw new Error(message);
      wx.showToast({ title: '设备已添加', icon: 'success' });
      setTimeout(() => wx.navigateBack({ delta: 1 }), 800);
    } catch (err) {
      console.error('[AddDevice] add failed', err);
      this.setData({ status: fmt.errText(err) });
    } finally {
      this.setData({ adding: false });
    }
  }
});
