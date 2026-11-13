import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { app } from 'electron'
import {
  AI_PORT,
  CLOUD_PRESETS,
  LOCAL_MODELS,
  type AiChatResult,
  type AiConfig,
  type AiMessage,
  type AiProvider,
  type AiStatus,
} from '../shared/ai'

/**
 * AI 服务：三模式统一入口
 *  - local：拉起内置 llama-server（随安装包分发，resources/mimo/llama-server.exe）
 *           加载本地 GGUF 模型（resources/mimo/*.gguf 或用户外接盘/自定义路径）
 *  - cloud：OpenAI Chat Completions 兼容接口，支持内置预设 + 用户自填 base/key/model
 *
 * 本地模式不自动启动：chat() 时按需拉起（127.0.0.1:18434），避免安装包体积大 + 启动慢。
 * 云端模式完全无外部依赖，chat() 直接 HTTP 请求。
 */

let proc: ChildProcess | null = null
let startPromise: Promise<void> | null = null
let state: AiStatus['state'] = 'stopped'
let lastError = ''
let currentCfg: AiConfig = { provider: 'local' }

function baseUrl(): string {
  return `http://127.0.0.1:${AI_PORT}`
}

function pickPreset(id?: string): (typeof CLOUD_PRESETS)[number] | null {
  if (!id) return null
  return CLOUD_PRESETS.find((p) => p.id === id) ?? null
}

/** 合并用户配置 + 预设默认值 */
function resolveCloud(cfg?: AiConfig): { base: string; key: string; model: string } {
  const preset = pickPreset(cfg?.preset)
  const base = (cfg?.cloudBase || preset?.base || '').trim()
  const key = (cfg?.cloudKey || '').trim()
  const model = (cfg?.cloudModel || preset?.model || '').trim()
  return { base, key, model }
}

function status(provider: AiProvider = currentCfg.provider ?? 'local'): AiStatus {
  return {
    state,
    port: AI_PORT,
    provider,
    model: provider === 'cloud' ? resolveCloud(currentCfg).model : currentCfg.model ?? '',
    server: provider === 'local' ? currentCfg.server : undefined,
    cloudBase: provider === 'cloud' ? resolveCloud(currentCfg).base : undefined,
    error: state === 'error' ? lastError : undefined,
  }
}

// ——— 以下是本地推理专属 ———

async function healthOk(): Promise<boolean> {
  try {
    const r = await fetch(`${baseUrl()}/health`, { signal: AbortSignal.timeout(1200) })
    if (!r.ok) return false
    const body = (await r.json().catch(() => null)) as { status?: string } | null
    return !!body && typeof body.status === 'string'
  } catch {
    return false
  }
}

function portInUse(): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.connect({ host: '127.0.0.1', port: AI_PORT })
    const done = (v: boolean): void => {
      sock.removeAllListeners()
      sock.destroy()
      resolve(v)
    }
    sock.setTimeout(800, () => done(false))
    sock.once('connect', () => done(true))
    sock.once('error', () => done(false))
  })
}

/** 内置资源目录优先级：resources/mimo → appPath/mimo → userData/mimo → 外接盘/用户配置 */
function candidateRoots(): string[] {
  const roots = new Set<string>()
  for (const dir of [
    path.join(process.resourcesPath, 'mimo'),
    path.join(app.getAppPath(), 'mimo'),
    path.join(app.getPath('userData'), 'mimo'),
  ]) {
    try {
      if (fs.existsSync(dir)) roots.add(dir)
    } catch { /* ignore */ }
  }
  // 用户配置的模型所在目录
  if (currentCfg.model) {
    const d = path.dirname(currentCfg.model)
    if (d) roots.add(d)
  }
  // 外接盘根
  for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')) {
    try {
      const root = `${c}:\\`
      if (!fs.existsSync(root)) continue
      roots.add(path.join(root, 'MIMO'))
      roots.add(path.join(root, 'mimo'))
    } catch { /* ignore */ }
  }
  return [...roots]
}

function searchFile(basename: string, maxDepth = 2): string | null {
  const lower = basename.toLowerCase()
  const walk = (dir: string, depth: number): string | null => {
    if (depth > maxDepth) return null
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return null
    }
    for (const e of entries) {
      if (e.isFile() && e.name.toLowerCase() === lower) return path.join(dir, e.name)
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        const hit = walk(path.join(dir, e.name), depth + 1)
        if (hit) return hit
      }
    }
    return null
  }
  for (const root of candidateRoots()) {
    try {
      if (!fs.existsSync(root)) continue
    } catch { continue }
    if (path.basename(root).toLowerCase() === lower && fs.statSync(root).isFile()) return root
    const hit = walk(root, 0)
    if (hit) return hit
  }
  return null
}

function resolveLocalPaths(cfg: AiConfig): { server: string; model: string } {
  let server = cfg.server?.trim() || ''
  let model = cfg.model?.trim() || ''

  // server：先看用户配置，再看内置 llama-server.exe
  if (!server || !fs.existsSync(server)) {
    server = searchFile('llama-server.exe') ?? ''
  }
  // model：先看用户配置；没有就挑一个内置模型（只要能找到）
  if (!model || !fs.existsSync(model)) {
    for (const m of LOCAL_MODELS) {
      const found = searchFile(m.file)
      if (found) {
        model = found
        break
      }
    }
  }
  return { server, model }
}

async function doStartLocal(cfg: AiConfig): Promise<void> {
  if (await healthOk()) {
    state = 'running'
    return
  }
  if (startPromise) {
    await startPromise
    return
  }
  const { server, model } = resolveLocalPaths(cfg)
  currentCfg = { ...cfg, server, model }

  if (!server) {
    state = 'error'
    lastError =
      '未找到 llama-server.exe。请在「设置 → AI 助手」里填入自定义路径，或把它放到 resources/mimo/ 目录。'
    return
  }
  if (!model) {
    state = 'error'
    lastError =
      '未找到本地 GGUF 模型。请把 .gguf 文件放到 resources/mimo/ 目录，或改用云端 API（设置 → AI 助手 → 云端）。'
    return
  }
  if (await portInUse()) {
    state = 'error'
    lastError = `端口 ${AI_PORT} 已被占用`
    return
  }

  state = 'starting'
  lastError = ''
  const p = new Promise<void>((resolve) => {
    let settled = false
    const done = (err?: string): void => {
      if (settled) return
      settled = true
      startPromise = null
      if (err) {
        state = 'error'
        lastError = err
      } else {
        state = 'running'
      }
      resolve()
    }
    try {
      proc = spawn(
        server,
        ['--model', model, '--host', '127.0.0.1', '--port', String(AI_PORT), '--ctx-size', '4096'],
        { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
      )
    } catch (e) {
      done(String(e))
      return
    }
    let stderrTail = ''
    proc.stderr?.on('data', (buf: Buffer) => {
      stderrTail = (stderrTail + buf.toString()).slice(-1500)
    })
    proc.on('error', (e) => done(`启动失败: ${e.message}`))
    proc.on('exit', (code) => {
      if (!settled) done(`推理进程退出(code=${code}): ${stderrTail.slice(-300)}`)
      else {
        proc = null
        state = 'stopped'
      }
    })
    const deadline = Date.now() + 120_000
    const timer = setInterval(() => {
      void healthOk().then((ok) => {
        if (ok) {
          clearInterval(timer)
          done()
        } else if (Date.now() > deadline) {
          clearInterval(timer)
          done(`模型加载超时: ${stderrTail.slice(-300)}`)
        }
      })
    }, 1000)
  })
  startPromise = p
  await p
}

function doStop(): void {
  if (proc) {
    try { proc.kill() } catch { /* ignore */ }
    proc = null
  }
  startPromise = null
  state = 'stopped'
}

async function chatLocal(messages: AiMessage[], cfg: AiConfig): Promise<AiChatResult> {
  await doStartLocal(cfg)
  if (state !== 'running') return { ok: false, error: lastError || '推理服务未就绪' }
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 300_000)
    const resp = await fetch(`${baseUrl()}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: path.basename(currentCfg.model || 'local'),
        messages,
        temperature: 0.6,
        max_tokens: 2048,
      }),
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    if (!resp.ok) return { ok: false, error: `推理接口 HTTP ${resp.status}` }
    const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] }
    const content = data.choices?.[0]?.message?.content
    if (!content) return { ok: false, error: '模型返回空内容' }
    return { ok: true, content }
  } catch (e) {
    const msg = e instanceof Error && e.name === 'AbortError' ? '推理超时（模型响应过慢）' : String(e)
    return { ok: false, error: msg }
  }
}

async function chatCloud(messages: AiMessage[], cfg: AiConfig): Promise<AiChatResult> {
  const { base, key, model } = resolveCloud(cfg)
  if (!base || !key || !model) {
    return {
      ok: false,
      error: '云端配置不完整：请填写 Base URL、API Key 和模型名（或选择一个预设）',
    }
  }
  const url = base.endsWith('/chat/completions')
    ? base
    : `${base.replace(/\/$/, '')}/chat/completions`
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 120_000)
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ model, messages, temperature: 0.6, max_tokens: 2048 }),
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    if (!resp.ok) {
      const body = await resp.text().catch(() => '')
      return { ok: false, error: `云端 HTTP ${resp.status}: ${body.slice(0, 200)}` }
    }
    const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] }
    const content = data.choices?.[0]?.message?.content
    if (!content) return { ok: false, error: '云端返回空内容' }
    return { ok: true, content }
  } catch (e) {
    const msg = e instanceof Error && e.name === 'AbortError' ? '云端请求超时' : String(e)
    return { ok: false, error: msg }
  }
}

export const aiService = {
  status(): AiStatus {
    if (state === 'running' && proc && proc.killed) state = 'stopped'
    return status()
  },
  async start(cfg?: AiConfig): Promise<AiStatus> {
    const provider: AiProvider = cfg?.provider ?? currentCfg.provider ?? 'local'
    currentCfg = { ...currentCfg, ...cfg, provider }
    if (provider === 'local') {
      await doStartLocal(currentCfg)
    } else {
      state = 'running'
      lastError = ''
    }
    return status(provider)
  },
  async stop(): Promise<AiStatus> {
    doStop()
    return status()
  },
  async chat(messages: AiMessage[], cfg?: AiConfig): Promise<AiChatResult> {
    const provider: AiProvider = cfg?.provider ?? currentCfg.provider ?? 'cloud'
    currentCfg = { ...currentCfg, ...cfg, provider }
    if (provider === 'cloud') {
      return chatCloud(messages, currentCfg)
    }
    return chatLocal(messages, currentCfg)
  },
}

app.once('before-quit', () => doStop())
