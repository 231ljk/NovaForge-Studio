import { ESPLoader, Transport } from 'esptool-js'

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

export class SerialManager {
  port: SerialPort | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private monitorStop = false
  private active = false

  async pickPort(): Promise<SerialPort> {
    if (!serialSupported()) {
      throw new Error('当前环境不支持 Web Serial，请使用 Windows 桌面客户端。')
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

  async flash(files: FlashFile[], opts: FlashOptions): Promise<string> {
    if (!this.port) throw new Error('请先选择串口设备')
    if (files.length === 0) throw new Error('没有可烧录的固件文件')
    const baudrate = opts.baudrate ?? 460800
    await this.closePortQuietly()

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

    try {
      const chip = await loader.main()
      opts.onLog(`检测到芯片: ${chip}`)
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
      await loader.after('hard_reset')
      return chip
    } finally {
      try {
        await transport.disconnect()
      } catch {
        // 忽略断开异常
      }
    }
  }

  async openMonitor(baudRate: number, onData: (text: string) => void): Promise<void> {
    if (!this.port) throw new Error('请先选择串口设备')
    await this.closePortQuietly()
    await this.port.open({ baudRate, bufferSize: 2048 })
    this.monitorStop = false
    this.active = true
    const readable = this.port.readable
    if (!readable) throw new Error('串口不可读')
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
    if (!this.port || !this.port.writable) throw new Error('串口未打开')
    const writer = this.port.writable.getWriter()
    await writer.write(new TextEncoder().encode(text))
    writer.releaseLock()
  }
}

export const serialManager = new SerialManager()
