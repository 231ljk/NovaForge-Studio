export type BoardFamily = 'esp32' | 'esp8266' | 'rp2040' | 'avr' | 'linux-sbc'
export type Connectivity = 'serial' | 'wifi' | 'ble'
export type FlashMethod = 'esptool' | 'uf2' | 'avrdude' | 'ssh'

export interface Board {
  id: string
  name: string
  vendor: string
  family: BoardFamily
  chip: string
  arch: string
  cores: number
  clockMhz: number
  flashMB: number
  psram?: string
  connectivity: Connectivity[]
  flashMethod: FlashMethod
  fqbn?: string
  coreId?: string
  bootloaderOffset?: number
  usb: string
  note: string
}

export interface PinAssignment {
  id: string
  label: string
  gpio: number
  mode: 'output' | 'input' | 'analog'
  haType: 'switch' | 'binary_sensor' | 'sensor'
}

export interface NetworkConfig {
  ssid: string
  password: string
  mqttHost: string
  mqttPort: number
  mqttUser: string
  mqttPass: string
  mdns?: string
}

export interface Project {
  id: string
  name: string
  boardId: string
  mode: 'code' | 'blocks'
  language: 'arduino' | 'micropython'
  code: string
  blockXml: string
  generatedCode: string
  /** 控制授权令牌（创建时生成、烧录进固件）：/api/set 必须携带，防止未授权 HA 操作设备 */
  ctrlToken: string
  pins: PinAssignment[]
  net: NetworkConfig
  createdAt: number
  updatedAt: number
}

export interface CoreStatus {
  id: string
  installed: boolean
  version?: string
  latest?: string
}

export interface ToolchainStatus {
  cliPath: string | null
  cliVersion: string | null
  platform: string
  cores: CoreStatus[]
  libraryReady: boolean
  ready: boolean
}

export interface BuildArtifact {
  name: string
  size: number
  base64: string
}

export interface BuildError {
  severity: 'error' | 'warning' | 'info'
  file?: string
  line?: number
  col?: number
  message: string
}

export interface BuildResult {
  success: boolean
  output: string
  sketchPath: string
  artifacts: BuildArtifact[]
  durationMs: number
  /** 结构化编译错误，用于 AI 自动修复 */
  errors: BuildError[]
}

export interface BuildRequest {
  projectId: string
  projectName: string
  fqbn: string
  coreIds: string[]
  code: string
}

export interface ProgressEvent {
  scope: 'toolchain' | 'build'
  line: string
  percent?: number
}

export interface AppPaths {
  userData: string
  toolchainDir: string
  buildDir: string
}

export interface HttpResult {
  ok: boolean
  status: number
  body: string
  error?: string
}

export interface SerialPortInfo {
  address: string
  label: string
  /** Windows 下从 PnP DeviceID 解析，用于和 Web Serial 选择的设备对应 */
  vendorId?: number
  productId?: number
}

export interface AvrdudeUploadRequest {
  port: string
  fqbn: string
  sketchDir: string
}

export interface DesktopApi {
  appInfo(): Promise<{ version: string; platform: string; electron: string; paths: AppPaths }>
  toolchainStatus(): Promise<ToolchainStatus>
  installCli(): Promise<{ ok: boolean; log: string }>
  installCore(coreId: string): Promise<{ ok: boolean; log: string }>
  build(req: BuildRequest): Promise<BuildResult>
  copyText(text: string): Promise<void>
  httpRequest(url: string): Promise<HttpResult>
  listSerialPorts(): Promise<SerialPortInfo[]>
  avrdudeUpload(req: AvrdudeUploadRequest): Promise<{ ok: boolean; log: string }>
  onProgress(cb: (e: ProgressEvent) => void): () => void
  authStatus(): Promise<import('./auth').AuthState>
  authStart(): Promise<import('./auth').AuthState>
  authStartGitee(): Promise<import('./auth').AuthState>
  authLogout(): Promise<import('./auth').AuthState>
  authOpen(url: string): Promise<void>
  aiStatus(): Promise<import('./ai').AiStatus>
  aiStart(cfg?: import('./ai').AiConfig): Promise<import('./ai').AiStatus>
  aiStop(): Promise<import('./ai').AiStatus>
  aiChat(
    messages: import('./ai').AiMessage[],
    cfg?: import('./ai').AiConfig,
  ): Promise<import('./ai').AiChatResult>
  gatewayStatus(): Promise<import('./gateway').GatewayStatus>
  gatewayStart(): Promise<import('./gateway').GatewayStatus>
  gatewayStop(): Promise<import('./gateway').GatewayStatus>
  gatewayRegenerateCode(): Promise<import('./gateway').GatewayStatus>
  gatewayPublish(payload: import('./gateway').GatewaySnapshots): Promise<void>
  // —— 邮箱主账号 ——
  accountStatus(): Promise<import('./account').AccountState>
  accountRequestCode(
    email: string,
    purpose: import('./account').CodePurpose,
  ): Promise<import('./account').CodeResult>
  accountRegister(
    email: string,
    code: string,
    name?: string,
    password?: string,
  ): Promise<import('./account').AuthResult>
  accountLogin(email: string, password: string): Promise<import('./account').AuthResult>
  accountLoginCode(email: string, code: string): Promise<import('./account').AuthResult>
  accountLogout(): Promise<import('./account').AccountState>
  accountBind(provider: import('./account').RepoProvider): Promise<import('./account').AccountState>
  accountUnbind(provider: import('./account').RepoProvider): Promise<import('./account').AccountState>
}
