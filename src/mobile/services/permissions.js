/* NovaForge 软件版 · 权限状态
 * 对应小程序版 services/permissions.js：
 * 小程序走 wx.getSetting + 蓝牙/WiFi/订阅消息授权；软件版映射到浏览器与系统能力。
 */
window.NF = window.NF || {};

(function (NF) {
  'use strict';

  function bluetoothSupported() {
    return !!(navigator.bluetooth);
  }

  function requestBluetooth() {
    if (!bluetoothSupported()) return Promise.resolve(false);
    return Promise.resolve(true);
  }

  function wifiState() {
    if (typeof navigator.onLine === 'boolean') return Promise.resolve(navigator.onLine);
    return Promise.resolve(true);
  }

  function notificationsSupported() {
    return typeof window.Notification !== 'undefined';
  }

  function notificationsConfigured() {
    return notificationsSupported() && Notification.permission !== 'default';
  }

  function requestNotifications() {
    if (!notificationsSupported()) return Promise.resolve(false);
    if (Notification.permission === 'granted') return Promise.resolve(true);
    if (Notification.permission === 'denied') return Promise.resolve(false);
    return Notification.requestPermission().then(function (result) {
      NF.storage.set('nf-system-notifications', result === 'granted' ? '1' : '');
      return result === 'granted';
    }, function () { return false; });
  }

  NF.permissions = {
    bluetoothSupported: bluetoothSupported,
    requestBluetooth: requestBluetooth,
    wifiState: wifiState,
    notificationsSupported: notificationsSupported,
    notificationsConfigured: notificationsConfigured,
    requestNotifications: requestNotifications
  };
}(window.NF));
