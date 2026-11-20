import { useEffect, useState } from 'react'
import { Modal } from '../components/Modal'
import { BOARDS, getBoard } from '../../../shared/boards'
import { IS_FLASH } from '../../../shared/product'
import type { ToolchainStatus } from '../../../shared/types'
import { useApp } from '../store'

type RouteId = 'workbench' | 'firmware' | 'device' | 'control' | 'ha' | 'settings'

export function Workbench({ navigate }: { navigate: (r: RouteId) => void }): React.ReactElement {
  const { projects, activeProject, setActiveId, createProject, deleteProject, notify } = useApp()
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('我的第一个设备')
  const [boardId, setBoardId] = useState('esp32-devkit-v1')
  const [mode, setMode] = useState<'code' | 'blocks'>('code')
  const [status, setStatus] = useState<ToolchainStatus | null>(null)

  useEffect(() => {
    window.api
      .toolchainStatus()
      .then(setStatus)
      .catch(() => setStatus(null))
  }, [])

  const submit = (): void => {
    if (!name.trim()) {
      notify('请填写项目名称', 'error')
      return
    }
    const project = createProject(name.trim(), boardId, mode)
    setShowCreate(false)
    notify(`已创建项目「${project.name}」`, 'success')
    navigate(IS_FLASH ? 'device' : 'firmware')
  }

  const toolchainLabel = !status
    ? '检测中…'
    : !status.cliPath
      ? '未安装 arduino-cli'
      : status.ready
        ? `已就绪 · ${status.cliVersion ?? ''}`
        : '已安装 CLI，缺少核心'

  return (
    <div className="stack">
      <section className="hero panel">
        <div className="hero-copy">
          <span className="eyebrow">ESP32 · 树莓派 · 真实硬件</span>
          <h2>{IS_FLASH ? '把固件烧进真实设备' : '把代码变成会动、会亮的设备'}</h2>
          <p>
            {IS_FLASH
              ? '选择开发板与项目，一键编译并通过数据线烧录固件，实时查看串口输出。联网后用 Wi-Fi 直接控制引脚，并可被 Home Assistant 自动发现。'
              : '选择开发板，写代码或用图形化积木搭逻辑，一键编译固件并通过数据线烧录。联网后用 Wi-Fi 直接控制引脚，并可被 Home Assistant 自动发现。'}
          </p>
          <div className="hero-actions">
            <button className="btn primary" onClick={() => setShowCreate(true)}>
              新建项目
            </button>
            <button
              className="btn ghost"
              onClick={() => (activeProject ? navigate(IS_FLASH ? 'device' : 'firmware') : setShowCreate(true))}
            >
              {activeProject ? (IS_FLASH ? '继续烧录' : '继续编写固件') : IS_FLASH ? '开始烧录' : '开始编写'}
            </button>
          </div>
        </div>
        <div className="hero-stats">
          <div className="stat">
            <span className="stat-value">{BOARDS.length}</span>
            <span className="stat-label">支持开发板</span>
          </div>
          <div className="stat">
            <span className="stat-value">{projects.length}</span>
            <span className="stat-label">本地项目</span>
          </div>
          <div className="stat">
            <span className="stat-value small">{toolchainLabel}</span>
            <span className="stat-label">编译工具链</span>
          </div>
          <button className="btn ghost small" onClick={() => navigate('settings')}>
            管理工具链
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <h3>项目</h3>
          <span className="muted">项目保存在本机，不会上传</span>
        </div>
        {projects.length === 0 ? (
          <div className="empty-inline">
            还没有项目。点击「新建项目」，选择一个开发板开始。
          </div>
        ) : (
          <div className="project-grid">
            {projects.map((p) => {
              const board = getBoard(p.boardId)
              return (
                <div key={p.id} className={`project-card ${activeProject?.id === p.id ? 'selected' : ''}`}>
                  <div className="project-title">
                    <h4>{p.name}</h4>
                    <span className="badge">{p.mode === 'code' ? '代码模式' : '图形化'}</span>
                  </div>
                  <div className="project-meta">
                    <span>{board?.name ?? '未知开发板'}</span>
                    <span className="dot-sep" />
                    <span>{p.pins.length} 个引脚功能</span>
                  </div>
                  <div className="project-meta dim">
                    更新于 {new Date(p.updatedAt).toLocaleString('zh-CN')}
                  </div>
                  <div className="project-actions">
                    <button
                      className="btn small primary"
                      onClick={() => {
                        setActiveId(p.id)
                        navigate(IS_FLASH ? 'device' : 'firmware')
                      }}
                    >
                      {IS_FLASH ? '烧录' : '打开'}
                    </button>
                    {!IS_FLASH && (
                      <button
                        className="btn small ghost"
                        onClick={() => {
                          setActiveId(p.id)
                          navigate('device')
                        }}
                      >
                        烧录
                      </button>
                    )}
                    <button
                      className="btn small danger"
                      onClick={() => {
                        deleteProject(p.id)
                        notify(`已删除「${p.name}」`)
                      }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-head">
          <h3>能力覆盖</h3>
        </div>
        <div className="feature-grid">
          <div className="feature">
            <h4>固件编译与烧录</h4>
            <p>基于 arduino-cli 与 esptool，本地编译、串口烧录，支持 ESP32 全系列与 RP2040。</p>
          </div>
          <div className="feature">
            <h4>代码 / 图形化双模式</h4>
            <p>专业用户直接写 Arduino C++，教学场景用积木生成同一份可编译固件。</p>
          </div>
          <div className="feature">
            <h4>Wi-Fi 与串口控制</h4>
            <p>生成的固件内置 HTTP 控制接口，烧录后即可在「设备控制」中开关真实引脚。</p>
          </div>
          <div className="feature">
            <h4>Home Assistant 原生发现</h4>
            <p>固件自动通过 MQTT Discovery 注册实体，无需刷写第三方固件。</p>
          </div>
        </div>
      </section>

      {showCreate && (
        <Modal title="新建项目" onClose={() => setShowCreate(false)}>
          <div className="form">
            <label className="field">
              <span>项目名称</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：客厅灯光控制器" />
            </label>
            <label className="field">
              <span>开发板</span>
              <select value={boardId} onChange={(e) => setBoardId(e.target.value)}>
                <optgroup label="ESP32 系列">
                  {BOARDS.filter((b) => b.family === 'esp32').map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} · {b.chip}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="ESP8266 系列">
                  {BOARDS.filter((b) => b.family === 'esp8266').map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} · {b.chip}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="树莓派 Pico (RP2040)">
                  {BOARDS.filter((b) => b.family === 'rp2040').map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} · {b.chip}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Arduino AVR（米思琪同款）">
                  {BOARDS.filter((b) => b.family === 'avr').map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} · {b.chip}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="树莓派 Linux 单板">
                  {BOARDS.filter((b) => b.family === 'linux-sbc').map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} · {b.chip}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
            <div className="field">
              <span>编写方式</span>
              <div className="segmented">
                <button
                  className={mode === 'code' ? 'active' : ''}
                  onClick={() => setMode('code')}
                  type="button"
                >
                  代码模式
                </button>
                <button
                  className={mode === 'blocks' ? 'active' : ''}
                  onClick={() => setMode('blocks')}
                  type="button"
                >
                  图形化
                </button>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setShowCreate(false)}>
                取消
              </button>
              <button className="btn primary" onClick={submit}>
                创建并开始
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
