const store = require('./services/store');
const theme = require('./services/theme');

App({
  globalData: {
    store
  },
  onLaunch() {
    // 启动阶段任何异常都会导致整站白屏，这里兜底保证页面仍能渲染
    try {
      theme.init();
    } catch (err) {
      console.error('[App] theme init failed', err);
    }
    try {
      store.init();
    } catch (err) {
      console.error('[App] store init failed', err);
    }
    try {
      if (wx.onThemeChange) {
        wx.onThemeChange(() => theme.apply());
      }
    } catch (err) {
      console.error('[App] theme listener failed', err);
    }
  }
});
