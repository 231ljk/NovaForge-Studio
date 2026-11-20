/* NovaForge 软件版 · 场景页（场景 + 自动化） */
window.NF = window.NF || {};

(function (NF) {
  'use strict';

  var fmt = NF.fmt;
  var busy = {};

  function render() {
    var state = NF.store.state;
    var connected = NF.store.isConnected();
    var data = state.data || {};
    var scenes = data.scenes || [];
    var automations = data.automations || [];

    if (!connected) {
      return '' +
        '<div class="scenes">' +
          '<div class="page-header"><span class="page-title">场景</span></div>' +
          '<div class="empty-card connect-empty">' +
            '<span class="empty-title">尚未连接家庭</span>' +
            '<span class="empty-text">连接后即可一键执行场景与自动化</span>' +
            '<div class="connect-button" data-go="me">去连接家庭</div>' +
          '</div>' +
        '</div>';
    }

    var sceneHtml = scenes.map(function (item) {
      return '' +
        '<div class="scene-card' + (busy[item.id] ? ' scene-card-busy' : '') + '" data-scene="' + NF.esc(item.id) + '">' +
          '<div class="scene-top"><span class="scene-icon">' + NF.esc(item.icon || '⚡') + '</span>' +
            '<span class="scene-action">执行</span></div>' +
          '<span class="scene-name">' + NF.esc(item.name) + '</span>' +
        '</div>';
    }).join('');

    var autoHtml = automations.map(function (item) {
      var on = item.state === 'on';
      return '' +
        '<div class="automation-card">' +
          '<div class="automation-info">' +
            '<span class="automation-name">' + NF.esc(item.name) + '</span>' +
            '<span class="automation-state' + (on ? ' automation-state-on' : '') + '">' + (on ? '已启用' : '已停用') + '</span>' +
          '</div>' +
          '<div class="switch' + (on ? ' switch-on' : '') + (busy[item.id] ? ' switch-disabled' : '') + '"' +
            ' data-automation="' + NF.esc(item.id) + '" data-state="' + NF.esc(item.state) + '">' +
            '<span class="switch-dot"></span>' +
          '</div>' +
        '</div>';
    }).join('');

    var emptyScene = '' +
      '<div class="empty-card" style="width:100%">' +
        '<span class="empty-title">还没有场景</span>' +
        '<span class="empty-text">可在 Home Assistant 中创建场景后刷新</span>' +
      '</div>';

    var emptyAuto = '' +
      '<div class="empty-card" style="width:100%">' +
        '<span class="empty-title">还没有自动化</span>' +
        '<span class="empty-text">自动化建好后会显示在这里</span>' +
      '</div>';

    return '' +
      '<div class="scenes">' +
        '<div class="page-header"><span class="page-title">场景</span>' +
          '<span class="section-tip">' + (state.refreshing ? '正在更新…' : '一键执行') + '</span></div>' +
        '<div class="section-head"><span class="section-title">场景</span></div>' +
        '<div class="scene-grid">' + (scenes.length ? sceneHtml : emptyScene) + '</div>' +
        '<div class="section-head"><span class="section-title">自动化</span></div>' +
        '<div class="automation-list">' + (automations.length ? autoHtml : emptyAuto) + '</div>' +
      '</div>';
  }

  async function runScene(entityId) {
    if (busy[entityId]) return;
    busy[entityId] = true;
    NF.pages.scenes.refreshDom();
    try {
      await NF.ha.callService('scene', 'turn_on', { entity_id: entityId });
      NF.toast('场景已执行');
    } catch (err) {
      console.error('[Scenes] run scene failed', err);
      NF.toast(err.message || fmt.errText(err), 2600);
    } finally {
      busy[entityId] = false;
      NF.pages.scenes.refreshDom();
    }
  }

  async function toggleAutomation(entityId, current) {
    if (busy[entityId]) return;
    busy[entityId] = true;
    NF.pages.scenes.refreshDom();
    try {
      await NF.ha.callService('automation', current === 'on' ? 'turn_off' : 'turn_on', { entity_id: entityId });
      await NF.store.refresh();
    } catch (err) {
      console.error('[Scenes] toggle automation failed', err);
      NF.toast(err.message || fmt.errText(err), 2600);
    } finally {
      busy[entityId] = false;
      NF.pages.scenes.refreshDom();
    }
  }

  function bind() {
    var host = NF.$('page-host');
    if (!host) return;

    host.querySelectorAll('[data-scene]').forEach(function (el) {
      el.addEventListener('click', function () { runScene(el.dataset.scene); });
    });

    host.querySelectorAll('[data-automation]').forEach(function (el) {
      el.addEventListener('click', function () {
        toggleAutomation(el.dataset.automation, el.dataset.state);
      });
    });

    host.querySelectorAll('[data-go]').forEach(function (el) {
      el.addEventListener('click', function () { NF.app.switchTab(el.dataset.go, true); });
    });
  }

  NF.pages = NF.pages || {};
  NF.pages.scenes = {
    render: render,
    bind: bind,
    refreshDom: function () {
      var host = NF.$('page-host');
      if (!host || NF.app.currentPage() !== 'scenes') return;
      host.innerHTML = render();
      bind();
    }
  };
}(window.NF));
