/** AI 助手：本地离线 / 云端 API / 自定义 OpenAI 兼容服务 三种形态 */

export interface AiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type AiState = 'stopped' | 'starting' | 'running' | 'error'

export interface AiChatResult {
  ok: boolean
  content?: string
  error?: string
}

export type AiProvider = 'local' | 'cloud'

/** 内置本地模型（随安装包分发或用户手动放置在 resources/mimo/） */
export const LOCAL_MODELS: { name: string; file: string; note: string }[] = [
  {
    name: 'MiMo-7B (推荐)',
    file: 'MiMo-7B-RL-nomtp-Q4_K_M.gguf',
    note: '本地离线、约 4.5 GB，用户需自行放入 resources/mimo/ 或外接盘',
  },
  {
    name: 'Qwen2.5-1.5B-Instruct',
    file: 'Qwen2.5-1.5B-Instruct-Q4_K_M.gguf',
    note: '轻量、CPU 可跑、约 1 GB',
  },
  {
    name: 'DeepSeek-R1-Distill-Qwen-1.5B',
    file: 'DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf',
    note: '推理方向、约 1 GB',
  },
]

/** 内置云端预设（均为 OpenAI Chat Completions 兼容接口） */
export const CLOUD_PRESETS: {
  id: string
  name: string
  base: string
  model: string
  doc: string
}[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    base: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    doc: 'https://platform.deepseek.com',
  },
  {
    id: 'qwen',
    name: '通义（阿里云百炼）',
    base: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    doc: 'https://bailian.console.aliyun.com',
  },
  {
    id: 'glm',
    name: '智谱 AI',
    base: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    doc: 'https://open.bigmodel.cn',
  },
  {
    id: 'siliconflow',
    name: '硅基流动 SiliconFlow',
    base: 'https://api.siliconflow.cn/v1',
    model: 'Qwen/Qwen2.5-7B-Instruct',
    doc: 'https://siliconflow.cn',
  },
  {
    id: 'openwebui',
    name: '自托管 OpenWebUI / Ollama',
    base: 'http://127.0.0.1:11434/v1',
    model: 'qwen2.5:7b',
    doc: 'https://openwebui.com',
  },
]

export const AI_PORT = 18434

/** 渲染层默认值：空字符串 = 让主进程在内置 resources/mimo/、外接盘等路径自动搜索 */
export const AI_DEFAULT_SERVER = ''
export const AI_DEFAULT_MODEL = ''

export interface AiConfig {
  provider?: AiProvider
  // —— 本地 provider ——
  server?: string
  model?: string
  // —— 云端 provider ——
  preset?: string
  cloudBase?: string
  cloudKey?: string
  cloudModel?: string
}

export interface AiStatus {
  state: AiState
  port: number
  provider: AiProvider
  model: string
  server?: string
  cloudBase?: string
  error?: string
}
