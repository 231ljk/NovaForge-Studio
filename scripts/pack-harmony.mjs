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
import { cpSync, existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
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

// 可选：从环境变量注入发布签名。只修改英文临时目录中的配置，避免密码进入仓库。
/** 从 p7b（PKCS#7）中取出 profile 的 bundle-name */
function readProfileBundleName(profilePath) {
  try {
    const buf = readFileSync(profilePath)
    const start = buf.indexOf('{"')
    const end = buf.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    const json = JSON.parse(buf.subarray(start, end + 1).toString('utf8'))
    return json['bundle-info']?.['bundle-name'] ?? null
  } catch {
    return null
  }
}

const signingKeys = [
  'HARMONY_STORE_FILE',
  'HARMONY_CERT_PATH',
  'HARMONY_PROFILE',
  'HARMONY_STORE_PASSWORD',
  'HARMONY_KEY_ALIAS',
  'HARMONY_KEY_PASSWORD'
]
const signingRequested = signingKeys.some((key) => Boolean(process.env[key]))
if (signingRequested) {
  const missing = signingKeys.filter((key) => !process.env[key])
  if (missing.length) {
    console.error(`鸿蒙签名配置不完整，缺少：${missing.join(', ')}`)
    process.exit(1)
  }
  for (const key of ['HARMONY_STORE_FILE', 'HARMONY_CERT_PATH', 'HARMONY_PROFILE']) {
    if (!existsSync(process.env[key])) {
      console.error(`签名文件不存在：${process.env[key]}`)
      process.exit(1)
    }
  }
  // hvigor 的 SignHap 只接受 DevEco 加密后的密码（长度 >= 32），明文密码会被直接拒绝，
  // 因此这里不注入 signingConfigs，改为先构建 unsigned HAP，再用 hap-sign-tool 本地签名。
  const appJson5 = readFileSync(path.join(harmonyDir, 'AppScope', 'app.json5'), 'utf8')
  const bundleName = /"bundleName"\s*:\s*"([^"]+)"/.exec(appJson5)?.[1]
  const profileBundleName = readProfileBundleName(process.env.HARMONY_PROFILE)
  if (bundleName && profileBundleName && bundleName !== profileBundleName) {
    const msg = `签名 profile 的 bundle-name（${profileBundleName}）与工程 bundleName（${bundleName}）不一致，安装会失败`
    if (process.env.HARMONY_ALLOW_BUNDLE_MISMATCH === '1') {
      console.warn(`警告：${msg}（已按 HARMONY_ALLOW_BUNDLE_MISMATCH=1 继续）`)
    } else {
      console.error(msg)
      process.exit(1)
    }
  }
}

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

// 5. 签名（可选）：用 SDK 自带的 hap-sign-tool 对 unsigned HAP 做本地签名
const releaseDir = path.join(root, 'release')
mkdirSync(releaseDir, { recursive: true })

if (signingRequested) {
  const java = path.join(DEVECO, 'jbr', 'bin', 'java.exe')
  const signTool = path.join(DEVECO, 'sdk', 'default', 'openharmony', 'toolchains', 'lib', 'hap-sign-tool.jar')
  if (!existsSync(java) || !existsSync(signTool)) {
    console.error(`未找到签名工具：${java} / ${signTool}`)
    process.exit(1)
  }
  const signed = path.join(releaseDir, `NovaForge-Studio-${version}-harmony-signed.hap`)
  const signResult = spawnSync(
    `"${java}" -jar "${signTool}" sign-app -mode localSign` +
      ` -keyAlias "${process.env.HARMONY_KEY_ALIAS}"` +
      ` -signAlg "${process.env.HARMONY_SIGN_ALG ?? 'SHA256withECDSA'}"` +
      ` -appCertFile "${path.resolve(process.env.HARMONY_CERT_PATH)}"` +
      ` -profileFile "${path.resolve(process.env.HARMONY_PROFILE)}"` +
      ` -inFile "${hap}" -outFile "${signed}"` +
      ` -keystoreFile "${path.resolve(process.env.HARMONY_STORE_FILE)}"` +
      ` -keyPwd "${process.env.HARMONY_KEY_PASSWORD}"` +
      ` -keystorePwd "${process.env.HARMONY_STORE_PASSWORD}"`,
    { stdio: 'inherit', shell: true }
  )
  if (signResult.status !== 0) {
    console.error('鸿蒙签名失败')
    process.exit(signResult.status ?? 1)
  }
  console.log(`完成（已签名）: ${signed}`)
} else {
  const target = path.join(
    releaseDir,
    `NovaForge-Studio-${version}-harmony${hap.includes('unsigned') ? '-unsigned' : ''}.hap`
  )
  copyFileSync(hap, target)
  console.log(`完成（未签名）: ${target}`)
}
