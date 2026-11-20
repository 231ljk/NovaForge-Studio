<template>
  <view class="scenes">
    <view class="page-header"><text class="page-title">场景</text></view>

    <view class="empty-card connect-empty" v-if="!connected">
      <text class="empty-title">连接家庭后查看场景</text>
      <text class="empty-text">场景和自动化保存在 Home Assistant 中</text>
      <view class="primary-button" @tap="goMe"><text>去连接家庭</text></view>
    </view>

    <template v-else>
      <view class="section-head">
        <text class="section-title">我的场景</text>
        <text class="section-tip">{{ scenes.length }} 个</text>
      </view>

      <view class="scene-grid" v-if="scenes.length">
        <view
          class="scene-card"
          :class="{ 'scene-busy': busyId === item.id }"
          v-for="item in scenes"
          :key="item.id"
          @tap="runScene(item)"
        >
          <view class="scene-top">
            <view class="scene-icon"><text>{{ item.icon }}</text></view>
            <text class="scene-action">{{ busyId === item.id ? '执行中' : '执行' }}</text>
          </view>
          <text class="scene-name">{{ item.name }}</text>
        </view>
      </view>
      <view class="empty-card" v-else>
        <text class="empty-text">{{ refreshing ? '正在读取…' : '还没有场景' }}</text>
      </view>

      <view class="section-head">
        <text class="section-title">自动化</text>
        <text class="section-tip">{{ activeAutomations }} 项运行中</text>
      </view>

      <view class="automation-card" v-if="automations.length">
        <view class="automation-row" v-for="item in automations" :key="item.id">
          <view class="automation-info">
            <text class="automation-name">{{ item.name }}</text>
            <text class="automation-state" :class="{ 'automation-on': item.on }">{{ item.on ? '已启用' : '已停用' }}</text>
          </view>
          <switch :checked="item.on" color="#008a7f" :disabled="!!busyId" @change="toggleAutomation(item, $event)" />
        </view>
      </view>
      <view class="empty-card" v-else>
        <text class="empty-text">{{ refreshing ? '正在读取…' : '还没有自动化' }}</text>
      </view>
    </template>
  </view>
</template>

<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import * as store from '../../services/store'
import * as ha from '../../services/ha'

const SCENE_ICONS = ['🎬', '🌙', '🛡️', '☀️', '🍽️', '📖']

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

const data = computed(() => snapshot.value.data || {})
const refreshing = computed(() => !!snapshot.value.refreshing)
const scenes = computed(() =>
  (data.value.scenes || []).map((item, index) => ({
    id: item.id,
    name: item.name || item.id,
    icon: SCENE_ICONS[index % SCENE_ICONS.length]
  }))
)
const automations = computed(() =>
  (data.value.automations || []).map((item) => ({
    id: item.id,
    name: item.name || item.id,
    on: item.state === 'on'
  }))
)
const activeAutomations = computed(() => automations.value.filter((item) => item.on).length)

const goMe = () => {
  uni.switchTab({
    url: '/pages/me/index',
    fail: () => {
      uni.navigateTo({ url: '/pages/me/index', fail: () => {} })
    }
  })
}

const runScene = async (item) => {
  if (!connected.value || busyId.value) return
  busyId.value = item.id
  try {
    const res = await ha.callService('scene', 'turn_on', { entity_id: item.id })
    if (!res || res.ok === false) throw new Error((res && res.error) || '场景执行失败')
    uni.showToast({ title: '已执行「' + item.name + '」', icon: 'none' })
  } catch (err) {
    uni.showToast({ title: (err && err.message) || '场景执行失败', icon: 'none', duration: 2500 })
  } finally {
    busyId.value = ''
  }
}

const toggleAutomation = async (item, event) => {
  if (!connected.value || busyId.value) return
  const enabled = !!(event && event.detail && event.detail.value)
  busyId.value = item.id
  try {
    const res = await ha.callService('automation', enabled ? 'turn_on' : 'turn_off', {
      entity_id: item.id
    })
    if (!res || res.ok === false) throw new Error((res && res.error) || '自动化设置失败')
    const message = await store.refresh()
    if (message) throw new Error(message)
  } catch (err) {
    uni.showToast({ title: (err && err.message) || '自动化设置失败', icon: 'none', duration: 2500 })
    apply()
  } finally {
    busyId.value = ''
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
.scenes {
  min-height: 100vh;
  padding: 28rpx 32rpx calc(56rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  background: #f5f6f7;
}

.page-header {
  padding: 8rpx 4rpx 24rpx;
}

.page-title {
  display: block;
  font-size: 36rpx;
  font-weight: 600;
  color: #1f2329;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 4rpx 18rpx;
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

.scene-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
}

.scene-card {
  width: 48.8%;
  min-height: 166rpx;
  margin-bottom: 16rpx;
  padding: 22rpx;
  box-sizing: border-box;
  border: 1rpx solid #e3e5e8;
  border-radius: 16rpx;
  background: #ffffff;
  display: flex;
  flex-direction: column;
}

.scene-busy {
  opacity: 0.55;
}

.scene-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 22rpx;
}

.scene-icon {
  width: 60rpx;
  height: 60rpx;
  border-radius: 12rpx;
  background: #f2f3f5;
  font-size: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.scene-action {
  font-size: 23rpx;
  color: #008a7f;
}

.scene-name {
  font-size: 28rpx;
  font-weight: 500;
  color: #1f2329;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.automation-card {
  padding: 0 24rpx;
  border: 1rpx solid #e3e5e8;
  border-radius: 16rpx;
  background: #ffffff;
}

.automation-row {
  min-height: 104rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1rpx solid #f0f1f2;
}

.automation-row:last-child {
  border-bottom: none;
}

.automation-info {
  flex: 1;
  min-width: 0;
  padding-right: 24rpx;
}

.automation-name {
  display: block;
  margin-bottom: 6rpx;
  font-size: 28rpx;
  font-weight: 500;
  color: #1f2329;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.automation-state {
  font-size: 22rpx;
  color: #9aa0a6;
}

.automation-on {
  color: #008a7f;
}

.empty-card {
  padding: 44rpx 28rpx;
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
  padding-top: 68rpx;
  padding-bottom: 68rpx;
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
</style>
