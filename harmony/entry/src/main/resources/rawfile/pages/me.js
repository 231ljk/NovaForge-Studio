/* NovaForge 软件版 · 我的
 * 与小程序版 pages/me 对齐，差别只在身份：微信账号 → GitHub / Gitee / 邮箱。
 * 这里承担「登录后再绑定家庭」的入口——登录不再被 HA 地址卡住。
 */
window.NF = window.NF || {};

(function (NF) {
  'use strict';

  var fmt = NF.fmt;
  var PROVIDER_LABEL = { github: 'GitHub 账号', gitee: 'Gitee 账号', email: '邮箱账号', demo: '演示模式' };
  var VERSION = '1.1.0';

  var ui = {
    haUrl: '',
    connecting: false,
    connectStatus: '',
    themeMode: 'auto',
    tencentList: [],
    tencentLoaded: false,
    meetingSubject: '',
    meetingCreating: false,
    meetings: [],
    meetingsLoaded: false
  };

  function providerText(session) {
    var provider = (session && session.provider) || 'email';
    var label = PROVIDER_LABEL[provider] || '账号';
    var id = (session && (session.email || session.login)) || '';
    if (session && session.demo) return '演示模式';
    return id ? label + ' · ' + NF.account.mask(id) : label;
  }

  function counts() {
    var data = NF.store.state.data || {};
    return {
      device: (data.entities || []).length,
      scene: (data.scenes || []).length,
      automation: (data.automations || []).length
    };
  }

  function connectionLabel() {
    var state = NF.store.state;
    if (state.session && state.session.demo) return '演示家庭';
    if (!NF.store.isConnected()) return '待连接';
    return state.refreshing ? '同步中' : '已连接';
  }

  function renderTheme() {
    var modes = [
      { key: 'auto', label: '跟随系统' },
      { key: 'light', label: '浅色' },
      { key: 'dark', label: '深色' }
    ];
    return modes.map(function (item) {
      var active = ui.themeMode === item.key ? ' theme-option-active' : '';
      return '<div class="theme-option' + active + '" data-theme="' + item.key + '">' + item.label + '</div>';
    }).join('');
  }

  function renderTencent() {
    if (!ui.tencentLoaded) {
      return '<div class="row"><div class="row-main"><span class="row-label">腾讯生态</span>' +
        '<span class="row-desc">连接家庭后自动读取</span></div></div>';
    }
    if (!ui.tencentList.length) {
      return '<div class="row"><div class="row-main"><span class="row-label">腾讯生态</span>' +
        '<span class="row-desc">HA 扩展没有返回服务清单</span></div></div>';
    }
    return ui.tencentList.map(function (item) {
      var value = item.configured ? '已配置' : (item.planned ? '待开放' : '未配置');
      return '' +
        '<div class="row">' +
          '<div class="row-main">' +
            '<span class="row-label">' + NF.esc(item.label || item.key) + '</span>' +
            '<span class="row-desc">' + NF.esc(item.description || '') + '</span>' +
          '</div>' +
          '<div class="row-value-wrap">' +
            '<span class="row-value' + (item.configured ? ' tencent-ok' : '') + '">' + value + '</span>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  function renderMeetings() {
    if (!ui.meetingsLoaded) return '';
    if (!ui.meetings.length) return '<div class="meeting-empty">还没有会议</div>';
    return ui.meetings.slice(0, 5).map(function (item) {
      return '' +
        '<div class="meeting-item" data-meeting="' + NF.esc(item.join_url || '') + '">' +
          '<span class="row-label">' + NF.esc(item.subject || '未命名会议') + '</span>' +
          '<span class="row-desc">' + NF.esc(fmt.timeText(item.start_time)) + (item.code ? ' · ' + NF.esc(item.code) : '') + '</span>' +
        '</div>';
    }).join('');
  }

  function render() {
    var state = NF.store.state;
    var session = state.session || {};
    var connected = NF.store.isConnected();
    var demo = !!session.demo;
    var name = session.name || session.email || session.login || '家庭成员';
    var initial = String(name).trim().charAt(0).toUpperCase() || 'N';
    var stat = counts();

    var statusClass = 'connect-status';
    var statusText = ui.connectStatus || (connected ? '已连接 ' + state.haUrl : (demo ? '演示模式无需连接' : '填写地址后即可控制设备'));

    return '' +
      '<div class="me">' +
        '<div class="profile">' +
          '<div class="avatar-wrap"><span class="avatar-text">' + NF.esc(initial) + '</span></div>' +
          '<span class="row-label">' + NF.esc(name) + '</span>' +
          '<span class="row-desc">' + NF.esc(providerText(session)) + '</span>' +
        '</div>' +

        '<div class="stats-card">' +
          '<div class="stat-item"><span class="stat-value">' + stat.device + '</span><span class="stat-label">设备</span></div>' +
          '<div class="stat-item"><span class="stat-value">' + stat.scene + '</span><span class="stat-label">场景</span></div>' +
          '<div class="stat-item"><span class="stat-value">' + stat.automation + '</span><span class="stat-label">自动化</span></div>' +
        '</div>' +

        '<div class="group">' +
          '<span class="group-title">家庭连接</span>' +
          '<div class="group-card">' +
            '<div class="row">' +
              '<div class="row-main">' +
                '<span class="row-label">连接状态</span>' +
                '<span class="row-desc" id="me-conn-desc">' + NF.esc(state.haUrl || '未填写地址') + '</span>' +
              '</div>' +
              '<div class="row-value-wrap"><span class="row-value">' + NF.esc(connectionLabel()) + '</span></div>' +
            '</div>' +
            (demo ? '' :
              '<div class="connection-form">' +
                '<input class="field" id="me-ha-url" placeholder="http://192.168.1.10:8123" value="' + NF.esc(ui.haUrl) + '" />' +
                '<div class="connect-button" id="me-connect">' + (ui.connecting ? '连接中…' : (connected ? '重新连接' : '连接家庭')) + '</div>' +
              '</div>') +
            '<div class="' + statusClass + '">' + NF.esc(statusText) + '</div>' +
            (connected && !demo ? '<div class="row" id="me-disconnect"><div class="row-main"><span class="row-label">断开这个家庭</span>' +
              '<span class="row-desc">保留登录，随时可重新连接</span></div><div class="row-value-wrap"><span class="row-arrow">›</span></div></div>' : '') +
          '</div>' +
        '</div>' +

        '<div class="group">' +
          '<span class="group-title">外观</span>' +
          '<div class="group-card appearance-card">' +
            '<div class="theme-options">' + renderTheme() + '</div>' +
          '</div>' +
        '</div>' +

        '<div class="group">' +
          '<span class="group-title">系统权限</span>' +
          '<div class="group-card">' +
            '<div class="row" data-perm="bluetooth"><div class="row-main"><span class="row-label">蓝牙</span>' +
              '<span class="row-desc">添加 ESP32 / 蓝牙网关设备</span></div>' +
              '<div class="row-value-wrap"><span class="row-value" id="perm-bluetooth">' +
              (NF.permissions.bluetoothSupported() ? '可用' : '不支持') + '</span></div></div>' +
            '<div class="row" data-perm="wifi"><div class="row-main"><span class="row-label">网络</span>' +
              '<span class="row-desc">局域网扫描与设备发现</span></div>' +
              '<div class="row-value-wrap"><span class="row-value" id="perm-wifi">' + (navigator.onLine === false ? '离线' : '在线') + '</span></div></div>' +
            '<div class="row" data-perm="notification"><div class="row-main"><span class="row-label">系统通知</span>' +
              '<span class="row-desc">设备告警与提醒</span></div>' +
              '<div class="row-value-wrap"><span class="row-value" id="perm-notification">' +
              (NF.permissions.notificationsConfigured() ? '已设置' : '未开启') + '</span></div></div>' +
          '</div>' +
        '</div>' +

        '<div class="group">' +
          '<span class="group-title">腾讯生态</span>' +
          '<div class="group-card">' + renderTencent() + '</div>' +
        '</div>' +

        (connected && !demo ? '' +
          '<div class="group">' +
            '<span class="group-title">腾讯会议</span>' +
            '<div class="group-card meeting-card">' +
              '<div class="meeting-form">' +
                '<input class="meeting-input" id="meeting-subject" placeholder="会议主题" value="' + NF.esc(ui.meetingSubject) + '" />' +
                '<div class="meeting-btn" id="meeting-create">' + (ui.meetingCreating ? '创建中…' : '创建') + '</div>' +
              '</div>' +
              renderMeetings() +
            '</div>' +
          '</div>' : '') +

        '<div class="group">' +
          '<span class="group-title">关于</span>' +
          '<div class="group-card">' +
            '<div class="row"><div class="row-main"><span class="row-label">版本</span>' +
              '<span class="row-desc">NovaForge 软件版</span></div>' +
              '<div class="row-value-wrap"><span class="row-value">' + VERSION + '</span></div></div>' +
            '<div class="row" data-action="refresh"><div class="row-main"><span class="row-label">刷新家庭数据</span>' +
              '<span class="row-desc">重新读取设备与场景</span></div>' +
              '<div class="row-value-wrap"><span class="row-arrow">›</span></div></div>' +
          '</div>' +
        '</div>' +

        '<div class="logout" id="me-logout">退出登录</div>' +
      '</div>';
  }

  function refreshDom() {
    var host = NF.$('page-host');
    if (!host || NF.app.currentPage() !== 'me') return;
    host.innerHTML = render();
    bind();
  }

  async function loadTencent() {
    if (!NF.store.isConnected()) return;
    try {
      var res = await NF.ha.tencentServices();
      var services = (res && res.services) || {};
      ui.tencentList = Object.keys(services).map(function (key) {
        return Object.assign({ key: key }, services[key]);
      });
      ui.tencentLoaded = true;
    } catch (err) {
      console.error('[Me] load tencent failed', err);
      ui.tencentLoaded = true;
    }
    refreshDom();
  }

  async function loadMeetings() {
    if (!NF.store.isConnected()) return;
    try {
      var res = await NF.ha.listTencentMeetings(1);
      ui.meetings = (res && res.meetings) || [];
      ui.meetingsLoaded = true;
    } catch (err) {
      console.error('[Me] load meetings failed', err);
      ui.meetingsLoaded = true;
    }
    refreshDom();
  }

  async function connect() {
    var state = NF.store.state;
    var session = state.session || {};
    if (ui.connecting) return;

    var base = fmt.normalizeUrl(ui.haUrl);
    ui.haUrl = base;

    if (!base) {
      ui.connectStatus = '请填写家庭 Home Assistant 地址，例如 http://192.168.1.10:8123';
      refreshDom();
      return;
    }

    ui.connecting = true;
    ui.connectStatus = '正在连接家庭…';
    refreshDom();

    try {
      await NF.ha.pingHa(base);

      if (session.provider === 'demo') throw new Error('演示模式不能连接真实家庭，请先退出登录');

      var identity = session.providerToken;
      if (!identity) {
        ui.connecting = false;
        ui.connectStatus = '当前账号没有可用的家庭凭证，请退出后重新登录一次';
        refreshDom();
        return;
      }

      var res = await NF.ha.tokenLogin(base, identity, session.provider || 'github');
      if (!res || !res.ok || !res.token) throw new Error((res && res.error) || '这个家庭没有绑定当前账号');

      NF.store.bindHa(res.token, base, {
        name: (res.account && (res.account.name || res.account.login)) || session.name,
        email: (res.account && res.account.email) || session.email
      });

      ui.connecting = false;
      ui.connectStatus = '家庭已连接';
      refreshDom();
      NF.toast('家庭已连接');
      loadTencent();
      loadMeetings();
    } catch (err) {
      console.error('[Me] connect failed', err);
      ui.connecting = false;
      ui.connectStatus = (err && err.message) || '连接失败';
      refreshDom();
    }
  }

  async function disconnect() {
    var answer = await NF.confirm('断开家庭', '会清除本地登录令牌，之后仍可用当前账号重新连接。');
    if (!answer || !answer.confirm) return;

    var session = Object.assign({}, NF.store.state.session || {}, { pending: true, token: '' });
    NF.store.signIn(session, '');
    ui.connectStatus = '已断开，可随时重新连接';
    refreshDom();
    NF.toast('已断开家庭');
  }

  async function createMeeting() {
    var subject = String(ui.meetingSubject || '').trim();
    if (!subject) {
      NF.toast('请先填写会议主题');
      return;
    }
    if (ui.meetingCreating) return;

    ui.meetingCreating = true;
    refreshDom();
    try {
      var res = await NF.ha.createTencentMeeting({ subject: subject });
      ui.meetingCreating = false;
      ui.meetingSubject = '';
      if (res && res.ok) {
        NF.toast('会议已创建');
        if (res.meeting && res.meeting.join_url) NF.copy(res.meeting.join_url);
        loadMeetings();
      } else {
        NF.toast((res && res.error) || '创建失败', 2600);
        refreshDom();
      }
    } catch (err) {
      ui.meetingCreating = false;
      NF.toast((err && err.message) || '创建失败', 2600);
      refreshDom();
    }
  }

  function bind() {
    var host = NF.$('page-host');
    if (!host) return;

    var urlInput = NF.$('me-ha-url');
    if (urlInput) {
      urlInput.addEventListener('input', function () { ui.haUrl = urlInput.value; });
    }

    var connectBtn = NF.$('me-connect');
    if (connectBtn) connectBtn.addEventListener('click', connect);

    var disconnectRow = NF.$('me-disconnect');
    if (disconnectRow) disconnectRow.addEventListener('click', disconnect);

    host.querySelectorAll('[data-theme]').forEach(function (el) {
      el.addEventListener('click', function () {
        ui.themeMode = el.dataset.theme;
        NF.theme.setMode(ui.themeMode);
        refreshDom();
      });
    });

    host.querySelectorAll('[data-perm]').forEach(function (el) {
      el.addEventListener('click', async function () {
        var kind = el.dataset.perm;
        if (kind === 'bluetooth') {
          var ok = await NF.permissions.requestBluetooth();
          NF.toast(ok ? '蓝牙可用' : '当前环境不支持蓝牙');
        } else if (kind === 'wifi') {
          var online = await NF.permissions.wifiState();
          NF.toast(online ? '网络在线' : '当前处于离线');
        } else {
          var granted = await NF.permissions.requestNotifications();
          NF.toast(granted ? '通知已开启' : '未能开启通知');
        }
        refreshDom();
      });
    });

    var meetingCreate = NF.$('meeting-create');
    if (meetingCreate) meetingCreate.addEventListener('click', createMeeting);

    var meetingInput = NF.$('meeting-subject');
    if (meetingInput) {
      meetingInput.addEventListener('input', function () { ui.meetingSubject = meetingInput.value; });
    }

    host.querySelectorAll('[data-meeting]').forEach(function (el) {
      el.addEventListener('click', function () {
        var url = el.dataset.meeting;
        if (!url) return;
        NF.copy(url).then(function () { NF.toast('入会链接已复制'); });
      });
    });

    var refreshRow = host.querySelector('[data-action="refresh"]');
    if (refreshRow) {
      refreshRow.addEventListener('click', async function () {
        if (!NF.store.isConnected()) {
          NF.toast('还没有连接家庭');
          return;
        }
        NF.showLoading('正在同步');
        var error = await NF.store.refresh();
        NF.hideLoading();
        NF.toast(error || '已同步');
        refreshDom();
      });
    }

    var logout = NF.$('me-logout');
    if (logout) {
      logout.addEventListener('click', async function () {
        var answer = await NF.confirm('退出登录', '退出后需要重新登录才能控制家庭设备。');
        if (!answer || !answer.confirm) return;
        NF.store.signOut();
        NF.app.relaunch('login');
      });
    }
  }

  NF.pages = NF.pages || {};
  NF.pages.me = {
    render: render,
    bind: bind,
    onShow: function () {
      var state = NF.store.state;
      var session = state.session || {};
      ui.haUrl = state.haUrl && state.haUrl.indexOf('demo://') !== 0 ? state.haUrl : '';
      ui.themeMode = NF.theme.currentMode();
      var connected = NF.store.isConnected();
      if (connected && !session.demo) {
        loadTencent();
        loadMeetings();
      }
      refreshDom();
    },
    refreshDom: refreshDom
  };
}(window.NF));
