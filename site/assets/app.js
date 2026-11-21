/* ==========================================================================
   NovaForge — 官方下载页交互（Flash / Studio / 网页版）
   纯原生 JS，无外部依赖（适配国内网络环境）
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------------- 顶栏滚动阴影 ---------------- */
  var topbar = $('#topbar');
  function onScroll() {
    if (!topbar) return;
    topbar.classList.toggle('is-stuck', window.scrollY > 8);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------------- 移动端菜单 ---------------- */
  var navToggle = $('#navToggle');
  var nav = $('#nav');
  function closeNav() {
    if (!nav || !navToggle) return;
    nav.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
  }
  if (navToggle && nav) {
    navToggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    $$('a', nav).forEach(function (a) { a.addEventListener('click', closeNav); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeNav();
    });
  }

  /* ---------------- 设备识别 ---------------- */
  var UA = navigator.userAgent || '';

  function detectPlatform() {
    if (/MicroMessenger/i.test(UA)) return 'weapp';
    if (/HarmonyOS|OpenHarmony/i.test(UA)) return 'harmony';
    if (/Android/i.test(UA)) return 'android';
    if (/iPhone|iPad|iPod/i.test(UA)) return 'ios';
    if (/Macintosh|Mac OS X/i.test(UA)) return 'macos';
    if (/Windows/i.test(UA)) return 'windows';
    if (/Linux|X11/i.test(UA)) return 'linux';
    return '';
  }

  var PLATFORM_LABEL = {
    windows: 'Windows',
    macos: 'macOS',
    ios: 'iOS',
    linux: 'Linux',
    android: 'Android',
    harmony: 'HarmonyOS',
    weapp: '微信小程序'
  };

  /* ---------------- 下载线路：国内 / 国际双仓库 ----------------
   * CN_RELEASES 填国内仓库的 releases 直链前缀（留空则自动回退 GitHub）。
   * 判定顺序：用户手动选择 > 网络探测 + 时区/语言 > 默认国内镜像。
   */
  var GH_RELEASES = 'https://github.com/231ljk/NovaForge-Studio/releases/latest/download/';
  var CN_RELEASES = 'https://gitee.com/q3w6/NovaForge-Studio/releases/download/v0.1.0/';
  var MIRROR_KEY = 'nf-mirror';

  var mirror = 'global';
  var RELEASES = GH_RELEASES;
  var FLASH_EXE = '';
  var STUDIO_DMG = '';
  var ANDROID_APK = '';

  function setMirror(m) {
    mirror = (m === 'cn' && CN_RELEASES) ? 'cn' : 'global';
    RELEASES = mirror === 'cn' ? CN_RELEASES : GH_RELEASES;
    FLASH_EXE = RELEASES + 'NovaForge-Flash-Setup-0.1.0.exe';
    STUDIO_DMG = RELEASES + 'NovaForge-Studio-0.1.0-arm64.dmg';
    ANDROID_APK = RELEASES + 'NovaForge-Studio-0.1.0-android-release.apk';
  }
  setMirror('global');

  /* 国内镜像已上传的文件（Gitee 单文件上限 100MB，超限文件自动回退 GitHub） */
  var CN_FILES = {
    'NovaForge-Studio-0.1.0-android-release.apk': 1,
    'NovaForge-Studio-0.1.0-harmony-signed.hap': 1,
    'NovaForge-Studio-0.1.0-ios-unsigned.ipa': 1
  };
  var CN_SPLIT_BASE = 'NovaForge-Studio-Setup-0.1.0.exe';

  function cnUrlFor(file) {
    if (mirror !== 'cn') return '';
    if (CN_FILES[file]) return CN_RELEASES + file;
    if (file === CN_SPLIT_BASE) return CN_RELEASES + CN_SPLIT_BASE + '.part1';
    return '';
  }

  /* 把页面里写死的 GitHub 直链统一改写到当前线路 */
  function rewriteStaticLinks() {
    $$('a[href]').forEach(function (a) {
      var h = a.getAttribute('href') || '';
      var file = '';
      if (h.indexOf(GH_RELEASES) === 0) file = h.slice(GH_RELEASES.length);
      else if (CN_RELEASES && h.indexOf(CN_RELEASES) === 0) file = h.slice(CN_RELEASES.length);
      if (!file) return;
      var cn = cnUrlFor(file);
      a.setAttribute('href', cn || (GH_RELEASES + file));
      if (cn && file === CN_SPLIT_BASE) a.setAttribute('data-cn-split', '1');
      else a.removeAttribute('data-cn-split');
    });
  }

  /* 国内线路下，Windows 安装包为 5 卷分卷，动态列出全部卷 */
  function renderSplitBox() {
    var old = document.getElementById('cnSplitBox');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    if (mirror !== 'cn') return;
    var target = null;
    $$('a[href]').forEach(function (a) {
      if (!target && a.getAttribute('data-cn-split') === '1') target = a;
    });
    if (!target) return;
    var host = target.parentNode;
    var box = document.createElement('div');
    box.id = 'cnSplitBox';
    box.className = 'cn-split';
    var html = '<p class="cn-split-title">国内镜像：Windows 安装包为 5 卷分卷（Gitee 单文件上限 100MB）</p><div class="cn-split-links">';
    for (var i = 1; i <= 5; i++) {
      html += '<a href="' + CN_RELEASES + CN_SPLIT_BASE + '.part' + i + '">part' + i + '</a>';
    }
    html += '</div><p class="cn-split-tip">5 卷全部下载到同一目录后，在该目录打开命令提示符执行：<code>copy /b ' + CN_SPLIT_BASE + '.part1+' + CN_SPLIT_BASE + '.part2+' + CN_SPLIT_BASE + '.part3+' + CN_SPLIT_BASE + '.part4+' + CN_SPLIT_BASE + '.part5 ' + CN_SPLIT_BASE + '</code></p>';
    box.innerHTML = html;
    host.parentNode.insertBefore(box, host.nextSibling);
  }

  /* 网络归属判定：GitHub 不可达 → 国内；可达但时区/语言为中国 → 仍走国内（更快） */
  function resolveMirror() {
    var saved = '';
    try { saved = localStorage.getItem(MIRROR_KEY) || ''; } catch (e) {}
    if (saved === 'cn' || saved === 'global') return Promise.resolve(saved);

    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    var lang = navigator.language || '';
    var cnRegion = /Shanghai|Chongqing|Urumqi|Harbin|Beijing/i.test(tz) || /^zh/i.test(lang);

    return new Promise(function (resolve) {
      var settled = false;
      var finish = function (m) { if (!settled) { settled = true; resolve(m); } };
      var timer = setTimeout(function () { finish('cn'); }, 1800);
      try {
        var ctrl = window.AbortController ? new AbortController() : null;
        var opt = { mode: 'no-cors', cache: 'no-store' };
        if (ctrl) opt.signal = ctrl.signal;
        fetch('https://github.com/favicon.ico', opt).then(function () {
          clearTimeout(timer);
          finish(cnRegion ? 'cn' : 'global');
        }).catch(function () {
          clearTimeout(timer);
          finish('cn');
        });
      } catch (e) {
        clearTimeout(timer);
        finish('cn');
      }
    });
  }

  function updateMirrorUI() {
    var box = document.getElementById('mirrorSwitch');
    if (box) {
      $$('button', box).forEach(function (b) {
        b.classList.toggle('is-active', b.getAttribute('data-mirror') === mirror);
      });
    }
    var tip = document.getElementById('mirrorTip');
    if (tip) {
      tip.textContent = mirror === 'cn'
        ? '当前线路：国内镜像（下载更快）'
        : '当前线路：GitHub 国际线路';
    }
  }

  function applyPlatformLinks() {
  var current = detectPlatform();
  var hint = $('#uaHint');
  var primary = $('#primaryDownload');
  var primaryText = $('#primaryDownloadText');
  var androidCard = $('.platform-card[data-platform="android"]');

  if (current) {
    var card = $('.platform-card[data-platform="' + current + '"]');
    if (card) card.classList.add('is-current');

    if (hint) {
      var ready = current === 'android' || current === 'windows' || current === 'macos' || current === 'linux';
      hint.innerHTML = ready
        ? '已识别到你的设备：<b>' + PLATFORM_LABEL[current] + '</b>，可直接下载安装包。'
        : '已识别到你的设备：<b>' + PLATFORM_LABEL[current] + '</b>，可先使用免安装网页版。';
    }

    if (primary && primaryText) {
      if (current === 'windows') {
        primary.href = FLASH_EXE;
        primary.removeAttribute('download');
        primaryText.textContent = '下载 NovaForge Flash';
      } else if (current === 'android') {
        primary.href = ANDROID_APK;
        primary.setAttribute('download', '');
        primaryText.textContent = '下载 Android 版 v0.1.0';
      } else if (current === 'macos') {
        primary.href = STUDIO_DMG;
        primary.removeAttribute('download');
        primaryText.textContent = '下载 NovaForge Studio';
      } else if (current === 'linux') {
        primary.href = RELEASES + 'NovaForge-Studio-0.1.0-amd64.deb';
        primary.removeAttribute('download');
        primaryText.textContent = '下载 Linux 版';
      } else if (current === 'harmony') {
        primary.href = RELEASES + 'NovaForge-Studio-0.1.0-harmony-signed.hap';
        primary.removeAttribute('download');
        primaryText.textContent = '下载鸿蒙 HAP';
      } else if (current === 'ios') {
        primary.href = RELEASES + 'NovaForge-Studio-0.1.0-ios-unsigned.ipa';
        primary.removeAttribute('download');
        primaryText.textContent = '下载 iOS 版 v0.1.0（未签名）';
      } else if (current === 'weapp') {
        primary.href = '#download';
        primaryText.textContent = '小程序即将开放';
      } else {
        primary.href = 'app/';
        primaryText.textContent = '使用网页版';
      }
    }
  } else if (hint) {
    hint.textContent = '请选择与设备匹配的版本；没有安装包时可直接使用网页版。';
  }
  }


  /* ---------------- 启动：先按默认线路渲染，再按网络归属切换 ---------------- */
  applyPlatformLinks();
  rewriteStaticLinks();
  renderSplitBox();
  updateMirrorUI();

  resolveMirror().then(function (m) {
    setMirror(m);
    applyPlatformLinks();
    rewriteStaticLinks();
    renderSplitBox();
    updateMirrorUI();
  });

  var mirrorBox = document.getElementById('mirrorSwitch');
  if (mirrorBox) {
    mirrorBox.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('button[data-mirror]') : null;
      if (!btn) return;
      var m = btn.getAttribute('data-mirror');
      if (m === 'cn' && !CN_RELEASES) {
        toast('国内镜像地址尚未配置，已使用 GitHub 线路');
        return;
      }
      try { localStorage.setItem(MIRROR_KEY, m); } catch (err) {}
      setMirror(m);
      applyPlatformLinks();
      rewriteStaticLinks();
      renderSplitBox();
      updateMirrorUI();
      toast(m === 'cn' ? '已切换到国内镜像' : '已切换到 GitHub 国际线路');
    });
  }

  // 安卓卡片高亮时滚动到可见位置不强制，仅保留视觉标记

  /* ---------------- 复制 SHA-256 ---------------- */
  var copyBtn = $('#copyHash');
  var hashEl = $('#apkHash');

  function toast(msg) {
    var el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('is-show'); }, 2200);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        resolve();
      } catch (err) { reject(err); }
    });
  }

  if (copyBtn && hashEl) {
    copyBtn.addEventListener('click', function () {
      copyText(hashEl.textContent.trim()).then(function () {
        copyBtn.textContent = '已复制';
        toast('校验值已复制');
        setTimeout(function () { copyBtn.textContent = '复制'; }, 1800);
      }).catch(function () {
        toast('复制失败，请手动选中复制');
      });
    });
  }

  var copyIpaBtn = $('#copyIpaHash');
  var ipaHashEl = $('#ipaHash');
  if (copyIpaBtn && ipaHashEl) {
    copyIpaBtn.addEventListener('click', function () {
      copyText(ipaHashEl.textContent.trim()).then(function () {
        copyIpaBtn.textContent = '已复制';
        toast('校验值已复制');
        setTimeout(function () { copyIpaBtn.textContent = '复制'; }, 1800);
      }).catch(function () {
        toast('复制失败，请手动选中复制');
      });
    });
  }

  /* ---------------- 未开放入口提示 ---------------- */
  var weappBtn = $('#weappBtn');
  if (weappBtn) {
    weappBtn.addEventListener('click', function () {
      toast('微信小程序正式版过审后会在此开放入口');
    });
  }



  /* ---------------- 入场动画 ---------------- */
  var reveals = $$('.platform-card, .feature, .req-table, .faq, .section-head');
  if ('IntersectionObserver' in window) {
    reveals.forEach(function (el, i) {
      el.classList.add('reveal');
      el.style.transitionDelay = Math.min(i % 6, 5) * 40 + 'ms';
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ---------------- 页脚年份 ---------------- */
  var yearEl = $('#year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------------- 下载行为记录（本地统计占位） ---------------- */
  var androidDownload = $('#androidDownload');
  if (androidDownload) {
    androidDownload.addEventListener('click', function () {
      toast('开始下载，安装前请允许“安装未知来源应用”');
    });
  }
})();
