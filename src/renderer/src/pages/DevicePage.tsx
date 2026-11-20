import { useEffect, useRef, useState } from 'react'
import { addressHex, base64ToBytes, resolveFlashTargets } from '../../../shared/flash'
import { serialManager, describePort, parseBuildErrors, type FlashStage, type ChipInfo } from '../lib/serial'
import { SerialError } from '../lib/serial'
import { downloadBackup, isNovaForgeFirmware, buildMeta, sha256, scanExtractableConfig } from '../../../shared/serialBackup'
import { BOARDS } from '../../../shared/boards'
import { buildFirmware } from '../../../shared/firmware'
import { useApp } from '../store'
import { IS_FLASH } from '../../../shared/product'
import type { SerialPortInfo, BuildResult } from '../../../shared/types'

/** 解析 Intel HEX，返回起始地址与连续数据 */
function parseIntelHex(text: string): { address: number; bytes: Uint8Array } {
  const chunks: { addr: number; data: Uint8Array }[] = []
  let base = 0
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line.startsWith(':') || line.length < 11) continue
    const b = line.slice(1)
    const len = parseInt(b.slice(0, 2), 16)
    const addr = parseInt(b.slice(2, 6), 16)
    const type = parseInt(b.slice(6, 8), 16)
    if (type === 0) {
      const data = new Uint8Array(len)
      for (let i = 0; i < len; i++) data[i] = parseInt(b.slice(8 + i * 2, 10 + i * 2), 16)
      chunks.push({ addr: base + addr, data })
    } else if (type === 1) {
      break
    } else if (type === 2) {
      base = parseInt(b.slice(8, 12), 16) << 4
    } else if (type === 4) {
      base = parseInt(b.slice(8, 12), 16) << 16
    }
  }
  if (!chunks.length) throw new Error('HEX 文件没有数据')
  const start = Math.min(...chunks.map((c) => c.addr))
  const end = Math.max(...chunks.map((c) => c.addr + c.data.length))
  const bytes = new Uint8Array(end - start)
  for (const c of chunks) bytes.set(c.data, c.addr - start)
  return { address: start, bytes }
}

function parseAddress(v: string): number {
  const n = parseInt(v.trim().toLowerCase().replace(/^0x/, ''), 16)
  return Number.isFinite(n) ? n : 0
}

const STAGE_LABELS: Record<FlashStage, string> = {
  connect: '连接开发板',
  detect: '检测芯片',
  erase: '擦除 Flash',
  write: '写入固件',
  verify: '校验数据',
  reset: '重启设备',
  done: '完成'
}

const STAGE_ORDER: FlashStage[] = ['connect', 'detect', 'erase', 'write', 'verify', 'reset', 'done']

type RouteId = 'workbench' | 'firmware' | 'device' | 'control' | 'ha' | 'settings'

export function DevicePage({ navigate }: { navigate: (r: RouteId) => void }): React.ReactElement | null {
  const { activeProject, activeBoard, lastBuild, notify, updateProject, switchBoard, createProject, setLastBuild } = useApp()
  const project = activeProject!
  const board = activeBoard!

  const [portLabel, setPortLabel] = useState('未选择串口')
  const [systemPorts, setSystemPorts] = useState<SerialPortInfo[]>([])
  const [flashing, setFlashing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState<FlashStage>('connect')
  const [flashLog, setFlashLog] = useState<string[]>([])
  const [baudrate, setBaudrate] = useState(460800)
  const [eraseAll, setEraseAll] = useState(false)
  const [monitoring, setMonitoring] = useState(false)
  const [monitorBaud, setMonitorBaud] = useState(115200)
  const [monitorData, setMonitorData] = useState('')
  const [sendText, setSendText] = useState('')
  const [manualFiles, setManualFiles] = useState<{ name: string; address: number; bytes: Uint8Array }[]>([])
  const [manualAddress, setManualAddress] = useState('0x0')
  const flashConsoleRef = useRef<HTMLDivElement>(null)

  // —— 日志节流缓冲区 ——
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
        setFlashLog((prev) => {
          const merged = [...prev, ...batch]
          return merged.slice(-500)
        })
      }, 100)
    }
  }

  useEffect(() => {
    if (flashConsoleRef.current) {
      flashConsoleRef.current.scrollTop = flashConsoleRef.current.scrollHeight
    }
  }, [flashLog, progress])

  const refreshSystemPorts = async (): Promise<SerialPortInfo[]> => {
    const list = await window.api.listSerialPorts()
    setSystemPorts(list)
    return list
  }

  useEffect(() => {
    void refreshSystemPorts()
    void serialManager.grantedPorts().then(async (ports) => {
      if (ports.length > 0) {
        const info = await describePort(ports[0])
        setPortLabel(info.label)
      }
    })
  }, [])

  const pickPort = async (): Promise<void> => {
    try {
      const port = await serialManager.pickPort()
      const info = await describePort(port)
      const ports = systemPorts.length > 0 ? systemPorts : await refreshSystemPorts()
      const hit = ports.find(
        (p) => p.vendorId && p.vendorId === info.vendorId && p.productId === info.productId
      )
      setPortLabel(hit ? `${hit.address} — ${hit.label}` : info.label)
      notify('串口设备已选择', 'success')
    } catch (err) {
      const se = err instanceof SerialError ? err : null
      notify(`选择串口失败: ${se?.detail.message ?? String(err)}`, 'error')
    }
  }

  const buildTargets = lastBuild?.success && lastBuild.artifacts.length
    ? resolveFlashTargets(board, lastBuild.artifacts)
    : []
  const targets = manualFiles.length
    ? manualFiles.map((f) => ({ address: f.address, name: f.name, size: f.bytes.length }))
    : buildTargets

  const pickFirmware = async (list: FileList | null): Promise<void> => {
    if (!list?.length) return
    const next = [...manualFiles]
    for (const file of Array.from(list)) {
      try {
        const buf = await file.arrayBuffer()
        if (file.name.toLowerCase().endsWith('.hex')) {
          const parsed = parseIntelHex(new TextDecoder().decode(buf))
          next.push({ name: file.name, address: parsed.address, bytes: parsed.bytes })
        } else {
          next.push({ name: file.name, address: parseAddress(manualAddress), bytes: new Uint8Array(buf) })
        }
      } catch (err) {
        notify(`读取 ${file.name} 失败: ${String(err)}`, 'error')
      }
    }
    setManualFiles(next)
  }

  const flash = async (): Promise<void> => {
    if (!targets.length) {
      notify(IS_FLASH ? '请先导入 .bin 或 .hex 固件文件' : '没有可烧录的固件，请先在「编写固件」中编译', 'error')
      return
    }
    if (serialManager.monitoring) await serialManager.stopMonitor()
    setFlashing(true)
    setProgress(0)
    setFlashLog([])
    setStage('connect')
    try {
      const files = manualFiles.length
        ? manualFiles.map((f) => ({ name: f.name, address: f.address, data: f.bytes }))
        : buildTargets.map((t) => {
            const artifact = lastBuild!.artifacts.find((a) => a.name === t.name)!
            return { name: t.name, address: t.address, data: base64ToBytes(artifact.base64) }
          })
      const chip = await serialManager.flash(files, {
        baudrate,
        eraseAll,
        onLog: (line) => pushLog(line),
        onProgress: (written, total) => setProgress(total ? Math.round((written / total) * 100) : 0),
        onStage: (s) => setStage(s)
      })
      notify(`烧录成功 · ${chip}`, 'success')
      setProgress(100)
      setStage('done')
    } catch (err) {
      const se = err instanceof SerialError ? err : null
      const msg = se?.detail.message ?? String(err)
      const hint = se?.detail.hint
      notify(`烧录失败: ${msg}`, 'error')
      if (hint) pushLog(`提示: ${hint}`)
      pushLog(msg)
    } finally {
      setFlashing(false)
    }
  }

  const startMonitor = async (): Promise<void> => {
    setMonitoring(true)
    setMonitorData('')
    try {
      await serialManager.openMonitor(monitorBaud, (text) => {
        setMonitorData((prev) => (prev + text).slice(-30000))
      })
    } catch (err) {
      notify(`打开串口失败: ${String(err)}`, 'error')
      setMonitoring(false)
    }
  }

  const stopMonitor = async (): Promise<void> => {
    await serialManager.stopMonitor()
    setMonitoring(false)
  }

  const send = async (): Promise<void> => {
    if (!sendText.trim()) return
    try {
      await serialManager.send(sendText + '\n')
      setSendText('')
    } catch (err) {
      notify(`发送失败: ${String(err)}`, 'error')
    }
  }

  // ============== 自动检测与纳管 ==============
  const [detecting, setDetecting] = useState(false)
  const [chipInfo, setChipInfo] = useState<ChipInfo | null>(null)
  const [firmwareStatus, setFirmwareStatus] = useState<'novaforge' | 'third-party' | 'unknown'>('unknown')
  const [boardingOpen, setBoardingOpen] = useState(false)
  const [boardingStep, setBoardingStep] = useState(0)
  const [boardingBusy, setBoardingBusy] = useState(false)
  const [backupBin, setBackupBin] = useState<Uint8Array | null>(null)
  const [extractedConfig, setExtractedConfig] = useState<ReturnType<typeof scanExtractableConfig> | null>(null)
  const [onBoardResult, setOnBoardResult] = useState<{ chip: string; backupSize: number } | null>(null)

  const autoDetect = async (): Promise<void> => {
    setDetecting(true)
    setChipInfo(null)
    setFirmwareStatus('unknown')
    setFlashLog([])
    pushLog('自动检测开发板…')
    try {
      const port = serialManager.hasPort ? null : await serialManager.pickPort()
      if (port) {
        const info = await describePort(port)
        setPortLabel(info.label)
      }
      const info = await serialManager.readChipInfo({
        baudrate,
        onLog: (line) => pushLog(line)
      })
      setChipInfo(info)
      pushLog(`检测成功: ${info.chip} (${info.flashSizeLabel}) MAC ${info.mac}`)

      // 读取前 4KB 判断是否 NovaForge 固件
      try {
        const probe = await serialManager.readFlash(0x0, 0x1000, { baudrate })
        const isNova = isNovaForgeFirmware(probe)
        setFirmwareStatus(isNova ? 'novaforge' : 'third-party')
        pushLog(`固件检测: ${isNova ? 'NovaForge 官方固件' : '第三方固件'}`)
      } catch {
        pushLog('固件识别跳过：读取分区表失败')
      }

      notify(`检测成功 · ${info.chip}`, 'success')
    } catch (err) {
      const se = err instanceof SerialError ? err : null
      notify(`检测失败: ${se?.detail.message ?? String(err)}`, 'error')
      if (se?.detail.hint) pushLog(`提示: ${se.detail.hint}`)
    } finally {
      setDetecting(false)
    }
  }

  const startBoarding = (): void => {
    if (!chipInfo) return
    setBoardingOpen(true)
    setBoardingStep(0)
    setBackupBin(null)
    setExtractedConfig(null)
    setOnBoardResult(null)
  }

  const boardingStepNext = async (): Promise<void> => {
    if (!chipInfo) return
    setBoardingBusy(true)
    try {
      // Step 1: 备份
      if (boardingStep === 0) {
        const flashSize = chipInfo.flashSizeBytes || 4 * 1024 * 1024
        pushLog(`备份原固件 (${flashSize / 1024 / 1024} MB)…`)
        const bin = await serialManager.readFlash(0x0, flashSize, {
          baudrate,
          onLog: (line) => pushLog(line),
          onProgress: (read, total) => setProgress(total ? Math.round((read / total) * 33) : 0)
        })
        setBackupBin(bin)
        const config = scanExtractableConfig(bin) ?? {}
        setExtractedConfig(config)
        pushLog(`备份完成: ${bin.length} 字节`)
        if (config.ssid || config.haUrl || config.deviceName) {
          pushLog(`迁移配置: SSID=${config.ssid ?? '无'} HA=${config.haUrl ?? '无'} 设备名=${config.deviceName ?? '无'}`)
        }
        setBoardingStep(1)
        return
      }
      // Step 2: 下载备份
      if (boardingStep === 1 && backupBin && chipInfo.flashSizeBytes) {
        const digest = await sha256(backupBin)
        const meta = buildMeta(
          'backup',
          chipInfo.chip,
          chipInfo.flashSizeBytes,
          chipInfo.mac,
          0x0,
          backupBin,
          digest
        )
        downloadBackup(backupBin, meta)
        notify('备份已下载到本地', 'success')
        setBoardingStep(2)
        return
      }
      // Step 3: 选择/生成官方固件 + 编译
      if (boardingStep === 2) {
        pushLog('生成 NovaForge 官方固件模板…')
        // 根据芯片匹配 BOARDS 列表
        const matchedBoard = BOARDS.find((b) =>
          b.family === 'esp32' && chipInfo.chip.toLowerCase().includes(b.chip.toLowerCase())
        ) ?? BOARDS.find((b) => b.family === 'esp32')
        if (matchedBoard) {
          switchBoard(project.id, matchedBoard.id)
          pushLog(`匹配板型: ${matchedBoard.name}`)
        }
        // 用当前项目编译
        const source = buildFirmware(project, matchedBoard ?? board)
        const build = await window.api.build({
          projectId: project.id,
          projectName: project.name ?? 'novaforge',
          fqbn: matchedBoard?.fqbn ?? board.fqbn ?? '',
          coreIds: matchedBoard?.coreId ? [matchedBoard.coreId] : board.coreId ? [board.coreId] : [],
          code: source
        })
        const errors = parseBuildErrors(build.output)
        setLastBuild({ ...build, errors })
        if (!build.success) {
          notify('官方固件编译失败，请检查 AI 修复', 'error')
          setBoardingBusy(false)
          return
        }
        pushLog(`官方固件编译完成: ${(build.durationMs / 1000).toFixed(1)}s`)
        setBoardingStep(3)
        return
      }
      // Step 4: 烧录官方固件（擦除 + 写入）
      if (boardingStep === 3) {
        const targetsNow = resolveFlashTargets(board, lastBuild?.artifacts ?? [])
        const files = targetsNow.length
          ? targetsNow.map((t) => {
              const a = (lastBuild?.artifacts ?? []).find((x) => x.name === t.name)
              if (!a) return null
              return { name: t.name, address: t.address, data: base64ToBytes(a.base64) }
            }).filter((f): f is { name: string; address: number; data: Uint8Array } => !!f)
          : []
        if (!files.length) {
          notify('没有可烧录的固件产物', 'error')
          setBoardingBusy(false)
          return
        }
        pushLog('擦除并写入官方固件…')
        await serialManager.flash(files, {
          baudrate,
          eraseAll: true,
          onLog: (line) => pushLog(line),
          onProgress: (written, total) => setProgress(total ? 33 + Math.round((written / total) * 67) : 100),
          onStage: (s) => setStage(s)
        })
        pushLog('烧录完成，设备已重启')
        setOnBoardResult({ chip: chipInfo.chip, backupSize: backupBin?.length ?? 0 })
        setBoardingStep(4)
        return
      }
    } catch (err) {
      const se = err instanceof SerialError ? err : null
      notify(`纳管失败: ${se?.detail.message ?? String(err)}`, 'error')
      if (se?.detail.hint) pushLog(`提示: ${se.detail.hint}`)
    } finally {
      setBoardingBusy(false)
    }
  }

  if (board.family === 'linux-sbc') {
    return (
      <div className="stack">
        <div className="notice">
          {board.name} 运行 Linux，不需要烧录固件。请使用 SSH 部署程序；串口监视器仅适用于 USB 转串口设备。
        </div>
        <section className="panel">
          <div className="section-head"><h3>串口监视器</h3></div>
          <MonitorPanel
            monitoring={monitoring} monitorBaud={monitorBaud} setMonitorBaud={setMonitorBaud}
            start={startMonitor} stop={stopMonitor} data={monitorData}
            sendText={sendText} setSendText={setSendText} send={send} clear={() => setMonitorData('')}
          />
        </section>
      </div>
    )
  }

  if (board.family === 'avr') {
    return <AvrFlashPage board={board} project={project} lastBuild={lastBuild} navigate={navigate} notify={notify} />
  }

  const stageIdx = STAGE_ORDER.indexOf(stage)
  const totalStages = STAGE_ORDER.length

  return (
    <div className="device-layout">
      <div className="firmware-main">
        {/* 自动检测 + 纳管卡片 */}
        {!IS_FLASH && board.family === 'esp32' && (
          <section className="panel">
            <div className="section-head">
              <h3>自动检测与纳管</h3>
              <span className="muted small">连上任意 ESP32 开发板，识别芯片 → 备份原固件 → 刷官方固件</span>
            </div>
            <div className="auto-detect-row">
              <button className="btn primary" onClick={() => void autoDetect()} disabled={detecting || flashing}>
                {detecting ? '检测中…' : chipInfo ? '重新检测' : '自动检测开发板'}
              </button>
              {chipInfo && (
                <>
                  <span className="chip-badge">{chipInfo.chip} · {chipInfo.flashSizeLabel}</span>
                  <span className="chip-mac mono">{chipInfo.mac}</span>
                  <span className={`firmware-badge ${firmwareStatus}`}>
                    {firmwareStatus === 'novaforge' ? 'NovaForge 官方固件' : firmwareStatus === 'third-party' ? '第三方固件' : '未知'}
                  </span>
                  <button className="btn ghost" onClick={startBoarding} disabled={boardingBusy || !chipInfo}>
                    开始纳管 →
                  </button>
                </>
              )}
            </div>
          </section>
        )}

        <section className="panel">
          <div className="section-head">
            <h3>烧录固件</h3>
            <span className={`badge ${targets.length ? 'ok' : ''}`}>
              {targets.length ? `${targets.length} 个镜像分区` : IS_FLASH ? '尚未导入' : '尚未编译'}
            </span>
          </div>

          {/* 七段进度条 */}
          {flashing && (
            <div className="stage-progress">
              {STAGE_ORDER.map((s, i) => (
                <div key={s} className={`stage-node ${i < stageIdx ? 'done' : i === stageIdx ? 'active' : ''}`}>
                  <span className="stage-num">{i + 1}</span>
                  <span className="stage-label">{STAGE_LABELS[s]}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flash-config">
            <div className="field">
              <span>串口设备</span>
              <div className="inline-row">
                <span className="port-label">{portLabel}</span>
                <button className="btn ghost small" onClick={() => void pickPort()} disabled={flashing}>
                  选择串口
                </button>
              </div>
              <div className="inline-row">
                <span className="muted small">
                  {systemPorts.length > 0
                    ? `系统串口：${systemPorts.map((p) => p.address).join('、')}`
                    : '未检测到系统串口，请检查驱动和 USB 数据线'}
                </span>
                <button className="btn ghost small" onClick={() => void refreshSystemPorts()} disabled={flashing}>
                  刷新
                </button>
              </div>
            </div>
            <div className="field">
              <span>烧录波特率</span>
              <select value={baudrate} onChange={(e) => setBaudrate(Number(e.target.value))} disabled={flashing}>
                <option value={115200}>115200（兼容性最好）</option>
                <option value={460800}>460800（推荐）</option>
                <option value={921600}>921600（高速）</option>
              </select>
            </div>
            <label className="checkbox">
              <input type="checkbox" checked={eraseAll} onChange={(e) => setEraseAll(e.target.checked)} disabled={flashing} />
              先擦除整片 Flash（会清除设备中已有数据）
            </label>
          </div>

          {IS_FLASH && (
            <div className="field" style={{ marginBottom: 12 }}>
              <span>导入固件文件（.bin / .hex）</span>
              <div className="inline-row">
                <label className="btn ghost small" style={{ cursor: 'pointer' }}>
                  选择文件
                  <input type="file" accept=".bin,.hex" multiple style={{ display: 'none' }}
                    onChange={(e) => { void pickFirmware(e.target.files).then(() => { e.target.value = '' }) }} />
                </label>
                <input className="input" style={{ width: 140 }} value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)} placeholder="BIN 烧录地址"
                  title="仅 .bin 文件使用，.hex 自动读取地址" />
                {manualFiles.length > 0 && (
                  <button className="btn ghost small" onClick={() => setManualFiles([])}>清空导入</button>
                )}
              </div>
              <div className="muted small">.bin 按左侧地址写入（合并镜像用 0x0），.hex 自动识别起始地址。</div>
            </div>
          )}

          {targets.length > 0 && (
            <div className="target-table">
              {targets.map((t) => (
                <div className="target-row" key={t.name}>
                  <span className="mono">{addressHex(t.address)}</span>
                  <span>{t.name}</span>
                  <span className="muted">{(t.size / 1024).toFixed(1)} KB</span>
                </div>
              ))}
            </div>
          )}

          {!targets.length && (
            <div className="empty-inline">
              {IS_FLASH ? '还没有可烧录的固件。请在上方导入 .bin 或 .hex 文件。' : (
                <>
                  还没有可烧录的固件。
                  <button className="link" onClick={() => navigate('firmware')}>去编写并编译 →</button>
                </>
              )}
            </div>
          )}

          {board.family === 'rp2040' && (
            <div className="notice">RP2040 采用 UF2 拖放烧录：编译后将 .uf2 文件复制到 BOOTSEL 磁盘。自动 UF2 写入将在后续版本提供。</div>
          )}

          <div className="build-actions">
            <button className="btn primary" onClick={() => void flash()} disabled={flashing || !targets.length}>
              {flashing ? `烧录中 ${progress}%` : '开始烧录'}
            </button>
            <button className="btn ghost" onClick={() => navigate('control')} disabled={flashing}>烧录完成去控制</button>
          </div>

          {(flashing || flashLog.length > 0) && (
            <>
              <div className="progress">
                <div className="progress-bar" style={{ width: `${progress}%` }} />
              </div>
              <div className="console" ref={flashConsoleRef}>
                {flashLog.map((line, i) => (
                  <div className="console-line" key={i}>{line || ' '}</div>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="panel">
          <div className="section-head">
            <h3>串口监视器</h3>
            <span className="muted small">用于查看设备启动日志与调试输出</span>
          </div>
          <MonitorPanel
            monitoring={monitoring} monitorBaud={monitorBaud} setMonitorBaud={setMonitorBaud}
            start={startMonitor} stop={stopMonitor} data={monitorData}
            sendText={sendText} setSendText={setSendText} send={send} clear={() => setMonitorData('')}
          />
        </section>
      </div>

      <aside className="firmware-side">
        <section className="panel">
          <div className="section-head"><h3>设备信息</h3></div>
          <div className="kv">
            <div><span>开发板</span><b>{board.name}</b></div>
            <div><span>芯片</span><b>{board.chip}</b></div>
            <div><span>烧录方式</span><b>{board.flashMethod.toUpperCase()}</b></div>
            <div><span>项目</span><b>{project.name}</b></div>
            <div><span>Wi-Fi</span><b>{project.net.ssid || '未配置'}</b></div>
            <div><span>引脚功能</span><b>{project.pins.length} 个</b></div>
          </div>
          {chipInfo && (
            <div className="kv" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-soft)' }}>
              <div><span>检测芯片</span><b>{chipInfo.chip}</b></div>
              <div><span>Flash</span><b>{chipInfo.flashSizeLabel}</b></div>
              <div><span>MAC</span><b className="mono">{chipInfo.mac}</b></div>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="section-head"><h3>烧录提示</h3></div>
          <ul className="tips">
            <li>ESP32 首次烧录若报连接失败，按住 BOOT 键再点开始，松开后重新尝试。</li>
            <li>烧录前请关闭占用串口的其他软件（如 Arduino IDE、串口助手）。</li>
            <li>{board.usb}</li>
          </ul>
        </section>
      </aside>

      {/* 纳管向导 Modal */}
      {boardingOpen && chipInfo && (
        <div className="modal-backdrop" onClick={() => !boardingBusy && setBoardingOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>开发板纳管向导 · {chipInfo.chip}</h3>
              <button className="icon-btn" onClick={() => !boardingBusy && setBoardingOpen(false)} disabled={boardingBusy}>×</button>
            </div>
            <div className="modal-body">
              {boardingStep === 0 && (
                <BoardingStep0 chipInfo={chipInfo} firmwareStatus={firmwareStatus} extractedConfig={extractedConfig} />
              )}
              {boardingStep === 1 && backupBin && (
                <BoardingStep1 chipInfo={chipInfo} backupSize={backupBin.length} extractedConfig={extractedConfig} />
              )}
              {boardingStep === 2 && (
                <div className="flow-step-body">
                  <p>下一步将：</p>
                  <ol>
                    <li>根据检测到的芯片匹配 NovaForge 官方固件模板</li>
                    <li>编译固件（约 30~90 秒）</li>
                    <li>擦除整片 Flash 并写入官方固件</li>
                  </ol>
                  <p className="muted small">原固件已下载到你的电脑，可随时刷回。</p>
                </div>
              )}
              {boardingStep === 3 && (
                <div className="flow-step-body">
                  <p>官方固件编译完成，准备写入开发板。</p>
                  <div className="notice">这将<strong>擦除整片 Flash</strong>，写入 NovaForge 官方固件。完成后开发板自动重启。</div>
                </div>
              )}
              {boardingStep === 4 && onBoardResult && (
                <div className="flow-step-body">
                  <div className="notice" style={{ background: 'rgba(52,214,172,0.08)', borderColor: 'rgba(52,214,172,0.3)', color: '#b8f7e7' }}>
                    ✓ 纳管完成！{onBoardResult.chip} 已成功刷入 NovaForge 官方固件，备份 {onBoardResult.backupSize} 字节已下载。
                  </div>
                  <p>下一步：进入「设备控制」连接 Wi-Fi 和 Home Assistant。</p>
                </div>
              )}
            </div>
            <div className="modal-actions">
              {boardingStep < 4 && (
                <>
                  <button className="btn ghost" onClick={() => !boardingBusy && setBoardingOpen(false)} disabled={boardingBusy}>
                    取消
                  </button>
                  <button className="btn primary" onClick={() => void boardingStepNext()} disabled={boardingBusy}>
                    {boardingBusy ? '进行中…' : boardingStep === 1 ? '下载备份 →' : boardingStep === 2 ? '生成并编译 →' : boardingStep === 3 ? '擦除并写入 →' : '开始备份 →'}
                  </button>
                </>
              )}
              {boardingStep === 4 && (
                <>
                  <button className="btn ghost" onClick={() => setBoardingOpen(false)}>关闭</button>
                  <button className="btn primary" onClick={() => { setBoardingOpen(false); navigate('control') }}>去控制 →</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BoardingStep0(props: { chipInfo: ChipInfo; firmwareStatus: string; extractedConfig: any }): React.ReactElement {
  const { chipInfo, firmwareStatus, extractedConfig } = props
  return (
    <div className="flow-step-body">
      <p>检测到：<b>{chipInfo.chip}</b> · Flash {chipInfo.flashSizeLabel} · MAC <span className="mono">{chipInfo.mac}</span></p>
      <p>当前固件：<b>{firmwareStatus === 'novaforge' ? 'NovaForge 官方固件' : firmwareStatus === 'third-party' ? '第三方固件' : '未知'}</b></p>
      <p>流程：</p>
      <ol>
        <li><b>完整备份原固件</b>（下载到本地，防止变砖）</li>
        <li><b>扫描可迁移配置</b>（WiFi SSID / HA 地址 / 设备名）</li>
        <li><b>生成并编译 NovaForge 官方固件</b></li>
        <li><b>擦除 + 写入</b> → 设备自动重启</li>
      </ol>
      {extractedConfig?.haUrl && (
        <div className="notice small">检测到可迁移配置：HA URL {extractedConfig.haUrl}</div>
      )}
    </div>
  )
}

function BoardingStep1(props: { chipInfo: ChipInfo; backupSize: number; extractedConfig: any }): React.ReactElement {
  const { chipInfo, backupSize, extractedConfig } = props
  return (
    <div className="flow-step-body">
      <div className="notice" style={{ background: 'rgba(52,214,172,0.08)', borderColor: 'rgba(52,214,172,0.3)', color: '#b8f7e7' }}>
        ✓ 备份完成：{backupSize.toLocaleString()} 字节 · 即将下载到你的电脑
      </div>
      {extractedConfig?.haUrl && (
        <p>检测到 Home Assistant 地址：<b>{extractedConfig.haUrl}</b>，将自动迁移到官方固件。</p>
      )}
      {!extractedConfig?.haUrl && <p>未检测到可迁移配置，官方固件将使用默认设置。</p>}
    </div>
  )
}

function BoardingStepBody() { return null }
export { BoardingStepBody }

// ==================== Monitor Panel ====================

function MonitorPanel(props: {
  monitoring: boolean; monitorBaud: number; setMonitorBaud: (v: number) => void
  start: () => Promise<void>; stop: () => Promise<void>
  data: string; sendText: string; setSendText: (v: string) => void; send: () => Promise<void>; clear: () => void
}): React.ReactElement {
  return (
    <>
      <div className="monitor-toolbar">
        <select value={props.monitorBaud} onChange={(e) => props.setMonitorBaud(Number(e.target.value))}>
          <option value={9600}>9600</option>
          <option value={115200}>115200（Arduino 默认）</option>
          <option value={230400}>230400</option>
          <option value={460800}>460800</option>
        </select>
        {props.monitoring ? (
          <button className="btn ghost small" onClick={() => void props.stop()}>停止监视</button>
        ) : (
          <button className="btn ghost small" onClick={() => void props.start()}>开始监视</button>
        )}
        <button className="btn ghost small" onClick={props.clear}>清空</button>
      </div>
      <pre className="monitor-output">{props.data || '串口输出会显示在这里…'}</pre>
      <div className="send-row">
        <input value={props.sendText} onChange={(e) => props.setSendText(e.target.value)}
          placeholder="向设备发送一行文本后回车"
          onKeyDown={(e) => { if (e.key === 'Enter') void props.send() }} />
        <button className="btn ghost small" onClick={() => void props.send()}>发送</button>
      </div>
    </>
  )
}

// ==================== AVR Flash ====================

function AvrFlashPage({
  board, project, lastBuild, navigate, notify
}: {
  board: import('../../../shared/types').Board
  project: import('../../../shared/types').Project
  lastBuild: BuildResult | null
  navigate: (r: RouteId) => void
  notify: (text: string, kind?: 'info' | 'error' | 'success') => void
}): React.ReactElement {
  const [ports, setPorts] = useState<SerialPortInfo[]>([])
  const [selectedPort, setSelectedPort] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadLog, setUploadLog] = useState<string[]>([])
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void window.api.listSerialPorts().then((list) => {
      setPorts(list)
      if (list.length > 0 && !selectedPort) setSelectedPort(list[0].address)
    })
  }, [])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [uploadLog])

  const refreshPorts = async (): Promise<void> => {
    const list = await window.api.listSerialPorts()
    setPorts(list)
    if (list.length > 0 && !selectedPort) setSelectedPort(list[0].address)
  }

  const hasHex = lastBuild?.success && lastBuild.artifacts.some((a) => a.name.endsWith('.hex'))

  const upload = async (): Promise<void> => {
    if (!selectedPort) { notify('请先选择串口', 'error'); return }
    if (!lastBuild || !hasHex) { notify('没有可烧录的固件，请先编译', 'error'); return }
    setUploading(true)
    setUploadLog([])
    try {
      const sketchDir = lastBuild.sketchPath.replace(/[/\\][^/\\]+\.ino$/, '')
      const res = await window.api.avrdudeUpload({ port: selectedPort, fqbn: board.fqbn!, sketchDir })
      setUploadLog((prev) => [...prev, res.log])
      notify(res.ok ? '烧录成功' : '烧录失败', res.ok ? 'success' : 'error')
    } catch (err) {
      notify(`烧录失败: ${String(err)}`, 'error')
      setUploadLog((prev) => [...prev, String(err)])
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="device-layout">
      <div className="firmware-main">
        <section className="panel">
          <div className="section-head">
            <h3>烧录固件（avrdude）</h3>
            <span className={`badge ${hasHex ? 'ok' : ''}`}>{hasHex ? '固件就绪' : '尚未编译'}</span>
          </div>
          <div className="flash-config">
            <div className="field">
              <span>串口设备</span>
              <div className="inline-row">
                <select value={selectedPort} onChange={(e) => setSelectedPort(e.target.value)} disabled={uploading} style={{ minWidth: 200 }}>
                  {ports.length === 0 && <option value="">未检测到串口</option>}
                  {ports.map((p) => <option key={p.address} value={p.address}>{p.label}</option>)}
                </select>
                <button className="btn ghost small" onClick={() => void refreshPorts()} disabled={uploading}>刷新</button>
              </div>
            </div>
          </div>
          {!hasHex && (
            <div className="empty-inline">
              {IS_FLASH ? '此开发板需要通过 arduino-cli 编译生成 .hex，请先使用 NovaForge Studio 编译固件。' : (
                <><>还没有可烧录的固件。</><button className="link" onClick={() => navigate('firmware')}>去编写并编译 →</button></>
              )}
            </div>
          )}
          {hasHex && (
            <div className="target-table">
              {lastBuild!.artifacts.filter((a) => a.name.endsWith('.hex')).map((a) => (
                <div className="target-row" key={a.name}>
                  <span>{a.name}</span>
                  <span className="muted">{(a.size / 1024).toFixed(1)} KB</span>
                </div>
              ))}
            </div>
          )}
          <div className="build-actions">
            <button className="btn primary" onClick={() => void upload()} disabled={uploading || !hasHex}>
              {uploading ? '烧录中…' : '开始烧录'}
            </button>
            <button className="btn ghost" onClick={() => navigate('control')} disabled={uploading}>烧录完成去控制</button>
          </div>
          {uploadLog.length > 0 && (
            <div className="console" ref={logRef}>
              {uploadLog.map((line, i) => <div className="console-line" key={i}>{line || ' '}</div>)}
            </div>
          )}
        </section>
        <section className="panel">
          <div className="section-head"><h3>串口监视器</h3></div>
          <div className="notice small">AVR 板烧录完成后可使用 Web Serial 串口监视器进行调试。</div>
        </section>
      </div>
      <aside className="firmware-side">
        <section className="panel">
          <div className="section-head"><h3>设备信息</h3></div>
          <div className="kv">
            <div><span>开发板</span><b>{board.name}</b></div>
            <div><span>芯片</span><b>{board.chip}</b></div>
            <div><span>烧录方式</span><b>avrdude</b></div>
            <div><span>项目</span><b>{project.name}</b></div>
            <div><span>FQBN</span><b className="mono">{board.fqbn}</b></div>
          </div>
        </section>
        <section className="panel">
          <div className="section-head"><h3>烧录提示</h3></div>
          <ul className="tips">
            <li>Arduino Uno/Nano 使用 USB-B 或 mini-USB 直连电脑。</li>
            <li>Arduino Mega 需要外接电源或 USB 供电。</li>
            <li>烧录前请关闭占用串口的其他软件（Arduino IDE、串口助手）。</li>
            <li>{board.usb}</li>
          </ul>
        </section>
      </aside>
    </div>
  )
}
