import Taro from '@tarojs/taro';
import { create } from 'zustand';
import type { Bootstrap, Session } from '@/types/ha';
import { bootstrap, configure, logoutRemote } from '@/services/ha';

const HA_KEY = 'nf-ha-url';
const SESSION_KEY = 'nf-session';

interface AppState {
  session: Session | null;
  haUrl: string;
  data: Bootstrap | null;
  ready: boolean;
  refreshing: boolean;
  init: () => void;
  signIn: (session: Session, haUrl: string) => void;
  signOut: () => void;
  demoSignIn: () => void;
  refresh: () => Promise<string | undefined>;
}

export const useAppStore = create<AppState>((set, get) => ({
  session: null,
  haUrl: '',
  data: null,
  ready: false,
  refreshing: false,

  init: () => {
    let session: Session | null = null;
    let haUrl = '';
    try {
      const rawSession = Taro.getStorageSync(SESSION_KEY);
      session = rawSession ? (JSON.parse(rawSession) as Session) : null;
      haUrl = Taro.getStorageSync(HA_KEY) || '';
    } catch (err) {
      console.error('[Store] restore session failed', err);
    }
    configure({ haUrl, token: session?.token || '', demo: !!session?.demo });
    set({ session, haUrl, ready: true });
    if (session) {
      get().refresh().catch((err) => console.error('[Store] boot refresh failed', err));
    }
  },

  signIn: (session, haUrl) => {
    try {
      Taro.setStorageSync(SESSION_KEY, JSON.stringify(session));
      Taro.setStorageSync(HA_KEY, haUrl);
    } catch (err) {
      console.error('[Store] persist session failed', err);
    }
    configure({ haUrl, token: session.token, demo: !!session.demo });
    set({ session, haUrl, data: null });
    get().refresh().catch((err) => console.error('[Store] refresh after login failed', err));
  },

  signOut: () => {
    logoutRemote().catch(() => undefined);
    try {
      Taro.removeStorageSync(SESSION_KEY);
    } catch (err) {
      console.error('[Store] clear session failed', err);
    }
    configure({ haUrl: get().haUrl, token: '', demo: false });
    set({ session: null, data: null });
  },

  demoSignIn: () => {
    get().signIn({ token: 'demo', email: 'demo@novaforge', name: '演示用户', provider: 'demo', demo: true }, 'demo://home-assistant');
  },

  refresh: async () => {
    const { session } = get();
    if (!session) return undefined;
    set({ refreshing: true });
    try {
      const res = await bootstrap();
      if (!res.ok) throw new Error('读取 HA 数据失败');
      set({ data: res, refreshing: false });
      return undefined;
    } catch (err) {
      console.error('[Store] refresh failed', err);
      set({ refreshing: false });
      if ((err as Error & { status?: number }).status === 401) {
        get().signOut();
        Taro.reLaunch({ url: '/pages/login/index?expired=1' });
        return '登录已失效，请重新登录';
      }
      return err instanceof Error ? err.message : String(err);
    }
  }
}));

/** tab 页登录守卫：未登录时跳转到登录页 */
export const ensureSession = (): boolean => {
  const { ready, session } = useAppStore.getState();
  if (!ready) return true; // 等待 init，由页面渲染空态
  if (!session) {
    Taro.reLaunch({ url: '/pages/login/index' });
    return false;
  }
  return true;
};
