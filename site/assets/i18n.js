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
      'nav.download': '下载',
      'nav.features': '功能',
      'nav.requirements': '系统要求',
      'nav.faq': '常见问题',
      'nav.webapp': '打开网页版',
      'nav.menu': '展开菜单',
      'lang.toggle': 'EN',
      'lang.aria': '切换到英文',

      /* ---- Hero ---- */
      'hero.pill': 'v0.1.0 · Windows / macOS / Linux 已发布',
      'hero.h1a': '一个负责烧录',
      'hero.h1b': '一个负责用 AI 写固件',
      'hero.lede': 'NovaForge 拆成两款桌面软件：<b>Flash</b> 专注固件编译、烧录与串口调试；<b>Studio</b> 内置 AI，用对话生成固件、创建项目文件、解答开发问题。还提供免安装网页版，手机与电脑浏览器直接使用。',
      'hero.cta.flash': '下载 NovaForge Flash',
      'hero.cta.webapp': '打开网页版',
      'hero.hint.detecting': '正在识别你的设备…',
      'hint.ready': '已识别到你的设备：<b>{p}</b>，可直接下载安装包。',
      'hint.web': '已识别到你的设备：<b>{p}</b>，可先使用免安装网页版。',
      'hint.none': '请选择与设备匹配的版本；没有安装包时可直接使用网页版。',
      'primary.windows': '下载 NovaForge Flash',
      'primary.android': '下载 Android 版 v0.1.0',
      'primary.macos': '下载 NovaForge Studio',
      'primary.linux': '下载 Linux 版',
      'primary.harmony': '下载鸿蒙 HAP',
      'primary.ios': '下载 iOS 版 v0.1.0（未签名）',
      'primary.weapp': '小程序即将开放',
      'primary.web': '使用网页版',
      'btn.copy': '复制',

      /* ---- 下载区 ---- */
      'dl.h2': '选择安装方式',
      'dl.p': '桌面端分为 Flash 与 Studio 两个独立安装包，可按需安装；网页版无需安装，浏览器直接打开。',

      'flash.meta': 'Windows 10 / 11 · macOS 12+ · x64 / Apple Silicon',
      'flash.desc': '固件烧录专用：导入 .bin / .hex 直接烧录，编译项目、串口监视、Wi-Fi 引脚控制与 Home Assistant 联动。不含 AI。',
      'btn.win': 'Windows 版',
      'btn.macArm': 'macOS Apple 芯片',
      'btn.macIntel': 'macOS Intel',

      'studio.meta': 'Windows · macOS',
      'studio.desc': '内置 AI：用对话生成与修改固件、创建项目文件、解答报错；同样支持代码 / 图形化编程与一键烧录。',
      'studio.hashNote': 'Windows 安装包已使用本地代码签名证书签名（CN=中文程助手），安装时若出现 SmartScreen 提示请选择「更多信息 → 仍要运行」。',

      'card.web': '网页版',
      'card.weapp': '微信小程序',
      'card.harmony': '鸿蒙 HarmonyOS',
      'web.meta': '浏览器直接使用 · 免安装',
      'web.desc': '手机或电脑浏览器打开即用，登录同一账号即可查看设备、场景与自动化，内置 AI 助手。',
      'web.btn': '打开网页版',
      'tag.online': '在线可用',

      'android.meta': 'Android 7.0 及以上',
      'android.desc': '与电脑同一账号互通，蓝牙直连与局域网发现，内置 AI 助手。',
      'android.btn': '下载 APK',
      'btn.releases': '查看发布页',

      'weapp.meta': '无需安装 · 微信内打开',
      'weapp.desc': '轻量入口，与 App 共用账号；按平台规范不提供 AI 功能。',
      'weapp.btn': '敬请期待',
      'tag.afterReview': '过审后开放',

      'linux.meta': 'AppImage / deb · x64',
      'linux.desc': 'Flash 与 Studio 双版本均支持 Linux。AppImage 免安装直接运行，deb 包适用于 Debian / Ubuntu 系发行版。Studio 内置 AI，Flash 不含 AI。',
      'linux.btn.deb': '下载 deb',

      'ios.meta': 'iOS 15 及以上 · iPhone / iPad',
      'ios.desc': '与电脑同一账号互通，蓝牙直连与局域网发现，内置 AI 助手。当前提供未签名 IPA，需用 AltStore / Sideloadly / Xcode 以你自己的 Apple ID 重签后安装；App Store 正式版需 Apple Developer 付费账号签名。',
      'ios.btn': '下载 IPA',

      'harmony.meta': 'HarmonyOS NEXT · 手机 / 平板',
      'harmony.desc': '原生鸿蒙应用，与电脑同一账号互通，内置 AI 助手。当前提供调试签名包，需在华为 AGC 配置设备白名单后安装；正式发布版待发布证书与 profile。',
      'harmony.btn': '下载 HAP',
      'tag.debugSign': '调试签名',

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
      'req.p': 'Windows 安装包为未签名版本，首次运行如遇 SmartScreen 提示，选择「更多信息 → 仍要运行」即可。macOS 如提示无法验证开发者，请在「系统设置 → 隐私与安全性」中允许打开。',
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
      'status.online': '在线可用',
      'status.ipa': '未签名 IPA 已发布 0.1.0',
      'status.debug': '调试签名可用',
      'status.review': '过审后开放',

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
      'faq6.a': '当前 Windows 安装包尚未购买代码签名证书。点击「更多信息 → 仍要运行」即可完成安装；校验值可在 Releases 页面核对。',

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
      'toast.copied': '校验值已复制',
      'toast.copyFail': '复制失败，请手动选中复制',
      'toast.weapp': '微信小程序正式版过审后会在此开放入口',
      'toast.android': '开始下载，安装前请允许“安装未知来源应用”',
      'toast.lang': '已切换为中文'
    },

    en: {
      /* ---- head ---- */
      'meta.title': 'NovaForge Downloads — Flash Flasher / Studio AI Coding / Web Version',
      'meta.desc': 'NovaForge ships two desktop apps: Flash compiles and flashes ESP32 / Raspberry Pi firmware, Studio embeds AI to generate firmware and project files from a conversation. A no-install web version is also available.',

      /* ---- topbar ---- */
      'brand.aria': 'NovaForge home',
      'nav.download': 'Download',
      'nav.features': 'Features',
      'nav.requirements': 'Requirements',
      'nav.faq': 'FAQ',
      'nav.webapp': 'Open web version',
      'nav.menu': 'Open menu',
      'lang.toggle': '中文',
      'lang.aria': 'Switch to Chinese',

      /* ---- Hero ---- */
      'hero.pill': 'v0.1.0 · Available for Windows / macOS / Linux',
      'hero.h1a': 'One burns the firmware',
      'hero.h1b': 'One writes it with AI',
      'hero.lede': 'NovaForge ships as two desktop apps: <b>Flash</b> handles firmware compilation, flashing and serial debugging; <b>Studio</b> embeds AI to generate firmware, create project files and answer development questions. A no-install web version runs in any mobile or desktop browser.',
      'hero.cta.flash': 'Download NovaForge Flash',
      'hero.cta.webapp': 'Open web version',
      'hero.hint.detecting': 'Detecting your device…',
      'hint.ready': 'Detected your device: <b>{p}</b> — you can download the installer directly.',
      'hint.web': 'Detected your device: <b>{p}</b> — try the no-install web version first.',
      'hint.none': 'Pick the build that matches your device, or use the web version if there is no installer.',
      'primary.windows': 'Download NovaForge Flash',
      'primary.android': 'Download Android v0.1.0',
      'primary.macos': 'Download NovaForge Studio',
      'primary.linux': 'Download Linux build',
      'primary.harmony': 'Download HarmonyOS HAP',
      'primary.ios': 'Download iOS v0.1.0 (unsigned)',
      'primary.weapp': 'Mini Program coming soon',
      'primary.web': 'Use web version',
      'btn.copy': 'Copy',

      /* ---- download ---- */
      'dl.h2': 'Choose your install',
      'dl.p': 'Desktop builds come as two separate installers, Flash and Studio — install either or both. The web version needs no installation at all.',

      'flash.meta': 'Windows 10 / 11 · macOS 12+ · x64 / Apple Silicon',
      'flash.desc': 'Built for flashing: import .bin / .hex and flash directly, compile projects, monitor the serial port, control Wi-Fi pins and integrate with Home Assistant. No AI included.',
      'btn.win': 'Windows',
      'btn.macArm': 'macOS Apple Silicon',
      'btn.macIntel': 'macOS Intel',

      'studio.meta': 'Windows · macOS',
      'studio.desc': 'AI built in: generate and modify firmware, create project files and explain errors through conversation. Also supports code / block programming and one-click flashing.',
      'studio.hashNote': 'The Windows installer is signed with a local code-signing certificate (CN=中文程助手). If SmartScreen appears during installation, choose “More info → Run anyway”.',

      'card.web': 'Web version',
      'card.weapp': 'WeChat Mini Program',
      'card.harmony': 'HarmonyOS',
      'web.meta': 'Runs in your browser · No install',
      'web.desc': 'Open it in any mobile or desktop browser. Sign in with the same account to view devices, scenes and automations, with the AI assistant built in.',
      'web.btn': 'Open web version',
      'tag.online': 'Available online',

      'android.meta': 'Android 7.0 and above',
      'android.desc': 'Shares one account with desktop, direct Bluetooth connection and LAN discovery, with the AI assistant built in.',
      'android.btn': 'Download APK',
      'btn.releases': 'View releases',

      'weapp.meta': 'No install · Opens in WeChat',
      'weapp.desc': 'A lightweight entry point sharing the same account as the app. AI is not offered here due to platform category rules.',
      'weapp.btn': 'Coming soon',
      'tag.afterReview': 'After review',

      'linux.meta': 'AppImage / deb · x64',
      'linux.desc': 'Both Flash and Studio support Linux. AppImage runs without installation; the deb package targets Debian / Ubuntu distributions. Studio includes AI, Flash does not.',
      'linux.btn.deb': 'Download deb',

      'ios.meta': 'iOS 15 and above · iPhone / iPad',
      'ios.desc': 'Shares one account with desktop, direct Bluetooth connection and LAN discovery, with the AI assistant built in. The current IPA is unsigned — re-sign it with your own Apple ID via AltStore / Sideloadly / Xcode before installing. An App Store release requires a paid Apple Developer account.',
      'ios.btn': 'Download IPA',

      'harmony.meta': 'HarmonyOS NEXT · Phone / Tablet',
      'harmony.desc': 'A native HarmonyOS app sharing one account with desktop, with the AI assistant built in. The current build is debug-signed and requires whitelisting your device in Huawei AGC. The public release awaits a release certificate and profile.',
      'harmony.btn': 'Download HAP',
      'tag.debugSign': 'Debug signed',

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
      'req.p': 'The Windows installer is unsigned. If SmartScreen appears on first run, choose “More info → Run anyway”. On macOS, if the developer cannot be verified, allow it under System Settings → Privacy & Security.',
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
      'status.online': 'Available online',
      'status.ipa': 'Unsigned IPA released 0.1.0',
      'status.debug': 'Debug signed',
      'status.review': 'After review',

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
      'faq6.a': 'The current Windows installer does not yet use a purchased code-signing certificate. Click “More info → Run anyway” to finish installing; you can verify the checksum on the Releases page.',

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
      'toast.copied': 'Checksum copied',
      'toast.copyFail': 'Copy failed — please select and copy manually',
      'toast.weapp': 'The WeChat Mini Program will open here once approved',
      'toast.android': 'Download started. Allow “Install unknown apps” before installing.',
      'toast.lang': 'Switched to English'
    }
  };

  window.NF_I18N = DICT;
})();