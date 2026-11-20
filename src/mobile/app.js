/* NovaForge 软件版 · 应用外壳
 * 负责四件事：视图切换（登录 / 主应用）、Tab 路由、子页返回栈、全局浮层。
 * 对应小程序版的 app.js + 自定义 tabBar 逻辑。
 */
window.NF = window.NF || {};

(function (NF) {
  'use strict';

  var TABS = ['home', 'scenes', 'me'];
  var TITLES = { home: '设备', scenes: '场景', me: '我的', 'add-device': '添加设备' };
  var MAIN_PAGES = ['home', 'scenes', 'me'];

  var current = 'home';
  var stack = [];
  var view = 'login';
  var loginBound = false;

  function $(id) { return document.getElementById(id); }

  function currentPage() {
    return current;
  }

  function showView(name) {
    view = name;
    var loginView = $('view-login');
    var appView = $('view-app');
    if (loginView) loginView.hidden = name !== 'login';
    if (appView) appView.hidden = name !== 'app';
  }

  function syncTopbar() {
    var back = $('nav-back');
    var title = $('nav-title');
    var right = $('nav-right');
    var isSub = MAIN_PAGES.indexOf(current) === -1;

    if (back) back.hidden = !isSub;
    if (title) title.textContent = TITLES[current] || '';
    if (right) {
      if (current === 'home') {
        right.innerHTML = '<div class="nav-add" id="nav-add">＋</div>';
        var add = $('nav-add');
        if (add) add.addEventListener('click', function () { openPage('add-device'); });
      } else {
        right.innerHTML = '';
      }
    }

    var tabbar = $('tabbar');
    if (tabbar) {
      tabbar.hidden = isSub;
      tabbar.querySelectorAll('[data-tab]').forEach(function (el) {
        el.classList.toggle('tab-item-active', el.dataset.tab === current);
      });
    }
  }

  function renderPage(name) {
    var host = $('page-host');
    var page = NF.pages[name];
    if (!host || !page) return;

    host.scrollTop = 0;
    if (typeof page.render === 'function') {
      host.innerHTML = page.render();
    }
    if (typeof page.bind === 'function') page.bind();
    if (typeof page.onShow === 'function') page.onShow();
    syncTopbar();
  }

  function refreshCurrent() {
    if (view !== 'app') return;
    var page = NF.pages[current];
    if (!page) return;
    if (typeof page.refreshDom === 'function') {
      page.refreshDom();
    } else {
      renderPage(current);
    }
  }

  function switchTab(name) {
    if (MAIN_PAGES.indexOf(name) === -1) return;
    stack = [];
    current = name;
    showView('app');
    renderPage(name);
  }

  function openPage(name) {
    if (!NF.pages[name]) return;
    stack.push(current);
    current = name;
    showView('app');
    renderPage(name);
  }

  function back() {
    var previous = stack.pop();
    current = previous || 'home';
    renderPage(current);
    return true;
  }

  /** 切视图：login / app / 直接指定某个 tab */
  function relaunch(target, params) {
    var options = params || {};
    if (target === 'login') {
      stack = [];
      current = 'home';
      showView('login');
      var loginPage = NF.pages.login;
      if (loginPage) {
        if (!loginBound && typeof loginPage.bind === 'function') {
          loginPage.bind();
          loginBound = true;
        }
        if (typeof loginPage.onShow === 'function') loginPage.onShow();
      }
      if (options.expired) NF.toast('登录已失效，请重新登录', 2600);
      return;
    }
    if (MAIN_PAGES.indexOf(target) >= 0) {
      switchTab(target);
      return;
    }
    stack = [];
    current = 'home';
    showView('app');
    renderPage('home');
  }

  // ---------------- 全局浮层 ----------------

  function bindOverlays() {
    var ok = $('dialog-ok');
    var cancel = $('dialog-cancel');
    if (ok) ok.addEventListener('click', function () { NF.closeDialog({ confirm: true, cancel: false }); });
    if (cancel) cancel.addEventListener('click', function () { NF.closeDialog({ confirm: false, cancel: true }); });

    var mask = $('dialog-mask');
    if (mask) {
      mask.addEventListener('click', function (event) {
        if (event.target === mask) NF.closeDialog({ confirm: false, cancel: true });
      });
    }

    var sheetMask = $('sheet-mask');
    var sheet = $('sheet');
    if (sheetMask) {
      sheetMask.addEventListener('click', function (event) {
        if (event.target === sheetMask) NF.closeSheet(-1);
      });
    }
    if (sheet) {
      sheet.addEventListener('click', function (event) {
        var item = event.target.closest('[data-sheet-index]');
        if (!item) return;
        NF.closeSheet(Number(item.dataset.sheetIndex));
      });
    }

    var tabbar = $('tabbar');
    if (tabbar) {
      tabbar.addEventListener('click', function (event) {
        var item = event.target.closest('[data-tab]');
        if (!item) return;
        switchTab(item.dataset.tab);
      });
    }

    var navBack = $('nav-back');
    if (navBack) navBack.addEventListener('click', back);

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      var dialogMask = $('dialog-mask');
      if (dialogMask && !dialogMask.hidden) {
        NF.closeDialog({ confirm: false, cancel: true });
        return;
      }
      if (stack.length) back();
    });

    window.addEventListener('online', function () { NF.toast('网络已恢复'); });
    window.addEventListener('offline', function () { NF.toast('网络已断开'); });
  }

  // ---------------- 启动 ----------------

  function boot() {
    NF.theme.init();
    bindOverlays();

    NF.store.subscribe(function () {
      if (view !== 'app') return;
      refreshCurrent();
    });

    NF.store.init();

    if (NF.store.state.session) {
      relaunch('app');
    } else {
      relaunch('login');
    }

    // 顶栏跟着滚动加阴影，纯视觉
    var host = $('page-host');
    var topbar = $('topbar');
    if (host && topbar) {
      host.addEventListener('scroll', function () {
        topbar.classList.toggle('topbar-scrolled', host.scrollTop > 4);
      });
    }
  }

  NF.app = {
    currentPage: currentPage,
    switchTab: switchTab,
    openPage: openPage,
    back: back,
    relaunch: relaunch,
    refreshCurrent: refreshCurrent
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}(window.NF));
