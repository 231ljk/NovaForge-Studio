import type { HaEntity } from '@/types/ha';

const TITLES: Record<string, string> = {
  on: '开',
  off: '关',
  unavailable: '离线',
  unknown: '未知',
  playing: '播放中',
  paused: '已暂停',
  idle: '待机',
  open: '开',
  opening: '正在开',
  closed: '关',
  closing: '正在关',
  locked: '已锁',
  unlocked: '未锁',
  home: '在家',
  not_home: '离家',
  heat: '制热',
  cool: '制冷',
  auto: '自动',
  dry: '除湿',
  fan_only: '送风'
};

export const stateText = (v: string): string => TITLES[v] || v;

const ON_STATES = ['on', 'open', 'unlocked', 'playing', 'heat', 'cool', 'auto', 'dry', 'fan_only'];
const READONLY_DOMAINS = ['sensor', 'binary_sensor', 'device_tracker', 'person', 'weather'];

export const isOn = (item: HaEntity): boolean => ON_STATES.indexOf(item.state) >= 0;

export const isReadonly = (item: HaEntity): boolean => READONLY_DOMAINS.indexOf(item.domain) >= 0;

export const iconOf = (item: HaEntity): string => {
  switch (item.domain) {
    case 'light':
      return '💡';
    case 'climate':
      return '🌡️';
    case 'cover':
      return '🪟';
    case 'lock':
      return '🔒';
    case 'media_player':
      return '🎵';
    case 'sensor':
      return '📊';
    case 'fan':
      return '🌀';
    case 'vacuum':
      return '🧹';
    case 'person':
    case 'device_tracker':
      return '📍';
    default:
      return '🔌';
  }
};

export const greeting = (): string => {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 11) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
};

export const normalizeUrl = (v: string): string => {
  let s = String(v || '').trim().replace(/\/+$/, '');
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
  return s;
};

export const errText = (err: unknown): string => {
  const msg = err instanceof Error ? err.message : String(err);
  if (/timeout/i.test(msg)) return '连接超时，请检查 HA 地址是否可从手机访问';
  return '网络请求失败：' + msg;
};
