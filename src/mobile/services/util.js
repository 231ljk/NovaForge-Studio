/* NovaForge 软件版 · 基础设施
 * 命名空间 / 网络 / 存储 / UI 浮层 / 格式化
 * 由小程序版（weapp）的 wx API 一一映射而来，行为保持一致。
 */
window.NF = window.NF || {};

(function (NF) {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  NF.$ = $;

  // ---------------- 转义 ----------------

  NF.esc = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  // ---------------- 存储（对应 wx.getStorageSync） ----------------

  NF.storage = {
    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem(key);
        return raw === null ? fallback : raw;
      } catch (e) {
        return fallback;
      }
    },
    getJSON: function (key, fallback) {
      try {
        var raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) {
        return fallback;
      }
    },
    set: function (key, value) {
      try { localStorage.setItem(key, value); } catch (e) { console.error('[Storage] set failed', key, e); }
    },
    remove: function (key) {
      try { localStorage.removeItem(key); } catch (e) { console.error('[Storage] remove failed', key, e); }
    }
  };

  // ---------------- Toast ----------------

  var toastTimer = null;

  NF.toast = function (message, duration) {
    var el = $('toast');
    if (!el) return;
    el.textContent = String(message == null ? '' : message);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, duration || 2200);
  };

  // ---------------- Loading（对应 wx.showLoading / hideLoading） ----------------

  var loadingCount = 0;

  NF.showLoading = function (text) {
    var mask = $('loading');
    if (!mask) return;
    loadingCount += 1;
    if (text) $('loading-text').textContent = text;
    mask.hidden = false;
  };

  NF.hideLoading = function () {
    var mask = $('loading');
    loadingCount = Math.max(0, loadingCount - 1);
    if (!mask) return;
    if (loadingCount === 0) mask.hidden = true;
  };

  // ---------------- 对话框（对应 wx.showModal） ----------------

  var dialogResolve = null;

  function closeDialog(result) {
    var mask = $('dialog-mask');
    if (mask) mask.hidden = true;
    var fn = dialogResolve;
    dialogResolve = null;
    if (fn) fn(result);
  }

  NF.dialog = function (opt) {
    var options = opt || {};
    var mask = $('dialog-mask');
    if (!mask) return Promise.resolve({ confirm: false });

    if (dialogResolve) closeDialog({ confirm: false, cancel: true });

    $('dialog-title').textContent = options.title || '';
    $('dialog-body').textContent = options.content || '';
    var okBtn = $('dialog-ok');
    var cancelBtn = $('dialog-cancel');
    okBtn.textContent = options.confirmText || '确定';
    okBtn.style.color = options.danger === false ? '' : '#f53f3f';
    cancelBtn.textContent = options.cancelText || '取消';

    var actions = okBtn.parentNode;
    if (options.showCancel === false) {
      cancelBtn.style.display = 'none';
      actions.classList.add('single');
    } else {
      cancelBtn.style.display = '';
      actions.classList.remove('single');
    }

    mask.hidden = false;
    return new Promise(function (resolve) { dialogResolve = resolve; });
  };

  NF.closeDialog = closeDialog;

  NF.confirm = function (title, content, options) {
    var opts = options || {};
    return NF.dialog({
      title: title,
      content: content,
      confirmText: opts.confirmText || '确定',
      cancelText: opts.cancelText || '取消',
      danger: opts.danger !== false
    });
  };

  // ---------------- 动作面板（对应 wx.showActionSheet） ----------------

  var sheetResolve = null;

  NF.closeSheet = function (index) {
    var mask = $('sheet-mask');
    if (mask) mask.hidden = true;
    var fn = sheetResolve;
    sheetResolve = null;
    if (fn) fn(index);
  };

  NF.sheet = function (items) {
    var mask = $('sheet-mask');
    var host = $('sheet');
    if (!mask || !host) return Promise.resolve(-1);

    var html = (items || []).map(function (label, index) {
      return '<div class="sheet-item" data-sheet-index="' + index + '">' + NF.esc(label) + '</div>';
    }).join('');
    html += '<div class="sheet-cancel" data-sheet-index="-1">取消</div>';
    host.innerHTML = html;
    mask.hidden = false;

    return new Promise(function (resolve) { sheetResolve = resolve; });
  };

  // ---------------- 网络 ----------------
  // 鸿蒙 WebView 下由 ArkTS 侧 NovaBridge 代发请求；Capacitor / 浏览器下直接 fetch。

  var bridgeSeq = 0;
  var bridgePending = {};

  window.__nfDone = function (id, code, text) {
    var pending = bridgePending[id];
    if (!pending) return;
    delete bridgePending[id];
    pending.resolve({ status: code, text: text == null ? '' : String(text) });
  };

  window.__nfFail = function (id, message) {
    var pending = bridgePending[id];
    if (!pending) return;
    delete bridgePending[id];
    pending.reject(new Error(message || 'network error'));
  };

  function bridgeRequest(url, opt) {
    return new Promise(function (resolve, reject) {
      var id = 'r' + (++bridgeSeq);
      bridgePending[id] = { resolve: resolve, reject: reject };
      try {
        window.NovaBridge.request(
          id, String(url), (opt.method || 'GET').toUpperCase(),
          JSON.stringify(opt.headers || {}),
          opt.body == null ? '' : String(opt.body)
        );
      } catch (e) {
        delete bridgePending[id];
        reject(e);
      }
    });
  }

  function parseBody(text) {
    if (!text) return {};
    try { return JSON.parse(text); } catch (e) { return { raw: text }; }
  }

  /**
   * 统一网络请求。
   * opt: { method, headers, json, form, body, timeout }
   * 返回 { status, data }；HTTP 401 抛出带 status 的错误，交由上层处理。
   */
  NF.http = function (url, opt) {
    var options = opt || {};
    var method = (options.method || 'GET').toUpperCase();
    var headers = Object.assign({}, options.headers || {});
    var body = options.body;

    if (options.json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.json);
    } else if (options.form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(options.form).toString();
    }

    var timeout = options.timeout || 15000;

    var run = window.NovaBridge && typeof window.NovaBridge.request === 'function'
      ? bridgeRequest(url, { method: method, headers: headers, body: body })
      : new Promise(function (resolve, reject) {
          var ctrl = new AbortController();
          var timer = setTimeout(function () {
            try { ctrl.abort(); } catch (e) { /* ignore */ }
          }, timeout);

          fetch(url, { method: method, headers: headers, body: body, signal: ctrl.signal })
            .then(function (res) {
              return res.text().then(function (text) { return { status: res.status, text: text }; });
            })
            .then(function (r) {
              clearTimeout(timer);
              resolve(r);
            })
            .catch(function (err) {
              clearTimeout(timer);
              reject(err && err.name === 'AbortError' ? new Error('timeout') : err);
            });
        });

    return run.then(function (r) {
      if (r.status === 401) {
        var err = new Error('登录已失效');
        err.status = 401;
        throw err;
      }
      return { status: r.status, data: parseBody(r.text) };
    });
  };

  /**
   * 表单上传（对应 wx.uploadFile）。
   * file: { file: File, name?: 'file', fields?: {} }
   */
  NF.upload = function (url, file, headers, timeout) {
    var form = new FormData();
    Object.keys(file.fields || {}).forEach(function (k) {
      form.append(k, (file.fields || {})[k]);
    });
    form.append(file.name || 'file', file.file, file.file.name);

    var ctrl = new AbortController();
    var timer = setTimeout(function () { try { ctrl.abort(); } catch (e) { /* ignore */ } }, timeout || 60000);

    return fetch(url, { method: 'POST', headers: headers || {}, body: form, signal: ctrl.signal })
      .then(function (res) {
        return res.text().then(function (text) {
          clearTimeout(timer);
          if (res.status === 401) {
            var err = new Error('登录已失效');
            err.status = 401;
            throw err;
          }
          return { status: res.status, data: parseBody(text) };
        });
      })
      .catch(function (err) {
        clearTimeout(timer);
        if (err && err.name === 'AbortError') throw new Error('附件上传超时');
        throw err;
      });
  };

  // ---------------- 剪贴板 ----------------

  NF.copy = function (text) {
    var value = String(text == null ? '' : text);
    if (!value) return Promise.resolve(false);
    var fallback = function () {
      try {
        var ta = document.createElement('textarea');
        ta.value = value;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        return true;
      } catch (e) {
        return false;
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(value).then(function () { return true; }, fallback);
    }
    return Promise.resolve(fallback());
  };

  /** 打开外部链接：Capacitor 用系统浏览器，WebView 兜底 window.open */
  NF.openExternal = function (url) {
    var target = String(url || '');
    if (!target) return;
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
      window.Capacitor.Plugins.Browser.open({ url: target }).catch(function () {
        window.open(target, '_blank');
      });
      return;
    }
    window.open(target, '_blank');
  };

  // ---------------- 文件选择（对应 wx.chooseImage / chooseMessageFile） ----------------

  NF.pickFiles = function (accept, multiple) {
    return new Promise(function (resolve) {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = accept || '*/*';
      input.multiple = !!multiple;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);

      var done = function (files) {
        if (input.parentNode) document.body.removeChild(input);
        resolve(files || []);
      };

      input.addEventListener('change', function () {
        done(Array.prototype.slice.call(input.files || []));
      });
      document.addEventListener('visibilitychange', function handler() {
        if (document.visibilityState === 'hidden') return;
        setTimeout(function () {
          if (input.parentNode && (!input.files || input.files.length === 0)) {
            document.removeEventListener('visibilitychange', handler);
            done([]);
          }
        }, 400);
      });

      input.click();
    });
  };

  NF.readAsDataURL = function (file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(new Error('读取文件失败')); };
      reader.readAsDataURL(file);
    });
  };

  NF.readAsText = function (file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { reject(new Error('读取文件失败')); };
      reader.readAsText(file);
    });
  };

  // ---------------- 格式化（对应 utils/format.js） ----------------

  var TITLES = {
    on: '开', off: '关', unavailable: '离线', unknown: '未知',
    playing: '播放中', paused: '已暂停', idle: '待机',
    open: '开', opening: '正在开', closed: '关', closing: '正在关',
    locked: '已锁', unlocked: '未锁', home: '在家', not_home: '离家',
    heat: '制热', cool: '制冷', auto: '自动', dry: '除湿', fan_only: '送风'
  };

  var ON_STATES = ['on', 'open', 'unlocked', 'playing', 'heat', 'cool', 'auto', 'dry', 'fan_only'];
  var READONLY_DOMAINS = ['sensor', 'binary_sensor', 'device_tracker', 'person', 'weather'];

  var fmt = {
    stateText: function (v) { return TITLES[v] || v; },

    isOn: function (item) { return ON_STATES.indexOf(item && item.state) >= 0; },

    isReadonly: function (item) { return READONLY_DOMAINS.indexOf(item && item.domain) >= 0; },

    iconOf: function (item) {
      switch (item && item.domain) {
        case 'light': return '💡';
        case 'climate': return '🌡️';
        case 'cover': return '🪟';
        case 'lock': return '🔒';
        case 'media_player': return '🎵';
        case 'sensor': return '📊';
        case 'fan': return '🌀';
        case 'vacuum': return '🧹';
        case 'person':
        case 'device_tracker': return '📍';
        default: return '🔌';
      }
    },

    greeting: function () {
      var h = new Date().getHours();
      if (h < 6) return '夜深了';
      if (h < 11) return '早上好';
      if (h < 14) return '中午好';
      if (h < 18) return '下午好';
      return '晚上好';
    },

    normalizeUrl: function (v) {
      var s = String(v || '').trim().replace(/\/+$/, '');
      if (!s) return '';
      if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
      return s;
    },

    errText: function (err) {
      var msg = err && err.message ? err.message : String(err);
      if (/timeout|超时/i.test(msg)) return '连接超时，请检查 HA 地址是否可从手机访问';
      return '网络请求失败：' + msg;
    },

    timeText: function (ts) {
      var n = Number(ts);
      if (!n) return '';
      var d = new Date(n * 1000);
      var pad = function (v) { return v < 10 ? '0' + v : String(v); };
      return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    },

    toViewEntity: function (item) {
      var readonly = fmt.isReadonly(item);
      return {
        id: item.id,
        name: item.name,
        domain: item.domain,
        state: item.state,
        unit: item.unit || '',
        on: fmt.isOn(item),
        readonly: readonly,
        icon: fmt.iconOf(item),
        stateLabel: readonly && item.unit ? item.state + item.unit : fmt.stateText(item.state)
      };
    }
  };

  NF.fmt = fmt;
}(window.NF));
