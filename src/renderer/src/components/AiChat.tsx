import { useEffect, useRef, useState } from 'react'
import type { AiConfig, AiMessage, AiStatus } from '../../../shared/ai'

const SYSTEM_PROMPT = [
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

function loadCfg(): AiConfig {
  try {
    return JSON.parse(localStorage.getItem('nf-ai-cfg') || '{}') as AiConfig
  } catch {
    return {}
  }
}

function renderRich(text: string): React.ReactNode[] {
  const parts = text.split(/```(\w*)\n?/g)
  const nodes: React.ReactNode[] = []
  for (let i = 0; i < parts.length; i++) {
    if (i % 3 === 0) {
      if (parts[i]) nodes.push(<span key={i}>{parts[i]}</span>)
    } else if (i % 3 === 1) {
      const code = (parts[i + 1] ?? '').replace(/\n$/, '')
      nodes.push(
        <pre key={i} className="ai-code">
          {code}
        </pre>,
      )
    }
  }
  return nodes
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

  const send = async (): Promise<void> => {
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    const next = [...items, { role: 'user' as const, content: text }]
    setItems(next)
    setBusy(true)
    try {
      const history: AiMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
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
            {items.map((m, i) => (
              <div key={i} className={`ai-msg ${m.role}${m.error ? ' err' : ''}`}>
                <div className="ai-role">{m.role === 'user' ? '我' : 'AI'}</div>
                <div className="ai-body">
                  {m.error ? m.content : renderRich(m.content)}
                </div>
              </div>
            ))}
            {busyHint && <div className="ai-busy">{busyHint}</div>}
          </div>
          <div className="ai-input">
            <textarea
              value={input}
              placeholder="粘贴报错、问设备问题、让它写代码…"
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
