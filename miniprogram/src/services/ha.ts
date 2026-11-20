import Taro from '@tarojs/taro';
import type { ApiResult, Bootstrap } from '@/types/ha';
import { demoBootstrap, demoChat } from '@/data/demo';

/**
 * NovaForge 服务层：与 HA 插件、GitHub Device Flow 通信。
 * 演示模式（demo）下全部走本地 mock，方便 H5 预览体验。
 */

interface BridgeConfig {
  haUrl: string;
  token: string;
  demo: boolean;
}

const config: BridgeConfig = { haUrl: '', token: '', demo: false };

export const configure = (c: Partial<BridgeConfig>): void => {
  Object.assign(config, c);
};

const GH_CLIENT_ID = 'Ov23liGYZuxISGkahFRw'; // 与 HA 插件一致的公共 OAuth Client ID（非密钥）
const GH_SCOPE = 'read:user gist';
export const GIST_FILE = 'novaforge-hub.json';

interface RawOptions {
  url: string;
  method?: 'GET' | 'POST';
  data?: Record<string, unknown>;
  headers?: Record<string, string>;
  timeout?: number;
  form?: boolean;
}

function raw<T = ApiResult>(opt: RawOptions): Promise<T> {
  return new Promise((resolve, reject) => {
    Taro.request({
      url: opt.url,
      method: opt.method || 'GET',
      data: opt.data,
      timeout: opt.timeout || 15000,
      header: opt.form
        ? { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', ...(opt.headers || {}) }
        : { 'Content-Type': 'application/json', ...(opt.headers || {}) },
      success: (res) => {
        if (res.statusCode === 401) {
          const err = new Error('登录已失效') as Error & { status?: number };
          err.status = 401;
          reject(err);
          return;
        }
        resolve(res.data as T);
      },
      fail: (err) => {
        console.error('[HA] request failed', opt.url, err.errMsg);
        reject(new Error(err.errMsg || 'network error'));
      }
    });
  });
}

const demoState = JSON.parse(JSON.stringify(demoBootstrap)) as Bootstrap;

function demoSnapshot(): Bootstrap {
  return {
    ...demoState,
    entities: demoState.entities.map((item) => ({ ...item })),
    scenes: demoState.scenes.map((item) => ({ ...item })),
    automations: demoState.automations.map((item) => ({ ...item }))
  };
}

function demoService(data?: Record<string, unknown>): void {
  const domain = String(data?.domain || '');
  const service = String(data?.service || '');
  const payload = (data?.data || {}) as Record<string, unknown>;
  const entityId = String(payload.entity_id || '');
  const entity = demoState.entities.find((item) => item.id === entityId);
  const automation = demoState.automations.find((item) => item.id === entityId);

  if (automation && domain === 'automation') {
    automation.state = service === 'turn_on' ? 'on' : 'off';
    return;
  }
  if (!entity) return;

  if (domain === 'lock') entity.state = service === 'lock' ? 'locked' : 'unlocked';
  else if (domain === 'cover') entity.state = service === 'open_cover' ? 'open' : 'closed';
  else if (domain === 'climate') entity.state = service === 'turn_off' ? 'off' : 'cool';
  else if (domain === 'media_player') entity.state = service === 'turn_off' ? 'paused' : 'playing';
  else if (domain === 'vacuum') entity.state = service === 'turn_off' ? 'idle' : 'on';
  else if (domain !== 'button' && domain !== 'scene' && domain !== 'script') {
    entity.state = service === 'turn_off' ? 'off' : 'on';
  }
}

function demoApi(path: string, data?: Record<string, unknown>): Promise<ApiResult> {
  console.log('[HA][demo]', path);
  switch (path) {
    case '/api/novaforge/mobile/bootstrap':
      return Promise.resolve(demoSnapshot() as unknown as ApiResult);
    case '/api/novaforge/mobile/service':
      demoService(data);
      return Promise.resolve({ ok: true });
    case '/api/novaforge/mobile/chat':
      return Promise.resolve({ ok: true, reply: demoChat(String(data?.text || '')) });
    case '/api/novaforge/mobile/scan':
      return Promise.resolve({
        ok: true,
        subnet: '192.168.31.0/24',
        devices: [{ name: 'NovaForge-ESP32 开发板', host: '192.168.31.66' }]
      });
    case '/api/novaforge/mobile/add-device':
      return Promise.resolve({ ok: true });
    default:
      return Promise.resolve({ ok: true });
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST';
  data?: Record<string, unknown>;
  timeout?: number;
}

export function api(path: string, opt: ApiOptions = {}): Promise<ApiResult> {
  if (config.demo) return demoApi(path, opt.data);
  const headers: Record<string, string> = {};
  if (config.token) headers.Authorization = 'Bearer ' + config.token;
  return raw<ApiResult>({
    url: config.haUrl + path,
    method: opt.method || 'GET',
    data: opt.data,
    headers,
    timeout: opt.timeout
  });
}

// ---------------- 业务接口 ----------------

export const bootstrap = (): Promise<Bootstrap> =>
  api('/api/novaforge/mobile/bootstrap') as unknown as Promise<Bootstrap>;

export const callService = (domain: string, service: string, data: Record<string, unknown>): Promise<ApiResult> =>
  api('/api/novaforge/mobile/service', { method: 'POST', data: { domain, service, data } });

export const chat = (text: string): Promise<ApiResult> =>
  api('/api/novaforge/mobile/chat', { method: 'POST', data: { text }, timeout: 60000 });

export const logoutRemote = (): Promise<ApiResult> =>
  api('/api/novaforge/mobile/logout', { method: 'POST', data: {} }).catch(() => ({ ok: false }));

export const scanDevices = (subnet: string): Promise<ApiResult> =>
  api('/api/novaforge/mobile/scan', { method: 'POST', data: { subnet }, timeout: 30000 });

export const addDevice = (host: string, port: number, token: string): Promise<ApiResult> =>
  api('/api/novaforge/mobile/add-device', { method: 'POST', data: { host, port, token } });

export const requestCode = (email: string): Promise<ApiResult> =>
  api('/api/novaforge/account/request-code', { method: 'POST', data: { email } });

export const loginByCode = (email: string, code: string): Promise<ApiResult> =>
  api('/api/novaforge/account/login', { method: 'POST', data: { email, code } });

export const giteeStart = (): Promise<ApiResult> =>
  api('/api/novaforge/account/gitee-start', { method: 'POST', data: {} });

export const giteePoll = (session: string): Promise<ApiResult> =>
  api('/api/novaforge/account/gitee-poll', { method: 'POST', data: { session } });

// ---------------- GitHub Device Flow（同账号自动对接） ----------------

export const githubStart = (): Promise<ApiResult> =>
  raw({ url: 'https://github.com/login/device/code', method: 'POST', form: true, data: { client_id: GH_CLIENT_ID, scope: GH_SCOPE } });

export const githubPoll = (deviceCode: string): Promise<ApiResult> =>
  raw({
    url: 'https://github.com/login/oauth/access_token',
    method: 'POST',
    form: true,
    data: { client_id: GH_CLIENT_ID, device_code: deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }
  });

export const githubGists = (token: string): Promise<ApiResult> =>
  raw({
    url: 'https://api.github.com/gists?per_page=100',
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' }
  });

export const githubRaw = (url: string, token: string): Promise<ApiResult> =>
  raw({ url, headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' } });

export const tokenLogin = (base: string, token: string): Promise<ApiResult> =>
  raw({ url: base + '/api/novaforge/account/token-login', method: 'POST', data: { provider: 'github', token }, timeout: 8000 });

/** 依次尝试 Gist 中记录的 HA 地址，直到 token-login 成功 */
export async function pairHa(urls: string[], token: string): Promise<ApiResult & { haUrl?: string }> {
  for (const base of urls) {
    try {
      const res = await tokenLogin(base, token);
      if (res && res.ok && res.token) return { ...res, haUrl: base };
      throw new Error(res.error || 'HA 拒绝了这次登录');
    } catch (err) {
      console.error('[HA] pair failed', base, err);
      if (base === urls[urls.length - 1]) throw new Error('连不上这台 HA：' + urls.join(' / '));
    }
  }
  throw new Error('这台 HA 没有可用地址');
}
