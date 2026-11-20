<template>
  <view class="home">
    <view class="hero">
      <view class="hero-info">
        <text class="greeting">{{ greetingText }}，{{ displayName }}</text>
        <text class="hero-title">{{ homeName }}</text>
      </view>
      <text class="status-tag" :class="{ 'status-tag-on': connected }">{{ connectionText }}</text>
    </view>

    <view class="content">
      <view class="demo-banner" v-if="demo">演示数据仅保存在本地</view>

      <template v-if="connected">
        <view class="overview">
          <view class="overview-head">
            <text class="overview-title">设备统计</text>
            <text class="overview-tip">{{ demo ? '演示家庭' : '已连接' }}</text>
          </view>
          <view class="stats">
            <view class="stat">
              <text class="stat-value">{{ devices.length }}</text>
              <text class="stat-label">全部设备</text>
            </view>
            <view class="stat">
              <text class="stat-value">{{ activeCount }}</text>
              <text class="stat-label">正在运行</text>
            </view>
            <view class="stat">
              <text class="stat-value">{{ onlineCount }}</text>
              <text class="stat-label">在线设备</text>
            </view>
          </view>
        </view>

        <view class="section-head">
          <text class="section-title">我的设备</text>
          <text class="section-tip">{{ refreshing ? '正在更新…' : '点按控制' }}</text>
        </view>

        <view class="device-grid" v-if="devices.length">
          <view
            class="device-card"
            :class="{ 'device-on': item.on, 'device-busy': busyId === item.id }"
            v-for="item in devices"
            :key="item.id"
            @tap="control(item)"
          >
            <view class="icon-wrap"><text class="device-icon">{{ item.icon }}</text></view>
            <text class="device-name">{{ item.name }}</text>
            <text class="device-state">{{ item.stateLabel }}</text>
          </view>
        </view>
        <view class="empty-card" v-else>
          <text class="empty-title">{{ refreshing ? '正在读取设备' : '还没有设备' }}</text>
          <text class="empty-text" v-if="!refreshing">可点击右下角「添加设备」</text>
        </view>
      </template>

      <view class="empty-card connect-empty" v-else>
        <text class="empty-title">还没连接家庭</text>
        <text class="empty-text">在「我的」里填写 Home Assistant 地址，即可控制家庭设备</text>
        <view class="primary-button" @tap="goMe"><text>去连接家庭</text></view>
      </view>
    </view>

    <view class="fab" @tap="goAddDevice">
      <text class="fab-icon">＋</text>
      <text class="fab-text">添加设备</text>
    </view>
  </view>
</template>

<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import * as store from '../../services/store'
import * as ha from '../../services/ha'
import { entityView, greeting, statusText } from '../../utils/format'

const ON_STATES = ['on', 'open', 'unlocked', 'playing', 'heat', 'cool', 'auto', 'dry', 'fan_only']
const READONLY_DOMAINS = ['sensor', 'binary_sensor', 'device_tracker', 'person', 'weather']

const snapshot = ref({})
const connected = ref(false)
const busyId = ref('')
let unsubscribe = null

const apply = (next) => {
  snapshot.value = next || store.state || {}
  try {
    connected.value = !!store.isConnected()
  } catch (err) {
    connected.value = false
  }
}

const toCard = (item) => {
  const view = (typeof entityView === 'function' ? entityView(item) : null) || {}
  const state = view.state || item.state || ''
  const domain = view.domain || item.domain || ''
  const readonly = view.readonly === undefined ? READONLY_DOMAINS.indexOf(domain) >= 0 : !!view.readonly
  return {
    id: item.id,
    name: view.name || item.name || item.id,
    domain,
    state,
    on: view.on === undefined ? ON_STATES.indexOf(state) >= 0 : !!view.on,
    readonly,
    icon: view.icon || '🔌',
    stateLabel: view.stateLabel || (typeof statusText === 'function' ? statusText(state) : '') || state
  }
}

const data = computed(() => snapshot.value.data || {})
const session = computed(() => snapshot.value.session || null)
const demo = computed(() => !!(session.value && session.value.demo))
const refreshing = computed(() => !!snapshot.value.refreshing)
const devices = computed(() => {
  const list = data.value.entities || []
  return list.map(toCard).filter((item) => !!item.id)
})
const activeCount = computed(() => devices.value.filter((item) => item.on).length)
const onlineCount = computed(() => devices.value.filter((item) => item.state !== 'unavailable').length)
const greetingText = computed(() => (typeof greeting === 'function' ? greeting() : '你好'))
const displayName = computed(() => {
  const s = session.value
  return (s && (s.name || s.email)) || '家庭成员'
})
const homeName = computed(() => data.value.name || snapshot.value.haUrl || '我的家庭')
const connectionText = computed(() => {
  if (!connected.value) return '未连接'
  return demo.value ? '演示家庭' : '已连接'
})

const goMe = () => {
  uni.switchTab({
    url: '/pages/me/index',
    fail: () => {
      uni.navigateTo({ url: '/pages/me/index', fail: () => {} })
    }
  })
}

const goAddDevice = () => {
  uni.navigateTo({ url: '/pages/add-device/index', fail: () => {} })
}

const control = async (item) => {
  if (!connected.value || item.readonly || busyId.value) return
  let service = item.on ? 'turn_off' : 'turn_on'
  if (item.domain === 'lock') service = item.state === 'locked' ? 'unlock' : 'lock'
  else if (item.domain === 'cover') service = item.state === 'open' ? 'close_cover' : 'open_cover'
  else if (item.domain === 'button') service = 'press'

  busyId.value = item.id
  try {
    const res = await ha.callService(item.domain, service, { entity_id: item.id })
    if (!res || res.ok === false) throw new Error((res && res.error) || '设备控制失败')
    await store.refresh()
  } catch (err) {
    uni.showToast({
      title: (err && err.message) || '设备控制失败',
      icon: 'none',
      duration: 2500
    })
  } finally {
    busyId.value = ''
    apply()
  }
}

onLoad(() => {
  try {
    unsubscribe = store.subscribe((state) => apply(state))
  } catch (err) {
    unsubscribe = null
  }
  apply()
})

onShow(() => {
  try {
    if (!store.ensureSession()) return
  } catch (err) {
    return
  }
  apply()
  if (!connected.value) return
  Promise.resolve(store.refresh())
    .then((message) => {
      if (message) uni.showToast({ title: message, icon: 'none', duration: 2500 })
    })
    .catch(() => {})
})

onPullDownRefresh(async () => {
  try {
    if (connected.value) {
      const message = await store.refresh()
      if (message) uni.showToast({ title: message, icon: 'none', duration: 2500 })
    }
  } catch (err) {
    uni.showToast({ title: (err && err.message) || '刷新失败', icon: 'none' })
  } finally {
    uni.stopPullDownRefresh()
  }
})

onUnmounted(() => {
  if (unsubscribe) unsubscribe()
})
</script>

<style>
.home {
  min-height: 100vh;
  padding-bottom: calc(180rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  background: #f5f6f7;
}

.hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 30rpx 32rpx;
  background: #ffffff;
  border-bottom: 1rpx solid #e3e5e8;
}

.hero-info {
  flex: 1;
  min-width: 0;
}

.greeting {
  display: block;
  margin-bottom: 6rpx;
  font-size: 24rpx;
  color: #6b7280;
}

.hero-title {
  display: block;
  font-size: 36rpx;
  font-weight: 600;
  color: #1f2329;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-tag {
  flex-shrink: 0;
  margin-left: 20rpx;
  padding: 8rpx 18rpx;
  border-radius: 24rpx;
  background: #f2f3f5;
  color: #9aa0a6;
  font-size: 22rpx;
}

.status-tag-on {
  background: rgba(0, 138, 127, 0.1);
  color: #008a7f;
}

.content {
  padding: 24rpx 32rpx 0;
}

.demo-banner {
  margin-bottom: 20rpx;
  padding: 14rpx 20rpx;
  border-radius: 12rpx;
  background: #fff7e8;
  color: #ad4e00;
  font-size: 23rpx;
}

.overview {
  padding: 26rpx;
  border: 1rpx solid #e3e5e8;
  border-radius: 16rpx;
  background: #ffffff;
}

.overview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 26rpx;
}

.overview-title {
  font-size: 28rpx;
  font-weight: 500;
  color: #1f2329;
}

.overview-tip {
  font-size: 22rpx;
  color: #9aa0a6;
}

.stats {
  display: flex;
  align-items: center;
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
  top: 8rpx;
  bottom: 8rpx;
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

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 4rpx 18rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2329;
}

.section-tip {
  font-size: 22rpx;
  color: #9aa0a6;
}

.device-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
}

.device-card {
  width: 48.8%;
  min-height: 196rpx;
  margin-bottom: 16rpx;
  padding: 22rpx;
  box-sizing: border-box;
  border: 1rpx solid #e3e5e8;
  border-radius: 16rpx;
  background: #ffffff;
  display: flex;
  flex-direction: column;
}

.device-on {
  background: rgba(0, 179, 164, 0.1);
  border-color: rgba(0, 138, 127, 0.45);
}

.device-busy {
  opacity: 0.55;
}

.icon-wrap {
  width: 64rpx;
  height: 64rpx;
  margin-bottom: 18rpx;
  border-radius: 12rpx;
  background: #f2f3f5;
  display: flex;
  align-items: center;
  justify-content: center;
}

.device-icon {
  font-size: 32rpx;
  line-height: 1;
}

.device-name {
  margin-bottom: 6rpx;
  font-size: 28rpx;
  font-weight: 500;
  color: #1f2329;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-state {
  font-size: 22rpx;
  color: #9aa0a6;
}

.empty-card {
  padding: 48rpx 32rpx;
  border: 1rpx solid #e3e5e8;
  border-radius: 16rpx;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.connect-empty {
  margin-top: 24rpx;
  padding-top: 72rpx;
  padding-bottom: 72rpx;
}

.empty-title {
  margin-bottom: 10rpx;
  font-size: 28rpx;
  font-weight: 500;
  color: #1f2329;
}

.empty-text {
  font-size: 24rpx;
  line-height: 1.7;
  color: #9aa0a6;
}

.primary-button {
  min-width: 220rpx;
  height: 92rpx;
  margin-top: 28rpx;
  padding: 0 32rpx;
  border-radius: 12rpx;
  background: #008a7f;
  color: #ffffff;
  font-size: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fab {
  position: fixed;
  right: 32rpx;
  bottom: calc(48rpx + env(safe-area-inset-bottom));
  height: 88rpx;
  padding: 0 32rpx;
  border-radius: 44rpx;
  background: #008a7f;
  color: #ffffff;
  display: flex;
  align-items: center;
  box-shadow: 0 8rpx 24rpx rgba(0, 138, 127, 0.3);
}

.fab-icon {
  margin-right: 8rpx;
  font-size: 34rpx;
  line-height: 1;
}

.fab-text {
  font-size: 26rpx;
}
</style>
