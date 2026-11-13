import { useEffect, useMemo, useRef, useState } from 'react'
import { deviceId } from '../../../shared/firmware'
import { useApp } from '../store'

interface DeviceState {
  ok: boolean
  device?: string
  pins?: { key: string; gpio: number; value: number }[]
}

export function Control(): React.ReactElement {
  const { activeProject, activeBoard, updateProject, notify } = useApp()
  const project = activeProject!
  const board = activeBoard!

  const suggested = useMemo(() => `http://${deviceId(project)}.local`, [project.id])
  const [endpoint, setEndpoint] = useState(suggested)
  const [connected, setConnected] = useState(false)
  const [state, setState] = useState<DeviceState | null>(null)
  const [error, setError] = useState('')
  const [ssid, setSsid] = useState(project.net.ssid)
  const [pass, setPass] = useState(project.net.password)
  const polling = useRef<number | null>(null)

  useEffect(() => {
    setEndpoint(suggested)
    setSsid(project.net.ssid)
    setPass(project.net.password)
    setConnected(false)
    setState(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id])

  const request = async (path: string): Promise<DeviceState | null> => {
    const base = endpoint.replace(/\/$/, '')
    const res = await window.api.httpRequest(`${base}${path}`)
    if (!res.ok) {
      setError(res.error ?? `HTTP ${res.status}`)
      setConnected(false)
      return null
    }
    try {
      return JSON.parse(res.body) as DeviceState
    } catch {
      setError('设备返回了无法解析的数据')
      return null
    }
  }

  const connect = async (): Promise<void> => {
    setError('')
    const data = await request('/api/state')
    if (data) {
      setState(data)
      setConnected(true)
      notify('已连接到设备', 'success')
    }
  }

  const refresh = async (): Promise<void> => {
    const data = await request('/api/state')
    if (data) setState(data)
  }

  useEffect(() => {
    if (!connected) {
      if (polling.current) window.clearInterval(polling.current)
      polling.current = null
      return
    }
    polling.current = window.setInterval(() => void refresh(), 2500)
    return () => {
      if (polling.current) window.clearInterval(polling.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, endpoint])

  const toggle = async (key: string, value: number): Promise<void> => {
    const data = await request(`/api/set?key=${encodeURIComponent(key)}&value=${value}`)
    if (data) setState(data)
  }

  const saveNetwork = (): void => {
    updateProject(project.id, { net: { ...project.net, ssid, password: pass } })
    notify('网络配置已保存，重新编译烧录后生效', 'success')
  }

  const pinState = (key: string): number | null => {
    const found = state?.pins?.find((p) => p.key === key)
    return found ? found.value : null
  }

  return (
    <div className="control-layout">
      <div className="firmware-main">
        <section className="panel">
          <div className="section-head">
            <h3>连接设备</h3>
            <span className={`badge ${connected ? 'ok' : ''}`}>{connected ? '在线' : '未连接'}</span>
          </div>
          <div className="inline-row endpoint-row">
            <input
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="http://设备IP 或 http://主机名.local"
            />
            <button className="btn primary" onClick={() => void connect()}>
              连接
            </button>
            <button className="btn ghost" onClick={() => void refresh()} disabled={!connected}>
              刷新
            </button>
          </div>
          <div className="muted small">
            设备需与电脑在同一局域网。烧录完成后串口监视器会打印设备 IP；主机名格式为
            <span className="mono"> {deviceId(project)}.local</span>。
          </div>
          {error && <div className="error-line">连接失败：{error}</div>}
          {state?.device && <div className="muted small mono">设备标识：{state.device}</div>}
        </section>

        <section className="panel">
          <div className="section-head">
            <h3>引脚控制</h3>
            <span className="muted small">{project.pins.length} 个功能</span>
          </div>
          {project.pins.length === 0 ? (
            <div className="empty-inline">请先在「编写固件」中定义引脚功能。</div>
          ) : (
            <div className="control-grid">
              {project.pins.map((pin) => {
                const value = pinState(pin.label)
                return (
                  <div className="control-tile" key={pin.id}>
                    <div className="control-head">
                      <span className="control-name">{pin.label}</span>
                      <span className="mono muted">GPIO {pin.gpio}</span>
                    </div>
                    <div className="control-body">
                      <span className={`state-dot ${value === 1 ? 'on' : ''}`} />
                      <span className="control-value">
                        {value === null ? '未知' : value === 1 ? '开启' : '关闭'}
                      </span>
                    </div>
                    {pin.mode === 'output' ? (
                      <div className="control-actions">
                        <button
                          className="btn small primary"
                          disabled={!connected}
                          onClick={() => void toggle(pin.label, 1)}
                        >
                          开启
                        </button>
                        <button
                          className="btn small ghost"
                          disabled={!connected}
                          onClick={() => void toggle(pin.label, 0)}
                        >
                          关闭
                        </button>
                      </div>
                    ) : (
                      <div className="muted small">输入状态由设备上报</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {state?.pins && (
          <section className="panel">
            <div className="section-head">
              <h3>设备原始状态</h3>
            </div>
            <pre className="raw-json">{JSON.stringify(state, null, 2)}</pre>
          </section>
        )}
      </div>

      <aside className="firmware-side">
        <section className="panel">
          <div className="section-head">
            <h3>设备 Wi-Fi</h3>
            <span className="muted small">烧录进固件</span>
          </div>
          <div className="form compact">
            <label className="field">
              <span>Wi-Fi 名称 (2.4GHz)</span>
              <input value={ssid} onChange={(e) => setSsid(e.target.value)} placeholder="家庭 Wi-Fi 名称" />
            </label>
            <label className="field">
              <span>Wi-Fi 密码</span>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="Wi-Fi 密码"
              />
            </label>
            <button className="btn ghost small full" onClick={saveNetwork}>
              保存配置
            </button>
            <div className="muted small">ESP32 / Pico W 仅支持 2.4GHz 频段，修改后需重新编译烧录。</div>
          </div>
        </section>

        <section className="panel">
          <div className="section-head">
            <h3>运行前提</h3>
          </div>
          <ul className="tips">
            <li>固件通过「{board.name}」的 Wi-Fi 接入局域网。</li>
            <li>已烧录最新固件，且设备与电脑处在同一路由器下。</li>
            <li>控制接口为 GET /api/set?key=功能名&amp;value=0|1。</li>
            <li>Home Assistant 侧无需再刷第三方固件，详见 HA 页面。</li>
          </ul>
        </section>
      </aside>
    </div>
  )
}
