/* NovaForge 软件版 · 添加设备
 * 对齐小程序版 pages/add-device：局域网扫描 → 选择设备 → 写入 HA。
 */
window.NF = window.NF || {};

(function (NF) {
  'use strict';

  var ui = {
    subnet: '',
    scanning: false,
    scanned: false,
    devices: [],
    picked: '',
    token: '',
    submitting: false
  };

  function guessSubnet() {
    var haUrl = NF.store.state.haUrl || '';
    var matched = /^https?:\/\/(\d+\.\d+\.\d+)\.\d+/.exec(haUrl);
    return matched ? matched[1] : '192.168.1';
  }

  function renderList() {
    if (!ui.scanned) {
      return '<div class="scan-card">' +
        '<div class="scanning-ring"></div>' +
        '<span class="scan-name">准备扫描 ' + NF.esc(ui.subnet) + '.x</span>' +
        '<span class="scan-desc">让 ESP32 设备通电并接入同一个 Wi-Fi</span>' +
        '</div>';
    }
    if (!ui.devices.length) {
      return '<div class="scan-card">' +
        '<span class="scan-name">没有发现新设备</span>' +
        '<span class="scan-desc">确认设备已上电、与电脑在同一网段后重新扫描</span>' +
        '</div>';
    }
    return '<div class="device-list">' + ui.devices.map(function (item) {
      var host = item.host || item.ip || '';
      var active = host === ui.picked ? ' scan-item-active' : '';
      return '' +
        '<div class="scan-item' + active + '" data-host="' + NF.esc(host) + '" data-port="' + NF.esc(item.port || 6053) + '">' +
          '<div class="scan-icon">◉</div>' +
          '<div class="scan-info">' +
            '<span class="scan-name">' + NF.esc(item.name || item.board || '未命名设备') + '</span>' +
            '<span class="scan-host">' + NF.esc(host) + ':' + NF.esc(item.port || 6053) + '</span>' +
          '</div>' +
          '<span class="scan-pick">' + (active ? '已选择' : '选择') + '</span>' +
        '</div>';
    }).join('') + '</div>';
  }

  function render() {
    return '' +
      '<div class="add-device">' +
        '<span class="page-title">添加设备</span>' +
        '<span class="hero-subtitle">扫描局域网里的 ESP32 设备，接入后即可在首页控制。</span>' +

        '<div class="notice">扫描依赖家庭 HA 的内存发现能力，需要先连接家庭。</div>' +

        '<div class="field-label">网段</div>' +
        '<input class="field" id="scan-subnet" placeholder="192.168.1" value="' + NF.esc(ui.subnet) + '" />' +

        renderList() +

        (ui.picked ? '' +
          '<div class="field-label">设备访问令牌</div>' +
          '<input class="field" id="scan-token" placeholder="设备未设密码可留空" value="' + NF.esc(ui.token) + '" />' : '') +

        '<div class="submit' + (ui.picked && !ui.submitting ? '' : ' submit-disabled') + '" id="scan-submit">' +
          (ui.submitting ? '正在添加…' : (ui.picked ? '添加到家庭' : '请选择设备')) + '</div>' +
        '<div class="cancel-button" id="scan-cancel">返回</div>' +
      '</div>';
  }

  function refreshDom() {
    var host = NF.$('page-host');
    if (!host) return;
    host.innerHTML = render();
    bind();
  }

  async function scan() {
    if (ui.scanning) return;
    if (!NF.store.isConnected()) {
      NF.toast('请先连接家庭');
      return;
    }

    ui.scanning = true;
    ui.scanned = false;
    refreshDom();
    NF.showLoading('正在扫描 ' + ui.subnet + '.x');

    try {
      var res = await NF.ha.scanDevices(ui.subnet);
      NF.hideLoading();
      ui.scanning = false;
      ui.scanned = true;
      ui.devices = (res && res.devices) || [];
      if (!ui.devices.length) NF.toast('没有扫到设备');
      refreshDom();
    } catch (err) {
      NF.hideLoading();
      ui.scanning = false;
      ui.scanned = true;
      console.error('[AddDevice] scan failed', err);
      NF.toast((err && err.message) || '扫描失败', 2600);
      refreshDom();
    }
  }

  async function submit(port) {
    var host = ui.picked;
    if (!host || ui.submitting) return;

    ui.submitting = true;
    refreshDom();
    try {
      var res = await NF.ha.addDevice(host, port || 6053, ui.token || '');
      ui.submitting = false;
      if (res && res.ok) {
        NF.toast('设备已添加');
        NF.store.refresh();
        NF.app.back();
        return;
      }
      NF.toast((res && res.error) || '添加失败', 2600);
      refreshDom();
    } catch (err) {
      ui.submitting = false;
      NF.toast((err && err.message) || '添加失败', 2600);
      refreshDom();
    }
  }

  function bind() {
    var subnetInput = NF.$('scan-subnet');
    if (subnetInput) {
      subnetInput.addEventListener('input', function () { ui.subnet = subnetInput.value.trim(); });
      subnetInput.addEventListener('change', scan);
    }

    var tokenInput = NF.$('scan-token');
    if (tokenInput) {
      tokenInput.addEventListener('input', function () { ui.token = tokenInput.value; });
    }

    var host = NF.$('page-host');
    if (host) {
      host.querySelectorAll('[data-host]').forEach(function (el) {
        el.addEventListener('click', function () {
          ui.picked = el.dataset.host;
          ui.port = el.dataset.port;
          refreshDom();
        });
      });
    }

    var submitBtn = NF.$('scan-submit');
    if (submitBtn) submitBtn.addEventListener('click', function () { submit(ui.port); });

    var cancelBtn = NF.$('scan-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', function () { NF.app.back(); });
  }

  NF.pages = NF.pages || {};
  NF.pages['add-device'] = {
    render: render,
    bind: bind,
    onShow: function () {
      if (!ui.subnet) ui.subnet = guessSubnet();
      refreshDom();
      if (!ui.scanned) scan();
    },
    refreshDom: refreshDom
  };
}(window.NF));
