/* ==========================================================================
   NovaForge — 多语言词典（zh / en）
   纯静态，无外部依赖。app.js 通过 window.NF_I18N 读取。
   ========================================================================== */
(function () {
  'use strict';

  var DICT = {
    zh: {
      /* ---- head ---- */
      'meta.title': 'NovaForge 官方下载 — Flash 烧录器 / Studio AI 编程 / 网页版',
      'meta.desc': 'NovaForge 提供两款桌面软件：Flash 专注 ESP32 / 树莓派固件编译与烧录，Studio 内置 AI 用对话生成固件与项目文件。另提供免安装网页版。',

      /* ---- 顶栏 ---- */
      'brand.aria': 'NovaForge 首页',
      'nav.portal': '开放平台',
      'nav.download': '下载',
      'nav.features': '功能',
      'nav.requirements': '系统要求',
      'nav.faq': '常见问题',
      'nav.webapp': '打开网页版',
      'nav.menu': '展开菜单',
      'nav.support': '客服',
      'lang.toggle': 'EN',
      'lang.aria': '切换到英文',

      /* ---- Hero ---- */
      'hero.pill': 'v0.2.0 · 原生版已发布 macOS / iOS / Android / 鸿蒙',
      'hero.h1': 'NovaForge 官方下载',
      'hero.lede': '<b>Flash</b> 负责固件编译、烧录与串口调试，<b>Studio</b> 内置 AI 用对话生成固件与项目文件。桌面端、手机端与免安装网页版使用同一账号，配置自动同步。',
      'hero.cta.webapp': '打开网页版',
      'hero.hint.detecting': '正在识别你的设备…',
      'hero.meta.version': '当前版本',
      'hero.meta.platforms': '支持平台',
      'hero.meta.route': '下载线路',
      'hero.meta.routeVal': '国内 / 国际自动选择',

      'hint.ready': '已识别到你的设备：<b>{p}</b>，可直接下载安装包。',
      'hint.web': '已识别到你的设备：<b>{p}</b>，可先使用免安装网页版。',
      'hint.none': '请选择与设备匹配的版本；没有安装包时可直接使用网页版。',

      'primary.windows': '下载 NovaForge Flash',
      'primary.android': '下载 Android 版',
      'primary.macos': '下载 NovaForge Studio',
      'primary.linux': '下载 Linux 版',
      'primary.harmony': '下载鸿蒙版',
      'primary.ios': 'iOS 待签名 · 用网页版',
      'primary.weapp': '查看小程序码',
      'primary.web': '使用网页版',

      /* ---- 下载区 ---- */
      'dl.h2': '下载',
      'dl.p': '按设备选择对应安装包。Windows、Linux、Android、iOS、鸿蒙均已更新为 v0.2.0 版本，账号与微信小程序共用同一套云端账号。',
      'dl.group.desktop': '桌面端',
      'dl.group.mobile': '移动端',
      'dl.group.web': '免安装',
      'dl.note.summary': '安装说明与校验值',
      'dl.foot': '所有安装包均可在',
      'dl.foot2': '查看完整版本记录与校验值。',

      'win.sub': 'Windows 10 22H2 及以上 · x64',
      'mac.sub': 'macOS 12 Monterey 及以上 · Apple 芯片 / Intel · 原生 SwiftUI',
      'linux.sub': 'Ubuntu 22.04 / Debian 12 及以上 · x64',
      'android.sub': 'Android 7.0 及以上 · arm64 / armeabi-v7a',
      'ios.sub': 'iOS 15 及以上 · iPhone / iPad',
      'harmony.sub': 'HarmonyOS NEXT · 手机 / 平板',
      'web.sub': 'Chrome / Edge / Safari 最新版',
      'weapp.sub': '微信 8.0 及以上',

      'legacy.note': 'v0.2.0 · 已接入云端账号（与小程序同一套账号）',
      'arch.apple': 'Apple 芯片',
      'arch.intel': 'Intel',
      'arch.universal': '通用',

      'card.web': '网页版',
      'card.weapp': '微信小程序',
      'card.harmony': '鸿蒙 HarmonyOS',

      'f.installer': '安装包',
      'f.noinstall': '免安装',
      'f.direct': '直接安装',
      'f.debug': '调试签名',
      'f.unsigned': '未签名',

      'badge.pendingSign': '待签名',

      'btn.download': '下载',
      'btn.copy': '复制',
      'btn.releases': '发布页',

      'win.note': '安装包已使用本地代码签名证书签名（CN=中文程助手）。首次运行若出现 SmartScreen 提示，选择「更多信息 → 仍要运行」即可。',
      'mac.note': 'v0.2.0 为原生 SwiftUI 重写。安装包为 ad-hoc 签名、未公证，首次打开需在 Finder 中右键点击 App 选择「打开」，或在「系统设置 → 隐私与安全性」中允许。',
      'linux.note': 'deb 包使用 sudo dpkg -i 安装；AppImage 下载后赋予可执行权限即可直接运行。',
      'ios.pending': '未签名 IPA，需自行签名后安装。当前 Release 中的 iOS 构建为未签名归档，无法直接安装到 iPhone / iPad；请使用自己的 Apple Developer 证书与描述文件重新签名。',
      'ios.note': '与电脑同一账号互通，蓝牙直连与局域网发现，内置 AI 助手。签名完成后可在 App Store Connect 分发。',
      'android.note': '这是调试签名 APK，安装前请在系统设置中允许「安装未知来源应用」。',
      'harmony.note': '原生 ArkTS 应用，debug 签名，绑定 1 台设备，有效期至 2026-12-01。与电脑同一账号互通，内置 AI 助手。',

      'tag.online': '在线可用',

      'web.name': '浏览器直接打开',
      'web.meta': '无需安装 · 手机与电脑通用',
      'web.btn': '打开',

      'weapp.name': '微信扫码打开',
      'weapp.meta': '无需安装 · 与 App 共用账号',
      'weapp.btn': '手机可长按二维码识别',

      /* ---- 功能 ---- */
      'feat.h2': '两款软件，各司其职',
      'feat.p': '烧录与 AI 编程拆开安装，互不拖累；需要时两个都装，项目与账号互通。',
      'feat1.h3': 'Flash · 专注烧录',
      'feat1.p': '导入 .bin / .hex、选择串口与波特率即可烧录；实时串口监视，支持 ESP32、ESP8266、RP2040 与 AVR。',
      'feat2.h3': 'Studio · AI 写固件',
      'feat2.p': '用自然语言描述需求，AI 直接生成或修改固件代码与项目文件，生成后仍可在编辑器里精修。',
      'feat3.h3': 'Home Assistant 联动',
      'feat3.p': '生成的固件内置 MQTT Discovery，设备联网后自动出现在 Home Assistant，无需刷第三方固件。',
      'feat4.h3': '网页版 · 免安装',
      'feat4.p': '不在电脑旁也能查看设备与场景；与桌面端、App 使用同一账号，配置自动同步。',

      /* ---- 系统要求 ---- */
      'req.h2': '系统要求',
      'req.p': 'Windows 安装包首次运行如遇 SmartScreen 提示，选择「更多信息 → 仍要运行」即可。macOS 如提示无法验证开发者，请在「系统设置 → 隐私与安全性」中允许打开。',
      'req.th.platform': '平台',
      'req.th.min': '最低版本',
      'req.th.arch': '架构',
      'req.th.status': '当前状态',
      'req.webapp': '网页版',
      'req.harmony': '鸿蒙 HarmonyOS',
      'req.weapp': '微信小程序',
      'req.browser': 'Chrome / Edge / Safari 最新版',
      'req.device': '手机 / 平板',
      'req.wechat': '微信 8.0 及以上',
      'status.released': '已发布 0.1.0',
      'status.released2': '已发布 0.2.0（原生）',
      'status.online': '在线可用',
      'status.pendingSign': '待 Apple 签名',

      /* ---- FAQ ---- */
      'faq.h2': '常见问题',
      'faq1.q': 'Flash 和 Studio 应该装哪个？',
      'faq1.a': '只想把现成固件烧进开发板，装 <b>Flash</b> 即可；想让 AI 帮忙写固件、改代码、生成项目文件，装 <b>Studio</b>。两者可以同时安装，使用各自的安装目录与配置。',
      'faq2.q': 'AI 功能在哪里？',
      'faq2.a': 'AI 在 <b>NovaForge Studio</b>（Windows / macOS / Linux）、手机 App（Android / iOS / 鸿蒙）和网页版中都可用，支持本地离线模型与云端 API。仅微信小程序因平台类目限制不提供 AI。',
      'faq3.q': '为什么只有微信小程序没有 AI？',
      'faq3.a': '微信小程序与微信多端应用中的 AI 能力属于企业类目，个人主体账号无法使用，因此小程序端只保留设备管理与控制。桌面软件、手机 App 和网页版由我们自己分发，不受该限制，AI 功能完整保留。',
      'faq4.q': '网页版需要安装吗？',
      'faq4.a': '不需要。用浏览器打开网页版入口即可，登录同一账号后能看到设备、场景与自动化数据。',
      'faq5.q': '支持哪些开发板？',
      'faq5.a': 'ESP32 全系列（含 S3 / C3 / C6）、ESP8266、树莓派 Pico（RP2040）以及 Arduino AVR 系列；树莓派 Linux 单板通过 SSH 部署。',
      'faq6.q': '安装包提示未知发布者怎么办？',
      'faq6.a': '点击「更多信息 → 仍要运行」即可完成安装；校验值可在 Releases 页面核对。',

      /* ---- 结尾 CTA ---- */
      'cta.h2': '从第一块开发板开始',
      'cta.p': '下载对应平台的安装包，或用浏览器直接打开网页版。桌面端、手机端与网页版使用同一账号，配置自动同步。',

      /* ---- 页脚 ---- */
      'footer.slogan': 'Flash 烧录 · Studio AI 编程 · 网页版',
      'footer.download': '下载',
      'footer.webapp': '网页版',
      'footer.features': '功能',
      'footer.faq': '常见问题',
      'footer.privacy': '隐私政策',
      'footer.terms': '用户协议',
      'footer.repo': '代码仓库',
      'footer.rights': 'NovaForge · 保留所有权利',
      'footer.icp': 'ICP 备案号待备案完成后展示',

      /* ---- 线路状态（只读，不可手动选择） ---- */
      'mirror.label': '下载线路',
      'mirror.detecting': '正在自动检测所在地区…',
      'mirror.cn': '国内镜像 · 自动',
      'mirror.global': 'GitHub 国际 · 自动',
      'mirror.fallback': '部分文件国内镜像未收录，已自动回退 GitHub',
      'mirror.offline': '网络检测失败，已使用 GitHub 国际线路',

      /* ---- 分卷 ---- */
      'split.title': '国内镜像：Windows 安装包为 5 卷分卷（Gitee 单文件上限 100MB）',
      'split.tip': '5 卷全部下载到同一目录后，在该目录打开命令提示符执行：',

      /* ---- 提示 ---- */
      /* ---- 客服 ---- */
      'cs.fab': '客服',
      'cs.title': '在线客服',
      'cs.sub': '常见问题即时解答 · 人工渠道见底部',
      'cs.greet': '你好，我是 NovaForge 客服助手。输入关键词，或直接点下面的常见问题。',
      'cs.placeholder': '输入问题，如：烧录失败',
      'cs.send': '发送',
      'cs.close': '关闭客服',
      'cs.issue': 'GitHub 提交问题',
      'cs.issueCn': 'Gitee 提交问题',
      'cs.faq': '全部常见问题',
      'cs.you': '你',
      'cs.bot': '客服助手',
      'cs.noMatch': '没有找到匹配的答案。可以换个关键词，或通过下方 GitHub / Gitee 提交问题，我们会跟进。',
      'cs.related': '相关问题',
      'cs.more': '还有 {n} 条相关，换个更具体的关键词试试。',
      'cs.enOnly': '该条答案暂无英文版，以下为中文原文。',

      'toast.copied': '校验值已复制',
      'toast.copyFail': '复制失败，请手动选中复制',
      'toast.android': '开始下载，安装前请允许“安装未知来源应用”',
      'toast.lang': '已切换为中文'
    },

    en: {
      /* ---- head ---- */
      'meta.title': 'NovaForge Downloads — Flash Flasher / Studio AI Coding / Web Version',
      'meta.desc': 'NovaForge ships two desktop apps: Flash compiles and flashes ESP32 / Raspberry Pi firmware, Studio embeds AI to generate firmware and project files from a conversation. A no-install web version is also available.',

      /* ---- topbar ---- */
      'brand.aria': 'NovaForge home',
      'nav.portal': 'Open Platform',
      'nav.download': 'Download',
      'nav.features': 'Features',
      'nav.requirements': 'Requirements',
      'nav.faq': 'FAQ',
      'nav.webapp': 'Open web version',
      'nav.menu': 'Open menu',
      'lang.toggle': '中文',
      'lang.aria': 'Switch to Chinese',

      /* ---- Hero ---- */
      'hero.pill': 'v0.2.0 · Native builds released for macOS / iOS / Android / HarmonyOS',
      'hero.h1': 'Download NovaForge',
      'hero.lede': '<b>Flash</b> handles firmware compilation, flashing and serial debugging. <b>Studio</b> embeds AI to generate firmware and project files from a conversation. Desktop, mobile and the no-install web version share one account, so settings sync automatically.',
      'hero.cta.webapp': 'Open web version',
      'hero.hint.detecting': 'Detecting your device…',
      'hero.meta.version': 'Version',
      'hero.meta.platforms': 'Platforms',
      'hero.meta.route': 'Download route',
      'hero.meta.routeVal': 'Auto (China / Global)',

      'hint.ready': 'Detected your device: <b>{p}</b> — you can download the installer directly.',
      'hint.web': 'Detected your device: <b>{p}</b> — try the no-install web version first.',
      'hint.none': 'Pick the build that matches your device, or use the web version if there is no installer.',

      'primary.windows': 'Download NovaForge Flash',
      'primary.android': 'Download Android build',
      'primary.macos': 'Download NovaForge Studio',
      'primary.linux': 'Download Linux build',
      'primary.harmony': 'Download HarmonyOS build',
      'primary.ios': 'iOS pending sign · use web version',
      'primary.weapp': 'View Mini Program code',
      'primary.web': 'Use web version',

      /* ---- download ---- */
      'dl.h2': 'Download',
      'dl.p': 'Pick the installer for your device. Windows, Linux, Android, iOS and HarmonyOS all ship v0.2.0 builds; accounts are shared with the WeChat mini program.',
      'dl.group.desktop': 'Desktop',
      'dl.group.mobile': 'Mobile',
      'dl.group.web': 'No install',
      'dl.note.summary': 'Install notes and checksums',
      'dl.foot': 'All installers are also listed on the',
      'dl.foot2': 'with full version history and checksums.',

      'win.sub': 'Windows 10 22H2 and above · x64',
      'mac.sub': 'macOS 12 Monterey and above · Apple Silicon / Intel · Native SwiftUI',
      'linux.sub': 'Ubuntu 22.04 / Debian 12 and above · x64',
      'android.sub': 'Android 7.0 and above · arm64 / armeabi-v7a',
      'ios.sub': 'iOS 15 and above · iPhone / iPad',
      'harmony.sub': 'HarmonyOS NEXT · Phone / Tablet',
      'web.sub': 'Latest Chrome / Edge / Safari',
      'weapp.sub': 'WeChat 8.0 and above',

      'legacy.note': 'v0.2.0 · Cloud accounts enabled (same account pool as the mini program)',
      'arch.apple': 'Apple Silicon',
      'arch.intel': 'Intel',
      'arch.universal': 'Universal',

      'card.web': 'Web version',
      'card.weapp': 'WeChat Mini Program',
      'card.harmony': 'HarmonyOS',

      'f.installer': 'Installer',
      'f.noinstall': 'Portable',
      'f.direct': 'Direct install',
      'f.debug': 'Debug-signed',
      'f.unsigned': 'Unsigned',

      'badge.pendingSign': 'Pending signature',

      'btn.download': 'Download',
      'btn.copy': 'Copy',
      'btn.releases': 'releases page',

      'win.note': 'The installer is signed with a local code-signing certificate (CN=中文程助手). If SmartScreen appears on first run, choose “More info → Run anyway”.',
      'mac.note': 'v0.2.0 is a native SwiftUI rewrite. The builds are ad-hoc signed and not notarized: on first launch, right-click the app in Finder and choose “Open”, or allow it under System Settings → Privacy & Security.',
      'linux.note': 'Install the deb with sudo dpkg -i; for the AppImage, make it executable and run it directly.',
      'ios.pending': 'Unsigned IPA — you must sign it yourself before installing. The iOS build in this Release is an unsigned archive that cannot be installed on iPhone / iPad directly; re-sign it with your own Apple Developer certificate and provisioning profile.',
      'ios.note': 'Shares one account with desktop, direct Bluetooth connection and LAN discovery, with the AI assistant built in. After signing it can be distributed via App Store Connect.',
      'android.note': 'This is a debug-signed APK. Allow “Install unknown apps” in system settings before installing.',
      'harmony.note': 'Native ArkTS app, debug-signed, bound to 1 device, valid until 2026-12-01. Shares one account with desktop and includes the AI assistant.',

      'tag.online': 'Available online',

      'web.name': 'Open in your browser',
      'web.meta': 'No install · Works on phone and desktop',
      'web.btn': 'Open',

      'weapp.name': 'Open with WeChat',
      'weapp.meta': 'No install · Shares the app account',
      'weapp.btn': 'On mobile, touch and hold the code',

      /* ---- features ---- */
      'feat.h2': 'Two apps, two jobs',
      'feat.p': 'Flashing and AI coding are installed separately so neither slows the other down. Install both if you need them — projects and accounts stay in sync.',
      'feat1.h3': 'Flash · Built for flashing',
      'feat1.p': 'Import .bin / .hex, pick a serial port and baud rate, and flash. Live serial monitoring supports ESP32, ESP8266, RP2040 and AVR.',
      'feat2.h3': 'Studio · AI writes firmware',
      'feat2.p': 'Describe what you need in plain language and the AI generates or edits firmware code and project files — still fully editable afterwards.',
      'feat3.h3': 'Home Assistant integration',
      'feat3.p': 'Generated firmware includes MQTT Discovery, so devices appear in Home Assistant automatically once online — no third-party firmware needed.',
      'feat4.h3': 'Web version · No install',
      'feat4.p': 'Check devices and scenes even when away from your computer. It shares one account with desktop and mobile, so configuration syncs automatically.',

      /* ---- requirements ---- */
      'req.h2': 'System requirements',
      'req.p': 'If SmartScreen appears on first run of the Windows installer, choose “More info → Run anyway”. On macOS, if the developer cannot be verified, allow it under System Settings → Privacy & Security.',
      'req.th.platform': 'Platform',
      'req.th.min': 'Minimum version',
      'req.th.arch': 'Architecture',
      'req.th.status': 'Status',
      'req.webapp': 'Web version',
      'req.harmony': 'HarmonyOS',
      'req.weapp': 'WeChat Mini Program',
      'req.browser': 'Latest Chrome / Edge / Safari',
      'req.device': 'Phone / Tablet',
      'req.wechat': 'WeChat 8.0 and above',
      'status.released': 'Released 0.1.0',
      'status.released2': 'Released 0.2.0 (native)',
      'status.online': 'Available online',
      'status.pendingSign': 'Pending Apple signature',

      /* ---- FAQ ---- */
      'faq.h2': 'Frequently asked questions',
      'faq1.q': 'Should I install Flash or Studio?',
      'faq1.a': 'If you only need to flash ready-made firmware onto a board, install <b>Flash</b>. If you want AI to write firmware, edit code and generate project files, install <b>Studio</b>. Both can be installed side by side with separate directories and settings.',
      'faq2.q': 'Where are the AI features?',
      'faq2.a': 'AI is available in <b>NovaForge Studio</b> (Windows / macOS / Linux), the mobile apps (Android / iOS / HarmonyOS) and the web version, supporting both local offline models and cloud APIs. Only the WeChat Mini Program omits AI due to platform category restrictions.',
      'faq3.q': 'Why is AI missing only in the WeChat Mini Program?',
      'faq3.a': 'AI capabilities in WeChat Mini Programs and WeChat multi-platform apps fall under enterprise categories, which individual accounts cannot use. The Mini Program therefore keeps only device management and control. Desktop, mobile and web builds are distributed by us and are not subject to that restriction, so AI is fully retained.',
      'faq4.q': 'Does the web version need installation?',
      'faq4.a': 'No. Just open the web version in your browser and sign in with the same account to see your devices, scenes and automations.',
      'faq5.q': 'Which development boards are supported?',
      'faq5.a': 'The full ESP32 family (including S3 / C3 / C6), ESP8266, Raspberry Pi Pico (RP2040) and Arduino AVR boards. Raspberry Pi Linux boards are deployed over SSH.',
      'faq6.q': 'What if the installer says the publisher is unknown?',
      'faq6.a': 'Click “More info → Run anyway” to finish installing; you can verify the checksum on the Releases page.',

      /* ---- closing CTA ---- */
      'cta.h2': 'Start with your first board',
      'cta.p': 'Download the installer for your platform, or open the web version right in your browser. Desktop, mobile and web share one account, so settings sync automatically.',

      /* ---- footer ---- */
      'footer.slogan': 'Flash flashing · Studio AI coding · Web version',
      'footer.download': 'Download',
      'footer.webapp': 'Web version',
      'footer.features': 'Features',
      'footer.faq': 'FAQ',
      'footer.privacy': 'Privacy Policy',
      'footer.terms': 'Terms of Service',
      'footer.repo': 'Repository',
      'footer.rights': 'NovaForge · All rights reserved',
      'footer.icp': 'ICP filing number will be displayed once approved',

      /* ---- route status (read-only) ---- */
      'mirror.label': 'Download route',
      'mirror.detecting': 'Detecting your region automatically…',
      'mirror.cn': 'China mirror · Auto',
      'mirror.global': 'GitHub global · Auto',
      'mirror.fallback': 'Some files are not mirrored in China — falling back to GitHub',
      'mirror.offline': 'Region detection failed — using the GitHub global route',

      /* ---- split volumes ---- */
      'split.title': 'China mirror: the Windows installer is split into 5 volumes (Gitee caps single files at 100MB)',
      'split.tip': 'After downloading all 5 volumes into one folder, open a command prompt there and run:',

      /* ---- toasts ---- */
      /* ---- support ---- */
      'cs.fab': 'Support',
      'cs.title': 'Live support',
      'cs.sub': 'Instant answers from the FAQ · human channels at the bottom',
      'cs.greet': 'Hi, I am the NovaForge support assistant. Type a keyword, or pick a question below.',
      'cs.placeholder': 'Ask something, e.g. flashing failed',
      'cs.send': 'Send',
      'cs.close': 'Close support',
      'cs.issue': 'Open a GitHub issue',
      'cs.issueCn': 'Open a Gitee issue',
      'cs.faq': 'All FAQs',
      'cs.you': 'You',
      'cs.bot': 'Support',
      'cs.noMatch': 'No matching answer found. Try another keyword, or open an issue on GitHub / Gitee and we will follow up.',
      'cs.related': 'Related questions',
      'cs.more': '{n} more matches — try a more specific keyword.',
      'cs.enOnly': 'This answer is only available in Chinese for now.',

      'toast.copied': 'Checksum copied',
      'toast.copyFail': 'Copy failed — please select and copy manually',
      'toast.android': 'Download started. Allow “Install unknown apps” before installing.',
      'toast.lang': 'Switched to English'
    }
  };

  window.NF_I18N = DICT;
})();