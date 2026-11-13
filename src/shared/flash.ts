import type { Board, BuildArtifact } from './types'

export const BOOT_APP0_OFFSET = 0xe000
export const PARTITION_OFFSET = 0x8000
export const APP_OFFSET = 0x10000

export interface FlashTarget {
  address: number
  name: string
  size: number
}

export function resolveFlashTargets(board: Board, artifacts: BuildArtifact[]): FlashTarget[] {
  if (board.family === 'esp8266') {
    // ESP8266 单合并镜像，写入 0x00000
    const app =
      artifacts.find((a) => a.name.endsWith('.ino.bin')) ||
      artifacts.find((a) => a.name.endsWith('.bin'))
    return app ? [{ address: 0x0, name: app.name, size: app.size }] : []
  }
  if (board.family !== 'esp32') return []
  const merged = artifacts.find((a) => a.name.includes('merged'))
  if (merged) return [{ address: 0x0, name: merged.name, size: merged.size }]

  const targets: FlashTarget[] = []
  const bootloader = artifacts.find((a) => a.name.includes('bootloader'))
  const partitions = artifacts.find((a) => a.name.includes('partitions'))
  const bootApp0 = artifacts.find((a) => a.name.includes('boot_app0'))
  const app = artifacts.find(
    (a) => a.name.endsWith('.ino.bin') && !a.name.includes('bootloader') && !a.name.includes('partitions')
  )

  if (bootloader) {
    targets.push({ address: board.bootloaderOffset ?? 0x1000, name: bootloader.name, size: bootloader.size })
  }
  if (partitions) targets.push({ address: PARTITION_OFFSET, name: partitions.name, size: partitions.size })
  if (bootApp0) targets.push({ address: BOOT_APP0_OFFSET, name: bootApp0.name, size: bootApp0.size })
  if (app) targets.push({ address: APP_OFFSET, name: app.name, size: app.size })
  return targets
}

export function addressHex(address: number): string {
  return '0x' + address.toString(16).toUpperCase().padStart(4, '0')
}

export function base64ToBytes(b64: string): Uint8Array {
  const raw = atob(b64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}
