/* NovaForge 软件版 · 账号
 * 小程序版靠微信云开发直接拿 openid；软件版没有微信身份，
 * 因此改为三种独立账号：GitHub Device Flow（可自动发现家庭）、Gitee OAuth、邮箱验证码。
 *
 * 约定：账号层只负责「拿到一个可交给 HA 校验的身份」，
 * 不保存任何 AppSecret；换设备令牌由 ha.tokenLogin 完成。
 */
window.NF = window.NF || {};

(function (NF) {
  'use strict';

  var githubCancelled = false;
  var githubDeviceCode = '';

  function mask(value) {
    var s = String(value || '');
    if (!s) return '';
    if (s.length <= 8) return s.slice(0, 2) + '****';
    return s.slice(0, 4) + '****' + s.slice(-4);
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function cancelGithub() {
    githubCancelled = true;
  }

  /** GitHub 是否已经处于授权等待中（用于 UI 判断能否取消） */
  function githubPending() {
    return !!githubDeviceCode && !githubCancelled;
  }

  /**
   * GitHub Device Flow 登录。
   * opts.onCode({ userCode, url, expiresIn })：把授权码与链接交给 UI
   * 返回 { token, name, email, avatar, login }
   */
  async function loginGithub(opts) {
    var options = opts || {};
    githubCancelled = false;

    var start = await NF.ha.githubStart();
    if (!start || !start.device_code || !start.user_code) {
      throw new Error('GitHub 没有返回授权码，请稍后重试');
    }

    githubDeviceCode = start.device_code;
    if (options.onCode) {
      options.onCode({
        userCode: start.user_code,
        url: start.verification_uri || 'https://github.com/login/device',
        expiresIn: start.expires_in || 900
      });
    }

    var interval = Math.max(5, Number(start.interval) || 5) * 1000;
    var deadline = Date.now() + (Number(start.expires_in) || 900) * 1000;

    while (Date.now() < deadline) {
      if (githubCancelled) {
        githubDeviceCode = '';
        throw new Error('已取消 GitHub 授权');
      }

      await sleep(interval);

      if (githubCancelled) {
        githubDeviceCode = '';
        throw new Error('已取消 GitHub 授权');
      }

      var res = await NF.ha.githubPoll(start.device_code);

      if (res && res.access_token) {
        githubDeviceCode = '';
        var token = res.access_token;
        var profile = {};
        try {
          profile = await NF.ha.githubUser(token);
        } catch (err) {
          console.error('[Account] read github profile failed', err);
        }
        return {
          token: token,
          login: (profile && profile.login) || '',
          name: (profile && (profile.name || profile.login)) || 'GitHub 用户',
          email: (profile && profile.email) || '',
          avatar: (profile && profile.avatar_url) || ''
        };
      }

      var error = (res && res.error) || '';
      if (error === 'authorization_pending') continue;
      if (error === 'slow_down') {
        interval += 5000;
        continue;
      }
      if (error === 'expired_token') {
        githubDeviceCode = '';
        throw new Error('授权码已过期，请重新获取');
      }
      if (error === 'access_denied') {
        githubDeviceCode = '';
        throw new Error('你取消了 GitHub 授权');
      }
      if (error === 'device_flow_disabled') {
        githubDeviceCode = '';
        throw new Error('这个 GitHub OAuth 应用没有开启 Device Flow');
      }
      if (error) {
        githubDeviceCode = '';
        throw new Error((res && res.error_description) || error);
      }
    }

    githubDeviceCode = '';
    throw new Error('等待授权超时，请重试');
  }

  /** Gitee OAuth：返回授权地址，由 UI 打开浏览器 */
  async function startGitee(base) {
    var res = await NF.ha.giteeStart(base);
    if (!res || !res.ok) throw new Error((res && res.error) || 'Gitee 授权发起失败');
    return res;
  }

  /** 轮询 Gitee 授权结果，返回 { token, account } */
  async function pollGitee(base, session, onTick) {
    var deadline = Date.now() + 5 * 60 * 1000;
    while (Date.now() < deadline) {
      await sleep(3000);
      var res = await NF.ha.giteePoll(base, session);
      if (res && res.ok && res.token) return res;
      if (res && res.error && !/pending|waiting/i.test(res.error)) {
        throw new Error(res.error);
      }
      if (onTick) onTick();
    }
    throw new Error('等待 Gitee 授权超时，请重试');
  }

  /** 邮箱验证码登录：发送 */
  async function sendEmailCode(base, email) {
    var value = String(email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('请填写正确的邮箱地址');
    return NF.ha.requestCode(base, value);
  }

  /** 邮箱验证码登录：验证 */
  async function loginByEmail(base, email, code) {
    var value = String(email || '').trim();
    var pass = String(code || '').trim();
    if (!value) throw new Error('请填写邮箱地址');
    if (!/^\d{4,8}$/.test(pass)) throw new Error('请填写收到的验证码');
    return NF.ha.loginByCode(base, value, pass);
  }

  NF.account = {
    mask: mask,
    cancelGithub: cancelGithub,
    githubPending: githubPending,
    loginGithub: loginGithub,
    startGitee: startGitee,
    pollGitee: pollGitee,
    sendEmailCode: sendEmailCode,
    loginByEmail: loginByEmail
  };
}(window.NF));
