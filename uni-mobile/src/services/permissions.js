// 在微信公众平台创建订阅消息模板后，将模板 ID 填到这里。
// 模板应包含账号/系统问题提醒所需的字段，发送端也需要使用同一模板。
const SUBSCRIBE_TEMPLATE_ID = ''

// #ifdef APP-PLUS
/** 当前安卓 SDK 版本，用于判断是否需要 Android 12+ 的蓝牙权限 */
const androidSdkInt = () => {
  try {
    const version = plus.android.importClass('android.os.Build$VERSION')
    return parseInt(version.SDK_INT, 10) || 0
  } catch (err) {
    return 0
  }
}

/** 真机运行时权限：全部授予才算成功 */
const requestAndroidPermission = (permissions) =>
  new Promise((resolve) => {
    try {
      if (typeof plus === 'undefined' || !plus.android) {
        resolve(false)
        return
      }
      plus.android.requestPermissions(
        permissions,
        (res) => {
          const granted = (res && res.granted) || []
          resolve(granted.length >= permissions.length)
        },
        (err) => {
          console.error('[Permissions] android request failed', err)
          resolve(false)
        }
      )
    } catch (err) {
      console.error('[Permissions] android request failed', err)
      resolve(false)
    }
  })

/** 打开当前应用的系统设置页（安卓走 Intent，iOS 走 app-settings） */
const openAppSetting = () => {
  try {
    if (plus.os.name === 'Android') {
      const main = plus.android.runtimeMainActivity()
      const Intent = plus.android.importClass('android.content.Intent')
      const Uri = plus.android.importClass('android.net.Uri')
      const intent = new Intent()
      intent.setAction('android.settings.APPLICATION_DETAILS_SETTINGS')
      intent.setData(Uri.fromParts('package', main.getPackageName(), null))
      main.startActivity(intent)
      return
    }
    plus.runtime.openURL('app-settings:')
  } catch (err) {
    console.error('[Permissions] open settings failed', err)
  }
}
// #endif

const openPermissionSettings = (title, content) => {
  uni.showModal({
    title,
    content,
    confirmText: '去设置',
    success: (res) => {
      if (!res.confirm) return
      // #ifdef MP-WEIXIN
      if (uni.openAppAuthorizeSetting) uni.openAppAuthorizeSetting()
      // #endif
      // #ifdef APP-PLUS
      openAppSetting()
      // #endif
    }
  })
}

const requestBluetooth = async () => {
  // #ifdef APP-PLUS
  // Android 12（API 31）起蓝牙扫描/连接改为运行时权限
  if (androidSdkInt() >= 31) {
    const granted = await requestAndroidPermission([
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.BLUETOOTH_SCAN'
    ])
    if (!granted) {
      openPermissionSettings('需要蓝牙权限', '请在系统设置中允许“附近的设备”，用于发现附近的 NovaForge 设备。')
      return false
    }
  }
  // #endif

  return new Promise((resolve) => {
    if (!uni.openBluetoothAdapter) {
      uni.showToast({ title: '当前版本不支持蓝牙', icon: 'none' })
      resolve(false)
      return
    }
    uni.openBluetoothAdapter({
      success: () => {
        uni.showToast({ title: '蓝牙可用', icon: 'success' })
        resolve(true)
      },
      fail: (err) => {
        const code = Number(err && err.errCode)
        if (code === 10001) {
          uni.showModal({ title: '请打开蓝牙', content: '设备连接需要使用系统蓝牙。', showCancel: false })
        } else {
          openPermissionSettings('需要蓝牙权限', '请在权限设置中允许蓝牙，用于发现附近的 NovaForge 设备。')
        }
        resolve(false)
      }
    })
  })
}

const requestWifi = async () => {
  // #ifdef APP-PLUS
  // 安卓读取 WiFi/SSID 必须授予定位权限
  const granted = await requestAndroidPermission(['android.permission.ACCESS_FINE_LOCATION'])
  if (!granted) {
    openPermissionSettings('需要定位权限', '安卓读取 WiFi 名称需要定位权限，用于发现局域网设备。')
    return false
  }
  // App 端没有读取 SSID 的开放接口，拿到定位权限即可交给 HA 侧完成局域网发现
  if (typeof uni.startWifi !== 'function') {
    uni.showToast({ title: '局域网权限已就绪', icon: 'none' })
    return true
  }
  // #endif

  // #ifdef MP-WEIXIN
  try {
    const info = uni.getDeviceInfo ? uni.getDeviceInfo() : uni.getSystemInfoSync()
    if (info.platform === 'android' && uni.authorize) {
      await new Promise((resolve, reject) => {
        uni.authorize({ scope: 'scope.userLocation', success: resolve, fail: reject })
      })
    }
  } catch (err) {
    openPermissionSettings('需要 WiFi 信息权限', '部分安卓手机需要允许位置信息，才能读取当前 WiFi 并发现局域网设备。')
    return false
  }
  // #endif

  return new Promise((resolve) => {
    if (!uni.startWifi) {
      uni.showToast({ title: '当前版本不支持 WiFi', icon: 'none' })
      resolve(false)
      return
    }
    uni.startWifi({
      success: () => {
        uni.getConnectedWifi({
          success: (res) => {
            const ssid = res.wifi && res.wifi.SSID
            uni.showToast({ title: ssid ? '已连接 ' + ssid : 'WiFi 可用', icon: 'none' })
            resolve(true)
          },
          fail: () => {
            openPermissionSettings('需要 WiFi 权限', '请连接家庭 WiFi，并在系统设置中允许读取 WiFi 信息。')
            resolve(false)
          }
        })
      },
      fail: () => {
        openPermissionSettings('无法使用 WiFi', '请检查系统 WiFi 和权限设置。')
        resolve(false)
      }
    })
  })
}

const requestNotifications = () => {
  // #ifdef MP-WEIXIN
  if (!SUBSCRIBE_TEMPLATE_ID) {
    uni.showModal({
      title: '通知模板待配置',
      content: '请先在微信公众平台创建账号/系统提醒订阅消息模板，并在小程序与通知服务端配置同一模板 ID。',
      showCancel: false
    })
    return Promise.resolve(false)
  }
  return new Promise((resolve) => {
    uni.requestSubscribeMessage({
      tmplIds: [SUBSCRIBE_TEMPLATE_ID],
      success: (res) => {
        const accepted = res[SUBSCRIBE_TEMPLATE_ID] === 'accept'
        if (accepted) {
          uni.setStorageSync('nf-system-notifications', true)
          uni.showToast({ title: '系统提醒已开启', icon: 'success' })
        } else {
          uni.showToast({ title: '未开启订阅消息', icon: 'none' })
        }
        resolve(accepted)
      },
      fail: (err) => {
        uni.showToast({ title: (err && err.errMsg) || '订阅消息授权失败', icon: 'none' })
        resolve(false)
      }
    })
  })
  // #endif

  // #ifdef APP-PLUS
  return (async () => {
    // Android 13（API 33）起通知需要运行时授权
    if (androidSdkInt() >= 33) {
      const granted = await requestAndroidPermission(['android.permission.POST_NOTIFICATIONS'])
      if (!granted) {
        openPermissionSettings('需要通知权限', '开启通知后，设备告警和系统提醒才能推送到手机。')
        return false
      }
    }
    return new Promise((resolve) => {
      uni.createPushMessage({
        title: 'NovaForge',
        content: '通知已开启，设备告警会在这里提醒你。',
        payload: { type: 'test' },
        success: () => {
          try {
            uni.setStorageSync('nf-system-notifications', true)
          } catch (err) {
            // 存储失败不影响本次授权
          }
          uni.showToast({ title: '通知已开启', icon: 'success' })
          resolve(true)
        },
        fail: (err) => {
          uni.showToast({ title: (err && err.errMsg) || '发送测试通知失败', icon: 'none' })
          resolve(false)
        }
      })
    })
  })()
  // #endif

  // #ifdef H5
  uni.showToast({ title: '当前环境不支持系统通知', icon: 'none' })
  return Promise.resolve(false)
  // #endif
}

/** 请求定位权限并取一次坐标；失败返回 null */
const requestLocation = async () => {
  // #ifdef APP-PLUS
  const granted = await requestAndroidPermission([
    'android.permission.ACCESS_FINE_LOCATION',
    'android.permission.ACCESS_COARSE_LOCATION'
  ])
  if (!granted) {
    openPermissionSettings('需要定位权限', '开启定位后，才能根据你在家/离家自动执行场景。')
    return null
  }
  // #endif

  // #ifdef MP-WEIXIN
  try {
    await new Promise((resolve, reject) => {
      uni.authorize({ scope: 'scope.userLocation', success: resolve, fail: reject })
    })
  } catch (err) {
    openPermissionSettings('需要定位权限', '开启定位后，才能根据你在家/离家自动执行场景。')
    return null
  }
  // #endif

  return new Promise((resolve) => {
    uni.getLocation({
      type: 'wgs84',
      success: (res) => {
        resolve({ lat: res.latitude, lng: res.longitude })
      },
      fail: (err) => {
        console.error('[Permissions] get location failed', err)
        openPermissionSettings('无法获取定位', '请检查系统定位开关和应用定位权限。')
        resolve(null)
      }
    })
  })
}

const notificationsConfigured = () => !!SUBSCRIBE_TEMPLATE_ID

export { requestBluetooth, requestWifi, requestNotifications, requestLocation, notificationsConfigured }
