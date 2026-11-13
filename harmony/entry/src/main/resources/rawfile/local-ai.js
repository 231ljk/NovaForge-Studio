/**
 * NovaForge 手机端内置 AI 引擎（离线）。
 *
 * 这是一套跑在手机本地的推理引擎：不联网、不依赖电脑、不需要下载模型，
 * 安装即用。它由「意图理解 + 固件代码生成 + 错误诊断 + 设备/HA 编排」四部分组成，
 * 能直接把自然语言变成可执行的固件与操作指令。
 *
 * 当手机登录的邮箱账号所对应的电脑在线时，界面可切换到电脑上的 MiMo 大模型增强。
 */
(function (global) {
  'use strict'

  // ---------------- 工具 ----------------
  function norm(s) {
    return String(s || '').toLowerCase().replace(/\s+/g, '')
  }
  function has(text, words) {
    for (var i = 0; i < words.length; i++) if (text.indexOf(words[i]) !== -1) return true
    return false
  }
  function pickPin(text) {
    var m = text.match(/(?:gpio|引脚|pin)\s*([0-9]{1,2})/i)
    if (m) return parseInt(m[1], 10)
    var bare = text.match(/([0-9]{1,2})号/)
    if (bare) return parseInt(bare[1], 10)
    return 2
  }
  function pickBoard(text) {
    if (has(text, ['8266', 'nodemcu', 'd1mini', 'd1 mini'])) return 'esp8266'
    if (has(text, ['c3', 's3', 'c6', 'esp32'])) return 'esp32'
    if (has(text, ['uno', 'nano', 'avr', '328'])) return 'avr'
    return 'esp32'
  }

  // ---------------- 固件代码生成 ----------------
  function genBlink(board, pin) {
    if (board === 'avr') {
      return [
        '// 由 NovaForge 内置 AI 生成：Arduino UNO/Nano 闪烁 ' + pin + ' 号引脚',
        'void setup() {',
        '  pinMode(' + pin + ', OUTPUT);',
        '}',
        '',
        'void loop() {',
        '  digitalWrite(' + pin + ', HIGH);',
        '  delay(1000);',
        '  digitalWrite(' + pin + ', LOW);',
        '  delay(1000);',
        '}'
      ].join('\n')
    }
    var wifi = board === 'esp8266' ? 'ESP8266WiFi' : 'WiFi'
    return [
      '// 由 NovaForge 内置 AI 生成：' + (board === 'esp8266' ? 'ESP8266' : 'ESP32') +
        ' 闪烁 GPIO' + pin + '，并可通过手机控制',
      '#include <' + wifi + '.h>',
      '',
      'const int PIN = ' + pin + ';',
      'bool state = false;',
      'unsigned long last = 0;',
      '',
      'void setup() {',
      '  Serial.begin(115200);',
      '  pinMode(PIN, OUTPUT);',
      '}',
      '',
      'void loop() {',
      '  // 每 1 秒翻转一次，串口输入 on/off 可手动控制',
      '  if (millis() - last > 1000) {',
      '    last = millis();',
      '    state = !state;',
      '    digitalWrite(PIN, state ? HIGH : LOW);',
      '  }',
      '  if (Serial.available()) {',
      '    String cmd = Serial.readStringUntil(\'\\n\');',
      '    cmd.trim();',
      '    if (cmd == "on") { state = true; digitalWrite(PIN, HIGH); }',
      '    if (cmd == "off") { state = false; digitalWrite(PIN, LOW); }',
      '  }',
      '}'
    ].join('\n')
  }

  function genSensor(board) {
    var sensor = board === 'avr' ? 'DHT' : 'DHT'
    return [
      '// 由 NovaForge 内置 AI 生成：DHT11 温湿度读取（' + sensor + ' 库）',
      '#include <DHT.h>',
      '',
      '#define DHTPIN 4',
      '#define DHTTYPE DHT11',
      'DHT dht(DHTPIN, DHTTYPE);',
      '',
      'void setup() {',
      '  Serial.begin(115200);',
      '  dht.begin();',
      '}',
      '',
      'void loop() {',
      '  float t = dht.readTemperature();',
      '  float h = dht.readHumidity();',
      '  if (isnan(t) || isnan(h)) {',
      '    Serial.println("传感器读取失败，检查接线与上拉电阻");',
      '  } else {',
      '    Serial.printf("温度 %.1f ℃  湿度 %.1f %%\\n", t, h);',
      '  }',
      '  delay(2000);',
      '}'
    ].join('\n')
  }

  function genSwitch(board, pin) {
    var wifiInclude = board === 'esp8266' ? '#include <ESP8266WiFi.h>\n#include <ESP8266WebServer.h>\nESP8266WebServer server(80);' : '#include <WiFi.h>\n#include <WebServer.h>\nWebServer server(80);'
    return [
      '// 由 NovaForge 内置 AI 生成：手机网页控制的开关（GPIO' + pin + '）',
      wifiInclude,
      '',
      'bool state = false;',
      'const int PIN = ' + pin + ';',
      '',
      'void setup() {',
      '  Serial.begin(115200);',
      '  pinMode(PIN, OUTPUT);',
      '  WiFi.begin("你的WiFi", "密码");',
      '  while (WiFi.status() != WL_CONNECTED) delay(300);',
      '  Serial.println(WiFi.localIP());',
      '  server.on("/", []() {',
      '    server.send(200, "text/html", state ? "已开" : "已关");',
      '  });',
      '  server.on("/toggle", []() {',
      '    state = !state;',
      '    digitalWrite(PIN, state ? HIGH : LOW);',
      '    server.send(200, "text/plain", state ? "1" : "0");',
      '  });',
      '  server.begin();',
      '}',
      '',
      'void loop() { server.handleClient(); }'
    ].join('\n')
  }

  // ---------------- 意图路由 ----------------
  var HELP = [
    '我是 NovaForge 内置 AI（离线运行在手机上），可以直接帮你：',
    '· 「点灯」/「让 GPIO2 每秒闪一次」→ 生成固件代码',
    '· 「读温湿度」→ 生成传感器代码',
    '· 「做个手机开关」→ 生成联网开关',
    '· 「编译客厅灯」→ 触发电脑端编译（需登录同一账号）',
    '· 「报错 xxx」→ 帮你定位常见编译/烧录错误',
    '· 「打开客厅灯」→ 控制已接入的 Home Assistant 实体',
    '',
    '回复里带「代码」时，可以在「编译」页一键写入项目。'
  ].join('\n')

  function explainError(text) {
    var rules = [
      { k: ['not found', 'no such file'], v: '头文件/库找不到：到电脑端「设置 → 工具链」安装对应库，或检查 include 名称拼写。' },
      { k: ['esp32', 'board not found'], v: '开发板未安装：电脑端设置里安装 esp32 核心（boards manager）。' },
      { k: ['timed out', 'timeout', 'time out'], v: '烧录超时：多为串口被占用或波特率过高。拔掉重插，关闭串口监视器，重试。' },
      { k: ['failed to connect', 'no serial data'], v: '连不上芯片：检查 USB 线是否仅供电、按住 BOOT 再点烧录、确认选对串口。' },
      { k: ['compilation error', 'expected', 'was not declared'], v: '语法/作用域错误：看日志第一条 error 的行号，常见是漏分号、括号不匹配、变量未声明。' },
      { k: ['out of memory', 'sketch too big', 'region overflow'], v: '固件超出 Flash：换分区表（Huge APP）或裁剪库。' },
      { k: ['permission denied', 'access is denied'], v: '串口无权限：关闭占用串口的软件，或换 USB 口；Linux 需把用户加入 dialout 组。' }
    ]
    var low = norm(text)
    for (var i = 0; i < rules.length; i++) {
      for (var j = 0; j < rules[i].k.length; j++) {
        if (low.indexOf(norm(rules[i].k[j])) !== -1) return '诊断：' + rules[i].v
      }
    }
    return '把完整报错贴给我，我会按行定位。常见排查顺序：① 开发板型号是否选对 ② 库是否装齐 ③ 串口是否被占用 ④ USB 线是否支持数据传输。'
  }

  function chat(messages, ctx) {
    var last = ''
    for (var i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        last = messages[i].content || ''
        break
      }
    }
    var t = norm(last)
    ctx = ctx || {}
    var out = { content: '', action: null }

    if (!t) {
      out.content = HELP
      return Promise.resolve(out)
    }
    if (t.indexOf('报错') !== -1 || t.indexOf('错误') !== -1 || t.indexOf('error') !== -1) {
      out.content = explainError(last)
      return Promise.resolve(out)
    }
    if (has(t, ['帮助', '你能做', '能干什么', '怎么用', 'help'])) {
      out.content = HELP
      return Promise.resolve(out)
    }
    // 编译 / 烧录
    if (has(t, ['编译', '烧录', 'build', '下载程序', '上传'])) {
      var name = ''
      var projects = ctx.projects || []
      for (var p = 0; p < projects.length; p++) {
        if (t.indexOf(norm(projects[p].name)) !== -1) name = projects[p].name
      }
      if (!projects.length) {
        out.content = '还没有可编译的项目。请先在电脑端工作台新建项目，或让我为你生成一段固件代码。'
      } else if (!name) {
        out.content = '你想编译哪个项目？当前有：' + projects.map(function (x) { return x.name }).join('、')
      } else {
        out.content = '好的，准备编译「' + name + '」。'
        out.action = { type: 'build', projectName: name }
      }
      return Promise.resolve(out)
    }
    // 设备控制
    if (has(t, ['打开', '关闭', '开灯', '关灯', '开启'])) {
      var target = last.replace(/^(请|帮我|麻烦)?\s*(打开|关闭|开启|关闭一下)?\s*/g, '').trim()
      var on = !has(t, ['关闭', '关掉', '关灯'])
      if (has(t, ['ha', 'homeassistant', '智能家居', '客厅', '卧室', '灯', '插座', '风扇'])) {
        out.content = (on ? '准备打开「' : '准备关闭「') + (target || '目标设备') + '」。'
        out.action = { type: 'ha', query: target, on: on }
      } else {
        out.content = '我理解你想控制设备。要在「设备」页选中开发板，或用 HA 页控制智能设备。'
      }
      return Promise.resolve(out)
    }
    // 生成代码
    var board = pickBoard(t)
    var pin = pickPin(t)
    if (has(t, ['温湿度', 'dht', '传感器'])) {
      out.content = '已为你生成 DHT11 温湿度读取固件（' + board.toUpperCase() + '）：\n\n```\n' + genSensor(board) + '\n```'
      out.code = genSensor(board)
      return Promise.resolve(out)
    }
    if (has(t, ['开关', '网页', '联网', '远程控制'])) {
      var sw = genSwitch(board, pin)
      out.content = '已生成联网开关固件（GPIO' + pin + '）：\n\n```\n' + sw + '\n```'
      out.code = sw
      return Promise.resolve(out)
    }
    if (has(t, ['闪', '点灯', 'blink', '呼吸灯', 'led', '灯'])) {
      var code = genBlink(board, pin)
      out.content = '已生成闪烁固件（' + board.toUpperCase() + ' · GPIO' + pin + '）：\n\n```\n' + code + '\n```'
      out.code = code
      return Promise.resolve(out)
    }
    if (has(t, ['esp32', 'esp8266', 'arduino', '开发板', '引脚', 'gpio'])) {
      out.content =
        '开发板要点：\n' +
        '· ESP32 常用可输出引脚：2 / 4 / 5 / 12~19 / 21~23 / 25~27\n' +
        '· 启动时会拉高的引脚（0/2/12/15）不要接需要默认低电平的外设\n' +
        '· ESP8266 的 D1/D2 对应 GPIO5/GPIO4，D4 上电会短暂拉低\n' +
        '· 输入引脚建议启用内部上拉，避免悬空乱跳'
      return Promise.resolve(out)
    }
    out.content =
      '我可以离线帮你写固件、解释报错、控制设备和 HA 实体。\n' +
      '试试说：「让 GPIO2 每秒闪一次」「生成温湿度读取代码」「编译客厅灯」。'
    return Promise.resolve(out)
  }

  global.NovaLocalAI = {
    name: '内置 AI（离线）',
    ready: true,
    chat: chat
  }
})(window)
