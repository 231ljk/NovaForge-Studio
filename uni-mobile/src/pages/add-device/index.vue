<template>
  <view class="add-device">
    <view class="hero">
      <text class="hero-title">添加设备</text>
      <text class="hero-subtitle">搜索局域网设备，或手动填写地址和令牌</text>
    </view>

    <view class="card empty-card" v-if="!connected">
      <text class="card-title">还没连接家庭</text>
      <text class="card-tip">连接 Home Assistant 后再添加设备</text>
      <view class="primary-button" @tap="goMe"><text>去连接家庭</text></view>
    </view>

    <template v-else>
      <view class="card">
        <view class="card-head">
          <view class="card-head-info">
            <text class="card-title">{{ scanning ? '正在搜索' : '局域网设备' }}</text>
            <text class="card-tip">设备需通电并连接家庭 WiFi</text>
          </view>
          <view class="scan-button" :class="{ 'button-busy': scanning }" @tap="scan">
            <text>{{ scanning ? '搜索中' : '扫描局域网' }}</text>
          </view>
        </view>

        <view class="device-list" v-if="devices.length">
          <view
            class="device-row"
            :class="{ 'device-row-active': host === item.host }"
            v-for="item in devices"
            :key="item.host"
            @tap="pickDevice(item)"
          >
            <view class="device-icon"><text>N</text></view>
            <view class="device-info">
              <text class="device-name">{{ item.name }}</text>
              <text class="device-host">{{ item.host }}</text>
            </view>
            <text class="device-pick">{{ host === item.host ? '已选择' : '选择' }}</text>
          </view>
        </view>
        <text class="scan-tip" v-else>{{ scanMessage }}</text>
      </view>

      <view class="card">
        <text class="card-title">手动添加</text>
        <text class="card-tip">填写 Home Assistant 地址、端口和长期访问令牌</text>

        <text class="field-label">HA 地址</text>
        <input class="field" v-model="host" placeholder="http://192.168.1.10" placeholder-class="ph" />

        <text class="field-label">端口</text>
        <input class="field" v-model="port" type="number" placeholder="8123" placeholder-class="ph" />

        <text class="field-label">长期令牌</text>
        <input class="field" v-model="token" password placeholder="长期访问令牌" placeholder-class="ph" />

        <view class="primary-button" :class="{ 'button-busy': adding }" @tap="add">
          <text>{{ adding ? '正在添加…' : '添加设备' }}</text>
        </view>

        <text class="status" v-if="status">{{ status }}</text>
      </view>
    </template>
  </view>
</template>

<script setup>
import { onUnmounted, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import * as store from '../../services/store'
import * as ha from '../../services/ha'

const connected = ref(false)
const scanning = ref(false)
const devices = ref([])
const scanMessage = ref('点击右上角「扫描局域网」开始搜索')
const host = ref('')
const port = ref('8123')
const token = ref('')
const adding = ref(false)
const status = ref('')
let scanned = false
let unsubscribe = null

const apply = (next) => {
  const src = next || store.state || {}
  try {
    connected.value = !!store.isConnected()
  } catch (err) {
    connected.value = false
  }
  return src
}

const goMe = () => {
  uni.switchTab({
    url: '/pages/me/index',
    fail: () => {
      uni.navigateTo({ url: '/pages/me/index', fail: () => {} })
    }
  })
}

const scan = async () => {
  if (!connected.value) {
    uni.showToast({ title: '请先连接家庭', icon: 'none' })
    return
  }
  if (scanning.value) return
  scanning.value = true
  scanned = true
  devices.value = []
  scanMessage.value = '正在搜索局域网设备…'
  try {
    const res = await ha.scanDevices()
    if (!res || res.ok === false) throw new Error((res && res.error) || '扫描失败')
    devices.value = (res.devices || []).map((item) => ({
      name: item.name || 'NovaForge 设备',
      host: item.host || item.ip || '',
      port: String(item.port || 80)
    })).filter((item) => !!item.host)
    scanMessage.value = devices.value.length
      ? '找到 ' + devices.value.length + ' 台设备'
      : '未发现设备，请检查电源和 WiFi，或手动添加'
  } catch (err) {
    scanMessage.value = '搜索失败：' + ((err && err.message) || '请稍后重试，或手动添加')
  } finally {
    scanning.value = false
  }
}

const pickDevice = (item) => {
  host.value = item.host
  port.value = item.port || '80'
  status.value = '已选择 ' + item.name + '，请填写长期令牌'
}

const add = async () => {
  if (adding.value) return
  if (!connected.value) {
    uni.showToast({ title: '请先连接家庭', icon: 'none' })
    return
  }
  const hostValue = String(host.value || '').trim()
  const portValue = String(port.value || '').trim() || '8123'
  const tokenValue = String(token.value || '').trim()
  if (!hostValue) {
    uni.showToast({ title: '请填写 HA 地址', icon: 'none' })
    return
  }
  if (!tokenValue) {
    uni.showToast({ title: '请填写长期令牌', icon: 'none' })
    return
  }

  adding.value = true
  status.value = '正在添加设备…'
  try {
    const res = await ha.addDevice(hostValue, portValue, tokenValue)
    if (!res || res.ok === false) throw new Error((res && res.error) || '添加失败')
    try {
      await store.refresh()
    } catch (err) {
      // 刷新失败不影响添加结果
    }
    uni.showToast({ title: '设备已添加', icon: 'success' })
    setTimeout(() => uni.navigateBack({ delta: 1, fail: () => {} }), 600)
  } catch (err) {
    status.value = (err && err.message) || '添加失败，请检查地址和令牌'
  } finally {
    adding.value = false
  }
}

onLoad(() => {
  try {
    unsubscribe = store.subscribe((state) => apply(state))
  } catch (err) {
    unsubscribe = null
  }
  const state = apply()
  const saved = state && state.haUrl
  if (saved && !/^demo:\/\//.test(saved)) {
    const bare = String(saved).replace(/^https?:\/\//i, '')
    const parts = bare.split(':')
    host.value = parts[0] || ''
    port.value = parts[1] || '8123'
  }
})

onShow(() => {
  try {
    store.ensureSession()
  } catch (err) {
    return
  }
  apply()
  if (connected.value && !scanned) scan()
})

onUnmounted(() => {
  if (unsubscribe) unsubscribe()
})
</script>

<style>
.add-device {
  min-height: 100vh;
  padding: 28rpx 32rpx calc(56rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  background: #f5f6f7;
}

.hero {
  margin-bottom: 24rpx;
  padding: 8rpx 4rpx 0;
}

.hero-title {
  display: block;
  margin-bottom: 6rpx;
  font-size: 36rpx;
  font-weight: 600;
  color: #1f2329;
}

.hero-subtitle {
  font-size: 24rpx;
  color: #9aa0a6;
}

.card {
  margin-bottom: 20rpx;
  padding: 28rpx;
  border: 1rpx solid #e3e5e8;
  border-radius: 16rpx;
  background: #ffffff;
}

.empty-card {
  padding-top: 48rpx;
  padding-bottom: 48rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.card-head-info {
  flex: 1;
  min-width: 0;
}

.card-title {
  display: block;
  margin-bottom: 6rpx;
  font-size: 29rpx;
  font-weight: 600;
  color: #1f2329;
}

.card-tip {
  display: block;
  margin-bottom: 22rpx;
  font-size: 22rpx;
  line-height: 1.6;
  color: #9aa0a6;
}

.scan-button {
  flex-shrink: 0;
  height: 64rpx;
  margin-left: 20rpx;
  padding: 0 24rpx;
  border: 1rpx solid #cfe5e2;
  border-radius: 12rpx;
  background: #ffffff;
  color: #008a7f;
  font-size: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.button-busy {
  opacity: 0.55;
}

.device-list {
  margin-top: 8rpx;
  border-top: 1rpx solid #f0f1f2;
}

.device-row {
  display: flex;
  align-items: center;
  padding: 22rpx 8rpx;
  border-bottom: 1rpx solid #f0f1f2;
}

.device-row:last-child {
  border-bottom: none;
}

.device-row-active {
  background: rgba(0, 179, 164, 0.08);
}

.device-icon {
  flex-shrink: 0;
  width: 64rpx;
  height: 64rpx;
  margin-right: 16rpx;
  border-radius: 12rpx;
  background: #f5f6f7;
  color: #008a7f;
  font-size: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.device-info {
  flex: 1;
  min-width: 0;
}

.device-name {
  display: block;
  margin-bottom: 4rpx;
  font-size: 28rpx;
  font-weight: 500;
  color: #1f2329;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-host {
  font-size: 22rpx;
  color: #9aa0a6;
}

.device-pick {
  flex-shrink: 0;
  margin-left: 12rpx;
  font-size: 23rpx;
  color: #008a7f;
}

.scan-tip {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #9aa0a6;
}

.field-label {
  display: block;
  margin-bottom: 10rpx;
  font-size: 24rpx;
  color: #6b7280;
}

.field {
  width: 100%;
  height: 92rpx;
  margin-bottom: 22rpx;
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

.primary-button {
  height: 92rpx;
  margin-top: 8rpx;
  border-radius: 12rpx;
  background: #008a7f;
  color: #ffffff;
  font-size: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.status {
  display: block;
  margin-top: 20rpx;
  padding: 18rpx 22rpx;
  border: 1rpx solid #e3e5e8;
  border-radius: 12rpx;
  background: #f5f6f7;
  font-size: 24rpx;
  line-height: 1.7;
  color: #b45309;
}
</style>
