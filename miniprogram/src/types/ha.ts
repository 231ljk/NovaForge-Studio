// Home Assistant / NovaForge 插件数据类型

export interface HaEntity {
  id: string;
  name: string;
  domain: string;
  state: string;
  unit?: string;
}

export interface HaScene {
  id: string;
  name: string;
}

export interface HaAutomation {
  id: string;
  name: string;
  state: string;
}

export interface Bootstrap {
  ok: boolean;
  name: string;
  entities: HaEntity[];
  scenes: HaScene[];
  automations: HaAutomation[];
}

export interface Session {
  token: string;
  email: string;
  name: string;
  provider: string;
  demo?: boolean;
}

export interface ApiResult {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

export interface ScanDevice {
  name: string;
  host: string;
}
