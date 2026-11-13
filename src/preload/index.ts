import { contextBridge, ipcRenderer } from 'electron'
import type { BuildRequest, DesktopApi, ProgressEvent, AvrdudeUploadRequest } from '../shared/types'
import type { AuthState } from '../shared/auth'
import type { AiChatResult, AiConfig, AiMessage, AiStatus } from '../shared/ai'

const api: DesktopApi = {
  appInfo: () => ipcRenderer.invoke('app:info'),
  toolchainStatus: () => ipcRenderer.invoke('toolchain:status'),
  installCli: () => ipcRenderer.invoke('toolchain:install-cli'),
  installCore: (coreId: string) => ipcRenderer.invoke('toolchain:install-core', coreId),
  build: (req: BuildRequest) => ipcRenderer.invoke('build:run', req),
  copyText: (text: string) => ipcRenderer.invoke('app:copy', text),
  httpRequest: (url: string) => ipcRenderer.invoke('device:http', url),
  listSerialPorts: (): Promise<import('../shared/types').SerialPortInfo[]> => ipcRenderer.invoke('toolchain:list-ports'),
  avrdudeUpload: (req: AvrdudeUploadRequest) => ipcRenderer.invoke('toolchain:avrdude-upload', req),
  onProgress: (cb: (e: ProgressEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: ProgressEvent): void => cb(payload)
    ipcRenderer.on('app:progress', listener)
    return () => ipcRenderer.removeListener('app:progress', listener)
  },
  authStatus: (): Promise<AuthState> => ipcRenderer.invoke('auth:status'),
  authStart: (): Promise<AuthState> => ipcRenderer.invoke('auth:start'),
  authStartGitee: (): Promise<AuthState> => ipcRenderer.invoke('auth:start-gitee'),
  authLogout: (): Promise<AuthState> => ipcRenderer.invoke('auth:logout'),
  aiStatus: (): Promise<AiStatus> => ipcRenderer.invoke('ai:status'),
  aiStart: (cfg?: AiConfig): Promise<AiStatus> => ipcRenderer.invoke('ai:start', cfg),
  aiStop: (): Promise<AiStatus> => ipcRenderer.invoke('ai:stop'),
  aiChat: (messages: AiMessage[], cfg?: AiConfig): Promise<AiChatResult> =>
    ipcRenderer.invoke('ai:chat', messages, cfg),
  authOpen: (url: string): Promise<void> => ipcRenderer.invoke('auth:open', url),
  gatewayStatus: (): Promise<import('../shared/gateway').GatewayStatus> =>
    ipcRenderer.invoke('gateway:status'),
  gatewayStart: (): Promise<import('../shared/gateway').GatewayStatus> =>
    ipcRenderer.invoke('gateway:start'),
  gatewayStop: (): Promise<import('../shared/gateway').GatewayStatus> =>
    ipcRenderer.invoke('gateway:stop'),
  gatewayRegenerateCode: (): Promise<import('../shared/gateway').GatewayStatus> =>
    ipcRenderer.invoke('gateway:code'),
  gatewayPublish: (payload: import('../shared/gateway').GatewaySnapshots): Promise<void> =>
    ipcRenderer.invoke('gateway:publish', payload),
  accountStatus: (): Promise<import('../shared/account').AccountState> =>
    ipcRenderer.invoke('account:status'),
  accountRequestCode: (
    email: string,
    purpose: import('../shared/account').CodePurpose,
  ): Promise<import('../shared/account').CodeResult> =>
    ipcRenderer.invoke('account:request-code', email, purpose),
  accountRegister: (
    email: string,
    code: string,
    name?: string,
    password?: string,
  ): Promise<import('../shared/account').AuthResult> =>
    ipcRenderer.invoke('account:register', email, code, name, password),
  accountLogin: (email: string, password: string): Promise<import('../shared/account').AuthResult> =>
    ipcRenderer.invoke('account:login', email, password),
  accountLoginCode: (
    email: string,
    code: string,
  ): Promise<import('../shared/account').AuthResult> =>
    ipcRenderer.invoke('account:login-code', email, code),
  accountLogout: (): Promise<import('../shared/account').AccountState> =>
    ipcRenderer.invoke('account:logout'),
  accountBind: (provider: import('../shared/account').RepoProvider) =>
    ipcRenderer.invoke('account:bind', provider),
  accountUnbind: (provider: import('../shared/account').RepoProvider) =>
    ipcRenderer.invoke('account:unbind', provider)
}

contextBridge.exposeInMainWorld('api', api)
