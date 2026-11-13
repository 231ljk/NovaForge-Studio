import { useEffect, useState } from 'react'
import { AppProvider, useApp } from './store'
import { Workbench } from './pages/Workbench'
import { Firmware } from './pages/Firmware'
import { DevicePage } from './pages/DevicePage'
import { Control } from './pages/Control'
import { HomeAssistant } from './pages/HomeAssistant'
import { Settings } from './pages/Settings'
import { AiChat } from './components/AiChat'

type RouteId = 'workbench' | 'firmware' | 'device' | 'control' | 'ha' | 'settings'

const NAV: { id: RouteId; label: string; icon: string; hint: string }[] = [
  { id: 'workbench', label: '工作台', icon: 'grid', hint: '项目与工具链总览' },
  { id: 'firmware', label: '编写固件', icon: 'code', hint: '代码与图形化编程' },
  { id: 'device', label: '烧录与串口', icon: 'usb', hint: '编译、烧录、串口监视' },
  { id: 'control', label: '设备控制', icon: 'power', hint: 'Wi-Fi 实时控制引脚' },
  { id: 'ha', label: 'Home Assistant', icon: 'home', hint: 'MQTT 自动发现与实体' },
  { id: 'settings', label: '设置', icon: 'settings', hint: '工具链与运行环境' }
]

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
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    code: (
      <>
        <path d="M9 6 3 12l6 6" />
        <path d="M15 6l6 6-6 6" />
      </>
    ),
    usb: (
      <>
        <circle cx="12" cy="4" r="1.8" />
        <path d="M12 6v12" />
        <path d="M12 14H8l-2-2" />
        <path d="M12 10h4l2 2" />
        <rect x="3" y="18" width="4" height="3" rx="1" />
        <rect x="17" y="18" width="4" height="3" rx="1" />
      </>
    ),
    power: (
      <>
        <path d="M12 3v8" />
        <path d="M6.5 6.5a7 7 0 1 0 11 0" />
      </>
    ),
    home: (
      <>
        <path d="M4 11 12 4l8 7" />
        <path d="M6 10v10h12V10" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3.2" />
        <path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7" />
      </>
    )
  }
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" strokeWidth="1.6">
      {paths[name]}
    </svg>
  )
}

function Shell(): React.ReactElement {
  const { activeProject, activeBoard, toasts, setActiveId } = useApp()
  const [route, setRoute] = useState<RouteId>(() => {
    const saved = localStorage.getItem('novaforge.route') as RouteId | null
    return saved && NAV.some((n) => n.id === saved) ? saved : 'workbench'
  })

  useEffect(() => {
    localStorage.setItem('novaforge.route', route)
  }, [route])

  const navigate = (id: RouteId): void => setRoute(id)
  const meta = NAV.find((n) => n.id === route)!

  const requiresProject = route === 'firmware' || route === 'device' || route === 'control' || route === 'ha'
  const blocked = requiresProject && !activeProject

  let content: React.ReactNode
  if (blocked) {
    content = (
      <div className="empty-state panel">
        <div className="empty-mark">NF</div>
        <h2>还没有选择项目</h2>
        <p>创建一个项目并选择开发板后，才能进入此页面。</p>
        <button className="btn primary" onClick={() => navigate('workbench')}>
          前往工作台
        </button>
      </div>
    )
  } else if (route === 'workbench') {
    content = <Workbench navigate={navigate} />
  } else if (route === 'firmware') {
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
            <div className="brand-name">NovaForge</div>
            <div className="brand-sub">Studio · ESP32 / Pi</div>
          </div>
        </div>

        <nav className="nav">
          {NAV.map((item) => (
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
              <button className="btn ghost small" onClick={() => setActiveId(null)}>
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

      <AiChat />
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>
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
