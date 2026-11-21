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

  var RELEASES = 'https://github.com/231ljk/NovaForge-Studio/releases/latest/download/';
  var FLASH_EXE = RELEASES + 'NovaForge-Flash-Setup-0.1.0.exe';
  var STUDIO_DMG = RELEASES + 'NovaForge-Studio-0.1.0-arm64.dmg';
  var ANDROID_APK = RELEASES + 'NovaForge-Studio-0.1.0-android-release.apk';

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
