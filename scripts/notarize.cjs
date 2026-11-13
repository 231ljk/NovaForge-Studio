// electron-builder afterSign 钩子：签名完成后自动走 Apple notarization + stapling
//
// 使用方式：
//   有证书 + 有 notary 凭证 → 自动签名 + 公证 + stapling（正式发布）
//   无证书（本地开发或 CI 没配 Secret）→ electron-builder 跳过签名，本脚本也跳过 notarize
//
// notary 凭证（App Store Connect API Key，推荐方式）：
//   APPLE_API_KEY          ← API Key ID（10 位字符串）
//   APPLE_API_ISSUER       ← Issuer ID（UUID，开发者账号的 Issuer）
//   APPLE_KEY_PATH         ← .p8 私钥文件的绝对路径（临时文件，CI 里从 GH Secret 解码）
//
// 脚本退出码：0=跳过或成功，非 0=notarize 失败

const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const log = (m) => console.log(`[notarize] ${m}`)

function hasNotaryCreds() {
  return Boolean(
    process.env.APPLE_API_KEY &&
    process.env.APPLE_API_ISSUER &&
    (process.env.APPLE_KEY_PATH || process.env.APPLE_ID)
  )
}

function hasSignCert() {
  // CI 里 electron-builder 会通过 CSC_IDENTITY_AUTO_DISCOVERY 从钥匙串找证书
  // 本地 unsigned 打包时 CSC_IDENTITY_AUTO_DISCOVERY=false
  return process.env.CSC_IDENTITY_AUTO_DISCOVERY !== 'false'
}

module.exports = async function afterSign(context) {
  const { outDir, appOutDir, packager, electronPlatformName } = context

  if (electronPlatformName !== 'darwin') {
    log('非 macOS，跳过 notarize')
    return
  }

  if (!hasSignCert()) {
    log('无 Developer ID 签名证书（CSC_IDENTITY_AUTO_DISCOVERY=false），跳过 notarize')
    return
  }

  if (!hasNotaryCreds()) {
    log('无 notary 凭证（需 APPLE_API_KEY / APPLE_API_ISSUER / APPLE_KEY_PATH），跳过')
    log('  → 要启用：在 GitHub Secrets 里配这三个变量')
    return
  }

  const appName = packager.appInfo.productFilename
  const appPath = path.join(appOutDir, `${appName}.app`)

  if (!fs.existsSync(appPath)) {
    throw new Error(`找不到 .app: ${appPath}`)
  }

  // —— 1. 打包成 notarytool 接受的 zip 并提交公证 ——
  const zipPath = path.join(outDir, `${appName}-notary.zip`)
  log(`提交公证: ${appPath}`)
  execFileSync('ditto', ['-c', '-k', '--keepParent', appPath, zipPath], {
    stdio: 'inherit',
    timeout: 120_000
  })

  try {
    execFileSync(
      'xcrun',
      [
        'notarytool', 'submit', zipPath,
        '--key', process.env.APPLE_KEY_PATH,
        '--key-id', process.env.APPLE_API_KEY,
        '--issuer', process.env.APPLE_API_ISSUER,
        '--wait'
      ],
      { stdio: 'inherit', timeout: 600_000 }
    )
  } finally {
    fs.rmSync(zipPath, { force: true })
  }
  log('公证通过')

  // —— 2. 把公证票据钉到 .app，随后生成的 dmg/zip 会包含它 ——
  log(`staple: ${appPath}`)
  execFileSync('xcrun', ['stapler', 'staple', appPath], {
    stdio: 'inherit',
    timeout: 120_000
  })

  log('notarization + stapling 完成')
}
