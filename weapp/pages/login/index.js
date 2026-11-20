const store = require('../../services/store');
const ha = require('../../services/ha');
const account = require('../../services/account');
const fmt = require('../../utils/format');
const theme = require('../../services/theme');
const { AGREEMENTS } = require('../../data/agreement');

const HA_KEY = 'nf-ha-url';

Page({
  data: {
    busy: false,
    status: '',
    haUrl: '',
    step: 'idle',
    showGithub: false,
    deviceCode: '',
    userCode: '',
    verifyUrl: '',
    themeClass: '',
    homes: [],
    // 失败可见重试：errorCode 非空时展示「重试」入口
    errorCode: '',
    retryText: '',
    // 云开发未就绪的显式引导
    cloudHint: '',
    // 隐私协议被拒时引导重新同意
    needPrivacy: false,
    // 微信用户档案（脱敏）
    profile: null,
    // 登录前必须勾选同意隐私政策与用户协议
    agreed: false,
    docVisible: false,
    docTitle: '',
    docText: ''
  },

  onAgreeChange(e) {
    this.setData({ agreed: !!((e.detail.value || []).length) });
  },

  requireAgree() {
    if (this.data.agreed) return true;
    this.setData({ status: '请先勾选并同意《隐私政策》和《用户协议》' });
    return false;
  },

  onOpenDoc(e) {
    const doc = (e.currentTarget.dataset && e.currentTarget.dataset.doc) || 'privacy';
    const item = AGREEMENTS[doc] || AGREEMENTS.privacy;
    this.setData({ docVisible: true, docTitle: item.title, docText: item.text });
  },

  onAcceptDoc() {
    this.setData({ docVisible: false, agreed: true });
  },

  onCloseDoc() {
    this.setData({ docVisible: false });
  },

  onLoad(options) {
    this.disposed = false;
    this.themeUnsubscribe = theme.subscribe((dark) => {
      this.setData({ themeClass: dark ? 'theme-dark' : '' });
    });

    let saved = '';
    try {
      saved = wx.getStorageSync(HA_KEY) || '';
    } catch (err) {
      saved = '';
    }
    if (/^demo:\/\//.test(saved)) saved = '';

    // 只预填用户自己保存过的地址：不再按环境注入默认值，
    // 否则 haUrl 恒为非空，云端通讯录自动找家（B 分支）永远走不到。
    // 开发联调请直接在下方输入框手动填写地址。
    if (saved && !/^https?:\/\//i.test(saved)) saved = '';

    const last = account.getLastIdentity();
    this.setData({
      haUrl: saved,
      homes: account.readCache(),
      profile: (last && last.profile) || null,
      status: options && options.expired ? '登录状态已失效，请重新登录' : ''
    });

    // 有会话先静默进首页；过期但本地还有微信身份时，先静默续期再进
    this.trySilentEnter();

    // 云端通讯录异步刷新，不阻塞首屏
    account
      .resolveHomes()
      .then((list) => {
        if (!this.disposed && Array.isArray(list)) this.setData({ homes: list });
      })
      .catch(() => undefined);
  },

  onUnload() {
    this.disposed = true;
    if (this.themeUnsubscribe) this.themeUnsubscribe();
    this.clearTimers();
  },

  clearTimers() {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
  },

  /**
   * 静默进首页：
   *   1. 会话有效 → 直接进
   *   2. 会话过期但本地还有微信身份 → 静默续期，成功则进
   *   3. 其它情况留在登录页，不做任何弹窗
   */
  async trySilentEnter() {
    if (this.entered) return;
    try {
      store.init();
    } catch (err) {
      console.error('[Login] store init failed', err);
    }
    const session = store.state.session;
    if (session && session.pending) return; // pending 需要用户挑家庭，留在登录页

    const expiresAt = Number(session && session.expiresAt) || 0;
    const fresh = expiresAt ? expiresAt - Date.now() > 60000 : true;

    if (store.isConnected() && fresh) {
      this.entered = true;
      wx.switchTab({ url: '/pages/home/index' });
      return;
    }

    if (store.isConnected() && account.getLastIdentity()) {
      this.setData({ status: '正在同步登录状态…' });
      const renewed = await store.renewSession();
      if (this.disposed) return;
      if (renewed) {
        this.entered = true;
        this.setData({ status: '' });
        wx.switchTab({ url: '/pages/home/index' });
        return;
      }
      this.setData({ status: '登录状态已失效，请重新登录', errorCode: 'SESSION_EXPIRED', retryText: '重试登录' });
    }
  },

  onHaUrlInput(e) {
    this.setData({ haUrl: (e.detail && e.detail.value) || '', status: '', errorCode: '' });
  },

  /** 点按已记住的家庭：填回输入框并直接走登录 */
  onHomeTap(e) {
    const url = e.currentTarget.dataset.url;
    if (!url || this.data.busy) return;
    this.setData({ haUrl: url });
    this.onWxTap();
  },

  /** 隐私协议确认：基础库不支持时直接放行（老版本无此要求） */
  requestPrivacy() {
    return new Promise((resolve) => {
      if (!wx.requirePrivacyAuthorize) {
        resolve(true);
        return;
      }
      wx.requirePrivacyAuthorize({
        success: () => resolve(true),
        fail: (err) => {
          const msg = (err && err.errMsg) || '';
          // 用户点了「拒绝」，其余情况（未配置隐私协议等）视为可继续
          if (/privacy permission is not authorized|deny|cancel/i.test(msg)) resolve(false);
          else resolve(true);
        }
      });
    });
  },

  onOpenPrivacy() {
    if (wx.openPrivacyContract) {
      wx.openPrivacyContract({ fail: () => undefined });
      return;
    }
    this.setData({ status: '请在微信「设置 - 隐私」中查看并同意隐私保护指引' });
  },

  describeError(err) {
    const code = (err && err.code) || '';
    const message = (err && err.message) || '';
    // 云函数 login 没部署（-505005）：必须指向「上传部署云函数」，而不是泛泛的云开发未配置
    if (code === 'FUNCTION_NOT_FOUND') {
      return {
        text: '云函数 login 还没部署，先在下面填写 Home Assistant 地址即可登录',
        cloudHint:
          '云函数 login 不存在（-505005）：在开发者工具左侧 cloudfunctions/login 上右键 →「上传并部署：云端安装依赖」，部署完成后再点微信登录即可自动找家。'
      };
    }
    // 云开发环境没开通 / 环境 ID 不存在（-501000）
    if (code === 'ENV_NOT_FOUND') {
      return {
        text: '云开发环境还没开通，先在下面填写 Home Assistant 地址即可登录',
        cloudHint:
          '云开发环境不可用（-501000）：在开发者工具「云开发」面板开通环境（或用已存在的环境 ID 覆盖 app.js 中的 env），再部署 login 云函数。'
      };
    }
    if (code === 'CLOUD_UNAVAILABLE') {
      return {
        text: message || '微信云开发还没就绪，先在下面填写 Home Assistant 地址即可登录',
        cloudHint: '云端通讯录暂不可用：客户端会自动改用 wx.login 直连家庭，功能不受影响。'
      };
    }
    if (code === 'HA_UNREACHABLE' || code === 'NO_HOME' || code === 'HA_ALL_FAILED') {
      return { text: message || '连不上这个家庭地址，请检查地址与网络（也可清空地址让云端自动找家）' };
    }
    if (code === 'RATE_LIMITED') return { text: '操作太频繁了，请等一分钟后再试' };
    if (code === 'NO_IDENTITY') return { text: '没有拿到微信身份，请退出小程序重新进入' };
    if (code === 'TIMEOUT' || code === 'NETWORK') return { text: message || '网络不稳定，请重试' };
    return { text: message || '微信登录失败，请重试' };
  },

  /** 合并「手填地址」与「云端通讯录」两条路径的失败原因，便于一次性定位 */
  mergeFailure(manualErr, cloudErr, tail) {
    const parts = [];
    if (manualErr) {
      const info = this.describeError(manualErr);
      const detail = info.text || fmt.errText(manualErr);
      parts.push('手填地址连接失败（' + detail + '）');
    }
    if (cloudErr) {
      const info = this.describeError(cloudErr);
      parts.push('云端自动找家失败（' + (info.text || fmt.errText(cloudErr)) + '）');
    }
    if (tail) parts.push(tail);
    if (!parts.length) parts.push('微信登录失败，请重试');
    return parts.join('；');
  },

  signInWithWechat(res, base, haName, identity) {
    store.signIn(
      {
        token: res.token,
        expiresAt: res.expiresAt || 0,
        email: '',
        name: '微信用户',
        avatar: '',
        provider: 'wechat',
        openidMasked: res.openidMasked || (identity && identity.masked) || '',
        haName: haName || ''
      },
      base
    );
  },

  /** 登录成功后回写通讯录（touch 传 true 时提升该家庭优先级） */
  rememberHome(url, haName, touch) {
    if (!url) return;
    if (touch) account.touchHome(url, true, haName);
    account
      .bindHome(url, { haName })
      .then((r) => {
        if (r && r.homes && !this.disposed) this.setData({ homes: r.homes });
      })
      .catch(() => undefined);
  },

  /** 没有家庭可连时先登录进 pending，地址后补；不清空用户已填的地址 */
  enterWechatPending(identity, message) {
    const keep = /^https?:\/\//i.test(store.state.haUrl || '') ? store.state.haUrl : '';
    store.signIn(
      {
        pending: true,
        token: '',
        expiresAt: 0,
        email: '',
        name: '微信用户',
        avatar: '',
        provider: 'wechat',
        openidMasked: (identity && identity.masked) || ''
      },
      keep
    );
    this.setData({ busy: false, status: '', errorCode: '' });
    if (message) wx.showToast({ title: message, icon: 'none', duration: 2600 });
    wx.switchTab({ url: '/pages/home/index' });
  },

  onRetry() {
    if (this.data.busy) return;
    if (this.data.needPrivacy) {
      this.onWxTap();
      return;
    }
    this.onWxTap();
  },

  async onWxTap() {
    if (this.data.busy) return;
    if (!this.requireAgree()) return;

    // 1) 隐私协议：拒绝则给出可见的重试入口
    const agreed = await this.requestPrivacy();
    if (!agreed) {
      this.setData({
        busy: false,
        needPrivacy: true,
        errorCode: 'PRIVACY_DENIED',
        retryText: '同意后重试',
        status: '登录需要先同意隐私保护指引'
      });
      return;
    }

    const manual = fmt.normalizeUrl(this.data.haUrl);
    this.setData({
      busy: true,
      needPrivacy: false,
      errorCode: '',
      haUrl: manual,
      status: '正在获取微信身份…'
    });
    wx.showLoading({ title: '正在登录', mask: true });

    let identity = null;
    let identityError = null;
    let cloudHint = '';
    try {
      identity = await account.login();
      this.setData({
        profile: identity.profile || this.data.profile
      });
    } catch (err) {
      identityError = err;
      const info = this.describeError(err);
      cloudHint = info.cloudHint || this.data.cloudHint;
    }
    if (this.disposed) {
      wx.hideLoading();
      return;
    }

    // 手填地址失败原因：非空表示 A 分支没连上，后续失败要合并展示
    let manualError = null;

    // ---- A. 填了地址：按指定地址连接（云开发不可用时用 code 兜底）----
    if (manual) {
      try {
        this.setData({ status: '正在检查地址…', cloudHint });
        const ping = await ha.pingHa(manual);
        this.setData({ status: '正在连接家庭…' });
        const res =
          identity && identity.signed
            ? await ha.openidLogin(manual, identity)
            : await ha.wxCodeLogin(manual, await ha.wxLoginCode());
        const haName = (ping && ping.name) || (res && res.ha) || '';
        this.signInWithWechat(res, manual, haName, identity);
        wx.hideLoading();
        this.rememberHome(manual, haName);
        this.setData({ busy: false, status: '', errorCode: '', retryText: '' });
        wx.switchTab({ url: '/pages/home/index' });
        return;
      } catch (err) {
        // 关键修复：手填地址失败不再直接中断。已拿到微信身份就回落到云端通讯录自动找家
        manualError = err;
        this.setData({ cloudHint: this.describeError(err).cloudHint || cloudHint });
        console.warn('[Login] manual address failed', fmt.errText(err));
        if (this.disposed) {
          wx.hideLoading();
          return;
        }
      }
    }

    // ---- B. 云端通讯录自动找家（A 失败或无手填地址时）----
    if (!identity) {
      // 连微信身份都没拿到：无法自动找家，合并展示失败原因并保留重试
      wx.hideLoading();
      const info = this.describeError(identityError || manualError);
      this.setData({
        busy: false,
        status: this.mergeFailure(manualError, identityError),
        errorCode: (identityError && identityError.code) || (manualError && manualError.code) || 'IDENTITY_FAILED',
        retryText: '重试',
        cloudHint: info.cloudHint || cloudHint
      });
      return;
    }

    let homes = (identity.homes || []).filter((item) => item && item.haUrl);
    if (!homes.length) {
      this.setData({ status: '正在查找已关联的家庭…', cloudHint });
      homes = await account.resolveHomes();
      if (this.disposed) {
        wx.hideLoading();
        return;
      }
    }

    if (homes.length) {
      this.setData({
        status: '正在连接「' + (homes[0].haName || homes[0].haUrl) + '」…',
        homes
      });
      try {
        const paired = await ha.pairHomes(
          homes.map((item) => item.haUrl),
          identity
        );
        this.signInWithWechat(paired.res, paired.haUrl, paired.haName, identity);
        wx.hideLoading();
        this.rememberHome(paired.haUrl, paired.haName, true);
        this.setData({ busy: false, status: '', errorCode: '', retryText: '' });
        wx.switchTab({ url: '/pages/home/index' });
        return;
      } catch (err) {
        homes.forEach((item) => account.touchHome(item.haUrl, false));
        wx.hideLoading();
        console.error('[Login] pair homes failed', err);
        if (manualError) {
          // 手填地址与云端找家都失败：合并原因 + 重试入口
          const info = this.describeError(err);
          this.setData({
            busy: false,
            status: this.mergeFailure(manualError, err),
            errorCode: (err && err.code) || 'LOGIN_FAILED',
            retryText: '重试',
            cloudHint: info.cloudHint || cloudHint
          });
          return;
        }
        this.enterWechatPending(identity, '微信已登录，家庭暂时连不上');
        return;
      }
    }

    // ---- C. 没有关联家庭：先登录进 pending，再引导绑定 ----
    wx.hideLoading();
    if (manualError) {
      // 手填地址连不上、云端也没有可用家庭：两条路径都失败，合并提示并允许重试
      this.setData({
        busy: false,
        status: this.mergeFailure(manualError, null, '云端通讯录里也没有已关联的家庭'),
        errorCode: (manualError && manualError.code) || 'LOGIN_FAILED',
        retryText: '重试',
        cloudHint: this.describeError(manualError).cloudHint || cloudHint
      });
      return;
    }
    this.enterWechatPending(identity, '微信已登录，去「我的」连接家庭');
  },

  onToggleGithub() {
    this.setData({ showGithub: !this.data.showGithub });
  },

  async onGithubTap() {
    if (this.data.busy) return;
    if (!this.requireAgree()) return;
    this.clearTimers();
    this.disposed = false;
    this.setData({ busy: true, status: '正在获取 GitHub 授权码…', step: 'github', errorCode: '' });
    try {
      const res = await ha.githubStart();
      if (!res || !res.device_code || !res.user_code) {
        throw new Error((res && res.error_description) || 'GitHub 没有返回授权码');
      }
      this.setData({
        busy: false,
        deviceCode: res.device_code,
        userCode: res.user_code,
        verifyUrl: res.verification_uri || 'https://github.com/login/device',
        status: '复制下方验证码，在 GitHub 页面完成授权'
      });
      this.pollGithub(res.device_code, Number(res.expires_in) || 900, Number(res.interval) || 5);
    } catch (err) {
      this.setData({
        busy: false,
        step: 'idle',
        status: '获取授权码失败：' + fmt.errText(err),
        errorCode: 'GITHUB_START_FAILED',
        retryText: '重试'
      });
    }
  },

  pollGithub(deviceCode, expiresIn, interval) {
    const deadline = Date.now() + expiresIn * 1000;
    let wait = Math.max(interval, 2) + 1;

    const tick = async () => {
      if (this.disposed) return;
      if (Date.now() > deadline) {
        this.setData({
          status: '授权码已过期，请重新获取',
          step: 'idle',
          errorCode: 'GITHUB_EXPIRED',
          retryText: '重新获取'
        });
        return;
      }
      try {
        const res = await ha.githubPoll(deviceCode);
        if (res && res.access_token) {
          this.discover(res.access_token);
          return;
        }
        const error = res && res.error;
        if (error === 'slow_down') wait += 5;
        else if (error !== 'authorization_pending') {
          throw new Error((res && res.error_description) || error || 'GitHub 授权失败');
        }
        this.pollTimer = setTimeout(tick, wait * 1000);
      } catch (err) {
        this.setData({
          busy: false,
          step: 'idle',
          status: 'GitHub 授权失败：' + fmt.errText(err),
          errorCode: 'GITHUB_FAILED',
          retryText: '重试'
        });
      }
    };

    this.pollTimer = setTimeout(tick, wait * 1000);
  },

  async discover(token) {
    this.setData({ busy: true, status: '正在查找你已绑定的家庭…' });
    try {
      const gists = await ha.githubGists(token);
      const list = Array.isArray(gists) ? gists : [];
      const files = [];
      list.forEach((gist) => {
        if (gist && gist.files && gist.files[ha.GIST_FILE]) files.push(gist.files[ha.GIST_FILE]);
      });
      if (!files.length) {
        this.enterPending(token);
        return;
      }

      const urls = [];
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        let content = file.content;
        if (!content && file.raw_url) content = await ha.githubRaw(file.raw_url, token);
        if (typeof content === 'string') {
          try {
            content = JSON.parse(content);
          } catch (err) {
            content = null;
          }
        }
        if (content && content.app === 'novaforge' && Array.isArray(content.urls)) {
          content.urls.forEach((url) => {
            const clean = fmt.normalizeUrl(url);
            if (clean && urls.indexOf(clean) < 0) urls.push(clean);
          });
        }
      }
      if (!urls.length) {
        this.enterPending(token);
        return;
      }

      this.setData({ status: '已找到家庭，正在连接…' });
      const res = await ha.pairHa(urls, token);
      const info = (res && res.account) || {};
      store.signIn(
        {
          token: res.token,
          expiresAt: res.expiresAt || 0,
          email: info.email || info.login || '',
          name: info.name || info.login || 'GitHub 用户',
          provider: 'github'
        },
        res.haUrl
      );
      this.setData({ step: 'idle', busy: false, status: '登录成功，正在进入家庭', errorCode: '' });
      wx.switchTab({ url: '/pages/home/index' });
    } catch (err) {
      this.setData({
        busy: false,
        step: 'idle',
        status: err.message || fmt.errText(err),
        errorCode: (err && err.code) || 'GITHUB_DISCOVER_FAILED',
        retryText: '重试'
      });
    }
  },

  enterPending(providerToken) {
    const session = {
      pending: true,
      token: '',
      expiresAt: 0,
      email: '',
      name: 'GitHub 用户',
      avatar: '',
      provider: 'github'
    };
    if (providerToken) session.providerToken = providerToken;
    store.signIn(session, '');
    this.setData({ step: 'idle', busy: false, status: '', errorCode: '' });
    wx.switchTab({ url: '/pages/home/index' });
  },

  onCopyCode() {
    if (!this.data.userCode) return;
    wx.setClipboardData({ data: this.data.userCode });
  },

  onOpenVerify() {
    if (!this.data.verifyUrl) return;
    wx.setClipboardData({
      data: this.data.verifyUrl,
      success: () => wx.showToast({ title: '链接已复制，可在浏览器打开', icon: 'none' })
    });
  },

  onCancelGithub() {
    this.disposed = true;
    this.clearTimers();
    this.setData({ step: 'idle', busy: false, status: '', errorCode: '' });
  },

  onDemoTap() {
    store.demoSignIn();
    wx.switchTab({ url: '/pages/home/index' });
  }
});
