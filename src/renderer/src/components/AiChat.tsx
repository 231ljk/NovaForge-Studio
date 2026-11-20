import { useEffect, useRef, useState } from 'react'
import type { AiConfig, AiMessage, AiStatus } from '../../../shared/ai'

const BASE_SYSTEM = [
  '你是 NovaForge Studio 的 AI 助手，由用户选择的本地离线模型或云端 API 驱动。',
  'NovaForge Studio 是 ESP32 与树莓派的开发软件：支持 Arduino C++ 与 MicroPython 固件编写、Blockly 图形化编程、编译烧录、WiFi/蓝牙/USB 设备控制，以及 Home Assistant 社区集成。',
  '设备以芯片 MAC 派生的硬件 ID（nf-xxxx）为唯一标识，控制指令必须携带项目授权码。',
  '你的职责：1) 解释编译/烧录报错并给出修复；2) 编写与修改 Arduino、MicroPython 代码；3) 讲解引脚配置、设备状态与 HA 对接；4) 回答本软件使用问题。',
  '回答用中文，简洁直接；代码放在代码块中，能直接运行。',
].join('\n')

interface ChatItem {
  role: 'user' | 'assistant'
  content: string
  error?: boolean
}

interface CodeBlock {
  lang: string
  code: string
  key: string
}

function loadCfg(): AiConfig {
  try {
    return JSON.parse(localStorage.getItem('nf-ai-cfg') || '{}') as AiConfig
  } catch {
    return {}
  }
}

/** 构建 system prompt：附加最近编译错误如果有的话 */
function buildSystemPrompt(): string {
  const extra: string[] = []
  try {
    const raw = localStorage.getItem('nf.lastBuildErrors')
    if (raw) {
      const errs = JSON.parse(raw) as { severity: string; file?: string; line?: number; message: string }[]
      const errors = errs.filter((e) => e.severity === 'error')
      if (errors.length > 0) {
        extra.push(
          '\n\n【最近一次编译错误（请根据以下错误自动修复）】\n' +
            errors.slice(0, 10).map((e) =>
              `  ${e.file ?? ''}${e.line ? ':' + e.line : ''}: ${e.message}`
            ).join('\n')
        )
      }
    }
  } catch { /* ignore */ }
  return BASE_SYSTEM + extra.join('\n')
}

function renderRich(text: string): { nodes: React.ReactNode[]; codeBlocks: CodeBlock[] } {
  const parts = text.split(/```(\w*)\n?/g)
  const nodes: React.ReactNode[] = []
  const blocks: CodeBlock[] = []
  let codeIdx = 0
  for (let i = 0; i < parts.length; i++) {
    if (i % 3 === 0) {
      if (parts[i]) nodes.push(<span key={i}>{parts[i]}</span>)
    } else if (i % 3 === 1) {
      const lang = parts[i] || 'plain'
      const code = (parts[i + 1] ?? '').replace(/\n$/, '')
      const key = `cb-${codeIdx++}`
      blocks.push({ lang, code, key })
      nodes.push(
        <div key={i} className="ai-code-wrap">
          <pre className="ai-code">{code}</pre>
        </div>
      )
    }
  }
  return { nodes, codeBlocks: blocks }
}

export function AiChat(): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<ChatItem[]>([
    {
      role: 'assistant',
      content:
        '你好，我是 NovaForge AI 助手。\n可以：粘贴编译报错让我诊断、让我写/改 Arduino 与 MicroPython 代码、问引脚与设备问题。\n可在「设置 → AI 助手」选择本地离线模型或云端 API。',
    },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<AiStatus | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void window.api.aiStatus().then(setStatus).catch(() => {})
  }, [open])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [items, busy, open])

  const applyCodeBlock = (code: string, lang: string): void => {
    // 广播代码到固件编辑器：Firmware.tsx 监听 nf:applyCode 事件
    window.dispatchEvent(new CustomEvent('nf:applyCode', { detail: { code, lang } }))
    notify('代码已发送到固件编辑器，请在固件页确认并编译', 'success')
  }

  const send = async (): Promise<void> => {
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    const next = [...items, { role: 'user' as const, content: text }]
    setItems(next)
    setBusy(true)
    try {
      const history: AiMessage[] = [
        { role: 'system', content: buildSystemPrompt() },
        ...next.slice(-12).map((m) => ({ role: m.role, content: m.content })),
      ]
      const res = await window.api.aiChat(history, loadCfg())
      if (res.ok && res.content) {
        setItems((prev) => [...prev, { role: 'assistant', content: res.content! }])
      } else {
        setItems((prev) => [...prev, { role: 'assistant', content: res.error ?? '推理失败', error: true }])
      }
    } catch (e) {
      setItems((prev) => [...prev, { role: 'assistant', content: String(e), error: true }])
    } finally {
      setBusy(false)
      void window.api.aiStatus().then(setStatus).catch(() => {})
    }
  }

  const busyHint =
    status?.state === 'starting'
      ? '模型加载中（首次约 10~40 秒）…'
      : busy
        ? status?.provider === 'cloud'
          ? '云端思考中…'
          : '本地推理中（CPU 约 5~15 字/秒）'
        : ''

  const modelShort = status?.model
    ? status.model.split(/[\\/]/).pop() ?? status.model
    : '未配置'

  return (
    <>
      <button
        className="ai-fab"
        title="AI 助手（设置中可切换本地/云端）"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '×' : 'AI'}
      </button>

      {open && (
        <div className="ai-panel">
          <div className="ai-head">
            <b>NovaForge AI 助手</b>
            <span className={`badge ${status?.state === 'running' ? 'ok' : ''}`}>
              {status?.provider === 'cloud'
                ? status?.state === 'error'
                  ? '云端配置缺失'
                  : '云端就绪'
                : status?.state === 'running'
                  ? '本地运行中'
                  : status?.state === 'starting'
                    ? '加载模型中'
                    : status?.state === 'error'
                      ? '启动失败'
                      : '未启动 · 发消息自动启动'}
            </span>
          </div>
          <div className="ai-list" ref={listRef}>
            {items.map((m, i) => {
              const { nodes, codeBlocks } = renderRich(m.content)
              return (
                <div key={i} className={`ai-msg ${m.role}${m.error ? ' err' : ''}`}>
                  <div className="ai-role">{m.role === 'user' ? '我' : 'AI'}</div>
                  <div className="ai-body">
                    {m.error ? m.content : (
                      <>
                        {nodes}
                        {m.role === 'assistant' && !m.error && codeBlocks.map((cb) => (
                          <div key={cb.key} className="ai-code-actions">
                            <button
                              className="btn ghost small"
                              onClick={() => applyCodeBlock(cb.code, cb.lang)}
                              title="发送到固件编辑器，然后编译"
                            >
                              应用到固件编辑器 →
                            </button>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
            {busyHint && <div className="ai-busy">{busyHint}</div>}
          </div>
          <div className="ai-input">
            <textarea
              value={input}
              placeholder="粘贴报错、问设备问题、让它写代码…（已自动附加最近编译错误）"
              rows={2}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
            />
            <button className="btn small" disabled={busy || !input.trim()} onClick={() => void send()}>
              发送
            </button>
          </div>
          <div className="ai-foot muted small">
            {status?.provider === 'cloud' ? '云端 API' : '本地离线'} · 模型 {modelShort}
          </div>
        </div>
      )}
    </>
  )
}

// notify 工具（AiChat 里没有直接访问 store 的 notify，这里用 dispatchEvent 发 toast）
function notify(text: string, kind: 'info' | 'success' | 'error' = 'info'): void {
  window.dispatchEvent(new CustomEvent('nf:toast', { detail: { text, kind } }))
}
