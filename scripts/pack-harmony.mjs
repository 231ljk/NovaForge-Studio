/**
 * 构建鸿蒙（HarmonyOS Stage 模型）HAP 包
 *
 * 说明：
 * 1. hvigor 不接受含非 ASCII 字符的项目路径，因此先把 harmony/ 复制到英文临时目录再构建；
 * 2. 移动端网页资产从 src/mobile 同步到 entry/src/main/resources/rawfile；
 * 3. 产物复制回 release/。未配置签名时得到的是 unsigned HAP，需在 DevEco Studio 中签名后安装。
 *
 * 用法：npm run pack:harmony
 */
import { cpSync, existsSync, mkdirSync, copyFileSync, readFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DEVECO = process.env.DEVECO_HOME ?? 'C:\\Program Files\\Huawei\\DevEco Studio'
const BUILD_DIR = process.env.HVIGOR_BUILD_DIR ?? 'C:\\hfbuild\\novaforge-harmony'
const version = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version

const harmonyDir = path.join(root, 'harmony')
const rawfile = path.join(harmonyDir, 'entry', 'src', 'main', 'resources', 'rawfile')

if (!existsSync(path.join(DEVECO, 'tools', 'hvigor', 'bin', 'hvigorw.bat'))) {
  console.error(`未找到 DevEco Studio: ${DEVECO}（可通过 DEVECO_HOME 环境变量指定）`)
  process.exit(1)
}

// 1. 同步移动端网页资产
mkdirSync(rawfile, { recursive: true })
cpSync(path.join(root, 'src', 'mobile'), rawfile, { recursive: true })

// 2. 复制到英文路径（保留上次构建缓存，加快增量编译）
mkdirSync(BUILD_DIR, { recursive: true })
cpSync(harmonyDir, BUILD_DIR, {
  recursive: true,
  force: true,
  filter: (src) => {
    const rel = path.relative(harmonyDir, src)
    return !/(^|[\\/])(\.hvigor|node_modules|oh_modules|build)([\\/]|$)/.test(rel)
  }
})

// 3. 调用 hvigor 构建
const result = spawnSync(
  `"${path.join(DEVECO, 'tools', 'hvigor', 'bin', 'hvigorw.bat')}" --mode module -p product=default assembleHap --no-daemon`,
  {
    cwd: BUILD_DIR,
    stdio: 'inherit',
    env: {
      ...process.env,
      DEVECO_SDK_HOME: path.join(DEVECO, 'sdk'),
      PATH: `${path.join(DEVECO, 'tools', 'node')};${process.env.PATH}`,
      // 本机提交内存（pagefile）偏小，堆限得过大会在提交时直接失败，故取较小值
      NODE_OPTIONS: '--max-old-space-size=640 --max-semi-space-size=4'
    },
    shell: true
  }
)
if (result.status !== 0) {
  console.error('鸿蒙构建失败')
  process.exit(result.status ?? 1)
}

// 4. 收集产物
const outDir = path.join(BUILD_DIR, 'entry', 'build', 'default', 'outputs')
const findHap = (dir) => {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name)
    if (item.isDirectory()) {
      const found = findHap(full)
      if (found) return found
    } else if (item.name.endsWith('.hap')) {
      return full
    }
  }
  return null
}

const hap = findHap(outDir)
if (!hap) {
  console.error('未找到 HAP 产物')
  process.exit(1)
}
const target = path.join(
  root,
  'release',
  `NovaForge-Studio-${version}-harmony${hap.includes('unsigned') ? '-unsigned' : ''}.hap`
)
mkdirSync(path.dirname(target), { recursive: true })
copyFileSync(hap, target)
console.log(`完成: ${target}`)
