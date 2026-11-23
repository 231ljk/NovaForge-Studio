/* ==========================================================================
   NovaForge — 官方下载页交互（Flash / Studio / 网页版）
   纯原生 JS，无外部依赖（适配国内网络环境）

   双仓库策略（全自动，无手动开关）：
     1. 通过 IP 地理接口判定访问者所在地区（多接口竞速 + 时区兜底）
     2. 国内 → Gitee 镜像；国外 → GitHub
     3. 逐文件比对两个仓库的真实 Release 资产清单，
        国内仓库缺失的文件自动回退 GitHub，绝不产生死链
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ======================================================================
     常量
     ====================================================================== */
  var GH_OWNER = '231ljk', GH_REPO = 'NovaForge-Studio';
  var CN_OWNER = 'q3w6', CN_REPO = 'NovaForge-Studio';

  var GH_API = 'https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO + '/releases/latest';
  var CN_API = 'https://gitee.com/api/v5/repos/' + CN_OWNER + '/' + CN_REPO + '/releases/latest';

  var GH_BASE = 'https://github.com/' + GH_OWNER + '/' + GH_REPO + '/releases/latest/download/';
  var CN_BASE = 'https://gitee.com/' + CN_OWNER + '/' + CN_REPO + '/releases/download/';

  var GH_REPO_PAGE = 'https://github.com/' + GH_OWNER + '/' + GH_REPO;
  var CN_REPO_PAGE = 'https://gitee.com/' + CN_OWNER + '/' + CN_REPO;
  var GH_RELEASES_PAGE = GH_REPO_PAGE + '/releases/latest';
  var CN_RELEASES_PAGE = CN_REPO_PAGE + '/releases';

  var GH_RE = /^https:\/\/github\.com\/231ljk\/NovaForge-Studio\/releases\/(?:latest\/download|download\/[^/]+)\/(.+)$/;
  var CN_RE = /^https:\/\/gitee\.com\/q3w6\/NovaForge-Studio\/releases\/download\/[^/]+\/(.+)$/;

  /* 接口不可用时的静态兜底清单（仅用于首屏占位，接口返回后以真实清单为准） */
  var GH_FALLBACK = [
    'llama-server-win-x64.exe',
    'NovaForge-Flash-0.1.0-amd64.deb',
    'NovaForge-Flash-0.1.0-arm64.dmg',
    'NovaForge-Flash-0.1.0-arm64.zip',
    'NovaForge-Flash-0.1.0-x64.dmg',
    'NovaForge-Flash-0.1.0-x64.zip',
    'NovaForge-Flash-0.1.0-x86_64.AppImage',
    'NovaForge-Flash-Setup-0.1.0.exe',
    'NovaForge-Studio-0.1.0-amd64.deb',
    'NovaForge-Studio-0.1.0-android-release.apk',
    'NovaForge-Studio-0.1.0-arm64.dmg',
    'NovaForge-Studio-0.1.0-arm64.zip',
    'NovaForge-Studio-0.1.0-harmony-signed.hap',
    'NovaForge-Studio-0.1.0-ios-unsigned.ipa',
    'NovaForge-Studio-0.1.0-x64.dmg',
    'NovaForge-Studio-0.1.0-x64.zip',
    'NovaForge-Studio-0.1.0-x86_64.AppImage',
    'NovaForge-Studio-Setup-0.1.0.exe'
  ];
  var CN_FALLBACK = [
    'NovaForge-Studio-0.1.0-android-release.apk',
    'NovaForge-Studio-0.1.0-harmony-signed.hap',
    'NovaForge-Studio-0.1.0-ios-unsigned.ipa',
    'NovaForge-Studio-Setup-0.1.0.exe.part1',
    'NovaForge-Studio-Setup-0.1.0.exe.part2',
    'NovaForge-Studio-Setup-0.1.0.exe.part3',
    'NovaForge-Studio-Setup-0.1.0.exe.part4',
    'NovaForge-Studio-Setup-0.1.0.exe.part5'
  ];

  /* Gitee 单文件上限 100MB，Studio 的 Windows 安装包以 5 卷分卷上传 */
  var SPLIT_BASE = 'NovaForge-Studio-Setup-0.1.0.exe';
  var SPLIT_PARTS = 5;

  var LANG_KEY = 'nf-lang';
  var CACHE_KEY = 'nf-assets-v3';
  var CACHE_TTL = 10 * 60 * 1000;

  /* ======================================================================
     状态
     ====================================================================== */
  var state = {
    lang: 'zh',
    mirror: 'global',   /* 'cn' | 'global' */
    region: '',         /* 两位国家码，空表示未判定成功 */
    resolved: false,    /* 地区判定是否已完成 */
    ghTag: 'v0.1.0',
    cnTag: 'v0.1.0',
    ghAssets: null,
    cnAssets: null,
    ghSizes: {},
    cnSizes: {}
  };

  /* ======================================================================
     多语言
     ====================================================================== */
  function t(key) {
    var d = window.NF_I18N || {};
    var cur = d[state.lang] || {};
    if (cur[key] != null) return cur[key];
    var zh = d.zh || {};
    return zh[key] != null ? zh[key] : key;
  }

  function detectLang() {
    /* URL 参数优先：?lang=en / ?lang=zh，便于分享指定语言的链接 */
    var q = '';
    try { q = (new URLSearchParams(location.search).get('lang') || '').toLowerCase(); } catch (e) {}
    if (q === 'zh' || q === 'en') return q;

    var saved = '';
    try { saved = localStorage.getItem(LANG_KEY) || ''; } catch (e) {}
    if (saved === 'zh' || saved === 'en') return saved;
    var langs = navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language || ''];
    for (var i = 0; i < langs.length; i++) {
      if (/^zh/i.test(langs[i])) return 'zh';
      if (/^en/i.test(langs[i])) return 'en';
    }
    return 'en';
  }

  function applyI18n() {
    $$('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    $$('[data-i18n-html]').forEach(function (el) {
      el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
    $$('[data-i18n-attr]').forEach(function (el) {
      var spec = el.getAttribute('data-i18n-attr') || '';
      spec.split('|').forEach(function (pair) {
        var i = pair.indexOf(':');
        if (i < 0) return;
        el.setAttribute(pair.slice(0, i).trim(), t(pair.slice(i + 1).trim()));
      });
    });

    document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
    document.title = t('meta.title');
    var md = document.querySelector('meta[name="description"]');
    if (md) md.setAttribute('content', t('meta.desc'));

    var lt = $('#langToggle');
    if (lt) {
      lt.textContent = t('lang.toggle');
      lt.setAttribute('aria-label', t('lang.aria'));
    }
  }

  /* ======================================================================
     网络工具
     ====================================================================== */
  function fetchJSON(url, ms) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        reject(new Error('timeout'));
      }, ms);
      function ok(v) { if (done) return; done = true; clearTimeout(timer); resolve(v); }
      function fail(e) { if (done) return; done = true; clearTimeout(timer); reject(e); }
      try {
        fetch(url, { cache: 'no-store', mode: 'cors', credentials: 'omit' })
          .then(function (r) {
            if (!r.ok) throw new Error('http ' + r.status);
            return r.json();
          })
          .then(ok)
          .catch(fail);
      } catch (e) { fail(e); }
    });
  }

  /* ======================================================================
     地区判定：多接口竞速，任一返回国家码即采用
     ====================================================================== */
  function detectRegion() {
    var probes = [
      { url: 'https://api.ip.sb/geoip', pick: function (j) { return j.country_code; } },
      { url: 'https://ipapi.co/json/', pick: function (j) { return j.country_code; } },
      { url: 'https://ipinfo.io/json', pick: function (j) { return j.country; } }
    ];

    return new Promise(function (resolve) {
      var settled = false;
      var pending = probes.length;
      var timer = setTimeout(function () { finish(''); }, 3500);

      function finish(v) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(v);
      }

      probes.forEach(function (p) {
        fetchJSON(p.url, 3500).then(function (j) {
          var cc = String(p.pick(j) || '').toUpperCase();
          if (cc) finish(cc);
          else if (--pending === 0) finish('');
        }).catch(function () {
          if (--pending === 0) finish('');
        });
      });
    });
  }

  /* 接口全部失败时的兜底：时区 / 语言 */
  function tzRegion() {
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    if (/Shanghai|Chongqing|Urumqi|Harbin|Beijing|Hong_Kong|Macau|Taipei/i.test(tz)) return 'CN';
    var lang = navigator.language || '';
    if (/^zh/i.test(lang)) return 'CN';
    return '';
  }

  /* ======================================================================
     真实资产清单：拉取两个仓库的 Release 资产名与体积
     ====================================================================== */
  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || !o.ts || Date.now() - o.ts > CACHE_TTL) return null;
      if (!o.gh || !o.cn) return null;
      return o;
    } catch (e) { return null; }
  }

  function writeCache(o) {
    try {
      o.ts = Date.now();
      localStorage.setItem(CACHE_KEY, JSON.stringify(o));
    } catch (e) {}
  }

  function toSizeMap(assets) {
    var m = {};
    (assets || []).forEach(function (a) {
      if (a && a.name && typeof a.size === 'number') m[a.name] = a.size;
    });
    return m;
  }

  function applyAssets(ghNames, cnNames, ghTag, cnTag, ghSizes, cnSizes) {
    state.ghAssets = {};
    ghNames.forEach(function (n) { state.ghAssets[n] = 1; });
    state.cnAssets = {};
    cnNames.forEach(function (n) { state.cnAssets[n] = 1; });
    state.ghTag = ghTag || 'v0.1.0';
    state.cnTag = cnTag || 'v0.1.0';
    state.ghSizes = ghSizes || {};
    state.cnSizes = cnSizes || {};
  }

  function loadAssets() {
    var cached = readCache();
    if (cached) {
      applyAssets(cached.gh, cached.cn, cached.ghTag, cached.cnTag, cached.ghSizes, cached.cnSizes);
      return Promise.resolve();
    }

    var ghP = fetchJSON(GH_API, 5000).then(function (j) {
      return {
        names: (j.assets || []).map(function (a) { return a.name; }),
        sizes: toSizeMap(j.assets),
        tag: j.tag_name || ''
      };
    }).catch(function () { return null; });

    var cnP = fetchJSON(CN_API, 5000).then(function (j) {
      return {
        names: (j.assets || []).map(function (a) { return a.name; }),
        sizes: toSizeMap(j.assets),
        tag: j.tag_name || ''
      };
    }).catch(function () { return null; });

    return Promise.all([ghP, cnP]).then(function (r) {
      var gh = r[0], cn = r[1];
      var ghNames = (gh && gh.names.length) ? gh.names : GH_FALLBACK;
      var cnNames = (cn && cn.names.length) ? cn.names : CN_FALLBACK;
      applyAssets(
        ghNames, cnNames,
        (gh && gh.tag) || 'v0.1.0', (cn && cn.tag) || 'v0.1.0',
        (gh && gh.sizes) || {}, (cn && cn.sizes) || {}
      );
      if (gh || cn) {
        writeCache({
          gh: ghNames, cn: cnNames,
          ghTag: state.ghTag, cnTag: state.cnTag,
          ghSizes: state.ghSizes, cnSizes: state.cnSizes
        });
      }
    });
  }

  /* ======================================================================
     链接解析：国内仓库有 → 国内；没有 → 自动回退 GitHub
     ====================================================================== */
  function splitAvailable() {
    return state.mirror === 'cn'
      && !!state.cnAssets
      && !!state.cnAssets[SPLIT_BASE + '.part1'];
  }

  function cnUrlFor(file) {
    if (state.mirror !== 'cn') return '';
    if (!state.cnAssets || !state.cnAssets[file]) return '';
    return CN_BASE + state.cnTag + '/' + file;
  }

  function ghUrlFor(file) {
    return GH_BASE + file;
  }

  function urlFor(file) {
    if (file === SPLIT_BASE && splitAvailable()) {
      return CN_BASE + state.cnTag + '/' + SPLIT_BASE + '.part1';
    }
    return cnUrlFor(file) || ghUrlFor(file);
  }

  /* 把页面里写死的仓库直链统一改写到当前线路 */
  function rewriteStaticLinks() {
    $$('a[href]').forEach(function (a) {
      var h = a.getAttribute('href') || '';
      var m = h.match(GH_RE) || h.match(CN_RE);
      if (!m) return;
      /* 首次改写时把原始文件名固化到 data-file，避免二次渲染时把已改写的
         part1 链接误判成普通文件而丢掉分卷标记 */
      var file = a.getAttribute('data-file') || m[1];
      a.setAttribute('data-file', file);
      a.setAttribute('href', urlFor(file));
      if (file === SPLIT_BASE && splitAvailable()) a.setAttribute('data-cn-split', '1');
      else a.removeAttribute('data-cn-split');
    });

    /* 发布页 / 仓库首页同样跟随线路，避免国内用户点进 GitHub 打不开 */
    $$('[data-releases-page]').forEach(function (a) {
      a.setAttribute('href', state.mirror === 'cn' ? CN_RELEASES_PAGE : GH_RELEASES_PAGE);
    });
    $$('[data-repo-page]').forEach(function (a) {
      a.setAttribute('href', state.mirror === 'cn' ? CN_REPO_PAGE : GH_REPO_PAGE);
    });
  }

  /* 文件体积：从真实 Release 资产里取，取不到就留空 */
  function formatSize(bytes) {
    if (!bytes || bytes < 0) return '';
    var mb = bytes / 1048576;
    if (mb >= 1024) return (mb / 1024).toFixed(2) + ' GB';
    if (mb >= 10) return mb.toFixed(1) + ' MB';
    if (mb >= 1) return mb.toFixed(2) + ' MB';
    return Math.max(1, Math.round(bytes / 1024)) + ' KB';
  }

  function fillSizes() {
    $$('[data-size-for]').forEach(function (el) {
      var name = el.getAttribute('data-size-for');
      var bytes = 0;
      if (state.mirror === 'cn' && state.cnSizes[name]) bytes = state.cnSizes[name];
      else if (state.ghSizes[name]) bytes = state.ghSizes[name];
      else if (state.cnSizes[name]) bytes = state.cnSizes[name];
      /* 接口不可达时用页面预置的真实体积兜底，避免首屏空白 */
      if (!bytes) bytes = Number(el.getAttribute('data-size')) || 0;
      el.textContent = formatSize(bytes);
    });
  }

  /* 国内线路下，Windows 安装包为 5 卷分卷，动态列出全部卷 */
  function renderSplitBox() {
    var old = document.getElementById('cnSplitBox');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    if (!splitAvailable()) return;

    var host = document.getElementById('splitHost');
    if (!host) {
      /* 兜底：没有专用挂载点时，插到分卷下载按钮所在行的后面 */
      var target = null;
      $$('a[href]').forEach(function (a) {
        if (!target && a.getAttribute('data-cn-split') === '1') target = a;
      });
      if (!target) return;
      host = target.parentNode;
    }

    var box = document.createElement('div');
    box.id = 'cnSplitBox';
    box.className = 'cn-split';

    var html = '<p class="cn-split-title">' + t('split.title') + '</p><div class="cn-split-links">';
    for (var i = 1; i <= SPLIT_PARTS; i++) {
      html += '<a href="' + CN_BASE + state.cnTag + '/' + SPLIT_BASE + '.part' + i + '">part' + i + '</a>';
    }
    html += '</div><p class="cn-split-tip">' + t('split.tip') + '<code>copy /b ';
    var parts = [];
    for (var k = 1; k <= SPLIT_PARTS; k++) parts.push(SPLIT_BASE + '.part' + k);
    html += parts.join('+') + ' ' + SPLIT_BASE + '</code></p>';

    box.innerHTML = html;
    host.appendChild(box);
  }

  /* ======================================================================
     线路状态（只读展示，不提供手动选择）
     ====================================================================== */
  function countMissing() {
    if (!state.cnAssets) return 0;
    var seen = {};
    var n = 0;
    $$('a[href]').forEach(function (a) {
      var h = a.getAttribute('href') || '';
      var m = h.match(GH_RE) || h.match(CN_RE);
      if (!m) return;
      var f = a.getAttribute('data-file') || m[1];
      if (seen[f]) return;
      seen[f] = 1;
      if (f === SPLIT_BASE) {
        if (!splitAvailable()) n++;
        return;
      }
      if (!state.cnAssets[f]) n++;
    });
    return n;
  }

  function updateRouteUI() {
    var tip = $('#mirrorTip');
    var badge = $('#mirrorBadge');
    if (!tip) return;

    if (!state.resolved) {
      tip.textContent = t('mirror.detecting');
      if (badge) badge.textContent = '…';
      return;
    }

    if (state.mirror === 'cn') {
      var missing = countMissing();
      if (badge) badge.textContent = 'CN';
      tip.textContent = missing > 0
        ? t('mirror.cn') + ' · ' + t('mirror.fallback')
        : t('mirror.cn');
    } else {
      if (badge) badge.textContent = 'GH';
      tip.textContent = state.region ? t('mirror.global') : t('mirror.offline');
    }
  }

  /* ======================================================================
     设备识别
     ====================================================================== */
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
    weapp: 'WeChat Mini Program'
  };

  function primaryFileFor(platform) {
    switch (platform) {
      case 'windows': return 'NovaForge-Flash-Setup-0.1.0.exe';
      case 'android': return 'NovaForge-Studio-0.1.0-android-release.apk';
      case 'macos': return 'NovaForge-Studio-0.1.0-arm64.dmg';
      case 'linux': return 'NovaForge-Studio-0.1.0-amd64.deb';
      case 'harmony': return 'NovaForge-Studio-0.1.0-harmony-signed.hap';
      case 'ios': return '';
      default: return '';
    }
  }

  function applyPlatformLinks() {
    var current = detectPlatform();
    var hint = $('#uaHint');
    var primary = $('#primaryDownload');
    var primaryText = $('#primaryDownloadText');

    $$('.dl-card').forEach(function (c) { c.classList.remove('is-current'); });

    if (current) {
      var card = $('.dl-card[data-platform="' + current + '"]');
      if (card) card.classList.add('is-current');

      if (hint) {
        var ready = current === 'android' || current === 'windows' || current === 'macos' || current === 'linux' || current === 'harmony';
        var tpl = ready ? t('hint.ready') : t('hint.web');
        hint.innerHTML = tpl.replace('{p}', PLATFORM_LABEL[current] || current);
      }

      if (primary && primaryText) {
        var file = primaryFileFor(current);
        if (file) {
          primary.href = urlFor(file);
          if (current === 'android') primary.setAttribute('download', '');
          else primary.removeAttribute('download');
          primaryText.textContent = t('primary.' + current);
        } else if (current === 'weapp') {
          primary.href = '#download';
          primary.removeAttribute('download');
          primaryText.textContent = t('primary.weapp');
        } else {
          primary.href = 'app/';
          primary.removeAttribute('download');
          primaryText.textContent = t('primary.web');
        }
      }
    } else if (hint) {
      hint.textContent = t('hint.none');
    }
  }

  function renderAll() {
    applyPlatformLinks();
    rewriteStaticLinks();
    fillSizes();
    renderSplitBox();
    updateRouteUI();
  }

  /* ======================================================================
     顶栏滚动阴影
     ====================================================================== */
  var topbar = $('#topbar');
  function onScroll() {
    if (!topbar) return;
    topbar.classList.toggle('is-stuck', window.scrollY > 8);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ======================================================================
     移动端菜单
     ====================================================================== */
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

  /* ======================================================================
     提示条
     ====================================================================== */
  function toast(msg) {
    var el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('is-show'); }, 2200);
  }

  /* ======================================================================
     复制校验值
     ====================================================================== */
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

  function bindCopy(btnId, codeId) {
    var btn = document.getElementById(btnId);
    var code = document.getElementById(codeId);
    if (!btn || !code) return;
    btn.addEventListener('click', function () {
      copyText(code.textContent.trim()).then(function () {
        btn.textContent = t('toast.copied');
        toast(t('toast.copied'));
        setTimeout(function () { btn.textContent = t('btn.copy'); }, 1800);
      }).catch(function () {
        toast(t('toast.copyFail'));
      });
    });
  }
  bindCopy('copyHash', 'apkHash');
  bindCopy('copyIpaHash', 'ipaHash');

  /* ======================================================================
     未开放入口提示
     ====================================================================== */
  var weappBtn = $('#weappBtn');
  if (weappBtn) {
    weappBtn.addEventListener('click', function () {
      toast(t('toast.weapp'));
    });
  }

  var androidDownload = $('#androidDownload');
  if (androidDownload) {
    androidDownload.addEventListener('click', function () {
      toast(t('toast.android'));
    });
  }

  /* ======================================================================
     语言切换
     ====================================================================== */
  var langToggle = $('#langToggle');
  if (langToggle) {
    langToggle.addEventListener('click', function () {
      state.lang = state.lang === 'zh' ? 'en' : 'zh';
      try { localStorage.setItem(LANG_KEY, state.lang); } catch (e) {}
      applyI18n();
      renderAll();
      toast(t('toast.lang'));
    });
  }

  /* ======================================================================
     客服：本地知识库检索（纯前端，无后端）
     ====================================================================== */
  var SUPPORT = window.NF_SUPPORT || { cats: [], items: [] };
  var CS_QUICK = ['FAQ-010', 'FAQ-011', 'FAQ-034', 'FAQ-052', 'FAQ-059', 'FAQ-002'];

  var csRoot = $('#cs'), csFab = $('#csFab'), csPanel = $('#csPanel'), csClose = $('#csClose');
  var csBody = $('#csBody'), csChips = $('#csChips'), csThread = $('#csThread');
  var csForm = $('#csForm'), csInput = $('#csInput'), csTopBtn = $('#csTopBtn'), csToFaq = $('#csToFaq');

  var csById = {};
  SUPPORT.items.forEach(function (it) { csById[it.id] = it; });

  function csHasEn(it) { return !!(it.q_en && it.a_en); }
  function csQ(it) { return (state.lang === 'en' && it.q_en) ? it.q_en : it.q; }
  function csA(it) { return (state.lang === 'en' && it.a_en) ? it.a_en : it.a; }

  function csEsc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function csLinkify(s) {
    return csEsc(s).replace(/(https?:\/\/[^\s，。；、）)]+)/g, function (u) {
      return '<a href="' + u + '" target="_blank" rel="noopener">' + u + '</a>';
    });
  }

  /* 关键词打分：问题 > 关键词 > 正文，中文补 2-gram */
  function csScore(it, q) {
    var s = 0;
    var qq = q.toLowerCase();
    var title = it.q.toLowerCase();
    var kws = it.kw.join(' ').toLowerCase();
    var body = it.a.toLowerCase();

    if (title.indexOf(qq) >= 0) s += 12;
    if (kws.indexOf(qq) >= 0) s += 8;
    if (body.indexOf(qq) >= 0) s += 4;

    qq.split(/[\s,，。、?？!！;；:：/]+/).forEach(function (tk) {
      if (tk.length < 2) return;
      if (title.indexOf(tk) >= 0) s += 6;
      if (kws.indexOf(tk) >= 0) s += 4;
      if (body.indexOf(tk) >= 0) s += 1;
    });

    if (/[\u4e00-\u9fa5]/.test(qq) && qq.length >= 2) {
      for (var i = 0; i < qq.length - 1; i++) {
        var bg = qq.substr(i, 2);
        if (title.indexOf(bg) >= 0) s += 3;
        else if (kws.indexOf(bg) >= 0) s += 2;
      }
    }
    return s;
  }

  function csScroll() {
    if (csBody) csBody.scrollTop = csBody.scrollHeight;
  }

  function csPush(role, html, tag) {
    if (!csThread) return;
    var msg = document.createElement('div');
    msg.className = 'cs-msg ' + (role === 'user' ? 'cs-msg-user' : 'cs-msg-bot');
    if (tag) {
      var tg = document.createElement('span');
      tg.className = 'cs-msg-tag';
      tg.textContent = tag;
      msg.appendChild(tg);
    }
    var body = document.createElement('div');
    body.innerHTML = html;
    msg.appendChild(body);
    csThread.appendChild(msg);
    csScroll();
  }

  function csChipRow(list) {
    var box = document.createElement('div');
    box.className = 'cs-chips';
    list.forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cs-chip';
      b.textContent = csQ(it);
      b.addEventListener('click', function () { csAsk(csQ(it)); });
      box.appendChild(b);
    });
    return box;
  }

  function csRenderChips() {
    if (!csChips) return;
    csChips.innerHTML = '';
    var list = CS_QUICK.map(function (id) { return csById[id]; }).filter(Boolean);
    if (!list.length) return;
    list.forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cs-chip';
      b.textContent = csQ(it);
      b.addEventListener('click', function () { csAsk(csQ(it)); });
      csChips.appendChild(b);
    });
  }

  function csAsk(q) {
    q = String(q || '').trim();
    if (!q || !csThread) return;
    csPush('user', csEsc(q));

    var scored = SUPPORT.items.map(function (it) { return { it: it, s: csScore(it, q) }; })
      .filter(function (x) { return x.s > 0; })
      .sort(function (a, b) { return b.s - a.s; });

    if (!scored.length) {
      csPush('bot', csEsc(t('cs.noMatch')));
      return;
    }

    var top = scored[0].it;
    var html = csLinkify(csA(top));
    if (state.lang === 'en' && !csHasEn(top)) {
      html = '<span class="cs-msg-note">' + csEsc(t('cs.enOnly')) + '</span>' + html;
    }
    csPush('bot', html, csQ(top));

    var rel = scored.slice(1, 4).map(function (x) { return x.it; });
    if (rel.length) csThread.appendChild(csChipRow(rel));

    if (scored.length > 4) {
      var more = document.createElement('div');
      more.className = 'cs-msg-note';
      more.textContent = t('cs.more').replace('{n}', scored.length - 4);
      csThread.appendChild(more);
    }
    csScroll();
  }

  function csOpen(open) {
    if (!csPanel) return;
    csPanel.hidden = !open;
    if (csRoot) csRoot.classList.toggle('is-open', open);
    [csFab, csTopBtn].forEach(function (b) {
      if (b) b.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    if (open) {
      csRenderChips();
      setTimeout(function () { if (csInput) csInput.focus(); }, 80);
    }
  }

  if (csFab) csFab.addEventListener('click', function () { csOpen(true); });
  if (csTopBtn) csTopBtn.addEventListener('click', function () { csOpen(true); });
  if (csClose) csClose.addEventListener('click', function () { csOpen(false); });
  if (csToFaq) csToFaq.addEventListener('click', function () { csOpen(false); });

  if (csForm) {
    csForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = csInput ? csInput.value : '';
      if (csInput) csInput.value = '';
      csAsk(v);
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && csPanel && !csPanel.hidden) csOpen(false);
  });

  document.addEventListener('click', function (e) {
    if (!csPanel || csPanel.hidden) return;
    if (csRoot && csRoot.contains(e.target)) return;
    csOpen(false);
  });

  /* 语言切换后重建快捷问题与已有对话 */
  if (langToggle) {
    langToggle.addEventListener('click', function () {
      if (csThread) csThread.innerHTML = '';
      csRenderChips();
    });
  }

  csRenderChips();

  /* 支持 ?cs=1 或 #support 直接展开客服面板，便于分享 */
  try {
    var csQs = new URLSearchParams(location.search);
    if (csQs.get('cs') === '1' || location.hash === '#support') csOpen(true);
  } catch (e) {}

  /* ======================================================================
     入场动画
     ====================================================================== */
  var reveals = $$('.dl-card, .feature, .table-wrap, .faq, .section-head, .cta-inner');
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

  /* ======================================================================
     页脚年份
     ====================================================================== */
  var yearEl = $('#year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ======================================================================
     启动
     ====================================================================== */
  state.lang = detectLang();
  applyI18n();
  csRenderChips();

  /* 首屏：先用兜底清单 + 时区猜测渲染，避免白屏等待 */
  applyAssets(GH_FALLBACK, CN_FALLBACK, 'v0.1.0', 'v0.1.0', {}, {});
  state.mirror = tzRegion() === 'CN' ? 'cn' : 'global';
  renderAll();

  /* 并行：真实地区判定 + 真实资产清单 */
  Promise.all([detectRegion(), loadAssets()]).then(function (r) {
    var cc = r[0];
    state.region = cc;
    state.mirror = (cc === 'CN' || (!cc && tzRegion() === 'CN')) ? 'cn' : 'global';
    state.resolved = true;
    renderAll();
  }).catch(function () {
    state.resolved = true;
    renderAll();
  });
})();