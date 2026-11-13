const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const OUT_DIR = path.join(__dirname, '..', 'build')
const SIZE = 512

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#111a24"/>
      <stop offset="1" stop-color="#0a0f15"/>
    </linearGradient>
    <linearGradient id="bolt" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5ef2ff"/>
      <stop offset="1" stop-color="#1fa8c9"/>
    </linearGradient>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="10" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect x="8" y="8" width="496" height="496" rx="112" fill="url(#bg)"/>
  <rect x="8" y="8" width="496" height="496" rx="112" fill="none" stroke="#1d3a4a" stroke-width="6"/>
  <!-- chip body -->
  <rect x="156" y="136" width="200" height="240" rx="20" fill="none" stroke="#2ec5e0" stroke-width="14" opacity="0.85"/>
  <!-- pins -->
  <g stroke="#2ec5e0" stroke-width="12" stroke-linecap="round" opacity="0.85">
    <line x1="120" y1="184" x2="156" y2="184"/>
    <line x1="120" y1="256" x2="156" y2="256"/>
    <line x1="120" y1="328" x2="156" y2="328"/>
    <line x1="356" y1="184" x2="392" y2="184"/>
    <line x1="356" y1="256" x2="392" y2="256"/>
    <line x1="356" y1="328" x2="392" y2="328"/>
  </g>
  <!-- lightning bolt -->
  <path d="M286 168 L212 288 h52 l-24 96 96 -134 h-56 z"
        fill="url(#bolt)" filter="url(#glow)"/>
</svg>`

function pngInIco(pngBuffers) {
  // ICO container with PNG-compressed entries (supported since Vista)
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(pngBuffers.length, 4)
  const entries = []
  let offset = 6 + pngBuffers.length * 16
  for (const { size, data } of pngBuffers) {
    const e = Buffer.alloc(16)
    e.writeUInt8(size >= 256 ? 0 : size, 0)
    e.writeUInt8(size >= 256 ? 0 : size, 1)
    e.writeUInt8(0, 2)
    e.writeUInt8(0, 3)
    e.writeUInt16LE(1, 4)
    e.writeUInt16LE(32, 6)
    e.writeUInt32LE(data.length, 8)
    e.writeUInt32LE(offset, 12)
    entries.push(e)
    offset += data.length
  }
  return Buffer.concat([header, ...entries, ...pngBuffers.map((p) => p.data)])
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: SIZE,
    height: SIZE,
    transparent: true,
    webPreferences: { sandbox: true }
  })

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:transparent">${svg}</body></html>`
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))

  await new Promise((r) => setTimeout(r, 300))
  const image = await win.webContents.capturePage()

  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(path.join(OUT_DIR, 'icon.png'), image.toPNG())

  const sizes = [16, 32, 48, 64, 128, 256]
  const entries = sizes.map((s) => ({
    size: s,
    data: image.resize({ width: s, height: s }).toPNG()
  }))
  fs.writeFileSync(path.join(OUT_DIR, 'icon.ico'), pngInIco(entries))

  console.log('icon written:', OUT_DIR)
  app.quit()
})
