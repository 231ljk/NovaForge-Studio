/* NovaForge 软件版 · 主题
 * auto / light / dark 三态；dark 时给 body 加 theme-dark，由 CSS 变量整体切换。
 * 对应小程序版 services/theme.js 的 setNavigationBarColor / setTabBarStyle 行为。
 */
window.NF = window.NF || {};

(function (NF) {
  'use strict';

  var THEME_KEY = 'nf-theme-mode';
  var MODES = ['auto', 'light', 'dark'];

  var mode = 'auto';
  var dark = false;
  var initialized = false;
  var listeners = [];
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function systemDark() {
    return !!(media && media.matches);
  }

  function apply() {
    dark = mode === 'dark' || (mode === 'auto' && systemDark());
    document.body.classList.toggle('theme-dark', dark);

    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = dark ? '#101214' : '#f5f6f7';

    listeners.slice().forEach(function (fn) {
      try {
        fn(dark, mode);
      } catch (err) {
        console.error('[Theme] listener failed', err);
      }
    });
  }

  function init() {
    if (initialized) {
      apply();
      return;
    }
    initialized = true;

    var saved = NF.storage.get(THEME_KEY, '');
    if (MODES.indexOf(saved) >= 0) mode = saved;

    if (media) {
      var onChange = function () { if (mode === 'auto') apply(); };
      if (media.addEventListener) media.addEventListener('change', onChange);
      else if (media.addListener) media.addListener(onChange);
    }

    apply();
  }

  function subscribe(fn) {
    listeners.push(fn);
    fn(dark, mode);
    return function () {
      var index = listeners.indexOf(fn);
      if (index >= 0) listeners.splice(index, 1);
    };
  }

  function setMode(next) {
    if (MODES.indexOf(next) < 0) return;
    mode = next;
    NF.storage.set(THEME_KEY, next);
    apply();
  }

  function modeLabel() {
    return { auto: '跟随系统', light: '浅色', dark: '深色' }[mode];
  }

  NF.theme = {
    init: init,
    subscribe: subscribe,
    setMode: setMode,
    apply: apply,
    modeLabel: modeLabel,
    isDark: function () { return dark; },
    currentMode: function () { return mode; }
  };
}(window.NF));
