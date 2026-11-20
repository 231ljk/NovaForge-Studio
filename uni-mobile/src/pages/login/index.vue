<template>
  <view class="login">
    <text class="brand">NovaForge</text>
    <text class="subtitle">登录后可以控制开发板和家庭设备</text>

    <view class="agree-row">
      <checkbox-group @change="onAgreeChange">
        <label class="agree-label"><checkbox value="agree" :checked="agreed" color="#008a7f" /></label>
      </checkbox-group>
      <text class="agree-text">已阅读并同意 <text class="agree-link" @tap="openDoc('privacy')">《隐私政策》</text>与<text class="agree-link" @tap="openDoc('terms')">《用户协议》</text></text>
    </view>

    <!-- #ifdef MP-WEIXIN -->
    <!-- 微信多端应用里走「身份管理」，短信由微信代发，凭证交服务端换用户标识 -->
    <template v-if="miniappIdentity">
      <button v-if="agreed" class="primary" :disabled="busy" open-type="phoneOneClickLogin" @phoneoneclicklogin="onOneClickLogin">
        本机号码一键登录
      </button>
      <button v-else class="primary" :disabled="busy" @tap="requireAgree">本机号码一键登录</button>
      <text class="hint" v-if="maskedPhone">当前本机号码 {{ maskedPhone }}</text>

      <view class="split"><text>或使用短信验证码</text></view>

      <input class="field" v-model="phone" type="number" maxlength="11" placeholder="手机号" placeholder-class="ph" />
      <view class="code-row">
        <input class="field code" v-model="code" type="number" maxlength="6" placeholder="验证码" placeholder-class="ph" />
        <button v-if="agreed" class="code-button" open-type="sendPhoneSms" :phoneNumber="phone" @sendphonesms="onSendMiniappSms">
          {{ countdown > 0 ? countdown + 's' : '获取验证码' }}
        </button>
        <button v-else class="code-button" @tap="requireAgree">获取验证码</button>
      </view>
      <button class="primary" :disabled="busy" @tap="onMiniappPhoneLogin">手机号登录</button>
      <text class="hint">短信由微信发送和校验。</text>
    </template>

    <template v-else>
      <button class="primary" :disabled="busy" @tap="onWechatLogin">微信登录</button>
      <button v-if="agreed" class="secondary" :disabled="busy" open-type="getPhoneNumber" @getphonenumber="onGetPhone">
        手机号快捷登录
      </button>
      <button v-else class="secondary" :disabled="busy" @tap="requireAgree">手机号快捷登录</button>
      <text class="hint">手机号由微信校验，不会经过我们的服务器。</text>
    </template>
    <!-- #endif -->

    <!-- #ifndef MP-WEIXIN -->
    <input class="field" v-model="phone" type="number" maxlength="11" placeholder="手机号" placeholder-class="ph" />
    <view class="code-row">
      <input class="field code" v-model="code" type="number" maxlength="6" placeholder="验证码" placeholder-class="ph" />
      <button class="code-button" :disabled="countdown > 0" @tap="onSendCode">
        {{ countdown > 0 ? countdown + 's' : '获取验证码' }}
      </button>
    </view>
    <button class="primary" :disabled="busy" @tap="onPhoneLogin">手机号登录</button>
    <button class="secondary" :disabled="busy" @tap="onWechatLogin">微信登录</button>
    <text class="hint">未注册的手机号会自动创建账号。</text>
    <!-- #endif -->

    <view class="third">
      <button class="secondary" :disabled="githubBusy" @tap="onGithubLogin">使用 GitHub 登录</button>
      <view class="device" v-if="githubStep !== 'idle'">
        <text class="hint">在 GitHub 页面输入验证码</text>
        <text class="device-code">{{ userCode }}</text>
        <view class="device-actions">
          <button class="secondary" @tap="onCopyCode">复制验证码</button>
          <button class="secondary" @tap="onOpenGithub">打开 GitHub 授权页</button>
        </view>
        <text class="hint" v-if="githubStep === 'polling'">等待 GitHub 授权…</text>
        <button class="secondary" @tap="onCancelGithub">取消</button>
      </view>
    </view>

    <text class="status" v-if="status">{{ status }}</text>
    <text class="mock" v-if="mockCode">测试验证码：{{ mockCode }}</text>

    <view class="doc-mask" v-if="docVisible" @tap="closeDoc">
      <view class="doc-card" @tap.stop>
        <text class="doc-title">{{ docTitle }}</text>
        <scroll-view class="doc-body" scroll-y><text>{{ docText }}</text></scroll-view>
        <view class="doc-actions">
          <button class="primary" @tap="acceptDoc">同意并勾选</button>
          <button class="secondary" @tap="closeDoc">关闭</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import {
  wechatLogin,
  sendSms,
  verifySms,
  saveSession,
  maskId,
  hasMiniappIdentity,
  miniappPhoneMask,
  miniappSmsLogin,
  miniappOneClickLogin,
  githubStart,
  githubPoll,
  githubUser
} from '../../services/account'
import { AGREEMENTS } from '../../data/agreement'

const agreed = ref(false)
const docVisible = ref(false)
const docTitle = ref('')
const docText = ref('')

const onAgreeChange = (e) => {
  agreed.value = !!((e.detail.value || []).length)
}

const requireAgree = () => {
  if (agreed.value) return true
  status.value = '请先勾选并同意《隐私政策》和《用户协议》'
  return false
}

const openDoc = (doc) => {
  const item = AGREEMENTS[doc] || AGREEMENTS.privacy
  docTitle.value = item.title
  docText.value = item.text
  docVisible.value = true
}

const acceptDoc = () => {
  agreed.value = true
  docVisible.value = false
}

const closeDoc = () => {
  docVisible.value = false
}

const phone = ref('')
const code = ref('')
const busy = ref(false)
const status = ref('')
const countdown = ref(0)
const mockCode = ref('')
const miniappIdentity = ref(false)
const maskedPhone = ref('')
const githubBusy = ref(false)
const githubStep = ref('idle')
const userCode = ref('')
const verifyUrl = ref('')
const githubTimer = ref(null)
let timer = null

onMounted(() => {
  miniappIdentity.value = hasMiniappIdentity()
  if (!miniappIdentity.value) return
  miniappPhoneMask()
    .then((res) => {
      maskedPhone.value = res.maskPhoneNumber || res.phoneNumber || res.mask || ''
    })
    .catch(() => {})
})

const finish = (session) => {
  saveSession(session)
  uni.reLaunch({ url: '/pages/home/index' })
}

const onWechatLogin = async () => {
  if (busy.value) return
  if (!requireAgree()) return
  busy.value = true
  status.value = '正在登录…'
  try {
    finish(await wechatLogin())
  } catch (err) {
    status.value = err.message || '微信登录失败'
  } finally {
    busy.value = false
  }
}

const onGetPhone = async (e) => {
  if (busy.value) return
  if (!requireAgree()) return
  const phoneCode = e && e.detail && e.detail.code
  if (!phoneCode) {
    status.value = '需要授权手机号才能快捷登录'
    return
  }
  busy.value = true
  status.value = '正在获取手机号…'
  try {
    finish(await wechatLogin(phoneCode))
  } catch (err) {
    status.value = err.message || '手机号登录失败'
  } finally {
    busy.value = false
  }
}

const startCountdown = () => {
  countdown.value = 60
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) clearInterval(timer)
  }, 1000)
}

/** 多端应用：微信代发短信，回调里只看 errCode。 */
const onSendMiniappSms = (e) => {
  const detail = (e && e.detail) || {}
  if (detail.errCode === 0 || detail.errCode === undefined) {
    startCountdown()
    status.value = '验证码已发送'
    return
  }
  status.value = detail.errMsg || '发送验证码失败'
}

const onMiniappPhoneLogin = async () => {
  if (busy.value) return
  if (!requireAgree()) return
  const phoneValue = String(phone.value || '').trim()
  const codeValue = String(code.value || '').trim()
  if (!/^1[3-9]\d{9}$/.test(phoneValue)) {
    status.value = '请输入正确的手机号'
    return
  }
  if (!/^\d{6}$/.test(codeValue)) {
    status.value = '请输入 6 位验证码'
    return
  }
  busy.value = true
  status.value = '正在登录…'
  try {
    finish(await miniappSmsLogin(phoneValue, codeValue))
  } catch (err) {
    status.value = err.message || '登录失败'
  } finally {
    busy.value = false
  }
}

const onOneClickLogin = async (e) => {
  if (busy.value) return
  if (!requireAgree()) return
  const detail = (e && e.detail) || {}
  if (detail.errCode && detail.errCode !== 0) {
    status.value = detail.errMsg || '一键登录失败，请改用短信验证码'
    return
  }
  if (!detail.code) {
    status.value = '没有拿到一键登录凭证'
    return
  }
  busy.value = true
  status.value = '正在登录…'
  try {
    finish(await miniappOneClickLogin(detail.code))
  } catch (err) {
    status.value = err.message || '一键登录失败'
  } finally {
    busy.value = false
  }
}

const onSendCode = async () => {
  if (countdown.value > 0 || busy.value) return
  if (!requireAgree()) return
  status.value = ''
  try {
    const res = await sendSms(String(phone.value || '').trim())
    mockCode.value = (res && res.debugCode) || ''
    startCountdown()
    status.value = '验证码已发送'
  } catch (err) {
    status.value = err.message || '发送失败'
  }
}

const onPhoneLogin = async () => {
  if (busy.value) return
  if (!requireAgree()) return
  busy.value = true
  status.value = '正在登录…'
  try {
    finish(await verifySms(String(phone.value || '').trim(), String(code.value || '').trim()))
  } catch (err) {
    status.value = err.message || '登录失败'
  } finally {
    busy.value = false
  }
}

// ---------------- GitHub Device Flow ----------------

const stopGithubTimer = () => {
  if (githubTimer.value) {
    clearTimeout(githubTimer.value)
    githubTimer.value = null
  }
}

const copyText = (value) => {
  if (!value) return
  uni.setClipboardData({
    data: String(value),
    success: () => {},
    fail: () => {}
  })
}

const stopGithub = (message) => {
  stopGithubTimer()
  githubStep.value = 'idle'
  if (message) status.value = message
}

const enterGithub = async (token) => {
  status.value = '正在获取 GitHub 账号…'
  try {
    const user = (await githubUser(token)) || {}
    finish({
      provider: 'github',
      name: user.login || 'GitHub 用户',
      uid: user.login,
      masked: maskId(user.login),
      phone: '',
      token,
      isNew: false
    })
  } catch (err) {
    status.value = err.message || 'GitHub 登录失败'
  }
}

const pollGithub = (deviceCode, expiresIn, interval) => {
  const deadline = Date.now() + expiresIn * 1000
  let wait = Math.max(Number(interval) || 5, 2) + 1

  const tick = async () => {
    if (githubStep.value !== 'polling') return
    if (Date.now() > deadline) {
      stopGithub('授权码已过期，请重试')
      return
    }
    try {
      const res = (await githubPoll(deviceCode)) || {}
      if (res.access_token) {
        stopGithubTimer()
        githubStep.value = 'idle'
        await enterGithub(res.access_token)
        return
      }
      const error = res.error
      if (error === 'slow_down') wait += 5
      else if (error === 'authorization_pending') {
        // 用户还没在 GitHub 页面确认，继续等
      } else if (error === 'expired_token') {
        stopGithub('授权码已过期，请重试')
        return
      } else if (error === 'access_denied') {
        stopGithub('已取消授权')
        return
      } else {
        stopGithub(res.error_description || 'GitHub 授权失败')
        return
      }
      githubTimer.value = setTimeout(tick, wait * 1000)
    } catch (err) {
      stopGithub(err.message || 'GitHub 授权失败')
    }
  }

  githubTimer.value = setTimeout(tick, wait * 1000)
}

const onGithubLogin = async () => {
  if (githubBusy.value || githubStep.value !== 'idle') return
  if (!requireAgree()) return
  githubBusy.value = true
  status.value = '正在获取 GitHub 授权码…'
  try {
    const res = (await githubStart()) || {}
    if (!res.device_code || !res.user_code) {
      throw new Error(res.error_description || 'GitHub 没有返回授权码')
    }
    userCode.value = res.user_code
    verifyUrl.value = res.verification_uri || 'https://github.com/login/device'
    githubStep.value = 'code'
    copyText(userCode.value)
    status.value = '验证码已复制，请在 GitHub 页面输入'
    githubStep.value = 'polling'
    pollGithub(res.device_code, Number(res.expires_in) || 900, Number(res.interval) || 5)
  } catch (err) {
    githubStep.value = 'idle'
    status.value = err.message || '获取 GitHub 授权码失败'
  } finally {
    githubBusy.value = false
  }
}

const onCopyCode = () => {
  copyText(userCode.value)
  status.value = '验证码已复制，请在 GitHub 页面输入'
}

const onOpenGithub = () => {
  copyText(verifyUrl.value || 'https://github.com/login/device')
  status.value = '授权页地址已复制，请在浏览器中打开'
}

const onCancelGithub = () => {
  stopGithubTimer()
  githubStep.value = 'idle'
  userCode.value = ''
  verifyUrl.value = ''
  status.value = ''
}

onUnmounted(() => {
  stopGithubTimer()
})
</script>

<style>
.login {
  min-height: 100vh;
  padding: 96rpx 44rpx 60rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.brand {
  font-size: 44rpx;
  font-weight: 600;
  color: #1f2329;
}

.subtitle {
  margin-top: 14rpx;
  margin-bottom: 56rpx;
  font-size: 26rpx;
  color: #6b7280;
}

.agree-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 36rpx;
}

.agree-label {
  display: flex;
  padding: 4rpx 10rpx 0 0;
}

.agree-row checkbox {
  transform: scale(0.8);
}

.agree-text {
  flex: 1;
  font-size: 24rpx;
  line-height: 1.6;
  color: #6b7280;
}

.agree-link {
  color: #008a7f;
}

.doc-mask {
  position: fixed;
  inset: 0;
  z-index: 90;
  padding: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
}

.doc-card {
  width: 100%;
  box-sizing: border-box;
  padding: 32rpx 28rpx 24rpx;
  border-radius: 16rpx;
  background: #ffffff;
}

.doc-title {
  display: block;
  margin-bottom: 20rpx;
  text-align: center;
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2329;
}

.doc-body {
  max-height: 56vh;
  font-size: 24rpx;
  line-height: 1.8;
  color: #6b7280;
}

.doc-actions {
  display: flex;
  margin-top: 24rpx;
}

.doc-actions button {
  flex: 1;
  margin: 0;
}

.doc-actions button + button {
  margin-left: 16rpx;
}

.field {
  height: 92rpx;
  padding: 0 24rpx;
  margin-bottom: 20rpx;
  border: 1rpx solid #e3e5e8;
  border-radius: 12rpx;
  background: #ffffff;
  font-size: 28rpx;
  color: #1f2329;
  box-sizing: border-box;
}

.ph {
  color: #9aa0a6;
}

.code-row {
  display: flex;
  align-items: center;
}

.code {
  flex: 1;
  min-width: 0;
  margin-right: 16rpx;
}

.code-button {
  width: 220rpx;
  height: 92rpx;
  line-height: 92rpx;
  margin: 0 0 20rpx;
  padding: 0;
  font-size: 26rpx;
  color: #008a7f;
  background: #ffffff;
  border: 1rpx solid #cfe5e2;
  border-radius: 12rpx;
}

.code-button[disabled] {
  color: #9aa0a6;
  border-color: #e3e5e8;
  background: #f5f6f7;
}

.primary,
.secondary {
  height: 92rpx;
  line-height: 92rpx;
  margin: 8rpx 0 20rpx;
  font-size: 30rpx;
  border-radius: 12rpx;
}

.primary {
  color: #ffffff;
  background: #008a7f;
}

.secondary {
  color: #008a7f;
  background: #ffffff;
  border: 1rpx solid #cfe5e2;
}

.primary[disabled],
.secondary[disabled] {
  opacity: 0.6;
}

.hint {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #9aa0a6;
}

.split {
  margin: 28rpx 0 24rpx;
  font-size: 24rpx;
  color: #9aa0a6;
}

.status {
  margin-top: 28rpx;
  font-size: 26rpx;
  color: #b45309;
}

.third {
  margin-top: 8rpx;
  padding-top: 32rpx;
  border-top: 1rpx solid #e3e5e8;
}

.device-code {
  display: block;
  margin: 16rpx 0;
  font-size: 44rpx;
  font-weight: 600;
  letter-spacing: 6rpx;
  color: #008a7f;
  text-align: center;
}

.device-actions {
  display: flex;
  margin-bottom: 16rpx;
}

.device-actions button {
  flex: 1;
  margin: 0;
}

.device-actions button + button {
  margin-left: 16rpx;
}

.mock {
  margin-top: 12rpx;
  font-size: 26rpx;
  color: #008a7f;
}
</style>
