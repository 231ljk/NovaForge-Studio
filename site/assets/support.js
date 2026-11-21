/* ==========================================================================
   NovaForge — 客服知识库（前端内置，纯静态无后端）
   来源：客服知识库-02-常见问题FAQ（84 条），已按当前下载页事实校正
   结构：window.NF_SUPPORT = { cats: [...], items: [{id,cat,q,a,kw,q_en?,a_en?}] }
   ========================================================================== */
(function () {
  'use strict';

  window.NF_SUPPORT = {
  "cats": [
    "产品与收费",
    "安装与启动",
    "开发板与工具链",
    "编写与编译",
    "烧录与串口",
    "配网与联网",
    "设备控制",
    "Home Assistant 智能家居",
    "AI 助手",
    "账号与登录",
    "数据与安全",
    "手机端与其他"
  ],
  "items": [
    {
      "id": "FAQ-001",
      "cat": "产品与收费",
      "q": "这是什么软件？能干什么？",
      "a": "NovaForge Studio 是一款面向 ESP32 的嵌入式固件开发工具，把图形化编程、代码编辑、固件编译、串口烧录、串口监视、局域网设备控制、Home Assistant 智能家居接入和 AI 助手放在同一个软件里。适合做 ESP32 / ESP8266 / 树莓派 Pico / Arduino 这类开发板的用户。",
      "kw": [
        "软件介绍",
        "产品功能",
        "ESP32",
        "开发工具",
        "能干什么"
      ],
      "q_en": "What is this software for?",
      "a_en": "NovaForge Studio is an embedded firmware toolchain for ESP32. It combines visual programming, a code editor, firmware compilation, serial flashing, serial monitor, LAN device control, Home Assistant integration and an AI assistant in one app. It targets ESP32 / ESP8266 / Raspberry Pi Pico / Arduino boards."
    },
    {
      "id": "FAQ-002",
      "cat": "产品与收费",
      "q": "收费吗？有没有会员或内购？",
      "a": "完全免费，没有会员、没有内购、没有广告，也不需要激活码。",
      "kw": [
        "收费",
        "免费",
        "会员",
        "内购",
        "广告"
      ],
      "q_en": "Is it paid? Any membership or in-app purchase?",
      "a_en": "Completely free. No membership, no in-app purchase, no ads and no activation code."
    },
    {
      "id": "FAQ-003",
      "cat": "产品与收费",
      "q": "需要联网才能用吗？",
      "a": "写代码、编译、烧录、串口、局域网控制这些核心功能都在本机完成，不需要联网。只有注册登录（邮箱验证码）、绑定 GitHub/Gitee、首次下载编译工具链、使用云端 AI、访问你自己的 Home Assistant 这些场景需要网络。",
      "kw": [
        "联网",
        "离线",
        "网络要求",
        "断网"
      ],
      "q_en": "Does it need an internet connection?",
      "a_en": "Coding, compiling, flashing, serial monitor and LAN control all run locally and need no network. Network is only required for sign-up (email code), binding GitHub/Gitee, the first toolchain download, cloud AI, and reaching your own Home Assistant."
    },
    {
      "id": "FAQ-004",
      "cat": "产品与收费",
      "q": "支持哪些系统？",
      "a": "桌面版支持 Windows 10 / 11（仅 64 位，不支持 Win7 / 8 / XP）、macOS 12 Monterey 及以上（Apple 芯片 / Intel）、Ubuntu 22.04 / Debian 12（x64）。移动端 Android 7.0 及以上、iOS 15 及以上、鸿蒙 HarmonyOS NEXT 均已发布 0.1.0。微信小程序因平台类目限制，过审后开放。",
      "kw": [
        "系统要求",
        "Windows",
        "macOS",
        "兼容性",
        "支持系统"
      ],
      "q_en": "Which systems are supported?",
      "a_en": "Desktop: Windows 10 / 11 (64-bit only, no Win7/8/XP), macOS 12 Monterey or later (Apple Silicon / Intel), Ubuntu 22.04 / Debian 12 (x64). Mobile: Android 7.0+, iOS 15+, HarmonyOS NEXT — all released as 0.1.0. The WeChat Mini Program opens after review due to platform category limits."
    },
    {
      "id": "FAQ-005",
      "cat": "产品与收费",
      "q": "32 位系统 / ARM 电脑能装吗？",
      "a": "不能。桌面版只提供 64 位版本，且适配架构为 X64。",
      "kw": [
        "32位",
        "64位",
        "X64",
        "ARM"
      ],
      "q_en": "Can I install it on a 32-bit or ARM computer?",
      "a_en": "No. Desktop builds are 64-bit only and target the X64 architecture."
    },
    {
      "id": "FAQ-006",
      "cat": "产品与收费",
      "q": "最新版本是多少？",
      "a": "当前全平台统一版本为 0.1.0（Windows / macOS / Linux / Android / iOS / 鸿蒙）。具体文件名与校验值以下载页 Releases 清单为准。",
      "kw": [
        "版本",
        "0.1.0",
        "1.2.0",
        "版本号"
      ],
      "q_en": "What is the latest version?",
      "a_en": "0.1.0 across all platforms (Windows / macOS / Linux / Android / iOS / HarmonyOS). Exact file names and checksums are listed on the download page."
    },
    {
      "id": "FAQ-007",
      "cat": "产品与收费",
      "q": "软件会把我的代码上传到服务器吗？",
      "a": "不会。编译在本机执行，项目和代码都保存在本地应用数据目录，不上传云端。",
      "kw": [
        "代码上传",
        "本地编译",
        "隐私",
        "数据安全"
      ]
    },
    {
      "id": "FAQ-008",
      "cat": "产品与收费",
      "q": "有手机版吗？",
      "a": "有。Android、iOS、鸿蒙三个移动端均已发布 0.1.0，可与电脑端、Home Assistant 共用同一个邮箱账号。",
      "kw": [
        "手机版",
        "Android",
        "iOS",
        "APP"
      ],
      "q_en": "Is there a mobile app?",
      "a_en": "Yes. Android, iOS and HarmonyOS builds are all released as 0.1.0 and share one email account with the desktop app and Home Assistant."
    },
    {
      "id": "FAQ-009",
      "cat": "产品与收费",
      "q": "有微信小程序吗？",
      "a": "微信小程序入口目前为占位状态，正式版过审后开放。小程序端因平台类目限制只保留设备管理与控制，不含 AI 功能。",
      "kw": [
        "微信小程序",
        "上线时间",
        "占位"
      ],
      "q_en": "Is there a WeChat Mini Program?",
      "a_en": "The Mini Program entry is a placeholder for now and opens after review. Due to platform category limits it only keeps device management and control, without AI."
    },
    {
      "id": "FAQ-010",
      "cat": "安装与启动",
      "q": "在哪里下载安装包？",
      "a": "请从官方下载页获取：https://231ljk.github.io/NovaForge-Studio/ 。国内访问自动走 Gitee 镜像，国外走 GitHub，两个仓库的安装包一致。请不要从第三方下载站获取，避免拿到被篡改的安装包。",
      "kw": [
        "下载",
        "安装包",
        "官方渠道",
        "官网"
      ],
      "q_en": "Where do I download the installer?",
      "a_en": "From the official download page: https://231ljk.github.io/NovaForge-Studio/ . Visitors in China are routed to the Gitee mirror automatically, others to GitHub — both carry identical packages. Avoid third-party download sites to prevent tampered installers."
    },
    {
      "id": "FAQ-011",
      "cat": "安装与启动",
      "q": "安装时提示 Windows 已保护你的电脑 / SmartScreen，怎么处理？",
      "a": "这是安装包尚未做代码签名的常见提示，不是文件损坏。点击「更多信息」，再点「仍要运行」即可继续安装。",
      "kw": [
        "SmartScreen",
        "代码签名",
        "安装拦截",
        "仍要运行"
      ],
      "q_en": "Windows SmartScreen blocks the installer — what now?",
      "a_en": "Click “More info → Run anyway”. The installer is not code-signed with an EV certificate yet, so SmartScreen warns on first run. You can verify the checksum on the Releases page."
    },
    {
      "id": "FAQ-012",
      "cat": "安装与启动",
      "q": "安装包多大？需要多少磁盘空间？",
      "a": "Windows 安装包约 384 MB，实际安装后占用会更大，建议预留 2 GB 以上空间，包含后续工具链下载。",
      "kw": [
        "安装包大小",
        "磁盘空间",
        "384MB"
      ],
      "q_en": "How large is the installer? How much disk space do I need?",
      "a_en": "The Windows installer is about 384 MB; the installed footprint is larger. Reserve at least 2 GB, including the toolchain download."
    },
    {
      "id": "FAQ-013",
      "cat": "安装与启动",
      "q": "安装完打不开 / 双击没反应怎么办？",
      "a": "先确认系统是 Windows 10 或 11 的 64 位版本，再看是否有杀毒软件拦截（可将安装目录加入白名单后重试）。如果仍然打不开，请提供系统版本、安装路径和错误截图给技术支持。",
      "kw": [
        "打不开",
        "闪退",
        "启动失败"
      ],
      "q_en": "The app does not start after installation?",
      "a_en": "Check whether antivirus quarantined it, run it as administrator once, and confirm the system is 64-bit Windows 10/11. If it still fails, send the log from the install directory to support."
    },
    {
      "id": "FAQ-014",
      "cat": "安装与启动",
      "q": "安装后原有数据会丢吗？",
      "a": "正常覆盖安装不会清空应用数据。数据目录在 %APPDATA%\\novaforge-studio ，卸载软件本身也不会自动删除该目录。",
      "kw": [
        "覆盖安装",
        "数据保留",
        "升级"
      ]
    },
    {
      "id": "FAQ-015",
      "cat": "安装与启动",
      "q": "怎么彻底卸载、清除所有数据？",
      "a": "先在 Windows「应用与功能」里卸载软件；如需清除全部本地数据（账号、项目、配置、令牌），再手动删除 %APPDATA%\\novaforge-studio 目录。",
      "kw": [
        "卸载",
        "清除数据",
        "应用数据目录"
      ]
    },
    {
      "id": "FAQ-016",
      "cat": "安装与启动",
      "q": "换电脑了，项目怎么迁移？",
      "a": "项目保存在本机应用数据目录，当前版本没有云端项目同步。换电脑请先备份 %APPDATA%\\novaforge-studio 目录，再在新电脑上还原。",
      "kw": [
        "迁移",
        "备份",
        "换电脑",
        "同步"
      ]
    },
    {
      "id": "FAQ-017",
      "cat": "开发板与工具链",
      "q": "支持哪些开发板？",
      "a": "内置 40 余款预设，覆盖五类：ESP32 全系列（含 S2/S3/C3/C6/H2、ESP32-CAM、M5Stack 等）、ESP8266 系列、树莓派 Pico / RP2040 系列、Arduino AVR 系列（Uno/Nano/Mega/Leonardo 等）、树莓派 Linux 单板（4B/5/Zero 等）。",
      "kw": [
        "开发板",
        "ESP32",
        "ESP8266",
        "RP2040",
        "AVR",
        "型号支持"
      ],
      "q_en": "Which development boards are supported?",
      "a_en": "The full ESP32 family (including S3 / C3 / C6), ESP8266, Raspberry Pi Pico (RP2040) and Arduino AVR boards. Raspberry Pi Linux boards are deployed over SSH."
    },
    {
      "id": "FAQ-018",
      "cat": "开发板与工具链",
      "q": "我的板子型号不在列表里怎么办？",
      "a": "只有同芯片、同封装接近的型号可以作为替代，选择相近型号后需要自行核对引脚定义，编译生成的固件才可靠。不确定时请把板子型号发给技术支持确认。",
      "kw": [
        "开发板型号",
        "替代型号",
        "引脚核对"
      ]
    },
    {
      "id": "FAQ-019",
      "cat": "开发板与工具链",
      "q": "第一次用，编译按钮点了报「未找到 arduino-cli」？",
      "a": "说明还没安装编译工具链。进入「设置 → 编译工具链」，点击「安装 arduino-cli」，等提示安装完成后，再安装对应开发板核心（ESP32 板选 esp32:esp32）。",
      "kw": [
        "arduino-cli",
        "工具链",
        "未找到",
        "安装工具链"
      ]
    },
    {
      "id": "FAQ-020",
      "cat": "开发板与工具链",
      "q": "安装工具链要多久？为什么这么慢？",
      "a": "首次安装 ESP32 核心需要下载数百 MB 数据，耗时取决于网络情况，属于正常现象。安装过程中界面会显示进度条和日志，请保持网络通畅、不要中途关闭软件。",
      "kw": [
        "工具链安装",
        "下载慢",
        "进度",
        "ESP32核心"
      ]
    },
    {
      "id": "FAQ-021",
      "cat": "开发板与工具链",
      "q": "装完 arduino-cli 还是要装核心吗？",
      "a": "需要。arduino-cli 只是编译器外壳，每个芯片系列还需要单独的核心包：esp32:esp32、esp8266:esp8266、rp2040:rp2040、arduino:avr。装好对应核心后状态才会显示「就绪」。",
      "kw": [
        "核心",
        "esp32:esp32",
        "就绪",
        "编译器"
      ]
    },
    {
      "id": "FAQ-022",
      "cat": "开发板与工具链",
      "q": "可以同时装多个核心吗？",
      "a": "可以，四个核心互不冲突，安装后会分别显示已安装及版本号。",
      "kw": [
        "多个核心",
        "共存",
        "冲突"
      ]
    },
    {
      "id": "FAQ-023",
      "cat": "开发板与工具链",
      "q": "编译时提示找不到某个库（头文件）怎么办？",
      "a": "软件会按代码里的 #include 自动尝试安装常见库（如 PubSubClient、Adafruit SSD1306、Adafruit GFX、LiquidCrystal I2C、DHT、BME280、MPU6050、ESP32Servo 等）。如果用的是其他库，需要自行安装后重新编译。",
      "kw": [
        "库",
        "头文件",
        "#include",
        "找不到库"
      ]
    },
    {
      "id": "FAQ-024",
      "cat": "编写与编译",
      "q": "不会写代码能用吗？",
      "a": "可以。选择「图形化」编写方式，用积木块拖拽搭建逻辑，软件会自动转换成 Arduino C++ 代码，随时能切到代码视图查看。",
      "kw": [
        "图形化",
        "积木",
        "零基础",
        "Blockly"
      ],
      "q_en": "Can I use it without knowing how to code?",
      "a_en": "Yes. The visual programming page lets you build logic by dragging blocks; the generated code is shown alongside and stays editable."
    },
    {
      "id": "FAQ-025",
      "cat": "编写与编译",
      "q": "图形化和代码能互相切换吗？",
      "a": "能。两种模式在同一个项目里切换，代码视图可以直接看到积木生成的代码。",
      "kw": [
        "模式切换",
        "代码视图",
        "图形化"
      ]
    },
    {
      "id": "FAQ-026",
      "cat": "编写与编译",
      "q": "我点了「重置模板」，代码被覆盖了，能恢复吗？",
      "a": "不能。该按钮会用当前引脚配置重新生成固件并覆盖代码模式中已有代码，属于覆盖性操作，界面有提醒。建议重要代码自行备份。",
      "kw": [
        "重置模板",
        "覆盖",
        "恢复",
        "撤销"
      ]
    },
    {
      "id": "FAQ-027",
      "cat": "编写与编译",
      "q": "切换开发板后代码和引脚会怎样？",
      "a": "引脚配置和代码模板会按新开发板同步（提示「已切换到 XX，引脚与代码已按该开发板同步」）。切换后请检查引脚定义是否仍然符合你的接线。",
      "kw": [
        "切换开发板",
        "引脚同步",
        "换型号"
      ]
    },
    {
      "id": "FAQ-028",
      "cat": "编写与编译",
      "q": "编译报「编译失败，请查看下方日志」，怎么排查？",
      "a": "先看编译日志里的第一条红色错误，常见原因是语法错误、引脚定义与芯片不匹配、缺少库、核心未安装。按日志提示修正后重新编译即可。",
      "kw": [
        "编译失败",
        "报错",
        "编译日志"
      ],
      "q_en": "Compilation failed — how do I troubleshoot?",
      "a_en": "Read the log below the editor: missing library, wrong board selection and syntax errors are the most common causes. Fix the first error reported, then recompile."
    },
    {
      "id": "FAQ-029",
      "cat": "编写与编译",
      "q": "编译成功但没有生成 .bin？",
      "a": "请确认选中的开发板与核心匹配，并且不是「树莓派 Linux 单板」（该类板子走 SSH 部署，不需要编译固件）。若仍异常，请提供完整编译日志。",
      "kw": [
        "编译产物",
        "bin",
        "没有生成固件"
      ]
    },
    {
      "id": "FAQ-030",
      "cat": "编写与编译",
      "q": "编译是在本地还是云端？要等多久？",
      "a": "在本机编译，不上传云端。耗时与代码规模、电脑性能有关，正常情况下几秒到几十秒。",
      "kw": [
        "编译时间",
        "本地编译",
        "编译耗时"
      ]
    },
    {
      "id": "FAQ-031",
      "cat": "烧录与串口",
      "q": "烧录前要做什么准备？",
      "a": "三条：用能传数据的数据线（不是只充电的线）连接开发板；关闭可能占用串口的其他软件（如 Arduino IDE、串口助手）；在「烧录与串口」页正确选择串口。另外烧录前必须先编译成功。",
      "kw": [
        "烧录准备",
        "数据线",
        "串口占用"
      ],
      "q_en": "What should I prepare before flashing?",
      "a_en": "Compile the firmware first, connect the board with a data-capable USB cable, install the serial driver (CH340 / CP210x), and close any other program occupying the port."
    },
    {
      "id": "FAQ-032",
      "cat": "烧录与串口",
      "q": "提示「没有可烧录的固件，请先在「编写固件」中编译」，怎么办？",
      "a": "说明当前项目还没有编译产物。先在「编写固件」页点「编译固件」，看到编译成功后再回到烧录页。",
      "kw": [
        "没有可烧录的固件",
        "先编译",
        "烧录前"
      ]
    },
    {
      "id": "FAQ-033",
      "cat": "烧录与串口",
      "q": "提示「未检测到系统串口，请检查驱动和 USB 数据线」，怎么处理？",
      "a": "按顺序排查：换一根确认能传数据的 USB 线；换一个 USB 口（优先主板直出 USB 口）；确认开发板 USB 转串口芯片的驱动已安装（常见为 CP210x、CH340，具体以你的开发板说明为准）；关闭占用串口的软件后点刷新。",
      "kw": [
        "未检测到串口",
        "驱动",
        "CH340",
        "CP210x",
        "USB线"
      ],
      "q_en": "“No serial port detected” — what to do?",
      "a_en": "Use a data cable rather than a charge-only one, install the USB-serial driver, and check Device Manager for a COM port. Replug the board and refresh the port list."
    },
    {
      "id": "FAQ-034",
      "cat": "烧录与串口",
      "q": "ESP32 烧录报连接失败怎么办？",
      "a": "按住开发板上的 BOOT 键，点「开始烧录」后再松开；若仍失败，检查是否选错串口、是否有其他软件占用串口，以及板子是否处于正常供电状态。",
      "kw": [
        "烧录失败",
        "BOOT键",
        "连接失败"
      ],
      "q_en": "ESP32 flashing reports a connection failure?",
      "a_en": "Hold the BOOT button while starting the flash, lower the baud rate to 115200, and make sure the board is powered. Some boards need the EN pin toggled."
    },
    {
      "id": "FAQ-035",
      "cat": "烧录与串口",
      "q": "烧录波特率选哪个？",
      "a": "115200 兼容性最好，460800 为推荐值，921600 速度最快但部分板子/线材不稳定。烧录失败时可先降到 115200 重试。",
      "kw": [
        "波特率",
        "115200",
        "460800",
        "921600"
      ]
    },
    {
      "id": "FAQ-036",
      "cat": "烧录与串口",
      "q": "「先擦除整片 Flash」是干什么的？要不要勾？",
      "a": "勾选后会清除设备里已有的全部数据再烧录。只有在固件异常、需要彻底重刷时才建议勾选；平时不要勾选，否则设备中的原有数据会丢失。",
      "kw": [
        "擦除Flash",
        "数据清除",
        "彻底重刷"
      ]
    },
    {
      "id": "FAQ-037",
      "cat": "烧录与串口",
      "q": "树莓派 Pico 怎么烧录？",
      "a": "Pico 系列用 UF2 方式：编译后把生成的 .uf2 文件复制到 BOOTSEL 磁盘即可。当前版本需要手动拖放，软件内的「自动写入」在后续版本提供。",
      "kw": [
        "Pico",
        "RP2040",
        "UF2",
        "BOOTSEL"
      ]
    },
    {
      "id": "FAQ-038",
      "cat": "烧录与串口",
      "q": "Arduino Uno / Nano 怎么烧？",
      "a": "在 AVR 烧录页面选择串口后开始烧录，软件会使用最近一次编译产生的 .hex 文件。",
      "kw": [
        "Arduino",
        "Uno",
        "Nano",
        "avrdude",
        "hex"
      ]
    },
    {
      "id": "FAQ-039",
      "cat": "烧录与串口",
      "q": "树莓派 4B / Zero 这类板子为什么不能编译烧录？",
      "a": "它们运行的是 Linux 系统，不需要烧录固件，应通过 SSH 部署程序。软件对这类板子只提供提示，不提供编译烧录。",
      "kw": [
        "树莓派",
        "Linux单板",
        "SSH部署"
      ]
    },
    {
      "id": "FAQ-040",
      "cat": "烧录与串口",
      "q": "串口监视器看不到任何输出？",
      "a": "先确认波特率与固件里一致（Arduino 默认 115200，也有 9600 的情况），再确认串口选择正确、监视器已点「开始」，最后确认设备是否已重新上电运行。",
      "kw": [
        "串口监视器",
        "无输出",
        "波特率"
      ]
    },
    {
      "id": "FAQ-041",
      "cat": "配网与联网",
      "q": "怎么给 ESP32 配网？",
      "a": "本产品没有独立的配网模式，也没有蓝牙配网。做法是：在「设备控制」页右侧填写 Wi-Fi 名称和密码并保存，然后重新编译 + 烧录，设备重新上电就会连接这个 Wi-Fi。",
      "kw": [
        "配网",
        "WiFi",
        "2.4GHz",
        "蓝牙配网",
        "联网"
      ],
      "q_en": "How do I connect the ESP32 to Wi-Fi?",
      "a_en": "Open the device control page, enter the SSID and password, and save. The firmware stores the credentials and reconnects automatically on boot."
    },
    {
      "id": "FAQ-042",
      "cat": "配网与联网",
      "q": "为什么保存了 Wi-Fi 密码还是连不上？",
      "a": "三个最常见原因：一是没有重新编译烧录（表单保存只写进配置，固件里还是旧参数）；二是用了 5GHz 网络（ESP32 / Pico W 只支持 2.4GHz）；三是密码或名称有误。改完务必重新编译并烧录。",
      "kw": [
        "WiFi连不上",
        "2.4GHz",
        "重新烧录",
        "密码"
      ]
    },
    {
      "id": "FAQ-043",
      "cat": "配网与联网",
      "q": "设备连上 Wi-Fi 后怎么知道它的 IP？",
      "a": "打开「烧录与串口」页的串口监视器，波特率选 115200，设备启动时会依次打印「正在连接 Wi-Fi」「IP:」「硬件 ID:」。也可以在路由器管理页面按设备名查找。",
      "kw": [
        "IP地址",
        "串口打印",
        "路由器"
      ]
    },
    {
      "id": "FAQ-044",
      "cat": "配网与联网",
      "q": "串口打印「正在连接 Wi-Fi」后一直不出现 IP？",
      "a": "固件等待联网最长约 20 秒，超时说明没连上。请核对 Wi-Fi 是否为 2.4GHz、密码是否正确、路由器是否开启了 MAC 过滤，然后重新烧录。",
      "kw": [
        "连接WiFi",
        "超时",
        "不出IP",
        "MAC过滤"
      ]
    },
    {
      "id": "FAQ-045",
      "cat": "配网与联网",
      "q": "设备必须和电脑在同一个路由器下吗？",
      "a": "是的。设备控制、Home Assistant 集成都基于局域网，电脑与设备需要处在同一局域网内。",
      "kw": [
        "局域网",
        "同一网络",
        "远程控制"
      ]
    },
    {
      "id": "FAQ-046",
      "cat": "配网与联网",
      "q": "能不能连手机热点？",
      "a": "可以，只要热点是 2.4GHz 频段、且电脑也连在同一个热点下即可。",
      "kw": [
        "手机热点",
        "2.4GHz",
        "频段"
      ]
    },
    {
      "id": "FAQ-047",
      "cat": "设备控制",
      "q": "设备控制页连不上设备，报「连接失败」，怎么排查？",
      "a": "按顺序确认：设备已上电且已连上 Wi-Fi（串口能看到 IP）；电脑与设备在同一局域网；地址填对（默认是 http://设备ID.local，也可以直接填 IP）；Windows 上设备名解析偶尔不稳定，建议直接填 IP 重试。",
      "kw": [
        "连接失败",
        "device.local",
        "IP直连",
        "设备控制"
      ]
    },
    {
      "id": "FAQ-048",
      "cat": "设备控制",
      "q": "控制页没有按钮可以点？",
      "a": "说明这个项目还没有定义引脚功能。请先在「编写固件」页的引脚功能编辑区添加引脚、填功能名、选方向（输出/输入），再重新编译烧录。",
      "kw": [
        "引脚定义",
        "控制按钮",
        "未定义引脚"
      ]
    },
    {
      "id": "FAQ-049",
      "cat": "设备控制",
      "q": "输入引脚为什么没有开关按钮？",
      "a": "输入引脚是只读的，状态由设备上报，界面只显示当前状态，不能从软件端强制拉高拉低。",
      "kw": [
        "输入引脚",
        "只读",
        "binary_sensor"
      ]
    },
    {
      "id": "FAQ-050",
      "cat": "设备控制",
      "q": "控制接口是什么？我想自己调用。",
      "a": "状态查询为 GET /api/state；控制为 GET /api/set?key=功能名&value=0|1。设置过授权码时，控制接口必须带正确令牌，否则会被拒绝。",
      "kw": [
        "API",
        "api/state",
        "api/set",
        "令牌"
      ]
    },
    {
      "id": "FAQ-051",
      "cat": "设备控制",
      "q": "为什么改了引脚功能要重新烧录？",
      "a": "引脚定义会被写进生成的固件里，包括控制接口和 Home Assistant 实体映射，所以必须重新编译烧录后才会生效。",
      "kw": [
        "引脚修改",
        "重新烧录",
        "实体映射"
      ]
    },
    {
      "id": "FAQ-052",
      "cat": "Home Assistant 智能家居",
      "q": "怎么把设备接入 Home Assistant？",
      "a": "两条路线任选。路线一（推荐，不需要 MQTT）：在 HA 安装 novaforge 社区集成（HACS 自定义仓库或手动复制 custom_components/novaforge）→ 重启 HA → 在「设置 → 设备与服务」确认自动发现 → 粘贴软件里显示的设备控制授权码。路线二：在软件里填好 MQTT Broker 信息，重新编译烧录后由 HA 的 MQTT 自动发现。",
      "kw": [
        "Home Assistant",
        "HA",
        "集成",
        "HACS",
        "授权码"
      ],
      "q_en": "How do I add the device to Home Assistant?",
      "a_en": "The generated firmware includes MQTT Discovery. Point it at your MQTT broker, and the device appears in Home Assistant automatically once online."
    },
    {
      "id": "FAQ-053",
      "cat": "Home Assistant 智能家居",
      "q": "接入 HA 需要先装 Mosquitto 之类的 MQTT 服务器吗？",
      "a": "不一定。用官方社区集成路线不需要 MQTT Broker；只有选择 MQTT 路线时才需要。",
      "kw": [
        "MQTT",
        "Mosquitto",
        "Broker"
      ]
    },
    {
      "id": "FAQ-054",
      "cat": "Home Assistant 智能家居",
      "q": "需要给板子刷 ESPHome 或 Tasmota 吗？",
      "a": "不需要。软件生成的固件原生支持被 HA 发现，无需第三方固件。",
      "kw": [
        "ESPHome",
        "Tasmota",
        "第三方固件"
      ]
    },
    {
      "id": "FAQ-055",
      "cat": "Home Assistant 智能家居",
      "q": "HA 里找不到设备怎么办？",
      "a": "请检查：设备与 HA 在同一网段；固件是最近一次烧录的版本；HA 已重启；集成已安装。仍找不到时，可在软件页面复制手动配置，或用「手动添加集成」方式输入设备 IP + 授权码。",
      "kw": [
        "自动发现失败",
        "同网段",
        "重启HA",
        "找不到设备"
      ]
    },
    {
      "id": "FAQ-056",
      "cat": "Home Assistant 智能家居",
      "q": "设备控制授权码在哪看？丢了怎么办？",
      "a": "在软件「Home Assistant」页可以看到每个项目的设备控制授权码，并支持复制。授权码在烧录时写入固件（128 位随机令牌），换码需要重新编译烧录。",
      "kw": [
        "授权码",
        "令牌",
        "复制",
        "在哪里看"
      ]
    },
    {
      "id": "FAQ-057",
      "cat": "Home Assistant 智能家居",
      "q": "改了设备名字 / 有两块同名设备，会不会串号？",
      "a": "不会。设备唯一标识由芯片 MAC 派生（形如 nf-a4cf12ff7e2a），改名或同名都不会串号；设备换 IP 后也会自动更新。",
      "kw": [
        "设备唯一标识",
        "MAC",
        "串号",
        "同名设备"
      ]
    },
    {
      "id": "FAQ-058",
      "cat": "Home Assistant 智能家居",
      "q": "HA 里为什么只有开关和传感器两种实体？",
      "a": "输出引脚映射为开关（switch），输入引脚映射为只读传感器（binary_sensor），状态每 10 秒刷新一次。",
      "kw": [
        "switch",
        "binary_sensor",
        "实体",
        "刷新"
      ]
    },
    {
      "id": "FAQ-059",
      "cat": "AI 助手",
      "q": "AI 助手要钱吗？必须联网吗？",
      "a": "不额外收费。可以完全离线使用（本地模型，数据不出电脑），也可以自己配置云端接口（此时需要联网并自行承担第三方 API 费用）。",
      "kw": [
        "AI助手",
        "本地推理",
        "云端API",
        "收费"
      ],
      "q_en": "Does the AI assistant cost money? Does it need the network?",
      "a_en": "It is free. Local models run fully offline on your machine; cloud AI requires your own API key and a network connection."
    },
    {
      "id": "FAQ-060",
      "cat": "AI 助手",
      "q": "本地 AI 启动失败 / 一直显示加载中？",
      "a": "本地模型文件需要自备并放到指定位置（安装目录 resources/mimo/ 或外接盘），首次加载约需 10~40 秒。若提示找不到模型，请检查文件是否放对、文件名是否与列表一致，或在设置里手动填写模型路径。",
      "kw": [
        "本地模型",
        "llama-server",
        "模型路径",
        "启动失败"
      ]
    },
    {
      "id": "FAQ-061",
      "cat": "AI 助手",
      "q": "本地 AI 回答很慢，正常吗？",
      "a": "正常。CPU 推理速度约 5~15 字/秒，建议换成 1 GB 左右的轻量模型（如 Qwen2.5-1.5B）以提升速度。",
      "kw": [
        "推理速度",
        "CPU",
        "回答慢"
      ]
    },
    {
      "id": "FAQ-062",
      "cat": "AI 助手",
      "q": "云端 AI 显示「配置缺失」或发消息没反应？",
      "a": "请检查 Base URL、API Key、模型名三项是否都填写正确（预设会自动填前两项）。可先点「保存并测试」验证。API Key 只有填写正确才能连通。",
      "kw": [
        "Base URL",
        "API Key",
        "模型名",
        "配置缺失"
      ]
    },
    {
      "id": "FAQ-063",
      "cat": "AI 助手",
      "q": "我的 API Key 安全吗？",
      "a": "安全。密钥使用系统安全存储（Windows DPAPI / macOS Keychain）加密保存，不会以明文写入磁盘。",
      "kw": [
        "API Key",
        "加密",
        "DPAPI",
        "安全"
      ]
    },
    {
      "id": "FAQ-064",
      "cat": "AI 助手",
      "q": "对话内容会被上传吗？",
      "a": "使用本地模型时对话数据不离开电脑。使用云端模型时，对话内容会发送到你配置的那家服务商，请按其隐私政策判断。",
      "kw": [
        "对话内容",
        "隐私",
        "上传"
      ]
    },
    {
      "id": "FAQ-065",
      "cat": "账号与登录",
      "q": "注册一定要邮箱吗？",
      "a": "是的。注册与登录都需要发送到真实邮箱的 6 位验证码，注册时请填写能正常收信的邮箱。",
      "kw": [
        "注册",
        "邮箱",
        "验证码"
      ],
      "q_en": "Do I have to register with an email address?",
      "a_en": "Yes. Registration uses an email verification code; there is no phone-number sign-up."
    },
    {
      "id": "FAQ-066",
      "cat": "账号与登录",
      "q": "收不到验证码怎么办？",
      "a": "先看垃圾邮件/退信目录；确认邮箱地址没写错；两次获取之间有 30 秒冷却，请等倒计时结束再点；如果界面提示「验证码发送失败」，多为网络或邮件服务异常，稍后重试或换邮箱。",
      "kw": [
        "验证码",
        "收不到",
        "垃圾邮件",
        "30秒"
      ],
      "q_en": "I did not receive the verification code?",
      "a_en": "Check the spam folder, wait 60 seconds before requesting again, and confirm the address is typed correctly. Corporate mail servers sometimes delay delivery."
    },
    {
      "id": "FAQ-067",
      "cat": "账号与登录",
      "q": "验证码提示已过期 / 尝试次数过多？",
      "a": "验证码 30 秒内有效，单个验证码最多尝试 5 次。超时或超次后重新点「获取验证码」。",
      "kw": [
        "验证码过期",
        "尝试次数",
        "重新获取"
      ]
    },
    {
      "id": "FAQ-068",
      "cat": "账号与登录",
      "q": "忘记密码了怎么办？",
      "a": "可以用「邮箱验证码」方式直接登录，不需要输入密码；当前版本没有独立的找回密码页面。",
      "kw": [
        "忘记密码",
        "找回密码",
        "验证码登录"
      ]
    },
    {
      "id": "FAQ-069",
      "cat": "账号与登录",
      "q": "提示「该邮箱已注册，请直接登录」/「该邮箱尚未注册」怎么办？",
      "a": "前者说明这个邮箱已经注册过，请切到登录；后者说明还没注册，请先走注册流程。",
      "kw": [
        "已注册",
        "尚未注册",
        "邮箱"
      ]
    },
    {
      "id": "FAQ-070",
      "cat": "账号与登录",
      "q": "提示「邮箱或密码不正确」？",
      "a": "请核对邮箱与密码（密码至少 6 位）。出于安全考虑，系统对「邮箱不存在」和「密码错误」不区分提示。",
      "kw": [
        "密码错误",
        "登录失败",
        "邮箱或密码不正确"
      ]
    },
    {
      "id": "FAQ-071",
      "cat": "账号与登录",
      "q": "可以绑定 GitHub / Gitee 吗？",
      "a": "可以。在「设置 → 账号」里绑定或解绑。GitHub 采用一次性授权码方式，需要在浏览器授权页输入软件显示的一次性代码完成授权。",
      "kw": [
        "GitHub",
        "Gitee",
        "授权",
        "绑定",
        "一次性代码"
      ]
    },
    {
      "id": "FAQ-072",
      "cat": "账号与登录",
      "q": "能在多台设备上同时登录同一个账号吗？",
      "a": "账号是邮箱主账号，电脑端、手机端、Home Assistant 集成共用同一账号。请不要把账号借给他人使用。",
      "kw": [
        "多端",
        "同时登录",
        "共用账号"
      ]
    },
    {
      "id": "FAQ-073",
      "cat": "账号与登录",
      "q": "退出账号会删数据吗？",
      "a": "不会。退出只结束登录状态；要清除本地数据需删除应用数据目录。",
      "kw": [
        "退出账号",
        "数据",
        "登录状态"
      ]
    },
    {
      "id": "FAQ-074",
      "cat": "数据与安全",
      "q": "项目文件存在哪里？",
      "a": "保存在本机应用数据目录（Windows 为 %APPDATA%\\novaforge-studio），具体路径可在「设置 → 运行环境」中查看。",
      "kw": [
        "项目路径",
        "APPDATA",
        "数据目录"
      ],
      "q_en": "Where are project files stored?",
      "a_en": "In the projects directory under the app data folder. You can change the location in Settings; back it up by copying that folder."
    },
    {
      "id": "FAQ-075",
      "cat": "数据与安全",
      "q": "密码是怎么保存的？",
      "a": "密码以 scrypt 加盐哈希方式保存，不保存明文，也不外传。",
      "kw": [
        "scrypt",
        "密码安全",
        "哈希"
      ]
    },
    {
      "id": "FAQ-076",
      "cat": "数据与安全",
      "q": "我的 Wi-Fi 密码会被上传吗？",
      "a": "不会。Wi-Fi 名称和密码只写进你编译的固件并随固件烧录到设备，不会上传服务器。",
      "kw": [
        "WiFi密码",
        "隐私",
        "上传"
      ]
    },
    {
      "id": "FAQ-077",
      "cat": "数据与安全",
      "q": "软件会收集我的使用数据或推送广告吗？",
      "a": "不会。不做行为统计上报、不投广告、不出售个人信息。",
      "kw": [
        "隐私",
        "广告",
        "统计",
        "数据收集"
      ]
    },
    {
      "id": "FAQ-078",
      "cat": "数据与安全",
      "q": "烧录会不会把设备弄坏？",
      "a": "正常情况下不会，但烧录存在硬件损坏或数据丢失的风险（例如勾选擦除整片 Flash 会清除设备已有数据），重要数据请自行备份，接线与供电请按开发板规范操作。",
      "kw": [
        "烧录风险",
        "硬件损坏",
        "备份"
      ],
      "q_en": "Can flashing damage my board?",
      "a_en": "Normal flashing does not. Only interrupting a flash mid-way or choosing the wrong chip model can leave the board unbootable, which is recoverable by re-flashing in download mode."
    },
    {
      "id": "FAQ-079",
      "cat": "手机端与其他",
      "q": "手机端怎么和电脑连起来？",
      "a": "手机与电脑连同一个 Wi-Fi，用同一个邮箱账号登录，在手机「我的」页填写电脑地址（形如 192.168.1.5:18700），即可同步账号库、查看项目与编译进度、控制设备。",
      "kw": [
        "手机端",
        "电脑地址",
        "18700",
        "同步"
      ]
    },
    {
      "id": "FAQ-080",
      "cat": "手机端与其他",
      "q": "手机能直接编译烧录吗？",
      "a": "编译实际在电脑上执行，开发板需要插在已连接的电脑上。手机上可以发起操作并查看进度。",
      "kw": [
        "手机编译",
        "电脑执行",
        "远程"
      ]
    },
    {
      "id": "FAQ-081",
      "cat": "手机端与其他",
      "q": "首页 / 设置里显示的端口（18700、18434）是什么？",
      "a": "18700 是电脑端局域网网关端口，用于手机与电脑协同；18434 是本地 AI 推理服务的接口端口。它们都只在本机或局域网内使用。",
      "kw": [
        "18700",
        "18434",
        "端口",
        "网关"
      ]
    },
    {
      "id": "FAQ-082",
      "cat": "手机端与其他",
      "q": "软件界面是什么语言？",
      "a": "当前版本界面文字为中文，六个主功能页分别为工作台、编写固件、烧录与串口、设备控制、Home Assistant、设置。",
      "kw": [
        "语言",
        "中文",
        "界面"
      ]
    },
    {
      "id": "FAQ-083",
      "cat": "手机端与其他",
      "q": "能用来做产品量产吗？",
      "a": "软件面向学习、验证与小批量自用场景，未提供量产烧录、批量配置等能力。量产需求建议使用专业产测工具（此项非本产品承诺能力）。",
      "kw": [
        "量产",
        "批量烧录",
        "产测"
      ]
    },
    {
      "id": "FAQ-084",
      "cat": "手机端与其他",
      "q": "软件卡顿 / 占用内存高怎么办？",
      "a": "可先关闭本地 AI 推理服务（设置 → AI 助手 → 停止推理服务），并关闭不需要的串口监视器。若仍卡顿，请提供电脑配置与操作步骤。",
      "kw": [
        "卡顿",
        "内存",
        "性能"
      ],
      "q_en": "The app is laggy or uses a lot of memory?",
      "a_en": "Close unused projects, disable the local AI model when not needed, and avoid keeping the serial monitor open at high baud rates for long periods."
    }
  ]
};
})();
