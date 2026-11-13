/**
 * 生成 Linux .deb 安装包
 *
 * 背景：在 Windows 上 electron-builder 的 deb 目标依赖 fpm（仅 Linux/macOS 可用），
 * AppImage 目标需要对图标创建符号链接（需要管理员权限）。因此这里直接按 deb 规范
 * （!<arch> + control.tar.gz + data.tar.gz）打包 release/linux-unpacked 目录。
 *
 * 用法：npm run pack:linux:deb
 */
import { createReadStream, createWriteStream, existsSync } from 'node:fs'
import { mkdir, readdir, stat, writeFile, open, rm } from 'node:fs/promises'
import { createGzip } from 'node:zlib'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP_ID = 'novaforge-studio'
const VERSION = JSON.parse(await readFileText(path.join(root, 'package.json'))).version
const SRC = path.join(root, 'release', 'linux-unpacked')
const OUT = path.join(root, 'release', `NovaForge-Studio-${VERSION}-amd64.deb`)
const PREFIX = `opt/${APP_ID}`
const EXECUTABLES = new Set(['novaforge-studio', 'chrome-sandbox', 'chrome_crashpad_handler'])

async function readFileText(p) {
  const chunks = []
  for await (const c of createReadStream(p)) chunks.push(c)
  return Buffer.concat(chunks).toString('utf8')
}

/* ---------------- tar 写入 ---------------- */
function octal(value, len) {
  return value.toString(8).padStart(len - 1, '0') + '\0'
}

function tarHeader(name, { mode = 0o644, size = 0, type = '0', linkname = '' } = {}) {
  const header = Buffer.alloc(512, 0)
  let fileName = name
  let prefix = ''
  if (Buffer.byteLength(name) > 100) {
    const idx = name.lastIndexOf('/', name.length - 101)
    if (idx <= 0) throw new Error(`路径过长且无法切分: ${name}`)
    prefix = name.slice(0, idx)
    fileName = name.slice(idx + 1)
    if (Buffer.byteLength(fileName) > 100 || Buffer.byteLength(prefix) > 155) {
      throw new Error(`路径过长: ${name}`)
    }
  }
  header.write(fileName, 0, 100, 'utf8')
  header.write(octal(mode, 8), 100, 8, 'ascii')
  header.write(octal(0, 8), 108, 8, 'ascii')
  header.write(octal(0, 8), 116, 8, 'ascii')
  header.write(octal(size, 12), 124, 12, 'ascii')
  header.write(octal(0, 12), 136, 12, 'ascii')
  header.write('        ', 148, 8, 'ascii')
  header.write(type, 156, 1, 'ascii')
  header.write(linkname, 157, 100, 'utf8')
  header.write('ustar\0', 257, 6, 'ascii')
  header.write('00', 263, 2, 'ascii')
  header.write('root', 265, 32, 'ascii')
  header.write('root', 297, 32, 'ascii')
  header.write(prefix, 345, 155, 'utf8')

  let sum = 0
  for (const byte of header) sum += byte
  header.write(octal(sum, 7) + ' ', 148, 8, 'ascii')
  return header
}

function pad512(size) {
  const rest = size % 512
  return rest === 0 ? Buffer.alloc(0) : Buffer.alloc(512 - rest, 0)
}

async function writeStreamTo(out, stream) {
  for await (const chunk of stream) {
    if (!out.write(chunk)) await new Promise((r) => out.once('drain', r))
  }
}

/**
 * 把 dir 打包为 tar.gz，entries 里的 name 为包内路径
 */
async function tarGz(entries, target) {
  const out = createWriteStream(target)
  const gzip = createGzip({ level: 9 })
  gzip.pipe(out)
  const write = (buf) =>
    new Promise((resolve) => {
      if (gzip.write(buf)) resolve()
      else gzip.once('drain', resolve)
    })

  for (const entry of entries) {
    if (entry.type === '5') {
      await write(tarHeader(entry.name, { mode: 0o755, type: '5' }))
      continue
    }
    if (entry.type === '2') {
      await write(tarHeader(entry.name, { mode: 0o777, type: '2', linkname: entry.linkname }))
      continue
    }
    const st = await stat(entry.file)
    await write(tarHeader(entry.name, { mode: entry.mode ?? 0o644, size: st.size, type: '0' }))
    await writeStreamTo(gzip, createReadStream(entry.file))
    const padding = pad512(st.size)
    if (padding.length) await write(padding)
  }

  await write(Buffer.alloc(1024, 0))
  gzip.end()
  await new Promise((resolve, reject) => {
    out.on('close', resolve)
    out.on('error', reject)
    gzip.on('error', reject)
  })
}

/** 递归收集目录内容为 tar 条目 */
async function collect(dir, inTar, entries) {
  const items = await readdir(dir, { withFileTypes: true })
  for (const item of items) {
    const full = path.join(dir, item.name)
    const name = `${inTar}/${item.name}`
    if (item.isDirectory()) {
      entries.push({ name, type: '5' })
      await collect(full, name, entries)
    } else if (item.isSymbolicLink()) {
      entries.push({ name, type: '2', linkname: item.name })
    } else {
      entries.push({
        name,
        type: '0',
        file: full,
        size: (await stat(full)).size,
        mode: EXECUTABLES.has(item.name) ? (item.name === 'chrome-sandbox' ? 0o4755 : 0o755) : 0o644
      })
    }
  }
}

/* ---------------- ar 写入 ---------------- */
function arEntry(name, data) {
  const header = Buffer.alloc(60, 0x20)
  header.write(name.padEnd(16, ' '), 0, 16, 'ascii')
  header.write(String(Math.floor(Date.now() / 1000)).padEnd(12, ' '), 16, 12, 'ascii')
  header.write('0'.padEnd(6, ' '), 28, 6, 'ascii')
  header.write('0'.padEnd(6, ' '), 34, 6, 'ascii')
  header.write('100644'.padEnd(8, ' '), 40, 8, 'ascii')
  header.write(String(data.length).padEnd(10, ' '), 48, 10, 'ascii')
  header.write('`\n', 58, 2, 'ascii')
  const padding = data.length % 2 ? Buffer.from('\n') : Buffer.alloc(0)
  return Buffer.concat([header, data, padding])
}

/* ---------------- 主流程 ---------------- */
if (!existsSync(SRC)) {
  console.error('缺少 release/linux-unpacked，请先执行 electron-builder --linux dir')
  process.exit(1)
}

const tmp = path.join(process.env.TEMP ?? '/tmp', 'novaforge-deb')
await rm(tmp, { recursive: true, force: true })
await mkdir(tmp, { recursive: true })

console.log('收集应用文件…')
const entries = [{ name: `./${PREFIX}`, type: '5' }]
await collect(SRC, `./${PREFIX}`, entries)

// 启动器脚本与桌面入口
const launcher = path.join(tmp, 'launcher')
await writeFile(
  launcher,
  `#!/bin/sh\nexec /${PREFIX}/${'novaforge-studio'} "$@"\n`,
  { mode: 0o755 }
)
const desktop = path.join(tmp, `${APP_ID}.desktop`)
await writeFile(
  desktop,
  `[Desktop Entry]
Type=Application
Name=NovaForge Studio
Comment=ESP32 / Raspberry Pi firmware IDE, flashing and device control
Exec=/${PREFIX}/novaforge-studio %U
Icon=${APP_ID}
Terminal=false
Categories=Development;
StartupWMClass=NovaForge Studio
`
)

const iconSrc = path.join(root, 'build', 'icon.png')
const hasIcon = existsSync(iconSrc)
entries.push({ name: './opt', type: '5' })
entries.push({ name: './usr', type: '5' })
entries.push({ name: './usr/share', type: '5' })
if (hasIcon) {
  entries.push({ name: './usr/share/icons', type: '5' })
  entries.push({ name: './usr/share/icons/hicolor', type: '5' })
  entries.push({ name: './usr/share/icons/hicolor/512x512', type: '5' })
  entries.push({ name: './usr/share/icons/hicolor/512x512/apps', type: '5' })
  entries.push({ name: `./usr/share/icons/hicolor/512x512/apps/${APP_ID}.png`, type: '0', file: iconSrc, mode: 0o644 })
}
entries.push({ name: './usr/share/applications', type: '5' })
entries.push({ name: `./usr/share/applications/${APP_ID}.desktop`, type: '0', file: desktop, mode: 0o644 })
entries.push({ name: './usr/bin', type: '5' })
entries.push({ name: `./usr/bin/${APP_ID}`, type: '0', file: launcher, mode: 0o755 })

console.log('打包 data.tar.gz…')
const dataTar = path.join(tmp, 'data.tar.gz')
await tarGz(entries, dataTar)

const installedKb = Math.round(
  entries.reduce((sum, e) => sum + (e.type === '0' ? e.size ?? 0 : 0), 0) / 1024
)
const control = `Package: ${APP_ID}
Version: ${VERSION}
Section: devel
Priority: optional
Architecture: amd64
Maintainer: NovaForge <dev@novaforge.local>
Installed-Size: ${installedKb}
Depends: libgtk-3-0, libnotify4, libnss3, libxss1, libxtst6, libatspi2.0-0, libsecret-1-0, libgbm1, libasound2, xdg-utils
Description: NovaForge Studio
 ESP32 / Raspberry Pi firmware IDE, with build, flashing and device control.
`

console.log('打包 control.tar.gz…')
const controlDir = path.join(tmp, 'control')
await mkdir(controlDir, { recursive: true })
await writeFile(path.join(controlDir, 'control'), control)
const controlTar = path.join(tmp, 'control.tar.gz')
await tarGz(
  [
    { name: '.', type: '5' },
    { name: './control', type: '0', file: path.join(controlDir, 'control'), mode: 0o644 }
  ],
  controlTar
)

console.log('写入 deb…')
const debBin = Buffer.from('2.0\n')
const controlBuf = await readAll(controlTar)
const handle = await open(OUT, 'w')
await handle.write(Buffer.from('!<arch>\n'))
await handle.write(arEntry('debian-binary', debBin))
await handle.write(arEntry('control.tar.gz', controlBuf))
await handle.write(arEntry('data.tar.gz', await readAll(dataTar)))
await handle.close()

const size = (await stat(OUT)).size
console.log(`完成: ${OUT} (${(size / 1024 / 1024).toFixed(1)} MB)`)
await rm(tmp, { recursive: true, force: true })

async function readAll(p) {
  const chunks = []
  for await (const c of createReadStream(p)) chunks.push(c)
  return Buffer.concat(chunks)
}
