// 在微信公众平台创建订阅消息模板后，将模板 ID 填到这里。
// 模板应包含账号/系统问题提醒所需的字段，发送端也需要使用同一模板。
const SUBSCRIBE_TEMPLATE_ID = '';

const openPermissionSettings = (title, content) => {
  wx.showModal({
    title,
    content,
    confirmText: '去设置',
    success: (res) => {
      if (res.confirm) wx.openAppAuthorizeSetting();
    }
  });
};

const requestBluetooth = () =>
  new Promise((resolve) => {
    if (!wx.openBluetoothAdapter) {
      wx.showToast({ title: '当前微信版本不支持蓝牙', icon: 'none' });
      resolve(false);
      return;
    }
    wx.openBluetoothAdapter({
      success: () => {
        wx.showToast({ title: '蓝牙可用', icon: 'success' });
        resolve(true);
      },
      fail: (err) => {
        const code = Number(err.errCode);
        if (code === 10001) {
          wx.showModal({ title: '请打开蓝牙', content: '设备连接需要使用系统蓝牙。', showCancel: false });
        } else {
          openPermissionSettings('需要蓝牙权限', '请在微信权限设置中允许蓝牙，用于发现附近的 NovaForge 设备。');
        }
        resolve(false);
      }
    });
  });

const requestWifi = async () => {
  try {
    const info = wx.getDeviceInfo ? wx.getDeviceInfo() : wx.getSystemInfoSync();
    if (info.platform === 'android' && wx.authorize) {
      await new Promise((resolve, reject) => {
        wx.authorize({ scope: 'scope.userLocation', success: resolve, fail: reject });
      });
    }
  } catch (err) {
    openPermissionSettings('需要 WiFi 信息权限', '部分安卓手机需要允许位置信息，才能读取当前 WiFi 并发现局域网设备。');
    return false;
  }

  return new Promise((resolve) => {
    if (!wx.startWifi) {
      wx.showToast({ title: '当前微信版本不支持 WiFi', icon: 'none' });
      resolve(false);
      return;
    }
    wx.startWifi({
      success: () => {
        wx.getConnectedWifi({
          success: (res) => {
            const ssid = res.wifi && res.wifi.SSID;
            wx.showToast({ title: ssid ? '已连接 ' + ssid : 'WiFi 可用', icon: 'none' });
            resolve(true);
          },
          fail: () => {
            openPermissionSettings('需要 WiFi 权限', '请连接家庭 WiFi，并在系统设置中允许微信读取 WiFi 信息。');
            resolve(false);
          }
        });
      },
      fail: () => {
        openPermissionSettings('无法使用 WiFi', '请检查系统 WiFi 和微信权限设置。');
        resolve(false);
      }
    });
  });
};

const requestNotifications = () =>
  new Promise((resolve) => {
    if (!SUBSCRIBE_TEMPLATE_ID) {
      wx.showModal({
        title: '通知模板待配置',
        content: '请先在微信公众平台创建账号/系统提醒订阅消息模板，并在小程序与通知服务端配置同一模板 ID。',
        showCancel: false
      });
      resolve(false);
      return;
    }
    wx.requestSubscribeMessage({
      tmplIds: [SUBSCRIBE_TEMPLATE_ID],
      success: (res) => {
        const accepted = res[SUBSCRIBE_TEMPLATE_ID] === 'accept';
        if (accepted) {
          wx.setStorageSync('nf-system-notifications', true);
          wx.showToast({ title: '系统提醒已开启', icon: 'success' });
        } else {
          wx.showToast({ title: '未开启订阅消息', icon: 'none' });
        }
        resolve(accepted);
      },
      fail: (err) => {
        wx.showToast({ title: err.errMsg || '订阅消息授权失败', icon: 'none' });
        resolve(false);
      }
    });
  });

module.exports = {
  requestBluetooth,
  requestWifi,
  requestNotifications,
  notificationsConfigured: () => !!SUBSCRIBE_TEMPLATE_ID
};
