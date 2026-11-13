import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getBoard } from '../../shared/boards'
import { buildFirmware, randomCtrlToken } from '../../shared/firmware'
import type { Board, BuildResult, Project } from '../../shared/types'

const PROJECTS_KEY = 'novaforge.projects.v1'
const ACTIVE_KEY = 'novaforge.active.v1'

interface Toast {
  id: number
  text: string
  kind: 'info' | 'error' | 'success'
}

interface AppContextValue {
  projects: Project[]
  activeProject: Project | null
  activeBoard: Board | null
  setActiveId: (id: string | null) => void
  createProject: (name: string, boardId: string, mode: Project['mode']) => Project
  updateProject: (id: string, patch: Partial<Project>) => void
  switchBoard: (id: string, boardId: string) => void
  deleteProject: (id: string) => void
  regenerateFirmware: (id: string) => void
  lastBuild: BuildResult | null
  setLastBuild: (result: BuildResult | null) => void
  toasts: Toast[]
  notify: (text: string, kind?: Toast['kind']) => void
}

const AppContext = createContext<AppContextValue | null>(null)

/** 各芯片家族的默认测试引脚（切换开发板时用于迁移自动生成的引脚） */
function defaultGpio(board: Board): number {
  return board.family === 'esp32' || board.family === 'esp8266' ? 2 : board.family === 'avr' ? 13 : 25
}

function initialPins(board: Board): Project['pins'] {
  const gpio = defaultGpio(board)
  return [
    {
      id: 'pin-1',
      label: '板载LED',
      gpio,
      mode: 'output',
      haType: 'switch'
    }
  ]
}

function blankProject(name: string, boardId: string, mode: Project['mode']): Project {
  const board = getBoard(boardId) ?? getBoard('esp32-devkit-v1')!
  const project: Project = {
    id: crypto.randomUUID(),
    name,
    boardId,
    mode,
    language: 'arduino',
    code: '',
    blockXml: '',
    generatedCode: '',
    ctrlToken: randomCtrlToken(),
    pins: initialPins(board),
    net: {
      ssid: '',
      password: '',
      mqttHost: 'homeassistant.local',
      mqttPort: 1883,
      mqttUser: '',
      mqttPass: '',
      mdns: ''
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  project.code = buildFirmware(project, board)
  return project
}

function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Project[]
    if (!Array.isArray(parsed)) return []
    // 旧项目补发控制授权令牌：立即回写，保证与已烧录固件里的令牌长期一致
    let migrated = false
    for (const p of parsed) {
      if (p && typeof p === 'object' && !p.ctrlToken) {
        p.ctrlToken = randomCtrlToken()
        migrated = true
      }
    }
    if (migrated) localStorage.setItem(PROJECTS_KEY, JSON.stringify(parsed))
    return parsed
  } catch {
    return []
  }
}

export function AppProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [projects, setProjects] = useState<Project[]>(loadProjects)
  const [activeId, setActiveId] = useState<string | null>(() => localStorage.getItem(ACTIVE_KEY))
  const [toasts, setToasts] = useState<Toast[]>([])
  const [lastBuild, setLastBuild] = useState<BuildResult | null>(null)

  useEffect(() => {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects))
  }, [projects])

  useEffect(() => {
    if (activeId) localStorage.setItem(ACTIVE_KEY, activeId)
    else localStorage.removeItem(ACTIVE_KEY)
  }, [activeId])

  // 把项目快照同步给局域网网关，手机端即可列出项目、让 AI 触发编译
  useEffect(() => {
    let cancelled = false
    const publish = async (): Promise<void> => {
      let account: { provider: string; login: string; name: string | null } | null = null
      try {
        const auth = await window.api.authStatus()
        if (auth.phase === 'authorized' && auth.user) {
          account = { provider: auth.provider ?? 'github', login: auth.user.login, name: auth.user.name }
        }
      } catch {
        /* 未登录/离线时按未登录处理 */
      }
      if (cancelled) return
      const snapshot = {
        activeProjectId: activeId,
        account,
        projects: projects.map((p) => {
          const board = getBoard(p.boardId)
          const source = p.mode === 'blocks' && board ? buildFirmware(p, board) : p.code
          return {
            id: p.id,
            name: p.name,
            boardId: p.boardId,
            code: source,
            pinLabels: p.pins.map((pin) => ({ label: pin.label, gpio: pin.gpio, mode: pin.mode }))
          }
        })
      }
      void window.api.gatewayPublish(snapshot).catch(() => {})
    }
    void publish()
    return () => {
      cancelled = true
    }
  }, [projects, activeId])

  const notify = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, text, kind }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3600)
  }, [])

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeId) ?? null,
    [projects, activeId]
  )
  const activeBoard = useMemo(
    () => (activeProject ? getBoard(activeProject.boardId) ?? null : null),
    [activeProject]
  )

  const createProject = useCallback(
    (name: string, boardId: string, mode: Project['mode']) => {
      const project = blankProject(name, boardId, mode)
      setProjects((prev) => [project, ...prev])
      setActiveId(project.id)
      return project
    },
    []
  )

  const updateProject = useCallback((id: string, patch: Partial<Project>) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p))
    )
  }, [])

  /**
   * 切换开发板：不能只改 boardId。
   *  - 引脚：把仍是旧板默认 GPIO 的引脚迁移到新板默认 GPIO，用户自定义的保持不动；
   *  - 代码：代码模式下若用户没改过模板，按新开发板重新生成（否则会拿旧板模板烧新板）；
   *  - 图形化：generatedCode 由积木工作区管理，切换后由工作区重建时重算。
   */
  const switchBoard = useCallback((id: string, boardId: string) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== id || p.boardId === boardId) return p
        const oldBoard = getBoard(p.boardId)
        const board = getBoard(boardId)
        if (!board) return p

        const oldDefault = oldBoard ? defaultGpio(oldBoard) : null
        const nextDefault = defaultGpio(board)
        const pins = p.pins.map((pin) =>
          oldDefault !== null && pin.gpio === oldDefault ? { ...pin, gpio: nextDefault } : pin
        )

        const next: Project = { ...p, boardId, pins, updatedAt: Date.now() }
        const untouched = !oldBoard || p.code.trim() === buildFirmware({ ...p }, oldBoard).trim()
        if (p.mode === 'code' && untouched) next.code = buildFirmware(next, board)
        return next
      })
    )
  }, [])

  const deleteProject = useCallback((id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id))
    setActiveId((current) => (current === id ? null : current))
  }, [])

  const regenerateFirmware = useCallback(
    (id: string) => {
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p
          const board = getBoard(p.boardId)
          if (!board) return p
          return {
            ...p,
            code: buildFirmware(p, board),
            updatedAt: Date.now()
          }
        })
      )
    },
    []
  )

  const value: AppContextValue = {
    projects,
    activeProject,
    activeBoard,
    setActiveId,
    createProject,
    updateProject,
    switchBoard,
    deleteProject,
    regenerateFirmware,
    lastBuild,
    setLastBuild,
    toasts,
    notify
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
