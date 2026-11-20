import { useEffect, useRef, useState } from 'react'
import { BOARDS } from '../../../shared/boards'
import { buildFirmware } from '../../../shared/firmware'
import { parseBuildErrors } from '../lib/serial'
import type { BuildResult } from '../../../shared/types'
import { BlocksEditor } from '../components/BlocksEditor'
import { CodeEditor } from '../components/CodeEditor'
import { PinEditor } from '../components/PinEditor'
import { useApp } from '../store'

type RouteId = 'workbench' | 'firmware' | 'device' | 'control' | 'ha' | 'settings'

export function Firmware({ navigate }: { navigate: (r: RouteId) => void }): React.ReactElement {
  const { activeProject, activeBoard, updateProject, switchBoard, regenerateFirmware, notify, setLastBuild } =
    useApp()
  const project = activeProject!
  const board = activeBoard!

  const [draft, setDraft] = useState(project.code)
  const [building, setBuilding] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [result, setResult] = useState<BuildResult | null>(null)
  const saveTimer = useRef<number | null>(null)
  const consoleRef = useRef<HTMLDivElement>(null)

  // 日志节流缓冲区
  const logBufRef = useRef<string[]>([])
  const logFlushTimerRef = useRef<number | null>(null)
  const pushLog = (line: string): void => {
    logBufRef.current.push(line)
    if (!logFlushTimerRef.current) {
      logFlushTimerRef.current = window.setTimeout(() => {
        logFlushTimerRef.current = null
        const batch = logBufRef.current
        logBufRef.current = []
        if (batch.length === 0) return
        setLogs((prev) => [...prev, ...batch].slice(-500))
      }, 100)
    }
  }

  useEffect(() => {
    setDraft(project.code)
  }, [project.id, project.code])

  useEffect(() => {
    const off = window.api.onProgress((e) => {
      if (e.scope !== 'build') return
      pushLog(e.line.trimEnd())
    })
    return off
  }, [])

  useEffect(() => {
    if (consoleRef.current) consoleRef.current.scrollTop = consoleRef.current.scrollHeight
  }, [logs])

  // AI 代码应用监听：AiChat 通过 CustomEvent 发代码到这里
  useEffect(() => {
    const applyCode = (): void => {
      try {
        const raw = localStorage.getItem('nf.applyCode')
        if (!raw) return
        const { code, ts } = JSON.parse(raw) as { code: string; lang: string; ts: number }
        // 只处理 30 秒内的新代码，避免重放旧事件
        if (Date.now() - ts > 30_000) return
        localStorage.removeItem('nf.applyCode')
        if (code && code.length > 10) {
          setDraft(code)
          updateProject(project.id, { code })
          notify('AI 代码已应用，点「编译固件」验证', 'success')
        }
      } catch { /* ignore */ }
    }
    applyCode()
    const onApply = (): void => applyCode()
    window.addEventListener('nf:applyCode', onApply)
    return () => window.removeEventListener('nf:applyCode', onApply)
  }, [project.id])

  const handleCodeChange = (value: string): void => {
    setDraft(value)
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      updateProject(project.id, { code: value })
    }, 600)
  }

  const buildNow = async (): Promise<BuildResult | null> => {
    if (!board.fqbn) {
      notify('该开发板使用 SSH 部署模式，不需要编译固件', 'error')
      return null
    }
    setBuilding(true)
    setLogs([])
    const source = project.mode === 'blocks' ? buildFirmware(project, board) : draft
    updateProject(project.id, project.mode === 'blocks' ? { generatedCode: project.generatedCode } : { code: draft })
    try {
      const build = await window.api.build({
        projectId: project.id,
        projectName: project.name,
        fqbn: board.fqbn,
        coreIds: board.coreId ? [board.coreId] : [],
        code: source
      })
      // 注入结构化错误
      const errors = parseBuildErrors(build.output)
      const enriched: BuildResult = { ...build, errors }
      setResult(enriched)
      setLastBuild(enriched)
      setLogs((prev) => [...prev, ...build.output.split('\n').slice(-400)])
      if (build.success) {
        notify(`编译成功，用时 ${(build.durationMs / 1000).toFixed(1)} 秒`, 'success')
        localStorage.setItem('nf.lastBuildErrors', '')
      } else {
        notify('编译失败，请查看下方日志或让 AI 修复', 'error')
        // 暴露错误给 AI：写入 localStorage，AiChat 发送消息时自动读取
        localStorage.setItem('nf.lastBuildErrors', JSON.stringify(errors.slice(0, 30)))
      }
      return enriched
    } catch (err) {
      notify(`编译调用失败: ${String(err)}`, 'error')
      return null
    } finally {
      setBuilding(false)
    }
  }

  const switchMode = (mode: 'code' | 'blocks'): void => {
    if (mode === 'code') {
      const generated = buildFirmware(project, board)
      setDraft(generated)
      updateProject(project.id, { mode, code: generated })
    } else {
      updateProject(project.id, { mode })
    }
  }

  return (
    <div className="firmware-layout">
      <div className="firmware-main">
        <section className="panel board-bar">
          <div className="board-pick">
            <span className="mini-label">开发板</span>
            <select
              value={project.boardId}
              onChange={(e) => {
                const nextId = e.target.value
                if (nextId === project.boardId) return
                switchBoard(project.id, nextId)
                const next = BOARDS.find((b) => b.id === nextId)
                notify(`已切换到 ${next?.name ?? nextId}，引脚与代码已按该开发板同步`)
              }}
            >
              {BOARDS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="board-specs">
            <span>{board.chip}</span>
            <span>{board.arch}</span>
            <span>{board.clockMhz} MHz</span>
            {board.flashMB > 0 && <span>{board.flashMB} MB Flash</span>}
            {board.psram && <span>{board.psram}</span>}
            <span>{board.usb}</span>
          </div>
          <div className="board-note">{board.note}</div>
        </section>

        {board.family === 'linux-sbc' && (
          <div className="notice">
            树莓派 Linux 单板不参与固件烧录：请通过 SSH 部署 Python/Node 程序，后续版本将内置远程部署。
          </div>
        )}

        <section className="panel editor-panel">
          <div className="editor-tabs">
            <button className={project.mode === 'code' ? 'active' : ''} onClick={() => switchMode('code')}>
              代码模式
            </button>
            <button className={project.mode === 'blocks' ? 'active' : ''} onClick={() => switchMode('blocks')}>
              图形化
            </button>
            <div className="editor-tab-spacer" />
            <span className="file-name">{project.name.replace(/[^\w\u4e00-\u9fa5]/g, '_')}.ino</span>
            <button
              className="btn ghost small"
              onClick={() => {
                regenerateFirmware(project.id)
                notify('已根据开发板与引脚重新生成模板')
              }}
              title="用当前引脚配置重新生成固件模板（会覆盖代码模式下已有代码）"
            >
              重置模板
            </button>
          </div>
          <div className="editor-surface">
            {project.mode === 'code' ? (
              <CodeEditor value={draft} onChange={handleCodeChange} readOnly={board.family === 'linux-sbc'} />
            ) : (
              <BlocksEditor
                key={`${project.id}:${project.boardId}`}
                projectId={project.id}
                xml={project.blockXml}
                onChangeXml={(xml) => updateProject(project.id, { blockXml: xml })}
                onChangeCode={(code) => updateProject(project.id, { generatedCode: code })}
              />
            )}
          </div>
        </section>
      </div>

      <aside className="firmware-side">
        <section className="panel">
          <div className="section-head">
            <h3>引脚功能</h3>
            <span className="muted small">同时用于 HTTP 与 HA 实体</span>
          </div>
          <PinEditor pins={project.pins} onChange={(pins) => updateProject(project.id, { pins })} />
        </section>

        <section className="panel grow">
          <div className="section-head">
            <h3>编译</h3>
            <span className="muted small">本机编译，不上传云端</span>
          </div>
          <div className="build-actions">
            <button
              className="btn primary"
              disabled={building || board.family === 'linux-sbc'}
              onClick={() => void buildNow()}
            >
              {building ? '编译中…' : '编译固件'}
            </button>
            <button
              className="btn ghost"
              disabled={building || !result?.success}
              onClick={() => navigate('device')}
            >
              前往烧录
            </button>
          </div>
          <div className="console" ref={consoleRef}>
            {logs.length === 0 ? (
              <div className="console-empty">编译输出会显示在这里</div>
            ) : (
              logs.map((line, i) => (
                <div className="console-line" key={i}>
                  {line || ' '}
                </div>
              ))
            )}
          </div>
          {result && result.success && (
            <div className="artifact-list">
              {result.artifacts.map((a) => (
                <div className="artifact" key={a.name}>
                  <span>{a.name}</span>
                  <span className="muted">{(a.size / 1024).toFixed(1)} KB</span>
                </div>
              ))}
              {result.artifacts.length === 0 && <div className="muted small">未产生 .bin 文件</div>}
            </div>
          )}
        </section>
      </aside>
    </div>
  )
}
