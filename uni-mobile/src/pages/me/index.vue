<template>
  <view class="me">
    <view class="profile">
      <view class="avatar"><text>{{ initial }}</text></view>
      <view class="profile-info">
        <text class="profile-name">{{ displayName }}</text>
        <text class="profile-sub">{{ subtitle }}</text>
      </view>
      <text class="provider" v-if="loggedIn">{{ providerLabel }}</text>
      <view class="login-link" v-else @tap="goLogin"><text>去登录</text></view>
    </view>

    <view class="stats-card" v-if="connected">
      <view class="stat">
        <text class="stat-value">{{ counts.entities }}</text>
        <text class="stat-label">设备</text>
      </view>
      <view class="stat">
        <text class="stat-value">{{ counts.scenes }}</text>
        <text class="stat-label">场景</text>
      </view>
      <view class="stat">
        <text class="stat-value">{{ counts.automations }}</text>
        <text class="stat-label">自动化</text>
      </view>
    </view>

    <view class="group" v-if="loggedIn">
      <text class="group-title">账号</text>
      <view class="card">
        <view class="row">
          <text class="row-label">登录方式</text>
          <text class="row-value">{{ providerLabel }}</text>
        </view>
        <view class="row">
          <text class="row-label">手机号/账号</text>
          <text class="row-value">{{ accountName }}</text>
        </view>
        <view class="row">
          <text class="row-label">脱敏 ID</text>
          <text class="row-value">{{ maskedId }}</text>
        </view>
      </view>
    </view>

    <view class="group">
      <text class="group-title">家庭连接</text>
      <view class="card">
        <view class="row">
          <text class="row-label">当前地址</text>
          <text class="row-value">{{ haUrl || '未连接' }}</text>
        </view>
        <view class="connect-form">
          <input class="field" v-model="inputUrl" placeholder="http://192.168.x.x:8123" placeholder-class="ph" />
          <view class="connect-button" :class="{ 'button-busy': connecting }" @tap="connect">
            <text>{{ connecting ? '正在连接' : '连接' }}</text>
          </view>
        </view>
        <text class="status" v-if="connectStatus">{{ connectStatus }}</text>
      </view>
    </view>

    <view class="group">
      <text class="group-title">权限</text>
      <view class="card perm-card">
        <view
          class="perm-button"
          v-for="item in PERMISSIONS"
          :key="item.key"
          @tap="requestPermission(item.key)"
        >
          <text class="perm-title">{{ item.title }}</text>
          <text class="perm-desc">{{ item.desc }}</text>
        </view>
      </view>
    </view>

    <view class="group">
      <text class="group-title">其他</text>
      <view class="card">
        <view class="row link" @tap="goAddDevice">
          <text class="row-label">添加设备</text>
          <text class="row-arrow">›</text>
        </view>
        <view class="row link" @tap="demoMode">
          <text class="row-label">演示模式</text>
          <text class="row-arrow">›</text>
        </view>
        <view class="row link" @tap="logout">
          <text class="row-label danger">退出登录</text>
          <text class="row-arrow">›</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import * as store from '../../services/store'
import * as ha from '../../services/ha'
import * as permissions from '../../services/permissions'
import { normalizeUrl } from '../../utils/format'

const PROVIDER_LABEL = {
  wechat: '微信账号',
  phone: '手机号账号',
  github: 'GitHub 账号',
  gitee: 'Gitee 账号',
  email: '邮箱账号',
  demo: '演示模式'
}
const PERMISSIONS = [
  { key: 'bluetooth', title: '蓝牙', desc: '附近设备连接' },
  { key: 'wifi', title: 'WiFi', desc: '局域网发现' },
  { key: 'notifications', title: '通知', desc: '连接与告警提醒' },
  { key: 'location', title: '位置', desc: '家庭与设备定位' }
]

const snapshot = ref({})
const connected = ref(false)
const inputUrl = ref('')
const connecting = ref(false)
const connectStatus = ref('')
let unsubscribe = null

const apply = (next) => {
  const src = next || store.state || {}
  snapshot.value = src
  try {
    connected.value = !!store.isConnected()
  } catch (err) {
    connected.value = false
  }
}

const session = computed(() => snapshot.value.session || null)
const loggedIn = computed(() => !!(session.value && !session.value.pending))
const data = computed(() => snapshot.value.data || {})
const haUrl = computed(() => snapshot.value.haUrl || '')
const demo = computed(() => !!(session.value && session.value.demo))
const counts = computed(() => ({
  entities: (data.value.entities || []).length,
  scenes: (data.value.scenes || []).length,
  automations: (data.value.automations || []).length
}))
const displayName = computed(() => {
  const s = session.value
  return (s && (s.name || s.email)) || '家庭成员'
})
const initial = computed(() => (displayName.value.charAt(0) || '家').toUpperCase())
const providerLabel = computed(() => {
  const s = session.value
  if (!s) return '未登录'
  return PROVIDER_LABEL[s.provider] || (demo.value ? '演示模式' : '已登录')
})
const accountName = computed(() => {
  const s = session.value || {}
  const phone = s.phone ? String(s.phone).replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') : ''
  return phone || s.email || s.name || '未绑定'
})
const maskedId = computed(() => {
  const s = session.value || {}
  return s.masked || s.uid || '—'
})
const subtitle = computed(() => {
  if (connected.value) return demo.value ? '演示家庭数据' : 'Home Assistant 家庭'
  return '尚未连接家庭'
})

const goLogin = () => {
  uni.reLaunch({ url: '/pages/login/index' })
}

const goAddDevice = () => {
  uni.navigateTo({ url: '/pages/add-device/index', fail: () => {} })
}

const connect = async () => {
  if (connecting.value) return
  const raw = String(inputUrl.value || '').trim()
  const base = typeof normalizeUrl === 'function' ? normalizeUrl(raw) : raw
  if (!base) {
    connectStatus.value = '请填写 Home Assistant 地址'
    return
  }
  inputUrl.value = base
  connecting.value = true
  connectStatus.value = '正在检查地址…'

  let homeName = ''
  try {
    const ping = await ha.pingHa(base)
    if (ping && ping.ok === false) throw new Error((ping && ping.error) || '地址不可达')
    homeName = (ping && ping.name) || ''
  } catch (err) {
    connectStatus.value = '地址不可达：' + ((err && err.message) || '请检查网络和地址')
    connecting.value = false
    return
  }

  connectStatus.value = '地址可用，正在登录…'
  try {
    const s = session.value || {}
    const res = await ha.openidLogin(base, s.identity || {})
    if (res && res.ok === false) throw new Error((res && res.error) || '登录失败')
    if (!res || (!res.token && !res.ok)) throw new Error('登录失败')
    if (typeof store.signIn === 'function') {
      const signed = store.signIn(Object.assign({}, res, { haName: homeName }), base)
      if (signed && typeof signed.then === 'function') await signed
    }
    connectStatus.value = ''
    uni.showToast({ title: '家庭已连接', icon: 'none' })
    try {
      const message = await store.refresh()
      if (message && typeof message === 'string') uni.showToast({ title: message, icon: 'none' })
    } catch (err) {
      // 刷新失败不影响连接结果
    }
  } catch (err) {
    connectStatus.value = '请先去登录页重新登录'
    uni.showToast({ title: '请先去登录页重新登录', icon: 'none', duration: 2500 })
  } finally {
    connecting.value = false
    apply()
  }
}

const requestPermission = async (key) => {
  try {
    if (key === 'bluetooth') {
      const granted = await permissions.requestBluetooth()
      uni.showToast({ title: granted ? '蓝牙可用' : '未授权或蓝牙已关闭', icon: 'none' })
    } else if (key === 'wifi') {
      const granted = await permissions.requestWifi()
      uni.showToast({ title: granted ? 'WiFi 可用' : '未授权或未连接 WiFi', icon: 'none' })
    } else if (key === 'notifications') {
      const granted = await permissions.requestNotifications()
      uni.showToast({ title: granted ? '通知已开启' : '通知未开启', icon: 'none' })
    } else if (key === 'location') {
      const res = await permissions.requestLocation()
      if (res && res.latitude !== undefined && res.longitude !== undefined) {
        uni.showToast({
          title: '位置 ' + Number(res.latitude).toFixed(4) + ', ' + Number(res.longitude).toFixed(4),
          icon: 'none',
          duration: 3000
        })
      } else {
        uni.showToast({ title: res ? '定位成功' : '未授权定位', icon: 'none' })
      }
    }
  } catch (err) {
    uni.showToast({ title: (err && err.message) || '权限申请失败', icon: 'none' })
  }
}

const demoMode = async () => {
  try {
    if (typeof store.demoSignIn !== 'function') throw new Error('当前版本不支持演示模式')
    await store.demoSignIn()
    apply()
    uni.showToast({ title: '已进入演示模式', icon: 'none' })
  } catch (err) {
    uni.showToast({ title: (err && err.message) || '演示模式不可用', icon: 'none' })
  }
}

const logout = () => {
  try {
    store.signOut()
  } catch (err) {
    // 退出失败也回到登录页，避免卡在无效会话
  }
  uni.reLaunch({ url: '/pages/login/index' })
}

onLoad(() => {
  try {
    unsubscribe = store.subscribe((state) => apply(state))
  } catch (err) {
    unsubscribe = null
  }
  const saved = store.state && store.state.haUrl
  if (saved && !/^demo:\/\//.test(saved)) inputUrl.value = saved
  apply()
})

onShow(() => {
  try {
    store.ensureSession()
  } catch (err) {
    // 无会话时仍可查看连接与权限设置
  }
  apply()
  if (connected.value) {
    Promise.resolve(store.refresh()).catch(() => {})
  }
})

onUnmounted(() => {
  if (unsubscribe) unsubscribe()
})
</script>

<style>
.me {
  min-height: 100vh;
  padding: 28rpx 32rpx calc(56rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  background: #f5f6f7;
}

.profile {
  display: flex;
  align-items: center;
  padding: 28rpx;
  border: 1rpx solid #e3e5e8;
  border-radius: 16rpx;
  background: #ffffff;
}

.avatar {
  flex-shrink: 0;
  width: 96rpx;
  height: 96rpx;
  margin-right: 20rpx;
  border-radius: 50%;
  background: #008a7f;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar text {
  color: #ffffff;
  font-size: 38rpx;
  font-weight: 500;
}

.profile-info {
  flex: 1;
  min-width: 0;
}

.profile-name {
  display: block;
  margin-bottom: 6rpx;
  font-size: 32rpx;
  font-weight: 600;
  color: #1f2329;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-sub {
  display: block;
  font-size: 22rpx;
  color: #9aa0a6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.provider {
  flex-shrink: 0;
  margin-left: 12rpx;
  font-size: 22rpx;
  color: #9aa0a6;
}

.login-link {
  flex-shrink: 0;
  margin-left: 12rpx;
  padding: 10rpx 22rpx;
  border: 1rpx solid #cfe5e2;
  border-radius: 12rpx;
  color: #008a7f;
  font-size: 24rpx;
}

.stats-card {
  display: flex;
  align-items: center;
  margin-top: 20rpx;
  padding: 28rpx 0;
  border: 1rpx solid #e3e5e8;
  border-radius: 16rpx;
  background: #ffffff;
}

.stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.stat + .stat::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6rpx;
  bottom: 6rpx;
  width: 1rpx;
  background: #e3e5e8;
}

.stat-value {
  margin-bottom: 6rpx;
  font-size: 34rpx;
  font-weight: 600;
  color: #1f2329;
  line-height: 1.3;
}

.stat-label {
  font-size: 22rpx;
  color: #9aa0a6;
}

.group {
  margin-top: 28rpx;
}

.group-title {
  display: block;
  margin-bottom: 10rpx;
  padding: 0 4rpx;
  font-size: 24rpx;
  color: #6b7280;
}

.card {
  padding: 0 24rpx;
  border: 1rpx solid #e3e5e8;
  border-radius: 16rpx;
  background: #ffffff;
}

.row {
  min-height: 100rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1rpx solid #f0f1f2;
}

.row:last-child {
  border-bottom: none;
}

.link {
  justify-content: space-between;
}

.row-label {
  flex: 1;
  min-width: 0;
  font-size: 28rpx;
  color: #1f2329;
}

.row-value {
  max-width: 55%;
  margin-left: 20rpx;
  font-size: 24rpx;
  color: #9aa0a6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
}

.row-arrow {
  margin-left: 12rpx;
  font-size: 30rpx;
  color: #c9cdd4;
}

.danger {
  color: #b42318;
}

.connect-form {
  padding: 24rpx 0;
}

.field {
  height: 92rpx;
  padding: 0 24rpx;
  border: 1rpx solid #e3e5e8;
  border-radius: 12rpx;
  background: #f5f6f7;
  font-size: 26rpx;
  color: #1f2329;
  box-sizing: border-box;
}

.ph {
  color: #9aa0a6;
}

.connect-button {
  height: 92rpx;
  margin-top: 16rpx;
  border-radius: 12rpx;
  background: #008a7f;
  color: #ffffff;
  font-size: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.button-busy {
  opacity: 0.6;
}

.status {
  display: block;
  padding-bottom: 24rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #b45309;
}

.perm-card {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  padding-top: 24rpx;
  padding-bottom: 24rpx;
  box-sizing: border-box;
}

.perm-button {
  width: 48.8%;
  margin-bottom: 16rpx;
  padding: 22rpx;
  border: 1rpx solid #e3e5e8;
  border-radius: 12rpx;
  background: #f5f6f7;
  box-sizing: border-box;
}

.perm-title {
  display: block;
  margin-bottom: 6rpx;
  font-size: 26rpx;
  color: #1f2329;
}

.perm-desc {
  font-size: 22rpx;
  color: #9aa0a6;
}
</style>
