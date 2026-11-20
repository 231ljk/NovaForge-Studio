const THEME_KEY = 'nf-theme-mode';
const MODES = ['auto', 'light', 'dark'];

let mode = 'auto';
let dark = false;
let initialized = false;
const listeners = [];

const systemDark = () => {
  try {
    const info = wx.getAppBaseInfo ? wx.getAppBaseInfo() : wx.getSystemInfoSync();
    return info.theme === 'dark';
  } catch (err) {
    return false;
  }
};

const apply = () => {
  dark = mode === 'dark' || (mode === 'auto' && systemDark());
  const backgroundColor = dark ? '#151719' : '#ffffff';
  wx.setNavigationBarColor({
    frontColor: dark ? '#ffffff' : '#000000',
    backgroundColor,
    fail: () => undefined
  });
  wx.setTabBarStyle({
    color: dark ? '#8f979f' : '#86909c',
    selectedColor: '#33c9bd',
    backgroundColor: dark ? '#1d2022' : '#ffffff',
    borderStyle: dark ? 'white' : 'black',
    fail: () => undefined
  });
  wx.setBackgroundColor({
    backgroundColor: dark ? '#101214' : '#f5f6f7',
    backgroundColorTop: dark ? '#101214' : '#f5f6f7',
    backgroundColorBottom: dark ? '#101214' : '#f5f6f7',
    fail: () => undefined
  });
  listeners.slice().forEach((fn) => {
    try {
      fn(dark, mode);
    } catch (err) {
      console.error('[Theme] listener failed', err);
    }
  });
};

const init = () => {
  if (initialized) {
    apply();
    return;
  }
  initialized = true;
  try {
    const saved = wx.getStorageSync(THEME_KEY);
    if (MODES.indexOf(saved) >= 0) mode = saved;
  } catch (err) {
    console.error('[Theme] restore failed', err);
  }
  apply();
};

const subscribe = (fn) => {
  listeners.push(fn);
  fn(dark, mode);
  return () => {
    const index = listeners.indexOf(fn);
    if (index >= 0) listeners.splice(index, 1);
  };
};

const setMode = (next) => {
  if (MODES.indexOf(next) < 0) return;
  mode = next;
  try {
    wx.setStorageSync(THEME_KEY, next);
  } catch (err) {
    console.error('[Theme] save failed', err);
  }
  apply();
};

const modeLabel = () => ({ auto: '跟随系统', light: '浅色', dark: '深色' }[mode]);

module.exports = { init, subscribe, setMode, apply, modeLabel };
