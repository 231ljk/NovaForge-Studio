/**
 * 串口 Flash 备份工具：命名、分片拼接、校验和、可读配置扫描。
 * 被 DevicePage 纳管向导和 SerialManager 读写流程引用。
 */

/** 备份文件元信息，写入 .nfbackup.json sidecar */
export interface BackupMeta {
  version: 1
  chip: string
  flashSizeBytes: number
  mac: string
  startAddress: number
  sizeBytes: number
  sha256?: string
  createdAt: string // ISO
  /** 从固件中扫描到的可读配置（如果有） */
  extracted?: {
    ssid?: string
    haUrl?: string
    deviceName?: string
    manufacturer?: 'novaforge' | 'unknown'
  }
}

const NOVA_MAGIC = new Uint8Array([0x4e, 0x46, 0x5f, 0x4e, 0x4f, 0x56, 0x41]) // "NF_NOVA"
const WIFI_SSID_PATTERNS = ['NOFORGE_SSID', 'ssid=', 'ssid:', 'WIFI_SSID']
const HA_URL_PATTERNS = ['homeassistant.local', 'http://192.168', 'ha_url', 'HA_URL']

export function backupFileName(chip: string, startAddr: number, size: number): string {
  const date = new Date().toISOString().slice(0, 10)
  const chipSlug = chip.replace(/[^a-z0-9]/gi, '_').toLowerCase()
  return `novaforge-backup-${chipSlug}-0x${startAddr.toString(16).toUpperCase()}-${size}-${date}.bin`
}

export function backupMetaFileName(binName: string): string {
  return binName.replace(/\.bin$/, '.nfbackup.json')
}

/** 简单的 SHA-256 计算（TextEncoder + SubtleCrypto） */
export async function sha256(data: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', data as unknown as ArrayBuffer)
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return hex
}

/**
 * 在固件二进制中扫描可读配置。
 * 不反编译，只找可见 ASCII 字符串模式。
 */
export function scanExtractableConfig(data: Uint8Array): BackupMeta['extracted'] {
  const text = new TextDecoder('ascii', { fatal: false }).decode(data)
  const lower = text.toLowerCase()

  // 查找 NovaForge 品牌标记
  const hasNovaMagic = NOVA_MAGIC.every(
    (b, i) => data[i] === b || lower.includes('novaforge') || lower.includes('nf_device')
  )

  // 查找 WiFi SSID（启发式：在常见 SSID 模式附近抓 2-32 字符）
  let ssid: string | undefined
  for (const pat of WIFI_SSID_PATTERNS) {
    const idx = lower.indexOf(pat.toLowerCase())
    if (idx >= 0) {
      const snippet = text.slice(idx + pat.length, idx + pat.length + 40)
      const match = snippet.match(/[:= ]*["']?([A-Za-z0-9_\-]{2,32})["']?/)
      if (match && match[1] && match[1].length >= 2) {
        ssid = match[1]
        break
      }
    }
  }

  // 查找 Home Assistant URL
  let haUrl: string | undefined
  for (const pat of HA_URL_PATTERNS) {
    const idx = lower.indexOf(pat.toLowerCase())
    if (idx >= 0) {
      const snippet = text.slice(Math.max(0, idx - 5), idx + 80)
      const match = snippet.match(/https?:\/\/[^\s"',<>]+/)
      if (match) {
        haUrl = match[0]
        break
      }
    }
  }

  // 查找设备名
  let deviceName: string | undefined
  const nameIdx = lower.indexOf('device_name')
  if (nameIdx >= 0) {
    const snippet = text.slice(nameIdx + 11, nameIdx + 11 + 40)
    const match = snippet.match(/[:= ]*["']?([A-Za-z0-9_\-]{2,32})["']?/)
    if (match && match[1]) deviceName = match[1]
  }

  return {
    manufacturer: hasNovaMagic ? 'novaforge' : 'unknown',
    ssid,
    haUrl,
    deviceName
  }
}

/** 判断备份是否来自 NovaForge 官方固件（简单启发） */
export function isNovaForgeFirmware(data: Uint8Array): boolean {
  const extracted = scanExtractableConfig(data)
  return (extracted?.manufacturer ?? 'unknown') === 'novaforge'
}

export function buildMeta(
  binName: string,
  chip: string,
  flashSizeBytes: number,
  mac: string,
  startAddress: number,
  data: Uint8Array,
  digest: string
): BackupMeta {
  return {
    version: 1,
    chip,
    flashSizeBytes,
    mac,
    startAddress,
    sizeBytes: data.length,
    sha256: digest,
    createdAt: new Date().toISOString(),
    extracted: scanExtractableConfig(data)
  }
}

export function downloadBackup(bin: Uint8Array, meta: BackupMeta): void {
  const binName = backupFileName(meta.chip, meta.startAddress, meta.sizeBytes)
  const blob = new Blob([bin as unknown as ArrayBuffer], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = binName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)

  // 同时下载 sidecar meta
  const metaBlob = new Blob([JSON.stringify(meta, null, 2)], { type: 'application/json' })
  const metaUrl = URL.createObjectURL(metaBlob)
  const a2 = document.createElement('a')
  a2.href = metaUrl
  a2.download = backupMetaFileName(binName)
  document.body.appendChild(a2)
  a2.click()
  a2.remove()
  URL.revokeObjectURL(metaUrl)
}
