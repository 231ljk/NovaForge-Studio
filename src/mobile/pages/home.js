/* NovaForge 软件版 · 设备页 */
window.NF = window.NF || {};

(function (NF) {
  'use strict';

  var fmt = NF.fmt;
  var busy = {};

  /** 实体 → HA 服务映射（与小程序版一致的开关语义） */
  function serviceFor(item) {
    var domain = item.domain;
    var state = item.state;

    if (domain === 'lock') return state === 'locked' ? 'unlock' : 'lock';
    if (domain === 'cover') return state === 'closed' ? 'open_cover' : 'close_cover';
    if (domain === 'climate') return state === 'off' ? 'turn_on' : 'turn_off';
    if (domain === 'media_player') return state === 'playing' ? 'turn_off' : 'turn_on';
    if (domain === 'vacuum') return (state === 'idle' || state === 'docked') ? 'turn_on' : 'turn_off';
    if (domain === 'button') return 'press';
    if (domain === 'scene' || domain === 'script') return 'turn_on';
    return state === 'on' ? 'turn_off' : 'turn_on';
  }

  function connectedView(state) {
    var data = state.data || {};
    var entities = (data.entities || []).map(fmt.toViewEntity);
    var running = entities.filter(function (item) { return item.on; }).length;
    var online = entities.filter(function (item) { return item.state !== 'unavailable'; }).length;

    var grid = entities.map(function (item) {
      var classes = ['grid-item'];
      if (busy[item.id]) classes.push('grid-item-busy');
      return '' +
        '<div class="' + classes.join(' ') + '">' +
          '<div class="device-card' + (item.on ? ' device-on' : '') + (item.readonly ? ' device-readonly' : '') + '"' +
            ' data-entity="' + NF.esc(item.id) + '">' +
            '<div class="icon-wrap"><span class="device-icon">' + item.icon + '</span></div>' +
            '<span class="device-name">' + NF.esc(item.name) + '</span>' +
            '<span class="device-state">' + NF.esc(item.stateLabel) + '</span>' +
          '</div>' +
        '</div>';
    }).join('');

    var empty = '' +
      '<div class="empty-card" style="width:100%">' +
        '<span class="empty-title">' + (state.refreshing ? '正在读取设备' : '还没有设备') + '</span>' +
        '<span class="empty-text">' + (state.refreshing ? '稍等，正在同步家庭状态' : '可点击右上角加号添加设备') + '</span>' +
      '</div>';

    return '' +
      (state.session && state.session.demo ? '<div class="demo-banner">演示数据仅保存在本地，不会写入你的家庭</div>' : '') +
      '<div class="overview">' +
        '<div class="overview-head">' +
          '<span class="home-name">' + NF.esc(data.name || '我的家庭') + '</span>' +
          '<span class="connection-text">' + (state.refreshing ? '同步中' : '已连接') + '</span>' +
        '</div>' +
        '<div class="stats">' +
          '<div class="stat-item"><span class="stat-value">' + entities.length + '</span><span class="stat-label">全部设备</span></div>' +
          '<div class="stat-item"><span class="stat-value">' + running + '</span><span class="stat-label">正在运行</span></div>' +
          '<div class="stat-item"><span class="stat-value">' + online + '</span><span class="stat-label">在线设备</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="section-head">' +
        '<span class="section-title">我的设备</span>' +
        '<span class="section-tip">' + (state.refreshing ? '正在更新…' : '点按控制') + '</span>' +
      '</div>' +
      '<div class="device-grid">' + (entities.length ? grid : empty) + '</div>';
  }

  function render() {
    var state = NF.store.state;
    var session = state.session || {};
    var name = session.name || session.email || '家庭成员';
    var connected = NF.store.isConnected();

    var body;
    if (connected) {
      body = connectedView(state);
    } else {
      body = '' +
        '<div class="empty-card connect-empty">' +
          '<span class="empty-title">尚未连接家庭</span>' +
          '<span class="empty-text">在“我的”中填写 Home Assistant 地址即可开始控制</span>' +
          '<div class="connect-button" data-go="me">去连接家庭</div>' +
        '</div>';
    }

    return '' +
      '<div class="home">' +
        '<div class="hero">' +
          '<div class="hero-top">' +
            '<div class="hero-info">' +
              '<span class="greeting">' + fmt.greeting() + '，' + NF.esc(name) + '</span>' +
              '<span class="hero-title">' + (connected ? NF.esc((state.data && state.data.name) || '我的家庭') : '未连接家庭') + '</span>' +
            '</div>' +
            (connected ? '<div class="add-button" data-go="add-device"><span class="add-icon">＋</span></div>' : '') +
          '</div>' +
        '</div>' +
        '<div class="content">' + body + '</div>' +
      '</div>';
  }

  async function toggle(entityId) {
    var data = NF.store.state.data || {};
    var item = (data.entities || []).filter(function (x) { return x.id === entityId; })[0];
    if (!item) return;

    var view = fmt.toViewEntity(item);
    if (view.readonly) {
      NF.toast(view.name + '：' + view.stateLabel);
      return;
    }
    if (busy[entityId]) return;

    busy[entityId] = true;
    NF.pages.home.refreshDom();

    try {
      await NF.ha.callService(item.domain, serviceFor(item), { entity_id: entityId });
      await NF.store.refresh();
    } catch (err) {
      console.error('[Home] call service failed', err);
      NF.toast(err.message || fmt.errText(err), 2600);
    } finally {
      busy[entityId] = false;
      NF.pages.home.refreshDom();
    }
  }

  function bind() {
    var host = NF.$('page-host');
    if (!host) return;

    host.querySelectorAll('[data-entity]').forEach(function (el) {
      el.addEventListener('click', function () { toggle(el.dataset.entity); });
    });

    host.querySelectorAll('[data-go]').forEach(function (el) {
      el.addEventListener('click', function () { NF.app.switchTab(el.dataset.go, true); });
    });
  }

  NF.pages = NF.pages || {};
  NF.pages.home = {
    render: render,
    bind: bind,
    refreshDom: function () {
      var host = NF.$('page-host');
      if (!host || NF.app.currentPage() !== 'home') return;
      host.innerHTML = render();
      bind();
    }
  };
}(window.NF));
