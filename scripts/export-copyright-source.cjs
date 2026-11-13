/**
 * 软著登记鉴别材料导出：源程序前 30 页 + 后 30 页（每页 50 行）。
 * 用法：node scripts/export-copyright-source.cjs
 */
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const OUT = path.join(ROOT, 'store', 'tencent', '05-软著', '源代码-前后各30页.txt')
const PAGE_LINES = 50
const PAGES = 30
const EXT = new Set(['.ts', '.tsx', '.css', '.html'])

function walk(dir, acc) {
  for (const name of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, acc)
    else if (EXT.has(path.extname(name))) acc.push(p)
  }
  return acc
}

const files = walk(path.join(ROOT, 'src'), [])
let lines = []
for (const f of files) {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/')
  const content = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\t/g, '  ')
  lines.push(`/* ===== ${rel} ===== */`)
  lines.push(...content.split('\n'))
  lines.push('')
}
lines = lines.map((l) => (l.length > 0 ? l : ' '))

const totalPages = Math.ceil(lines.length / PAGE_LINES)
const pick =
  totalPages <= PAGES * 2
    ? lines
    : [...lines.slice(0, PAGE_LINES * PAGES), ...lines.slice(-PAGE_LINES * PAGES)]

const header = [
  'NovaForge Studio 嵌入式固件开发软件 V1.0',
  '源程序鉴别材料（前 30 页 + 后 30 页，每页 50 行）',
  `源程序总行数：${lines.length} 行，共 ${totalPages} 页`,
  '',
]
const body = []
for (let i = 0; i < pick.length; i += PAGE_LINES) {
  const pageNo = i / PAGE_LINES + 1
  body.push(`---------- 第 ${pageNo} 页 ----------`)
  body.push(...pick.slice(i, i + PAGE_LINES))
}
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, header.concat(body).join('\n'), 'utf8')
console.log(`文件数: ${files.length}, 总行数: ${lines.length}, 总页数: ${totalPages}`)
console.log(`已导出: ${OUT}`)
