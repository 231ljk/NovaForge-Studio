import { app } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { BOARD_INDEX_URLS, ESP32_CORE, AVR_CORE, ESP8266_CORE } from '../shared/boards'
import type { BuildArtifact, BuildRequest, BuildResult, ProgressEvent, ToolchainStatus, SerialPortInfo, AvrdudeUploadRequest } from '../shared/types'

type Emit = (event: ProgressEvent) => void

const ADDITIONAL_URLS = Object.values(BOARD_INDEX_URLS).join(',')

/** 源码 include 头文件 → Arduino 库管理器名称（积木胶水层所需依赖） */
const INCLUDE_LIB_MAP: Record<string, string> = {
  'PubSubClient.h': 'PubSubClient',
  'Adafruit_SSD1306.h': 'Adafruit SSD1306',
  'Adafruit_GFX.h': 'Adafruit GFX Library',
  'LiquidCrystal_I2C.h': 'LiquidCrystal I2C',
  'DHT.h': 'DHT sensor library',
  'Adafruit_BME280.h': 'Adafruit BME280 Library',
  'Adafruit_MPU6050.h': 'Adafruit MPU6050',
  'Adafruit_Sensor.h': 'Adafruit Unified Sensor',
  'ESP32Servo.h': 'ESP32Servo',
  'Servo.h': 'Servo'
}

function execFile(command: string, args: string[], emit?: Emit, scope: ProgressEvent['scope'] = 'toolchain') {
  return new Promise<{ code: number; output: string }>((resolve) => {
    let output = ''
    let child: ChildProcess
    try {
      child = spawn(command, args, { windowsHide: true })
    } catch (err) {
      resolve({ code: -1, output: String(err) })
      return
    }
    child.stdout?.on('data', (d) => {
      const text = d.toString()
      output += text
      emit?.({ scope, line: text })
    })
    child.stderr?.on('data', (d) => {
      const text = d.toString()
      output += text
      emit?.({ scope, line: text })
    })
    child.on('error', (err) => resolve({ code: -1, output: output + String(err) }))
    child.on('close', (code) => resolve({ code: code ?? -1, output }))
  })
}

/** 从 Windows PnP DeviceID 里取 USB VID/PID，用于和 Web Serial 选中的设备对应 */
function parseUsbIds(deviceId?: string): { vendorId?: number; productId?: number } {
  const match = /VID_([0-9A-F]{4})&PID_([0-9A-F]{4})/i.exec(deviceId ?? '')
  if (!match) return {}
  return { vendorId: parseInt(match[1], 16), productId: parseInt(match[2], 16) }
}

async function nativeSerialPorts(): Promise<SerialPortInfo[]> {
  if (process.platform === 'win32') {
    // 注册表能拿到当前占用的 COM 号；PnP 能拿到友好名称和 VID/PID。两者都取，互为补充。
    const script = [
      "$ErrorActionPreference='SilentlyContinue'",
      "$names=@();",
      "$reg=Get-ItemProperty -Path 'HKLM:\\HARDWARE\\DEVICEMAP\\SERIALCOMM';",
      "if($reg){$reg.PSObject.Properties | Where-Object { $_.Name -notlike 'PS*' } | ForEach-Object { $names += [string]$_.Value }};",
      "@{ ports=@(Get-PnpDevice -Class Ports -PresentOnly | Select-Object FriendlyName,InstanceId); names=$names } |",
      'ConvertTo-Json -Compress -Depth 4'
    ].join(' ')
    const res = await execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', script])
    if (res.code !== 0) return []
    const text = res.output.trim()
    if (!text) return []
    try {
      const parsed = JSON.parse(text) as {
        ports?: { FriendlyName?: string; InstanceId?: string } | { FriendlyName?: string; InstanceId?: string }[]
        names?: string | string[]
      }
      const rows = Array.isArray(parsed.ports) ? parsed.ports : parsed.ports ? [parsed.ports] : []
      const registered = Array.isArray(parsed.names) ? parsed.names : parsed.names ? [parsed.names] : []
      const ports: SerialPortInfo[] = []
      for (const row of rows) {
        const name = row.FriendlyName ?? ''
        const address = /\((COM\d+)\)/.exec(name)?.[1]
        if (!address) continue
        ports.push({
          address,
          label: name.replace(/\s*\(COM\d+\)\s*$/, '').trim() || address,
          ...parseUsbIds(row.InstanceId)
        })
      }
      // 只有注册表记录的串口（驱动名称不完整时）也要显示出来
      for (const name of registered) {
        const address = String(name).trim().toUpperCase()
        if (!/^COM\d+$/.test(address)) continue
        if (ports.some((p) => p.address === address)) continue
        ports.push({ address, label: address })
      }
      return ports
    } catch {
      return []
    }
  }

  // macOS 与 Linux：直接读 /dev 下的串口设备
  const dirs = process.platform === 'darwin'
    ? [{ dir: '/dev', match: /^cu\.(usb|serial|wchusbserial|SLAB_USBtoUART)/ }]
    : [
        { dir: '/dev', match: /^(ttyUSB|ttyACM|ttyAMA|ttyS\d+)/ },
        { dir: '/dev/serial/by-id', match: /.*/ }
      ]
  const ports: SerialPortInfo[] = []
  for (const { dir, match } of dirs) {
    try {
      const entries = await fs.readdir(dir)
      for (const entry of entries) {
        if (entry === 'ttyS0' || !match.test(entry)) continue
        const address = path.join(dir, entry)
        if (ports.some((p) => p.address === address)) continue
        ports.push({ address, label: entry })
      }
    } catch {
      // 目录不存在时跳过
    }
  }
  return ports
}

function cliAssetUrl(): { url: string; ext: 'zip' | 'tar.gz' } {
  const platform = process.platform
  const arch = process.arch
  if (platform === 'win32') {
    return {
      url:
        arch === 'arm64'
          ? 'https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_Windows_ARM64.zip'
          : 'https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_Windows_64bit.zip',
      ext: 'zip'
    }
  }
  if (platform === 'darwin') {
    return {
      url:
        arch === 'arm64'
          ? 'https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_macOS_ARM64.tar.gz'
          : 'https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_macOS_64bit.tar.gz',
      ext: 'tar.gz'
    }
  }
  return {
    url:
      arch === 'arm64'
        ? 'https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_Linux_ARM64.tar.gz'
        : 'https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_Linux_64bit.tar.gz',
    ext: 'tar.gz'
  }
}

export class ToolchainService {
  private emit: Emit
  readonly toolchainDir: string
  readonly buildDir: string
  private cliCache: string | null = null

  constructor(emit: Emit) {
    this.emit = emit
    this.toolchainDir = path.join(app.getPath('userData'), 'toolchain')
    this.buildDir = path.join(app.getPath('userData'), 'builds')
  }

  private get localCliPath(): string {
    return path.join(this.toolchainDir, process.platform === 'win32' ? 'arduino-cli.exe' : 'arduino-cli')
  }

  private async tryCli(command: string): Promise<string | null> {
    const res = await execFile(command, ['version'])
    if (res.code === 0) return command
    return null
  }

  async resolveCli(force = false): Promise<string | null> {
    if (this.cliCache && !force) return this.cliCache
    try {
      await fs.access(this.localCliPath)
      this.cliCache = this.localCliPath
      return this.cliCache
    } catch {
      // fall through to system PATH
    }
    this.cliCache = await this.tryCli('arduino-cli')
    return this.cliCache
  }

  async status(): Promise<ToolchainStatus> {
    const cliPath = await this.resolveCli()
    let cliVersion: string | null = null
    const cores: ToolchainStatus['cores'] = [
      { id: ESP32_CORE, installed: false },
      { id: ESP8266_CORE, installed: false },
      { id: 'rp2040:rp2040', installed: false },
      { id: AVR_CORE, installed: false }
    ]
    let libraryReady = false
    if (cliPath) {
      const version = await execFile(cliPath, ['version'])
      if (version.code === 0) {
        const match = version.output.match(/Version:\s*([\w.\-+]+)/)
        cliVersion = match ? match[1] : version.output.split('\n')[0]
      }
      const coreList = await execFile(cliPath, ['core', 'list', '--format', 'json'])
      if (coreList.code === 0) {
        try {
          const parsed = JSON.parse(coreList.output) as {
            platforms?: { metadata?: { id?: string }; releasing?: { version?: string } }[]
          }
          const installed = new Map<string, string>()
          for (const p of parsed.platforms ?? []) {
            if (p.metadata?.id) installed.set(p.metadata.id, p.releasing?.version ?? 'unknown')
          }
          for (const c of cores) {
            if (installed.has(c.id)) {
              c.installed = true
              c.version = installed.get(c.id)
            }
          }
        } catch {
          // ignore malformed output
        }
      }
      const libs = await execFile(cliPath, ['lib', 'list'])
      libraryReady = libs.code === 0 && /PubSubClient/i.test(libs.output)
    }
    return {
      cliPath,
      cliVersion,
      platform: `${process.platform}-${process.arch}`,
      cores,
      libraryReady,
      ready: Boolean(cliPath) && cores.some((c) => c.installed)
    }
  }

  async installCli(): Promise<{ ok: boolean; log: string }> {
    if (await this.resolveCli(true)) {
      return { ok: true, log: '已检测到 arduino-cli 可用。' }
    }
    await fs.mkdir(this.toolchainDir, { recursive: true })
    const asset = cliAssetUrl()
    this.emit({ scope: 'toolchain', line: `正在下载 arduino-cli: ${asset.url}`, percent: 0 })
    const response = await fetch(asset.url, { redirect: 'follow' })
    if (!response.ok || !response.body) {
      return { ok: false, log: `下载失败: HTTP ${response.status}` }
    }
    const total = Number(response.headers.get('content-length') ?? 0)
    const archivePath = path.join(this.toolchainDir, `arduino-cli-download.${asset.ext}`)
    const chunks: Uint8Array[] = []
    let received = 0
    const reader = response.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      received += value.length
      if (total) {
        this.emit({
          scope: 'toolchain',
          line: `下载 arduino-cli ${(received / 1048576).toFixed(1)} / ${(total / 1048576).toFixed(1)} MB`,
          percent: Math.round((received / total) * 100)
        })
      }
    }
    await fs.writeFile(archivePath, Buffer.concat(chunks))
    this.emit({ scope: 'toolchain', line: '下载完成，正在解压…', percent: 100 })

    let extractResult: { code: number; output: string }
    if (asset.ext === 'zip') {
      extractResult =
        process.platform === 'win32'
          ? await execFile('powershell', [
              '-NoProfile',
              '-Command',
              `Expand-Archive -LiteralPath '${archivePath}' -DestinationPath '${this.toolchainDir}' -Force`
            ])
          : await execFile('unzip', ['-o', archivePath, '-d', this.toolchainDir])
    } else {
      extractResult = await execFile('tar', ['-xzf', archivePath, '-C', this.toolchainDir])
    }
    if (extractResult.code !== 0) {
      return { ok: false, log: extractResult.output }
    }
    if (process.platform !== 'win32') {
      await fs.chmod(this.localCliPath, 0.755).catch(() => undefined)
    }
    await fs.rm(archivePath, { force: true })
    this.cliCache = null
    const resolved = await this.resolveCli(true)
    this.emit({ scope: 'toolchain', line: resolved ? `arduino-cli 安装完成: ${resolved}` : '未找到 arduino-cli' })
    return { ok: Boolean(resolved), log: resolved ? 'arduino-cli 安装完成' : '安装失败' }
  }

  async installCore(coreId: string): Promise<{ ok: boolean; log: string }> {
    const cli = await this.resolveCli()
    if (!cli) return { ok: false, log: '请先安装 arduino-cli' }
    let log = ''
    this.emit({ scope: 'toolchain', line: '正在更新核心索引（首次安装体积较大，请耐心等待）…' })
    const update = await execFile(cli, ['core', 'update-index', '--additional-urls', ADDITIONAL_URLS], this.emit)
    log += update.output
    if (update.code !== 0) return { ok: false, log }
    const install = await execFile(
      cli,
      ['core', 'install', coreId, '--additional-urls', ADDITIONAL_URLS],
      this.emit
    )
    log += install.output
    return { ok: install.code === 0, log }
  }

  async ensureLibrary(): Promise<boolean> {
    const cli = await this.resolveCli()
    if (!cli) return false
    const libs = await execFile(cli, ['lib', 'list', '--format', 'json'])
    if (libs.code === 0) {
      try {
        const parsed = JSON.parse(libs.output) as { installed_libraries?: { name?: string }[] }
        const names = (parsed.installed_libraries ?? []).map((l) => l.name ?? '')
        if (names.some((n) => n.includes('PubSubClient'))) return true
      } catch {
        if (/PubSubClient/i.test(libs.output)) return true
      }
    }
    this.emit({ scope: 'build', line: '正在安装 PubSubClient 库（MQTT 依赖）…' })
    const install = await execFile(cli, ['lib', 'install', 'PubSubClient'], this.emit, 'build')
    return install.code === 0
  }

  /** 按源码里的 #include 自动补齐所需 Arduino 库（显示屏/传感器/舵机等积木依赖） */
  async ensureLibrariesFor(source: string): Promise<void> {
    const need = new Set<string>()
    for (const m of source.matchAll(/#include\s+<([^>]+)>/g)) {
      const lib = INCLUDE_LIB_MAP[m[1]]
      if (lib) need.add(lib)
    }
    if (need.size === 0) return
    const cli = await this.resolveCli()
    if (!cli) return

    const installed = new Set<string>()
    const list = await execFile(cli, ['lib', 'list', '--format', 'json'])
    if (list.code === 0) {
      try {
        const parsed = JSON.parse(list.output) as { installed_libraries?: { name?: string }[] }
        for (const l of parsed.installed_libraries ?? []) if (l.name) installed.add(l.name)
      } catch {
        for (const lib of need) if (new RegExp(lib, 'i').test(list.output)) installed.add(lib)
      }
    }
    for (const lib of need) {
      const hit = [...installed].some((n) => n.toLowerCase() === lib.toLowerCase() || n.includes(lib) || lib.includes(n))
      if (hit) continue
      this.emit({ scope: 'build', line: `正在安装依赖库：${lib} …` })
      const res = await execFile(cli, ['lib', 'install', lib], this.emit, 'build')
      if (res.code !== 0) {
        this.emit({ scope: 'build', line: `⚠ 库 ${lib} 安装失败，编译可能报错（可稍后重试）` })
      }
    }
  }

  async build(req: BuildRequest): Promise<BuildResult> {
    const started = Date.now()
    const cli = await this.resolveCli()
    if (!cli) {
      return {
        success: false,
        output: '未找到 arduino-cli。请在「设置」中点击「安装工具链」。',
        sketchPath: '',
        artifacts: [],
        durationMs: 0,
        errors: []
      }
    }
    const safe =
      req.projectName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_').slice(0, 40) || 'novaforge_sketch'
    const sketchDir = path.join(this.buildDir, req.projectId, safe)
    const outDir = path.join(sketchDir, 'build')
    await fs.mkdir(sketchDir, { recursive: true })
    await fs.rm(outDir, { recursive: true, force: true })
    await fs.mkdir(outDir, { recursive: true })
    const sketchFile = path.join(sketchDir, `${safe}.ino`)
    await fs.writeFile(sketchFile, req.code, 'utf8')

    if (req.code.includes('PubSubClient')) {
      await this.ensureLibrary()
    }
    await this.ensureLibrariesFor(req.code)

    this.emit({ scope: 'build', line: `开始编译 ${req.fqbn} …` })
    const compile = await execFile(
      cli,
      [
        '--additional-urls',
        ADDITIONAL_URLS,
        'compile',
        '--fqbn',
        req.fqbn,
        '--output-dir',
        outDir,
        '--warnings',
        'default',
        sketchDir
      ],
      this.emit,
      'build'
    )

    const artifacts: BuildArtifact[] = []
    if (compile.code === 0) {
      const files = await fs.readdir(outDir)
      for (const name of files) {
        if (!name.endsWith('.bin') && !name.endsWith('.hex')) continue
        const full = path.join(outDir, name)
        const stat = await fs.stat(full)
        if (stat.size > 32 * 1024 * 1024) continue
        artifacts.push({
          name,
          size: stat.size,
          base64: (await fs.readFile(full)).toString('base64')
        })
      }
    }
    return {
      success: compile.code === 0,
      output: compile.output,
      sketchPath: sketchFile,
      artifacts,
      durationMs: Date.now() - started,
      errors: []
    }
  }

  /** 直接枚举系统串口：不依赖 arduino-cli，驱动装好后设备管理器能看到，这里就能看到 */
  async listPorts(): Promise<SerialPortInfo[]> {
    const byAddress = new Map<string, SerialPortInfo>()
    for (const port of await nativeSerialPorts()) {
      byAddress.set(port.address, port)
    }

    // arduino-cli 能识别出具体开发板型号时补全名称，识别不到也不影响返回已有串口
    const cli = await this.resolveCli()
    if (cli) {
      const result = await execFile(cli, ['board', 'list', '--format', 'json'])
      if (result.code === 0) {
        try {
          const parsed = JSON.parse(result.output) as {
            detected_ports?: { address?: string; protocol?: string; matching_boards?: { name?: string }[] }[]
          }
          for (const p of parsed.detected_ports ?? []) {
            if (p.protocol !== 'serial' || !p.address) continue
            const boardName = p.matching_boards?.[0]?.name
            const existing = byAddress.get(p.address)
            if (existing) {
              if (boardName) existing.label = `${p.address} — ${boardName}`
            } else {
              byAddress.set(p.address, {
                address: p.address,
                label: boardName ? `${p.address} — ${boardName}` : p.address
              })
            }
          }
        } catch {
          // arduino-cli 输出异常时保留系统串口列表
        }
      }
    }

    return [...byAddress.values()].sort((a, b) => a.address.localeCompare(b.address, 'en', { numeric: true }))
  }

  async avrdudeUpload(req: AvrdudeUploadRequest): Promise<{ ok: boolean; log: string }> {
    const cli = await this.resolveCli()
    if (!cli) return { ok: false, log: '请先安装 arduino-cli' }
    this.emit({ scope: 'build', line: `正在烧录到 ${req.port}（${req.fqbn}）…` })
    const upload = await execFile(
      cli,
      ['upload', '-p', req.port, '--fqbn', req.fqbn, '--input-dir', req.sketchDir],
      this.emit,
      'build'
    )
    return { ok: upload.code === 0, log: upload.output }
  }
}
