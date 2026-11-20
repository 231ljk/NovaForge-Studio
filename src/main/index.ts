import { app, BrowserWindow, clipboard, ipcMain, session, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { ToolchainService } from './toolchain'
import { AuthService } from './auth'
import { GatewayService } from './gateway'
import { accountService } from './account'
import { aiService } from './ai'
import { IS_FLASH, PRODUCT_NAME } from '../shared/product'
import type { BuildRequest, AvrdudeUploadRequest } from '../shared/types'
import type { GatewaySnapshots } from '../shared/gateway'

// 两个产品使用各自的 userData 目录，互不干扰
app.setName(PRODUCT_NAME)

// —— 启动期修复（必须在任何 Electron API 调用之前）——
// 修 "FATAL ERROR: Zone Allocation failed" / "Committing semi space failed"
// V8 堆内存管理在部分 Windows 环境下崩溃：限制堆大小 + 禁用 JIT 优化编译器
app.commandLine.appendSwitch(
  'js-flags',
  '--max-old-space-size=2048 --max-semi-space-size=16 --no-turbo-fan --no-opt --jitless'
)
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-gpu-compositing')
app.commandLine.appendSwitch('disable-software-rasterizer')
app.commandLine.appendSwitch('disable-dev-shm-usage')
app.commandLine.appendSwitch('no-sandbox')
app.disableHardwareAcceleration()

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1080,
    minHeight: 680,
    show: false,
    backgroundColor: '#0b0f14',
    autoHideMenuBar: true,
    title: PRODUCT_NAME,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })

  // 正常路径：渲染进程 ready 后再 show，避免白屏闪烁
  mainWindow.on('ready-to-show', () => {
    console.log('[NovaForge] ready-to-show 事件触发，显示窗口')
    mainWindow?.show()
  })

  // 超时兜底：15 秒还没 ready-to-show，强制 show 出来，让用户能看到错误
  setTimeout(() => {
    const win = mainWindow
    if (win && !win.isDestroyed() && (win.isMinimized() || !win.isVisible())) {
      console.warn('[NovaForge] 15s 超时仍未 ready-to-show，强制显示窗口')
      win.show()
      win.focus()
    }
  }, 15000)

  // 渲染层加载失败 → 直接把错误打到控制台并显示窗口
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error(`[NovaForge] 渲染加载失败 code=${code} desc=${desc} url=${url}`)
    mainWindow?.show()
  })

  mainWindow.webContents.on('console-message', (e) => {
    const ev = e as unknown as { level: number; message: string; lineNumber?: number; sourceId?: string }
    const tag = ev.level === 2 ? 'RENDERER_ERR' : ev.level === 1 ? 'RENDERER_WARN' : 'RENDERER'
    const loc = ev.sourceId ? ` (${ev.sourceId}:${ev.lineNumber ?? 0})` : ''
    console.log(`[${tag}] ${ev.message}${loc}`)
  })

  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error(`[NovaForge] 渲染进程退出 reason=${details.reason} exitCode=${details.exitCode}`)
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    console.log(`[NovaForge] 开发模式：加载 ${rendererUrl}`)
    void mainWindow.loadURL(rendererUrl)
  } else {
    const file = path.join(__dirname, '../renderer/index.html')
    console.log(`[NovaForge] 生产模式：加载 ${file}`)
    void mainWindow.loadFile(file)
  }
}

function configureSerialAccess(): void {
  const ses = session.defaultSession
  ses.setPermissionCheckHandler((_wc, permission) => permission === 'serial')
  ses.setDevicePermissionHandler((details) => details.deviceType === 'serial')

  ses.on('select-serial-port', (event, portList, _webContents, callback) => {
    event.preventDefault()
    if (portList.length === 0) {
      callback('')
      return
    }
    const preferred =
      portList.find((p) => /CP210|CH340|CH910|USB|JTAG|UART|Silicon|Espressif/i.test(p.displayName ?? '')) ??
      portList[0]
    callback(preferred.portId)
  })

  ses.on('serial-port-added', (_event, port) => {
    mainWindow?.webContents.send('serial:port-added', port.portId)
  })
}

let gateway: GatewayService | null = null

const toolchain = new ToolchainService((event) => {
  mainWindow?.webContents.send('app:progress', event)
  gateway?.broadcastProgress(event)
})

const auth = new AuthService()
gateway = new GatewayService(toolchain, auth, accountService)

// 仓库授权成功后，自动把该仓库账号绑定到当前邮箱账号（一个邮箱统领所有账号）
auth.onAuthorized = (provider, user, token) => {
  if (accountService.status().phase !== 'signedIn') return
  accountService.bindRepo(provider, user.login, user.name, token)
}

function persistAiCfg(cfg?: import('../shared/ai').AiConfig): void {
  if (!cfg) return
  try {
    fs.writeFileSync(path.join(app.getPath('userData'), 'ai-config.json'), JSON.stringify(cfg))
  } catch {
    /* ignore */
  }
}

function registerIpc(): void {
  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    platform: process.platform,
    electron: process.versions.electron,
    paths: {
      userData: app.getPath('userData'),
      toolchainDir: toolchain.toolchainDir,
      buildDir: toolchain.buildDir
    }
  }))

  ipcMain.handle('toolchain:status', () => toolchain.status())
  ipcMain.handle('toolchain:install-cli', () => toolchain.installCli())
  ipcMain.handle('toolchain:install-core', (_event, coreId: string) => toolchain.installCore(coreId))
  ipcMain.handle('build:run', (_event, req: BuildRequest) => toolchain.build(req))
  ipcMain.handle('app:copy', (_event, text: string) => clipboard.writeText(text))
  ipcMain.handle('device:http', async (_event, url: string) => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
      return { ok: res.ok, status: res.status, body: await res.text() }
    } catch (err) {
      return { ok: false, status: 0, body: '', error: String(err) }
    }
  })

  ipcMain.handle('toolchain:list-ports', () => toolchain.listPorts())
  ipcMain.handle(
    'toolchain:avrdude-upload',
    (_event, req: AvrdudeUploadRequest) => toolchain.avrdudeUpload(req)
  )
  ipcMain.handle('auth:status', () => auth.status())
  ipcMain.handle('auth:start', () => auth.startLogin())
  ipcMain.handle('auth:start-gitee', () => auth.startGiteeLogin())
  // —— 邮箱主账号 ——
  ipcMain.handle('account:status', () => accountService.status())
  ipcMain.handle('account:request-code', (_e, email: string, purpose: 'register' | 'login') =>
    accountService.requestCode(email, purpose),
  )
  ipcMain.handle(
    'account:register',
    (_e, email: string, code: string, name?: string, password?: string) =>
      accountService.register(email, code, name, password),
  )
  ipcMain.handle('account:login', (_e, email: string, password: string) =>
    accountService.login(email, password),
  )
  ipcMain.handle('account:login-code', (_e, email: string, code: string) =>
    accountService.loginWithCode(email, code),
  )
  ipcMain.handle('account:logout', () => accountService.logout())
  ipcMain.handle('account:bind', (_e, provider: 'github' | 'gitee') => {
    // 绑定动作：把 AuthService 里已授权成功的仓库令牌挂到邮箱账号
    const token = auth.currentToken(provider)
    const st = auth.status()
    return st.then((s) => {
      if (!token || s.phase !== 'authorized' || !s.user) {
        return accountService.status()
      }
      return accountService.bindRepo(provider, s.user.login, s.user.name, token)
    })
  })
  ipcMain.handle('account:unbind', (_e, provider: 'github' | 'gitee') =>
    accountService.unbindRepo(provider),
  )
  // Flash 版不提供任何 AI 能力，IPC 也不注册
  if (!IS_FLASH) {
    ipcMain.handle('ai:status', () => aiService.status())
    ipcMain.handle('ai:start', (_e, cfg?: import('../shared/ai').AiConfig) => {
      persistAiCfg(cfg)
      return aiService.start(cfg)
    })
    ipcMain.handle('ai:stop', () => aiService.stop())
    ipcMain.handle(
      'ai:chat',
      (_e, messages: import('../shared/ai').AiMessage[], cfg?: import('../shared/ai').AiConfig) => {
        persistAiCfg(cfg)
        return aiService.chat(messages, cfg)
      },
    )
  }
  // —— 局域网网关（手机 APP）——
  ipcMain.handle('gateway:status', () => gateway?.status() ?? { running: false, port: 0, addresses: [], code: '', codeExpiresAt: 0, paired: 0 })
  ipcMain.handle('gateway:start', () => gateway!.start())
  ipcMain.handle('gateway:stop', () => {
    gateway?.stop()
    return gateway?.status()
  })
  ipcMain.handle('gateway:code', () => {
    gateway?.regenerateCode()
    return gateway?.status()
  })
  ipcMain.handle('gateway:publish', (_e, payload: GatewaySnapshots) => {
    gateway?.publish(payload)
  })
  ipcMain.handle('auth:logout', () => {
    auth.logout()
    return auth.status()
  })
  ipcMain.handle('auth:open', (_event, url: string) => {
    // 只放行 https，避免被拼出 file:// 等危险协议
    if (typeof url === 'string' && /^https:\/\/[\w.-]+\//.test(url)) {
      void shell.openExternal(url)
    }
  })
}

app.whenReady().then(() => {
  console.log('[NovaForge] app.whenReady → serial access + IPC + createWindow')
  configureSerialAccess()
  registerIpc()
  createWindow()
  // 网关随应用启动：手机 App 打开即能发现电脑，无需手动开启
  void gateway?.start()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => gateway?.stop())
