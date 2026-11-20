import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Input } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import classnames from 'classnames';
import {
  configure,
  GIST_FILE,
  giteePoll,
  giteeStart,
  githubGists,
  githubPoll,
  githubRaw,
  githubStart,
  loginByCode,
  pairHa,
  requestCode
} from '@/services/ha';
import { useAppStore } from '@/store/app';
import type { ApiResult, Session } from '@/types/ha';
import { errText, normalizeUrl } from '@/utils/format';
import styles from './index.module.scss';

interface OAuthPanel {
  provider: 'GitHub' | 'Gitee';
  code: string;
  url: string;
  tip: string;
}

interface AccountInfo {
  email?: string;
  name?: string;
  login?: string;
  provider?: string;
}

interface GistItem {
  files?: Record<string, { raw_url?: string }>;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const sessionFromResponse = (res: ApiResult, provider: string): Session => {
  const account = (res.account || {}) as AccountInfo;
  return {
    token: String(res.token || ''),
    email: account.email || '',
    name: account.name || account.login || account.email || 'NovaForge 用户',
    provider: account.provider || provider
  };
};

export default function LoginPage() {
  const router = useRouter();
  const savedHaUrl = useAppStore((s) => s.haUrl);
  const signIn = useAppStore((s) => s.signIn);
  const demoSignIn = useAppStore((s) => s.demoSignIn);
  const [haAddress, setHaAddress] = useState(savedHaUrl);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(router.params.expired ? '登录已失效，请重新登录' : '');
  const [oauth, setOauth] = useState<OAuthPanel | null>(null);
  const oauthRun = useRef(0);

  useEffect(() => {
    if (savedHaUrl) setHaAddress(savedHaUrl);
  }, [savedHaUrl]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => () => {
    oauthRun.current += 1;
  }, []);

  const copyText = (text: string, label: string) => {
    Taro.setClipboardData({
      data: text,
      success: () => Taro.showToast({ title: `${label}已复制`, icon: 'none' }),
      fail: (err) => console.error('[Login] clipboard failed', err)
    });
  };

  const finishLogin = (res: ApiResult, url: string, provider: string) => {
    if (!res.ok || !res.token) throw new Error(res.error || '登录失败');
    signIn(sessionFromResponse(res, provider), url);
    Taro.showToast({ title: '连接成功', icon: 'success' });
    Taro.reLaunch({ url: '/pages/home/index' });
  };

  const prepareHa = (): string | null => {
    const url = normalizeUrl(haAddress);
    if (!url) {
      setError('请先填写 Home Assistant 地址');
      return null;
    }
    setHaAddress(url);
    configure({ haUrl: url, token: '', demo: false });
    return url;
  };

  const discoverAndPair = async (githubToken: string) => {
    setOauth((prev) => prev ? { ...prev, tip: '授权成功，正在查找同账号绑定的 Home Assistant…' } : prev);
    const list = await githubGists(githubToken) as unknown as GistItem[];
    if (!Array.isArray(list)) throw new Error('读取 GitHub Gist 失败');
    const hit = list.find((item) => item.files && item.files[GIST_FILE]);
    const rawUrl = hit?.files?.[GIST_FILE]?.raw_url;
    if (!rawUrl) {
      throw new Error('没有找到已绑定的 HA：请先在 HA 的 NovaForge 插件中绑定同一个 GitHub 账号');
    }

    const rawHub: unknown = await githubRaw(rawUrl, githubToken);
    const hub = (typeof rawHub === 'string' ? JSON.parse(rawHub) : rawHub) as { urls?: string[] };
    const urls = Array.isArray(hub.urls) ? hub.urls.map(normalizeUrl).filter(Boolean) : [];
    if (!urls.length) throw new Error('这台 HA 没有可访问地址，请检查 HA 网络配置');

    setOauth((prev) => prev ? { ...prev, tip: '已找到家庭，正在校验账号并建立连接…' } : prev);
    const res = await pairHa(urls, githubToken);
    finishLogin(res, res.haUrl || '', 'github');
  };

  const pollGithub = async (deviceCode: string, initialInterval: number, run: number) => {
    let interval = Math.max(initialInterval, 5);
    while (run === oauthRun.current) {
      await sleep(interval * 1000);
      if (run !== oauthRun.current) return;
      let res: ApiResult;
      try {
        res = await githubPoll(deviceCode);
      } catch (err) {
        console.error('[Login] GitHub poll network error', err);
        continue;
      }

      if (res.access_token) {
        await discoverAndPair(String(res.access_token));
        return;
      }
      if (res.error === 'authorization_pending') continue;
      if (res.error === 'slow_down') {
        interval += 5;
        continue;
      }
      throw new Error(String(res.error_description || res.error || 'GitHub 授权失败'));
    }
  };

  const startGithub = async () => {
    if (busy) return;
    const run = ++oauthRun.current;
    setBusy('github');
    setError('');
    console.log('[Login] start GitHub device flow');
    try {
      const res = await githubStart();
      if (!res.device_code) throw new Error(String(res.error_description || 'GitHub 未返回设备授权码'));
      const userCode = String(res.user_code || '');
      const verificationUrl = String(res.verification_uri || 'https://github.com/login/device');
      setOauth({
        provider: 'GitHub',
        code: userCode,
        url: verificationUrl,
        tip: '请在浏览器打开授权地址，输入代码并同意授权；此页面会自动完成登录。'
      });
      await pollGithub(String(res.device_code), Number(res.interval) || 5, run);
    } catch (err) {
      console.error('[Login] GitHub login failed', err);
      if (run === oauthRun.current) {
        setOauth(null);
        setError(`GitHub 登录未完成：${errText(err)}。浏览器预览可能受跨域限制，可先体验演示模式。`);
      }
    } finally {
      if (run === oauthRun.current) setBusy('');
    }
  };

  const pollGitee = async (session: string, url: string, run: number) => {
    while (run === oauthRun.current) {
      await sleep(4000);
      if (run !== oauthRun.current) return;
      let res: ApiResult;
      try {
        res = await giteePoll(session);
      } catch (err) {
        console.error('[Login] Gitee poll network error', err);
        continue;
      }
      if (res.ok && res.token) {
        finishLogin(res, url, 'gitee');
        return;
      }
      if (!res.ok) throw new Error(res.error || 'Gitee 授权失败');
    }
  };

  const startGitee = async () => {
    if (busy) return;
    const url = prepareHa();
    if (!url) return;
    const run = ++oauthRun.current;
    setBusy('gitee');
    setError('');
    console.log('[Login] start Gitee flow');
    try {
      const res = await giteeStart();
      if (!res.ok || !res.session) throw new Error(res.error || '无法发起 Gitee 授权');
      setOauth({
        provider: 'Gitee',
        code: 'Gitee',
        url: String(res.authorizeUrl || ''),
        tip: '请在浏览器完成授权，授权后会自动跳回 HA，此页面会持续检查登录结果。'
      });
      await pollGitee(String(res.session), url, run);
    } catch (err) {
      console.error('[Login] Gitee login failed', err);
      if (run === oauthRun.current) {
        setOauth(null);
        setError(errText(err));
      }
    } finally {
      if (run === oauthRun.current) setBusy('');
    }
  };

  const cancelOauth = () => {
    oauthRun.current += 1;
    setOauth(null);
    setBusy('');
  };

  const sendCode = async () => {
    if (busy || countdown > 0) return;
    const url = prepareHa();
    if (!url) return;
    if (email.indexOf('@') < 1) {
      setError('请填写正确的邮箱地址');
      return;
    }
    setBusy('code');
    setError('');
    try {
      const res = await requestCode(email.trim());
      if (!res.ok) throw new Error(res.error || '验证码发送失败');
      setCountdown(30);
      Taro.showToast({ title: '验证码已发送', icon: 'none' });
    } catch (err) {
      console.error('[Login] request code failed', err);
      setError(errText(err));
    } finally {
      setBusy('');
    }
  };

  const emailLogin = async () => {
    if (busy) return;
    const url = prepareHa();
    if (!url) return;
    if (email.indexOf('@') < 1 || code.trim().length !== 6) {
      setError('请填写正确邮箱和 6 位验证码');
      return;
    }
    setBusy('email');
    setError('');
    try {
      const res = await loginByCode(email.trim(), code.trim());
      finishLogin(res, url, 'email');
    } catch (err) {
      console.error('[Login] email login failed', err);
      setError(errText(err));
    } finally {
      setBusy('');
    }
  };

  const enterDemo = () => {
    console.log('[Login] enter demo mode');
    demoSignIn();
    Taro.reLaunch({ url: '/pages/home/index' });
  };

  return (
    <View className={styles.loginPage}>
      <View className={styles.hero}>
        <View className={styles.logo}><Text>✦</Text></View>
        <Text className={styles.brand}>NovaForge</Text>
        <Text className={styles.slogan}>让智能家居，无界连接</Text>
        <View className={styles.features}>
          <Text className={styles.feature}>同账号对接</Text>
          <Text className={styles.feature}>全设备映射</Text>
          <Text className={styles.feature}>AI 自然控制</Text>
        </View>
      </View>

      <View className={styles.content}>
        <View className={styles.loginCard}>
          <Text className={styles.cardTitle}>同账号，自动找到你的家</Text>
          <Text className={styles.cardDesc}>HA 插件与小程序登录同一个 GitHub 账号，即可自动对接，无需填写 HA 地址。</Text>

          <View
            className={classnames(styles.primaryButton, !!busy && styles.buttonDisabled)}
            onClick={startGithub}
          >
            <View className={styles.githubMark}><Text>GH</Text></View>
            <Text>{busy === 'github' ? '正在等待 GitHub 授权…' : '使用 GitHub 自动连接'}</Text>
          </View>
          <View className={styles.demoButton} onClick={enterDemo}>
            <Text>先逛一逛 · 进入演示家庭</Text>
          </View>
          <Text className={styles.privacyTip}>授权仅用于读取账号信息和 NovaForge 对接 Gist，不会保存你的 GitHub 密码。</Text>
        </View>

        {oauth && (
          <View className={styles.oauthCard}>
            <Text className={styles.oauthTitle}>在浏览器中完成 {oauth.provider} 授权</Text>
            <View className={styles.oauthCodeRow}>
              <Text className={styles.oauthCode}>{oauth.code}</Text>
              {oauth.provider === 'GitHub' && (
                <View className={styles.oauthAction} onClick={() => copyText(oauth.code, '授权码')}><Text>复制授权码</Text></View>
              )}
            </View>
            <Text className={styles.oauthLink} onClick={() => copyText(oauth.url, '授权地址')}>{oauth.url}（点击复制）</Text>
            <Text className={styles.oauthTip}>{oauth.tip}</Text>
            <View className={styles.cancelButton} onClick={cancelOauth}><Text>取消等待</Text></View>
          </View>
        )}

        {error && <View className={styles.errorCard}><Text>{error}</Text></View>}

        <View className={styles.advancedToggle} onClick={() => setAdvanced((value) => !value)}>
          <Text>其他连接方式</Text>
          <Text className={classnames(styles.advancedArrow, advanced && styles.advancedArrowOpen)}>›</Text>
        </View>

        {advanced && (
          <View className={styles.advancedCard}>
            <Text className={styles.fieldLabel}>Home Assistant 地址</Text>
            <Input
              className={styles.fieldInput}
              value={haAddress}
              placeholder="例如 http://192.168.1.10:8123"
              placeholderStyle="color:#86909c"
              onInput={(event) => setHaAddress(event.detail.value)}
            />

            <Text className={styles.fieldLabel}>邮箱</Text>
            <Input
              className={styles.fieldInput}
              value={email}
              placeholder="HA 插件中使用的邮箱"
              placeholderStyle="color:#86909c"
              onInput={(event) => setEmail(event.detail.value)}
            />

            <Text className={styles.fieldLabel}>邮箱验证码</Text>
            <View className={styles.codeRow}>
              <Input
                className={classnames(styles.fieldInput, styles.codeInput)}
                value={code}
                type="number"
                maxlength={6}
                placeholder="6 位验证码"
                placeholderStyle="color:#86909c"
                onInput={(event) => setCode(event.detail.value)}
              />
              <View className={styles.codeButton} onClick={sendCode}>
                <Text>{countdown > 0 ? `${countdown}s` : busy === 'code' ? '发送中…' : '获取验证码'}</Text>
              </View>
            </View>
            <View className={styles.advancedButton} onClick={emailLogin}>
              <Text>{busy === 'email' ? '正在登录…' : '邮箱验证码登录'}</Text>
            </View>

            <View className={styles.divider}><Text className={styles.dividerText}>或</Text></View>
            <View className={classnames(styles.advancedButton, styles.giteeButton)} onClick={startGitee}>
              <Text>{busy === 'gitee' ? '等待 Gitee 授权…' : '使用 Gitee 登录'}</Text>
            </View>
          </View>
        )}

        <Text className={styles.footerTip}>真实设备数据由你自托管的 Home Assistant 提供；演示模式无需账号。</Text>
      </View>
    </View>
  );
}
