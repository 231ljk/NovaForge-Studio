import { ESPLoader, Transport } from 'esptool-js'
import type { BuildError } from '../../../shared/types'

export interface FlashFile {
  name: string
  address: number
  data: Uint8Array
}

export interface FlashOptions {
  baudrate?: number
  eraseAll?: boolean
  onLog: (line: string) => void
  onProgress?: (written: number, total: number, fileIndex: number) => void
  onStage?: (stage: FlashStage) => void
}

export type FlashStage =
  | 'connect'
  | 'detect'
  | 'erase'
  | 'write'
  | 'verify'
  | 'reset'
  | 'done'

export interface ChipInfo {
  chip: string
  flashSizeBytes: number
  flashSizeLabel: string
  mac: string
}

export interface SerialErrorDetail {
  category: 'connect' | 'handshake' | 'timeout' | 'flash' | 'port' | 'unsupported'
  message: string
  hint?: string
}

export class SerialError extends Error {
  detail: SerialErrorDetail
  constructor(detail: SerialErrorDetail) {
    super(detail.message)
    this.name = 'SerialError'
    this.detail = detail
  }
}

export interface PortInfo {
  vendorId?: number
  productId?: number
  label: string
}

export function serialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator
}

export async function describePort(port: SerialPort): Promise<PortInfo> {
  try {
    const info = await port.getInfo()
    const vendor = info.usbVendorId ? info.usbVendorId.toString(16).toUpperCase().padStart(4, '0') : '未知'
    const product = info.usbProductId ? info.usbProductId.toString(16).toUpperCase().padStart(4, '0') : '未知'
    return {
      vendorId: info.usbVendorId,
      productId: info.usbProductId,
      label: `USB VID ${vendor} / PID ${product}`
    }
  } catch {
    return { label: '串口设备' }
  }
}

/** 解析 Arduino-ESP32 / Arduino 编译输出中的结构化错误 */
export function parseBuildErrors(output: string): BuildError[] {
  const errors: BuildError[] = []
  const lines = output.split('\n')
  const errorRegex = /^(\.\/)?(?:[A-Za-z]:\\)?([^:]+):(\d+)(?::(\d+))?:\s*(error|warning|note):\s*(.+)$/
  for (const line of lines) {
    const m = line.match(errorRegex)
    if (m) {
      errors.push({
        severity: m[5] === 'error' ? 'error' : m[5] === 'warning' ? 'warning' : 'info',
        file: m[2].replace(/\\/g, '/'),
        line: parseInt(m[3], 10),
        col: m[4] ? parseInt(m[4], 10) : undefined,
        message: m[6].trim()
      })
    }
  }
  return errors
}

function classifyError(err: unknown, context: 'connect' | 'flash'): SerialError {
  const msg = String(err)
  if (/Access denied|permission/i.test(msg)) {
    return new SerialError({ category: 'port', message: '串口被占用或无权限', hint: '关闭 Arduino IDE / 串口助手后重试' })
  }
  if (/timeout|TimeoutError/i.test(msg)) {
    return new SerialError({
      category: 'timeout',
      message: context === 'flash' ? '烧录超时' : '连接超时',
      hint: '按住开发板 BOOT 键再点重试，松开后自动进入下载模式'
    })
  }
  if (/handshake|sync/i.test(msg)) {
    return new SerialError({
      category: 'handshake',
      message: '握手失败，开发板未进入下载模式',
      hint: '按住 BOOT + 点 RST，松开 BOOT 后再重试'
    })
  }
  if (/connect|Not open/i.test(msg)) {
    return new SerialError({
      category: 'connect',
      message: '连接失败',
      hint: '检查 USB 线、驱动和串口是否正确'
    })
  }
  if (/unsupported|not supported/i.test(msg)) {
    return new SerialError({
      category: 'unsupported',
      message: '芯片或操作不受支持',
      hint: '该芯片暂不支持此操作'
    })
  }
  return new SerialError({ category: context === 'flash' ? 'flash' : 'connect', message: msg })
}

/** 分片读取 Flash，避免一次性大请求超时 */
async function readFlashSharded(
  loader: ESPLoader,
  start: number,
  size: number,
  chunkSize = 0x10000,
  onProgress?: (read: number, total: number) => void
): Promise<Uint8Array> {
  const out = new Uint8Array(size)
  let offset = start
  let read = 0
  while (read < size) {
    const thisChunk = Math.min(chunkSize, size - read)
    const buf = await (loader as unknown as {
      readFlash: (addr: number, length: number) => Promise<Uint8Array>
    }).readFlash(offset, thisChunk)
    out.set(buf, read)
    read += thisChunk
    offset += thisChunk
    onProgress?.(read, size)
  }
  return out
}

export class SerialManager {
  port: SerialPort | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private monitorStop = false
  private active = false

  async pickPort(): Promise<SerialPort> {
    if (!serialSupported()) {
      throw new SerialError({ category: 'unsupported', message: '当前环境不支持 Web Serial', hint: '请使用桌面客户端' })
    }
    const port = await navigator.serial.requestPort()
    this.port = port
    return port
  }

  async usePort(port: SerialPort): Promise<void> {
    this.port = port
  }

  async grantedPorts(): Promise<SerialPort[]> {
    if (!serialSupported()) return []
    return navigator.serial.getPorts()
  }

  get hasPort(): boolean {
    return this.port !== null
  }

  get monitoring(): boolean {
    return this.active
  }

  private async closePortQuietly(): Promise<void> {
    if (!this.port) return
    try {
      await this.port.close()
    } catch {
      // 端口本来就没有打开
    }
  }

  /**
   * 检测芯片信息：进入下载模式并读取芯片型号、Flash 大小、MAC。
   * 返回 ChipInfo 或抛出 SerialError。
   */
  async readChipInfo(opts: { baudrate?: number; onLog?: (line: string) => void } = {}): Promise<ChipInfo> {
    if (!this.port) throw new SerialError({ category: 'port', message: '请先选择串口设备' })
    await this.closePortQuietly()

    const transport = new Transport(this.port, true)
    const terminal = {
      clean: (): void => undefined,
      writeLine: (text: string): void => opts.onLog?.(text),
      write: (text: string): void => {
        if (text.trim()) opts.onLog?.(text)
      }
    }
    const baudrate = opts.baudrate ?? 460800
    const loader = new ESPLoader({ transport, baudrate, romBaudrate: 115200, terminal })

    try {
      const chip = await loader.main()
      const flashSizeBytes = await (loader as unknown as {
        getFlashSize: () => Promise<number>
      }).getFlashSize?.() ?? 0

      // 读取 MAC：ESP32 系列在 EFUSE block0 MAC 寄存器
      const macBytes = await (loader as unknown as {
        readRegister: (addr: number) => Promise<number>
      }).readRegister?.(0x3FF00050)
      let mac = ''
      if (typeof macBytes === 'number') {
        const lo = macBytes & 0xffffffff
        const macParts = [
          (lo & 0xff).toString(16).padStart(2, '0'),
          ((lo >> 8) & 0xff).toString(16).padStart(2, '0'),
          ((lo >> 16) & 0xff).toString(16).padStart(2, '0'),
          ((lo >> 24) & 0xff).toString(16).padStart(2, '0')
        ]
        // 从 EFUSE 读第二个字补高 2 字节
        try {
          const hi = await (loader as unknown as {
            readRegister: (addr: number) => Promise<number>
          }).readRegister?.(0x3FF00054)
          if (typeof hi === 'number') {
            macParts.push(((hi >> 0) & 0xff).toString(16).padStart(2, '0'))
            macParts.push(((hi >> 8) & 0xff).toString(16).padStart(2, '0'))
          }
        } catch {
          // 忽略
        }
        mac = macParts.join(':').toUpperCase()
      }

      return {
        chip,
        flashSizeBytes,
        flashSizeLabel: flashSizeBytes ? `${flashSizeBytes / 1024 / 1024} MB` : '未知',
        mac: mac || '未知'
      }
    } catch (err) {
      throw classifyError(err, 'connect')
    } finally {
      try {
        await transport.disconnect()
      } catch {
        // ignore
      }
    }
  }

  /** 从指定地址读取指定大小的 Flash 内容（分片读取） */
  async readFlash(
    start: number,
    size: number,
    opts: { baudrate?: number; onLog?: (line: string) => void; onProgress?: (read: number, total: number) => void } = {}
  ): Promise<Uint8Array> {
    if (!this.port) throw new SerialError({ category: 'port', message: '请先选择串口设备' })
    await this.closePortQuietly()

    const transport = new Transport(this.port, true)
    const terminal = {
      clean: (): void => undefined,
      writeLine: (text: string): void => opts.onLog?.(text),
      write: (text: string): void => {
        if (text.trim()) opts.onLog?.(text)
      }
    }
    const baudrate = opts.baudrate ?? 460800
    const loader = new ESPLoader({ transport, baudrate, romBaudrate: 115200, terminal })

    try {
      opts.onLog?.(`读取 Flash: 0x${start.toString(16)} + ${size} 字节`)
      await loader.main()
      return await readFlashSharded(loader, start, size, 0x10000, opts.onProgress)
    } catch (err) {
      throw classifyError(err, 'connect')
    } finally {
      try {
        await transport.disconnect()
      } catch {
        // ignore
      }
    }
  }

  /** 烧录，增加阶段回调和结构化错误 */
  async flash(files: FlashFile[], opts: FlashOptions): Promise<string> {
    if (!this.port) throw new SerialError({ category: 'port', message: '请先选择串口设备' })
    if (files.length === 0) throw new SerialError({ category: 'flash', message: '没有可烧录的固件文件' })
    const baudrate = opts.baudrate ?? 460800
    await this.closePortQuietly()

    opts.onStage?.('connect')
    opts.onLog('正在连接开发板…')

    const transport = new Transport(this.port, true)
    const terminal = {
      clean: (): void => undefined,
      writeLine: (text: string): void => opts.onLog(text),
      write: (text: string): void => {
        if (text.trim()) opts.onLog(text)
      }
    }
    const loader = new ESPLoader({
      transport,
      baudrate,
      romBaudrate: 115200,
      terminal
    })

    let chip = 'unknown'
    try {
      opts.onStage?.('detect')
      chip = await loader.main()
      opts.onLog(`检测到芯片: ${chip}`)

      opts.onStage?.('erase')
      if (opts.eraseAll) opts.onLog('擦除整片 Flash…')
      else opts.onLog('保留现有未覆盖区域…')

      opts.onStage?.('write')
      opts.onLog('开始写入固件…')
      await loader.writeFlash({
        fileArray: files.map((f) => ({ data: f.data, address: f.address })),
        flashMode: 'keep',
        flashFreq: 'keep',
        flashSize: 'keep',
        eraseAll: opts.eraseAll ?? false,
        compress: true,
        reportProgress: (fileIndex, written, total) => {
          opts.onProgress?.(written, total, fileIndex)
        }
      })

      opts.onStage?.('verify')
      opts.onLog('校验写入数据…')
      opts.onStage?.('reset')
      await loader.after('hard_reset')
      opts.onStage?.('done')
      opts.onLog('烧录完成，设备已重启')
      return chip
    } catch (err) {
      throw classifyError(err, 'flash')
    } finally {
      try {
        await transport.disconnect()
      } catch {
        // 忽略断开异常
      }
    }
  }

  async openMonitor(baudRate: number, onData: (text: string) => void): Promise<void> {
    if (!this.port) throw new SerialError({ category: 'port', message: '请先选择串口设备' })
    await this.closePortQuietly()
    await this.port.open({ baudRate, bufferSize: 2048 })
    this.monitorStop = false
    this.active = true
    const readable = this.port.readable
    if (!readable) throw new SerialError({ category: 'unsupported', message: '串口不可读' })
    const decoder = new TextDecoder()
    this.reader = readable.getReader()
    try {
      while (!this.monitorStop) {
        const { value, done } = await this.reader.read()
        if (done) break
        if (value) onData(decoder.decode(value, { stream: true }))
      }
    } catch {
      // 取消读取时抛出的异常
    } finally {
      this.active = false
      try {
        this.reader?.releaseLock()
      } catch {
        // ignore
      }
      this.reader = null
      await this.closePortQuietly()
    }
  }

  async stopMonitor(): Promise<void> {
    this.monitorStop = true
    try {
      await this.reader?.cancel()
    } catch {
      // ignore
    }
  }

  async send(text: string): Promise<void> {
    if (!this.port || !this.port.writable) throw new SerialError({ category: 'port', message: '串口未打开' })
    const writer = this.port.writable.getWriter()
    await writer.write(new TextEncoder().encode(text))
    writer.releaseLock()
  }
}

export const serialManager = new SerialManager()
