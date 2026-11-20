/* NovaForge 软件版 · 登录 v3
 * 版式：品牌徽标 → 邮箱验证码（输入框 + 右侧「获取验证码」按钮 + 登录）→ 更多登录方式图标。
 * 关键规则：登录不再要求填 Home Assistant 地址。
 *  - 已有家庭地址（上次连接过）：邮箱/GitHub/Gitee 走家庭校验，成功后直接连上；
 *  - 没有家庭地址：允许直接进入 App（pending 会话），家庭地址留到「我的」里连接。
 */
window.NF = window.NF || {};

(function (NF) {
  'use strict';

  var fmt = NF.fmt;

  // 隐私政策 / 用户协议（登录前必须勾选同意）
  var AGREEMENTS = {
    privacy: {
      title: 'NovaForge 隐私政策',
      text: '更新日期：2026-11-20\n\n1. 我们收集的信息\n- 账号信息：邮箱地址、验证码，以及你授权登录的 GitHub / Gitee 昵称、头像与访问令牌。\n- 家庭与设备信息：你填写的 Home Assistant 地址、设备名称、设备状态与场景配置。\n- 使用信息：登录时间、功能使用记录与崩溃日志，用于改进稳定性。\n\n2. 权限使用\n- 蓝牙：用于发现并连接附近的 ESP32 设备。\n- 位置信息：系统要求扫描蓝牙与局域网设备时需要，仅用于设备发现，不会上传你的精确位置。\n- 通知：用于推送设备告警与场景执行结果。\n- 本地网络 / Wi-Fi：用于与电脑端和家庭服务器通信。\n- AI 服务：仅在你主动使用时，把对话内容发送给你选择的本地模型或云端接口。\n\n3. 信息存储与共享\n- 数据保存在你的设备本地与你自己的家庭服务器中；账号数据仅用于登录与设备同步。\n- 除 GitHub / Gitee 登录授权外，我们不向任何第三方出售或共享你的个人信息。\n\n4. 你的权利\n- 你可以随时退出登录、解绑第三方账号、清除本地缓存；需要删除账号数据可联系我们。\n\n5. 联系我们\n如对本政策有疑问，可通过应用内「我的 → 帮助与反馈」与我们联系。'
    },
    terms: {
      title: 'NovaForge 用户协议',
      text: '更新日期：2026-11-20\n\n1. 服务内容\nNovaForge 提供固件编写与烧录、设备控制、场景自动化、Home Assistant 接入及 AI 辅助编程等服务（具体功能以各端实际提供为准，微信小程序端不提供 AI 功能）。\n\n2. 账号使用\n- 你应使用真实、合法的邮箱或第三方账号登录，并妥善保管验证码与访问令牌。\n- 你不得利用本服务从事违法违规、入侵他人设备或网络的行为。\n\n3. 设备与固件\n- 由你生成或烧录的固件在你自己的硬件上运行，因操作不当导致的设备损坏由你自行承担。\n- 烧录前请确认固件来源可信，并备份重要数据。\n\n4. 知识产权\n本软件的界面、图标、文档与代码的知识产权归 NovaForge 所有；你生成的固件与项目文件归你所有。\n\n5. 免责与变更\n- 本服务按「现状」提供，因网络、第三方平台（GitHub / Gitee / Home Assistant）原因导致的中断我们不承担责任。\n- 我们可能不定期更新本协议，更新后继续使用即视为接受。\n\n6. 联系我们\n如对本协议有疑问，可通过应用内「我的 → 帮助与反馈」与我们联系。'
    }
  };

  function agreed() {
    var el = NF.$('login-agree');
    return !!(el && el.checked);
  }

  function requireAgree() {
    if (agreed()) return true;
    status('请先勾选并同意《隐私政策》和《用户协议》', true);
    return false;
  }

  function showAgreement(doc) {
    var item = AGREEMENTS[doc] || AGREEMENTS.privacy;
    var mask = NF.$('agreement-mask');
    if (!mask) return;
    var title = NF.$('agreement-title');
    var body = NF.$('agreement-body');
    if (title) title.textContent = item.title;
    if (body) {
      body.textContent = item.text;
      body.scrollTop = 0;
    }
    mask.hidden = false;
  }

  function hideAgreement() {
    var mask = NF.$('agreement-mask');
    if (mask) mask.hidden = true;
  }

  var ui = {
    busy: false,
    countdown: 0,
    timer: null,
    haUrl: '',
    oauthUrl: ''
  };

  function status(text, isError) {
    var el = NF.$('login-status');
    if (!el) return;
    if (!text) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.textContent = text;
    el.style.color = isError ? '#f53f3f' : '';
  }

  function setBusy(value) {
    ui.busy = !!value;
    var mailBtn = NF.$('btn-mail-login');
    if (mailBtn) {
      if (value) mailBtn.classList.add('primary-button-busy');
      else mailBtn.classList.remove('primary-button-busy');
    }
    ['btn-github', 'btn-gitee', 'btn-weibo', 'btn-request-code'].forEach(function (id) {
      var el = NF.$(id);
      if (!el) return;
      el.disabled = !!value;
      el.style.opacity = value ? '0.6' : '';
    });
  }

  function setPrimaryLabel(text) {
    var mailBtn = NF.$('btn-mail-login');
    if (mailBtn) mailBtn.textContent = text || '登录';
  }

  function showOauth(title, code, url) {
    var mask = NF.$('oauth-mask');
    if (!mask) return;
    ui.oauthUrl = url || '';
    mask.hidden = false;
    var titleEl = NF.$('oauth-title');
    if (titleEl) titleEl.textContent = title || '授权码';
    var codeEl = NF.$('oauth-code');
    if (codeEl) codeEl.textContent = code || '';
    var openBtn = NF.$('btn-open-verify');
    if (openBtn) openBtn.hidden = !url;
  }

  function hideOauth() {
    ui.oauthUrl = '';
    var mask = NF.$('oauth-mask');
    if (mask) mask.hidden = true;
  }

  function openOauthUrl() {
    var url = ui.oauthUrl || 'https://github.com/login/device';
    NF.openExternal(url);
    status('已在浏览器打开授权页，若没有反应可点「复制验证码」到浏览器手动输入');
  }

  function finishLogin(session, haUrl, message) {
    hideOauth();
    NF.store.signIn(session, haUrl || '');
    NF.toast(message || '登录成功');
    NF.app.relaunch('home');
  }

  // 已连接过的家庭地址（登录页不再提供输入框）
  function currentHaUrl() {
    if (ui.haUrl) return fmt.normalizeUrl(ui.haUrl);
    var saved = NF.store.state.haUrl || NF.storage.get(NF.store.HA_KEY, '') || '';
    if (saved && saved.indexOf('demo://') !== 0) return fmt.normalizeUrl(saved);
    return '';
  }

  function readEmail() {
    var el = NF.$('login-email');
    return (el && el.value ? el.value : '').trim();
  }

  // ---------------- 邮箱验证码（主登录位） ----------------

  function startCountdown() {
    ui.countdown = 60;
    var btn = NF.$('btn-request-code');
    if (!btn) return;
    btn.classList.add('code-btn-busy');
    btn.textContent = ui.countdown + ' 秒后重发';
    clearInterval(ui.timer);
    ui.timer = setInterval(function () {
      ui.countdown -= 1;
      var btnEl = NF.$('btn-request-code');
      if (!btnEl) return;
      if (ui.countdown <= 0) {
        clearInterval(ui.timer);
        btnEl.classList.remove('code-btn-busy');
        btnEl.textContent = '获取验证码';
        ui.countdown = 0;
        return;
      }
      btnEl.textContent = ui.countdown + ' 秒后重发';
    }, 1000);
  }

  async function requestCode() {
    if (ui.countdown > 0 || ui.busy) return;
    if (!requireAgree()) return;
    var base = currentHaUrl();
    if (!base) {
      status('还没连接家庭：可现在直接登录进入，验证码登录将在「我的」连接家庭后可用');
      return;
    }
    var email = readEmail();
    if (!email) {
      status('请先填写邮箱地址', true);
      var mailEl = NF.$('login-email');
      if (mailEl && mailEl.focus) mailEl.focus();
      return;
    }
    try {
      await NF.account.sendEmailCode(base, email);
      status('验证码已发送，请查收邮件（10 分钟内有效）');
      startCountdown();
    } catch (err) {
      status((err && err.message) || '验证码发送失败', true);
    }
  }

  async function mailLogin() {
    if (ui.busy) return;
    if (!requireAgree()) return;
    var email = readEmail();
    var codeEl = NF.$('login-code');
    var code = (codeEl && codeEl.value ? codeEl.value : '').trim();
    var base = currentHaUrl();

    if (!email) {
      status('请先填写邮箱地址', true);
      var mailEl = NF.$('login-email');
      if (mailEl && mailEl.focus) mailEl.focus();
      return;
    }

    // 未连接家庭：不阻断，直接以「待连接」身份进入 App
    if (!base) {
      finishLogin({
        provider: 'email',
        providerToken: '',
        name: email,
        email: email,
        pending: true,
        token: ''
      }, '', '已进入（未连接家庭），可在「我的」连接家庭');
      return;
    }

    if (!code) {
      status('请填写邮箱收到的验证码', true);
      if (codeEl && codeEl.focus) codeEl.focus();
      return;
    }

    setBusy(true);
    setPrimaryLabel('正在验证…');
    status('');
    try {
      var res = await NF.account.loginByEmail(base, email, code);
      var session = {
        provider: 'email',
        providerToken: res.providerToken || '',
        name: (res.account && (res.account.name || res.account.email)) || email,
        email: email,
        pending: false,
        token: res.token
      };
      finishLogin(session, base, '登录成功');
    } catch (err) {
      status((err && err.message) || '登录失败', true);
    } finally {
      setBusy(false);
      setPrimaryLabel('登录');
    }
  }

  // ---------------- GitHub（第三方图标） ----------------

  async function githubLogin() {
    if (ui.busy) return;
    if (!requireAgree()) return;
    setBusy(true);
    status('正在获取 GitHub 授权码…');

    try {
      var profile = await NF.account.loginGithub({
        onCode: function (info) {
          showOauth('GitHub 授权码', info.userCode, info.url);
          status('已生成授权码，请在浏览器完成授权');
          try { NF.openExternal(info.url); } catch (err) { console.warn('[Login] open url failed', err); }
        }
      });

      status('GitHub 授权成功，正在寻找你的家庭…');

      var baseSession = {
        provider: 'github',
        providerToken: profile.token,
        name: profile.name,
        login: profile.login,
        email: profile.email,
        avatar: profile.avatar,
        pending: true,
        token: ''
      };

      var urls = [];
      try {
        urls = await NF.ha.discoverHa(profile.token);
      } catch (err) {
        console.warn('[Login] discover ha failed', err);
        finishLogin(baseSession, '', '已登录，稍后可在「我的」里填一次家庭地址');
        return;
      }

      status('找到家庭记录，正在连接…');
      try {
        var paired = await NF.ha.pairHa(urls, profile.token, 'github');
        var session = Object.assign({}, baseSession, {
          pending: false,
          token: paired.token,
          haUrl: paired.haUrl
        });
        finishLogin(session, paired.haUrl, '登录成功，家庭已连接');
      } catch (err) {
        console.warn('[Login] pair failed', err);
        baseSession.pending = true;
        baseSession.knownUrls = urls;
        finishLogin(baseSession, '', '已登录，家庭暂时连不上，可在「我的」重试');
      }
    } catch (err) {
      console.error('[Login] github failed', err);
      hideOauth();
      status((err && err.message) || 'GitHub 登录失败', true);
    } finally {
      if (!NF.store.state.session) setBusy(false);
    }
  }

  // ---------------- Gitee（第三方图标） ----------------

  async function giteeLogin() {
    if (ui.busy) return;
    if (!requireAgree()) return;
    var base = currentHaUrl();
    if (!base) {
      status('Gitee 授权需要家庭服务配合，请先在「我的」连接家庭后再试', true);
      return;
    }

    setBusy(true);
    status('正在获取 Gitee 授权…');
    try {
      var start = await NF.account.startGitee(base);
      var url = start.authorizeUrl || start.url || '';
      if (url) {
        showOauth('Gitee 授权', '已打开浏览器', url);
        NF.openExternal(url);
      }
      var res = await NF.account.pollGitee(base, start.session);
      var session = {
        provider: 'gitee',
        providerToken: res.providerToken || res.giteeToken || '',
        name: (res.account && (res.account.name || res.account.login)) || 'Gitee 用户',
        login: (res.account && res.account.login) || '',
        email: (res.account && res.account.email) || '',
        pending: false,
        token: res.token
      };
      finishLogin(session, base, '登录成功，家庭已连接');
    } catch (err) {
      console.error('[Login] gitee failed', err);
      hideOauth();
      status((err && err.message) || 'Gitee 登录失败', true);
    } finally {
      setBusy(false);
    }
  }

  // ---------------- 微博（待接入） ----------------

  function weiboSoon() {
    status('微博登录还在接入开发者平台，开放后会出现在这里');
  }

  // ---------------- 绑定 ----------------

  function bind() {
    // 协议链接：在 label 内点击只打开协议，不触发勾选
    Array.prototype.forEach.call(document.querySelectorAll('.agree-link'), function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        showAgreement(el.getAttribute('data-doc'));
      });
    });
    var acceptBtn = NF.$('btn-agree-accept');
    if (acceptBtn) acceptBtn.addEventListener('click', function () {
      var box = NF.$('login-agree');
      if (box) box.checked = true;
      hideAgreement();
    });
    var closeBtn = NF.$('btn-agree-close');
    if (closeBtn) closeBtn.addEventListener('click', hideAgreement);
    var agreeMask = NF.$('agreement-mask');
    if (agreeMask) agreeMask.addEventListener('click', function (e) {
      if (e && e.target === agreeMask) hideAgreement();
    });

    var mailBtn = NF.$('btn-mail-login');
    if (mailBtn) mailBtn.addEventListener('click', mailLogin);

    var requestBtn = NF.$('btn-request-code');
    if (requestBtn) requestBtn.addEventListener('click', requestCode);

    var github = NF.$('btn-github');
    if (github) github.addEventListener('click', githubLogin);

    var gitee = NF.$('btn-gitee');
    if (gitee) gitee.addEventListener('click', giteeLogin);

    var weibo = NF.$('btn-weibo');
    if (weibo) weibo.addEventListener('click', weiboSoon);

    var demo = NF.$('btn-demo');
    if (demo) {
      demo.addEventListener('click', function () {
        NF.store.demoSignIn();
        NF.toast('已进入演示家庭');
        NF.app.relaunch('home');
      });
    }

    var codeInput = NF.$('login-code');
    if (codeInput) {
      codeInput.addEventListener('keydown', function (e) {
        if (e && e.key === 'Enter') mailLogin();
      });
    }

    var copyBtn = NF.$('btn-copy-code');
    if (copyBtn) copyBtn.addEventListener('click', function () {
      var code = NF.$('oauth-code');
      if (!code || !code.textContent) return;
      NF.copy(code.textContent).then(function () { NF.toast('授权码已复制'); });
    });

    var openBtn = NF.$('btn-open-verify');
    if (openBtn) openBtn.addEventListener('click', openOauthUrl);

    var cancelBtn = NF.$('btn-cancel-oauth');
    if (cancelBtn) cancelBtn.addEventListener('click', function () {
      NF.account.cancelGithub();
      hideOauth();
      setBusy(false);
      status('已取消授权');
    });

    var mask = NF.$('oauth-mask');
    if (mask) mask.addEventListener('click', function (e) {
      if (e && e.target === mask) {
        NF.account.cancelGithub();
        hideOauth();
        setBusy(false);
      }
    });
  }

  NF.pages = NF.pages || {};
  NF.pages.login = {
    bind: bind,
    onShow: function () {
      status('');
      var saved = NF.store.state.haUrl || NF.storage.get(NF.store.HA_KEY, '') || '';
      ui.haUrl = (saved && saved.indexOf('demo://') !== 0) ? saved : '';
      var pwd = NF.$('login-code');
      if (pwd && pwd.value) pwd.value = '';
    }
  };
}(window.NF));
