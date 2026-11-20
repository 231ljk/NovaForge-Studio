import { useEffect, useState } from 'react'
import { AppProvider, useApp } from './store'
import { Workbench } from './pages/Workbench'
import { Firmware } from './pages/Firmware'
import { DevicePage } from './pages/DevicePage'
import { Control } from './pages/Control'
import { HomeAssistant } from './pages/HomeAssistant'
import { Settings } from './pages/Settings'
import { AiChat } from './components/AiChat'
import { IS_FLASH, PRODUCT_NAME, PRODUCT_TAGLINE } from '../../shared/product'
import { BOARDS } from '../../shared/boards'

type RouteId = 'workbench' | 'firmware' | 'device' | 'control' | 'ha' | 'settings'

const NAV: { id: RouteId; label: string; icon: string; hint: string }[] = [
  { id: 'workbench', label: '工作台', icon: 'grid', hint: '项目与工具链总览' },
  { id: 'firmware', label: '编写固件', icon: 'code', hint: '代码与图形化编程' },
  { id: 'device', label: '烧录与串口', icon: 'usb', hint: '编译、烧录、串口监视' },
  { id: 'control', label: '设备控制', icon: 'power', hint: 'Wi-Fi 实时控制引脚' },
  { id: 'ha', label: 'Home Assistant', icon: 'home', hint: 'MQTT 自动发现与实体' },
  { id: 'settings', label: '设置', icon: 'settings', hint: '编译器、核心与运行环境' }
]

const NAV_ITEMS = IS_FLASH ? NAV.filter((n) => n.id !== 'firmware') : NAV

const SUBTITLE: Record<RouteId, string> = {
  workbench: '从开发板到真实设备，统一入口',
  firmware: 'Arduino C++ 代码或积木式编程，直接生成可烧录固件',
  device: '通过数据线烧录固件，并实时查看串口输出',
  control: '设备联网后，用同一 Wi-Fi 网络实时控制引脚',
  ha: '原生 Home Assistant 发现，无需额外刷写第三方固件',
  settings: '编译器、核心与运行环境'
}

function Icon({ name }: { name: string }): React.ReactElement {
  const paths: Record<string, React.ReactNode> = {
    grid: (<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>),
    code: (<><path d="M9 6 3 12l6 6" /><path d="M15 6l6 6-6 6" /></>),
    usb: (<><circle cx="12" cy="4" r="1.8" /><path d="M12 6v12" /><path d="M12 14H8l-2-2" /><path d="M12 10h4l2 2" /><rect x="3" y="18" width="4" height="3" rx="1" /><rect x="17" y="18" width="4" height="3" rx="1" /></>),
    power: (<><path d="M12 3v8" /><path d="M6.5 6.5a7 7 0 1 0 11 0" /></>),
    home: (<><path d="M4 11 12 4l8 7" /><path d="M6 10v10h12V10" /></>),
    settings: (<><circle cx="12" cy="12" r="3.2" /><path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7" /></>)
  }
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" strokeWidth="1.6">{paths[name]}</svg>
}

function Shell(): React.ReactElement {
  const { activeProject, activeBoard, toasts, setActiveId, notify, createProject, switchBoard } = useApp()
  const [route, setRoute] = useState<RouteId>(() => {
    const saved = localStorage.getItem('novaforge.route') as RouteId | null
    return saved && NAV_ITEMS.some((n) => n.id === saved) ? saved : 'workbench'
  })
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const [onboardingStep, setOnboardingStep] = useState(0)
  const [wizardBoardId, setWizardBoardId] = useState<string>('')
  const [wizardProjName, setWizardProjName] = useState('我的第一个设备')

  // 首启检测：无项目 → 弹出向导
  useEffect(() => {
    const hasProj = !!activeProject
    const visited = localStorage.getItem('novaforge.wizardDone')
    if (!hasProj && !visited) {
      setOnboardingOpen(true)
      setOnboardingStep(0)
    }
  }, [activeProject])

  // 恢复状态记忆
  useEffect(() => {
    const lastProj = localStorage.getItem('novaforge.lastProjectId')
    if (lastProj && !activeProject) {
      setActiveId(lastProj)
    }
  }, [])

  // toast 事件监听（AiChat 通过 CustomEvent 发 toast）
  useEffect(() => {
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent).detail as { text: string; kind?: 'info' | 'success' | 'error' }
      notify(detail.text, detail.kind)
    }
    window.addEventListener('nf:toast', onToast)
    return () => window.removeEventListener('nf:toast', onToast)
  }, [notify])

  // 固件编辑器 AI 代码应用事件
  useEffect(() => {
    const onApply = (e: Event) => {
      const detail = (e as CustomEvent).detail as { code: string; lang: string }
      localStorage.setItem('nf.applyCode', JSON.stringify({ code: detail.code, lang: detail.lang, ts: Date.now() }))
      if (route !== 'firmware') setRoute('firmware')
    }
    window.addEventListener('nf:applyCode', onApply)
    return () => window.removeEventListener('nf:applyCode', onApply)
  }, [route])

  useEffect(() => { localStorage.setItem('novaforge.route', route) }, [route])

  const navigate = (id: RouteId): void => {
    setRoute(id)
    // 导航时持久化当前项目状态
    if (activeProject) {
      localStorage.setItem('novaforge.lastProjectId', activeProject.id)
      if (activeBoard) localStorage.setItem('novaforge.lastBoardId', activeBoard.id)
    }
  }
  const meta = NAV_ITEMS.find((n) => n.id === route) ?? NAV_ITEMS[0]

  const requiresProject = route === 'firmware' || route === 'device' || route === 'control' || route === 'ha'
  const blocked = requiresProject && !activeProject

  // 向导步骤
  const wizardStep = (n: number, label: string, children: React.ReactNode, canNext: boolean = true): React.ReactElement => (
    <div className="wizard-step-body">
      <h4>Step {n + 1}: {label}</h4>
      {children}
      <div className="wizard-actions">
        {n > 0 && <button className="btn ghost" onClick={() => setOnboardingStep(n - 1)}>上一步</button>}
        {n < 3 ? (
          <button className="btn primary" disabled={!canNext} onClick={() => setOnboardingStep(n + 1)}>下一步 →</button>
        ) : (
          <button className="btn primary" disabled={!canNext} onClick={() => {
            const boardId = wizardBoardId || BOARDS.find((b) => b.family === 'esp32')?.id || BOARDS[0].id
            const projId = createProject(wizardProjName, boardId, 'code')
            setOnboardingOpen(false)
            localStorage.setItem('novaforge.wizardDone', '1')
            navigate('firmware')
          }}>开始 → 编写固件</button>
        )}
      </div>
    </div>
  )

  let content: React.ReactNode
  if (blocked) {
    content = (
      <div className="empty-state panel">
        <div className="empty-mark">NF</div>
        <h2>还没有选择项目</h2>
        <p>创建一个项目并选择开发板后，才能进入此页面。</p>
        <div className="guide-card">
          <b>快速上手：4 步跑通第一个设备</b>
          <ol>
            <li>创建项目 → 选开发板</li>
            <li>编写固件（AI 可以帮你写）</li>
            <li>编译 → 连接串口 → 烧录</li>
            <li>打开设备控制，点亮一个引脚 🎉</li>
          </ol>
        </div>
        <div className="inline-row" style={{ gap: 10, marginTop: 14 }}>
          <button className="btn primary" onClick={() => { setOnboardingOpen(true); setOnboardingStep(0) }}>
            开始新手向导
          </button>
          <button className="btn ghost" onClick={() => navigate('workbench')}>去工作台</button>
        </div>
      </div>
    )
  } else if (route === 'workbench') {
    content = <Workbench navigate={navigate} />
  } else if (route === 'firmware' && !IS_FLASH) {
    content = <Firmware navigate={navigate} />
  } else if (route === 'device') {
    content = <DevicePage navigate={navigate} />
  } else if (route === 'control') {
    content = <Control />
  } else if (route === 'ha') {
    content = <HomeAssistant />
  } else {
    content = <Settings />
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">NF</div>
          <div>
            <div className="brand-name">{PRODUCT_NAME}</div>
            <div className="brand-sub">{PRODUCT_TAGLINE}</div>
          </div>
        </div>

        <nav className="nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${route === item.id ? 'active' : ''}`}
              onClick={() => navigate(item.id)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="side-project">
          <div className="side-label">当前项目</div>
          {activeProject ? (
            <>
              <div className="side-project-name">{activeProject.name}</div>
              <div className="side-project-meta">{activeBoard?.name ?? '未知开发板'}</div>
              <button className="btn ghost small" onClick={() => { setActiveId(null); localStorage.removeItem('novaforge.lastProjectId') }}>
                取消选择
              </button>
            </>
          ) : (
            <div className="side-project-meta">未选择项目</div>
          )}
        </div>

        <div className="side-footer">
          <span className="dot online" />
          Windows 桌面版 0.1.0
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{meta.label}</h1>
            <p className="subtitle">{meta.hint}</p>
          </div>
          <div className="topbar-right">
            <span className="env-chip">本地运行</span>
            {activeProject && <span className="project-chip">{activeProject.name}</span>}
          </div>
        </header>
        <div className="page">{content}</div>
      </main>

      {!IS_FLASH && <AiChat />}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>
        ))}
      </div>

      {/* 首启/新手向导 Modal */}
      {onboardingOpen && (
        <div className="modal-backdrop" onClick={() => setOnboardingOpen(false)}>
          <div className="modal onboarding-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>欢迎使用 NovaForge</h3>
              <button className="icon-btn" onClick={() => setOnboardingOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="wizard-progress">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={`wizard-dot ${i <= onboardingStep ? 'active' : ''}`}>{i + 1}</div>
                ))}
              </div>
              {onboardingStep === 0 && wizardStep(0, '选一个开发板', (
                <div>
                  <p>开发板决定了编译参数和引脚分配。如果是 ESP32-S3 / ESP32-C3 / ESP8266，选对应的板型即可。</p>
                  <select
                    className="input wizard-select"
                    value={wizardBoardId}
                    onChange={(e) => setWizardBoardId(e.target.value)}
                  >
                    <option value="">从下面选一个…</option>
                    {BOARDS.filter((b) => b.family === 'esp32' || b.family === 'esp8266').map((b) => (
                      <option key={b.id} value={b.id}>{b.name} · {b.chip} ({b.flashMB}MB Flash)</option>
                    ))}
                  </select>
                </div>
              ), !!wizardBoardId)}
              {onboardingStep === 1 && wizardStep(1, '给项目起个名字', (
                <div>
                  <p>比如「客厅灯光」「自动浇水」「温度计」，后续可以随时改名。</p>
                  <input
                    className="input wizard-input"
                    value={wizardProjName}
                    onChange={(e) => setWizardProjName(e.target.value)}
                    placeholder="我的第一个设备"
                  />
                </div>
              ), wizardProjName.trim().length > 0)}
              {onboardingStep === 2 && wizardStep(2, '写固件', (
                <div>
                  <p>Studio 内置 AI 助手，可以帮你写好 hello-world、接线代码、WiFi 联网。</p>
                  <div className="flow-steps" style={{ marginTop: 10 }}>
                    <div className="flow-step"><b>图形化积木</b><p>拖拖拽拽，Blockly 自动生成代码</p></div>
                    <div className="flow-step"><b>Arduino C++</b><p>直接写代码，Studio 本地编译</p></div>
                    <div className="flow-step"><b>AI 助手</b><p>告诉它想做什么，让它写完整固件</p></div>
                  </div>
                </div>
              ))}
              {onboardingStep === 3 && wizardStep(3, '编译 + 烧录', (
                <div>
                  <p>最后两步非常快：</p>
                  <ol>
                    <li>点「编译固件」→ Studio 本地编译，10~30 秒</li>
                    <li>数据线插电脑 → 选串口 → 点「开始烧录」→ 设备自动重启</li>
                  </ol>
                  <div className="notice">烧录前请确认 USB 线是数据线（不是充电线）。如果烧录失败，按住开发板 BOOT 键再点一次。</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function App(): React.ReactElement {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
