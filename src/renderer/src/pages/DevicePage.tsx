import { useEffect, useRef, useState } from 'react'
import { addressHex, base64ToBytes, resolveFlashTargets } from '../../../shared/flash'
import { serialManager, describePort } from '../lib/serial'
import { useApp } from '../store'
import type { SerialPortInfo } from '../../../shared/types'

type RouteId = 'workbench' | 'firmware' | 'device' | 'control' | 'ha' | 'settings'

export function DevicePage({ navigate }: { navigate: (r: RouteId) => void }): React.ReactElement | null {
  const { activeProject, activeBoard, lastBuild, notify } = useApp()
  const project = activeProject!
  const board = activeBoard!

  const [portLabel, setPortLabel] = useState('未选择串口')
  const [flashing, setFlashing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [flashLog, setFlashLog] = useState<string[]>([])
  const [baudrate, setBaudrate] = useState(460800)
  const [eraseAll, setEraseAll] = useState(false)
  const [monitoring, setMonitoring] = useState(false)
  const [monitorBaud, setMonitorBaud] = useState(115200)
  const [monitorData, setMonitorData] = useState('')
  const [sendText, setSendText] = useState('')
  const flashConsoleRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (flashConsoleRef.current) {
      flashConsoleRef.current.scrollTop = flashConsoleRef.current.scrollHeight
    }
  }, [flashLog, progress])

  useEffect(() => {
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
      setPortLabel(info.label)
      notify('串口设备已选择', 'success')
    } catch (err) {
      notify(`选择串口失败: ${String(err)}`, 'error')
    }
  }

  const targets = lastBuild?.success && lastBuild.artifacts.length
    ? resolveFlashTargets(board, lastBuild.artifacts)
    : []

  const flash = async (): Promise<void> => {
    if (!targets.length) {
      notify('没有可烧录的固件，请先在「编写固件」中编译', 'error')
      return
    }
    if (serialManager.monitoring) await serialManager.stopMonitor()
    setFlashing(true)
    setProgress(0)
    setFlashLog([])
    try {
      const files = targets.map((t) => {
        const artifact = lastBuild!.artifacts.find((a) => a.name === t.name)!
        return { name: t.name, address: t.address, data: base64ToBytes(artifact.base64) }
      })
      const chip = await serialManager.flash(files, {
        baudrate,
        eraseAll,
        onLog: (line) => setFlashLog((prev) => [...prev.slice(-200), line]),
        onProgress: (written, total) => setProgress(total ? Math.round((written / total) * 100) : 0)
      })
      notify(`烧录成功 · ${chip}`, 'success')
      setProgress(100)
    } catch (err) {
      notify(`烧录失败: ${String(err)}`, 'error')
      setFlashLog((prev) => [...prev, String(err)])
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

  if (board.family === 'linux-sbc') {
    return (
      <div className="stack">
        <div className="notice">
          {board.name} 运行 Linux，不需要烧录固件。请使用 SSH 部署程序；串口监视器仅适用于 USB 转串口设备。
        </div>
        <section className="panel">
          <div className="section-head">
            <h3>串口监视器</h3>
          </div>
          <MonitorPanel
            monitoring={monitoring}
            monitorBaud={monitorBaud}
            setMonitorBaud={setMonitorBaud}
            start={startMonitor}
            stop={stopMonitor}
            data={monitorData}
            sendText={sendText}
            setSendText={setSendText}
            send={send}
            clear={() => setMonitorData('')}
          />
        </section>
      </div>
    )
  }

  if (board.family === 'avr') {
    return <AvrFlashPage board={board} project={project} lastBuild={lastBuild} navigate={navigate} notify={notify} />
  }

  return (
    <div className="device-layout">
      <div className="firmware-main">
        <section className="panel">
          <div className="section-head">
            <h3>烧录固件</h3>
            <span className={`badge ${targets.length ? 'ok' : ''}`}>
              {targets.length ? `${targets.length} 个镜像分区` : '尚未编译'}
            </span>
          </div>

          <div className="flash-config">
            <div className="field">
              <span>串口设备</span>
              <div className="inline-row">
                <span className="port-label">{portLabel}</span>
                <button className="btn ghost small" onClick={() => void pickPort()} disabled={flashing}>
                  选择串口
                </button>
              </div>
            </div>
            <div className="field">
              <span>烧录波特率</span>
              <select
                value={baudrate}
                onChange={(e) => setBaudrate(Number(e.target.value))}
                disabled={flashing}
              >
                <option value={115200}>115200（兼容性最好）</option>
                <option value={460800}>460800（推荐）</option>
                <option value={921600}>921600（高速）</option>
              </select>
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={eraseAll}
                onChange={(e) => setEraseAll(e.target.checked)}
                disabled={flashing}
              />
              先擦除整片 Flash（会清除设备中已有数据）
            </label>
          </div>

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
              还没有可烧录的固件。<button className="link" onClick={() => navigate('firmware')}>去编写并编译 →</button>
              </div>
          )}

          {board.family === 'rp2040' && (
            <div className="notice">
              RP2040 采用 UF2 拖放烧录：编译后将 .uf2 文件复制到 BOOTSEL 磁盘。自动 UF2 写入将在后续版本提供。
            </div>
          )}

          <div className="build-actions">
            <button className="btn primary" onClick={() => void flash()} disabled={flashing || !targets.length}>
              {flashing ? `烧录中 ${progress}%` : '开始烧录'}
            </button>
            <button className="btn ghost" onClick={() => navigate('control')} disabled={flashing}>
              烧录完成去控制
            </button>
          </div>

          {(flashing || flashLog.length > 0) && (
            <>
              <div className="progress">
                <div className="progress-bar" style={{ width: `${progress}%` }} />
              </div>
              <div className="console" ref={flashConsoleRef}>
                {flashLog.map((line, i) => (
                  <div className="console-line" key={i}>
                    {line || ' '}
                  </div>
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
            monitoring={monitoring}
            monitorBaud={monitorBaud}
            setMonitorBaud={setMonitorBaud}
            start={startMonitor}
            stop={stopMonitor}
            data={monitorData}
            sendText={sendText}
            setSendText={setSendText}
            send={send}
            clear={() => setMonitorData('')}
          />
        </section>
      </div>

      <aside className="firmware-side">
        <section className="panel">
          <div className="section-head">
            <h3>设备信息</h3>
          </div>
          <div className="kv">
            <div>
              <span>开发板</span>
              <b>{board.name}</b>
            </div>
            <div>
              <span>芯片</span>
              <b>{board.chip}</b>
            </div>
            <div>
              <span>烧录方式</span>
              <b>{board.flashMethod.toUpperCase()}</b>
            </div>
            <div>
              <span>项目</span>
              <b>{project.name}</b>
            </div>
            <div>
              <span>Wi-Fi</span>
              <b>{project.net.ssid || '未配置'}</b>
            </div>
            <div>
              <span>引脚功能</span>
              <b>{project.pins.length} 个</b>
            </div>
          </div>
        </section>
        <section className="panel">
          <div className="section-head">
            <h3>烧录提示</h3>
          </div>
          <ul className="tips">
            <li>ESP32 首次烧录若报连接失败，按住 BOOT 键再点开始，松开后重新尝试。</li>
            <li>烧录前请关闭占用串口的其他软件（如 Arduino IDE、串口助手）。</li>
            <li>{board.usb}</li>
          </ul>
        </section>
      </aside>
    </div>
  )
}

function MonitorPanel(props: {
  monitoring: boolean
  monitorBaud: number
  setMonitorBaud: (v: number) => void
  start: () => Promise<void>
  stop: () => Promise<void>
  data: string
  sendText: string
  setSendText: (v: string) => void
  send: () => Promise<void>
  clear: () => void
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
          <button className="btn ghost small" onClick={() => void props.stop()}>
            停止监视
          </button>
        ) : (
          <button className="btn ghost small" onClick={() => void props.start()}>
            开始监视
          </button>
        )}
        <button className="btn ghost small" onClick={props.clear}>
          清空
        </button>
      </div>
      <pre className="monitor-output">{props.data || '串口输出会显示在这里…'}</pre>
      <div className="send-row">
        <input
          value={props.sendText}
          onChange={(e) => props.setSendText(e.target.value)}
          placeholder="向设备发送一行文本后回车"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void props.send()
          }}
        />
        <button className="btn ghost small" onClick={() => void props.send()}>
          发送
        </button>
      </div>
    </>
  )
}

function AvrFlashPage({
  board,
  project,
  lastBuild,
  navigate,
  notify
}: {
  board: import('../../../shared/types').Board
  project: import('../../../shared/types').Project
  lastBuild: import('../../../shared/types').BuildResult | null
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
    if (!selectedPort) {
      notify('请先选择串口', 'error')
      return
    }
    if (!lastBuild || !hasHex) {
      notify('没有可烧录的固件，请先编译', 'error')
      return
    }
    setUploading(true)
    setUploadLog([])
    try {
      const sketchDir = lastBuild.sketchPath.replace(/[/\\][^/\\]+\.ino$/, '')
      const res = await window.api.avrdudeUpload({
        port: selectedPort,
        fqbn: board.fqbn!,
        sketchDir
      })
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
            <span className={`badge ${hasHex ? 'ok' : ''}`}>
              {hasHex ? '固件就绪' : '尚未编译'}
            </span>
          </div>

          <div className="flash-config">
            <div className="field">
              <span>串口设备</span>
              <div className="inline-row">
                <select
                  value={selectedPort}
                  onChange={(e) => setSelectedPort(e.target.value)}
                  disabled={uploading}
                  style={{ minWidth: 200 }}
                >
                  {ports.length === 0 && <option value="">未检测到串口</option>}
                  {ports.map((p) => (
                    <option key={p.address} value={p.address}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <button className="btn ghost small" onClick={() => void refreshPorts()} disabled={uploading}>
                  刷新
                </button>
              </div>
            </div>
          </div>

          {!hasHex && (
            <div className="empty-inline">
              还没有可烧录的固件。
              <button className="link" onClick={() => navigate('firmware')}>
                去编写并编译 →
              </button>
            </div>
          )}

          {hasHex && (
            <div className="target-table">
              {lastBuild!.artifacts
                .filter((a) => a.name.endsWith('.hex'))
                .map((a) => (
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
            <button className="btn ghost" onClick={() => navigate('control')} disabled={uploading}>
              烧录完成去控制
            </button>
          </div>

          {uploadLog.length > 0 && (
            <div className="console" ref={logRef}>
              {uploadLog.map((line, i) => (
                <div className="console-line" key={i}>
                  {line || ' '}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="section-head">
            <h3>串口监视器</h3>
          </div>
          <div className="notice small">
            AVR 板烧录完成后可使用 Web Serial 串口监视器进行调试。
          </div>
        </section>
      </div>

      <aside className="firmware-side">
        <section className="panel">
          <div className="section-head">
            <h3>设备信息</h3>
          </div>
          <div className="kv">
            <div>
              <span>开发板</span>
              <b>{board.name}</b>
            </div>
            <div>
              <span>芯片</span>
              <b>{board.chip}</b>
            </div>
            <div>
              <span>烧录方式</span>
              <b>avrdude</b>
            </div>
            <div>
              <span>项目</span>
              <b>{project.name}</b>
            </div>
            <div>
              <span>FQBN</span>
              <b className="mono">{board.fqbn}</b>
            </div>
          </div>
        </section>
        <section className="panel">
          <div className="section-head">
            <h3>烧录提示</h3>
          </div>
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
