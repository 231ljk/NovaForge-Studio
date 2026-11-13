import * as Blockly from 'blockly'
import { javascriptGenerator } from 'blockly/javascript'
// 中文语言包：标准积木（逻辑/循环/数学/文本/变量/列表）显示中文
import * as zhHans from 'blockly/msg/zh-hans'

/**
 * NovaForge 图形化积木库（v2 大扩容）
 * 10 大分类：引脚控制 / 时间与调试 / 网络 / 显示屏 / 传感器 +
 *           标准的 逻辑 / 循环 / 数学 / 文本 / 变量 / 列表
 * 显示与传感器积木生成 nfXxx() 调用，由固件模板按需注入驱动胶水层。
 */

const PIN = (name = 'PIN', value = 2): { type: string; name: string; value: number; min: number; max: number; precision: number } => ({
  type: 'field_number',
  name,
  value,
  min: 0,
  max: 48,
  precision: 1,
})
const NUM = (name: string, value: number, min: number, max: number): { type: string; name: string; value: number; min: number; max: number; precision: number } => ({
  type: 'field_number',
  name,
  value,
  min,
  max,
  precision: 1,
})
const TXT = (name: string, text: string): { type: string; name: string; text: string } => ({ type: 'field_input', name, text })
const DROP = (name: string, options: [string, string][]): { type: string; name: string; options: [string, string][] } => ({
  type: 'field_dropdown',
  name,
  options,
})
const STMT = { previousStatement: null, nextStatement: null }

const HIGH_LOW: [string, string][] = [
  ['高电平 1', 'HIGH'],
  ['低电平 0', 'LOW'],
]

let defined = false

export function defineNovaBlocks(): void {
  if (defined) return
  defined = true

  // 标准积木中文化（Blockly 13 的 setLocale 合并消息表）
  try {
    Blockly.setLocale(zhHans as unknown as Record<string, string>)
  } catch {
    /* 语言包缺失不影响功能 */
  }

  Blockly.defineBlocksWithJsonArray([
    // ===== 引脚控制 =====
    { type: 'nf_gpio_write', message0: '引脚 %1 输出 %2', args0: [PIN(), DROP('VALUE', HIGH_LOW)], ...STMT, colour: '#2bbf9a', tooltip: '设置 GPIO 输出高低电平' },
    { type: 'nf_gpio_pwm', message0: '引脚 %1 PWM 占空比 %2 (0-255)', args0: [PIN(), NUM('VALUE', 128, 0, 255)], ...STMT, colour: '#2bbf9a', tooltip: 'PWM 模拟输出（LED 调光等）' },
    { type: 'nf_gpio_read', message0: '读取引脚 %1 电平', args0: [PIN()], output: 'Number', colour: '#2bbf9a', tooltip: '数字读取 GPIO（0/1）' },
    { type: 'nf_gpio_mode', message0: '引脚 %1 设为 %2', args0: [PIN(), DROP('MODE', [['输出', 'OUTPUT'], ['输入', 'INPUT'], ['输入上拉', 'INPUT_PULLUP']])], ...STMT, colour: '#2bbf9a', tooltip: '配置引脚工作模式' },
    { type: 'nf_analog_read', message0: '读取模拟引脚 A%1', args0: [NUM('PIN', 36, 0, 48)], output: 'Number', colour: '#2bbf9a', tooltip: 'ADC 模拟量读取（0-4095）' },
    { type: 'nf_analog_write', message0: '模拟输出 引脚 %1 占空比 %2', args0: [PIN(), NUM('VALUE', 128, 0, 255)], ...STMT, colour: '#2bbf9a', tooltip: '8 位模拟输出' },
    { type: 'nf_servo', message0: '舵机 引脚 %1 转到 %2 度', args0: [PIN(), NUM('ANGLE', 90, 0, 180)], ...STMT, colour: '#2bbf9a', tooltip: '控制舵机角度 0~180°（ESP32 自动安装 ESP32Servo，Arduino 自动安装 Servo）' },
    { type: 'nf_tone', message0: '蜂鸣器 引脚 %1 发声 %2 Hz 持续 %3 ms', args0: [PIN(), NUM('FREQ', 1000, 20, 20000), NUM('MS', 200, 1, 60000)], ...STMT, colour: '#2bbf9a', tooltip: '无源蜂鸣器播放音调' },

    // ===== 时间与调试 =====
    { type: 'nf_delay', message0: '等待 %1 毫秒', args0: [NUM('MS', 1000, 0, 3600000)], ...STMT, colour: '#6c8cff', tooltip: '延时' },
    { type: 'nf_delay_s', message0: '等待 %1 秒', args0: [{ type: 'field_number', name: 'S', value: 1, min: 0, precision: 0.1 }], ...STMT, colour: '#6c8cff', tooltip: '按秒延时' },
    { type: 'nf_serial_print', message0: '串口打印 %1', args0: [TXT('TEXT', 'Hello NovaForge')], ...STMT, colour: '#6c8cff', tooltip: '向串口输出文本（不换行）' },
    { type: 'nf_serial_println', message0: '串口打印并换行 %1', args0: [{ type: 'input_value', name: 'VALUE' }], ...STMT, colour: '#6c8cff', tooltip: '打印任意值并换行（可接传感器积木）' },
    { type: 'nf_millis', message0: '运行时间(毫秒)', output: 'Number', colour: '#6c8cff', tooltip: '自开机以来的毫秒数' },

    // ===== 网络 =====
    { type: 'nf_wifi_connect', message0: '连接 WiFi 名称 %1 密码 %2', args0: [TXT('SSID', 'WiFi名称'), TXT('PASS', 'WiFi密码')], ...STMT, colour: '#e0a44a', tooltip: '连接指定 WiFi（一般用不到，固件已按项目配置联网）' },
    { type: 'nf_wifi_ready', message0: 'WiFi 已连接', output: 'Boolean', colour: '#e0a44a', tooltip: '判断当前是否已联网' },
    { type: 'nf_http_get', message0: 'HTTP GET %1 的响应文本', args0: [TXT('URL', 'http://192.168.1.100/api')], output: 'String', colour: '#e0a44a', tooltip: '发起 HTTP GET 请求并返回响应（局域网设备 API 等）' },
    { type: 'nf_mqtt_publish', message0: 'MQTT 发布 主题 %1 消息 %2', args0: [TXT('TOPIC', 'demo/topic'), TXT('MSG', 'hello')], ...STMT, colour: '#e0a44a', tooltip: '通过 MQTT 发布消息（HA 主题：novaforge/硬件ID/state/键）' },

    // ===== 显示屏 =====
    { type: 'nf_oled_init', message0: '初始化 OLED(SSD1306) SDA %1 SCL %2 地址 %3', args0: [NUM('SDA', 21, 0, 48), NUM('SCL', 22, 0, 48), DROP('ADDR', [['0x3C', '0x3C'], ['0x3D', '0x3D']])], ...STMT, colour: '#8a63f2', tooltip: '初始化 I2C OLED 128×64（自动安装驱动库）' },
    { type: 'nf_oled_clear', message0: 'OLED 清屏', ...STMT, colour: '#8a63f2', tooltip: '清空 OLED 画面' },
    { type: 'nf_oled_text', message0: 'OLED 在 (%1,%2) 显示文字 大小%3 内容 %4', args0: [NUM('X', 0, 0, 127), NUM('Y', 0, 0, 63), NUM('SIZE', 1, 1, 8), TXT('TEXT', 'NovaForge')], ...STMT, colour: '#8a63f2', tooltip: '显示静态文字（动态数值请用"显示数值"）' },
    { type: 'nf_oled_num', message0: 'OLED 在 (%1,%2) 显示数值 大小%3 值 %4', args0: [NUM('X', 0, 0, 127), NUM('Y', 20, 0, 63), NUM('SIZE', 1, 1, 8), { type: 'input_value', name: 'VALUE', check: 'Number' }], ...STMT, colour: '#8a63f2', tooltip: '显示数字（可接温度、距离等传感器积木）' },
    { type: 'nf_oled_pixel', message0: 'OLED 画点 (%1,%2) 颜色 %3', args0: [NUM('X', 64, 0, 127), NUM('Y', 32, 0, 63), DROP('C', [['亮', '1'], ['灭', '0']])], ...STMT, colour: '#8a63f2', tooltip: '像素点绘制' },
    { type: 'nf_oled_line', message0: 'OLED 画线 (%1,%2) 到 (%3,%4)', args0: [NUM('X1', 0, 0, 127), NUM('Y1', 0, 0, 63), NUM('X2', 127, 0, 127), NUM('Y2', 63, 0, 63)], ...STMT, colour: '#8a63f2', tooltip: '线段绘制' },
    { type: 'nf_oled_rect', message0: 'OLED 矩形 左上(%1,%2) 宽%3 高%4', args0: [NUM('X', 10, 0, 127), NUM('Y', 10, 0, 63), NUM('W', 40, 1, 128), NUM('H', 20, 1, 64)], ...STMT, colour: '#8a63f2', tooltip: '空心矩形' },
    { type: 'nf_oled_circle', message0: 'OLED 圆心(%1,%2) 半径%3', args0: [NUM('X', 64, 0, 127), NUM('Y', 32, 0, 63), NUM('R', 15, 1, 64)], ...STMT, colour: '#8a63f2', tooltip: '空心圆' },
    { type: 'nf_lcd_init', message0: '初始化 LCD1602 地址 %1', args0: [DROP('ADDR', [['0x27', '0x27'], ['0x3F', '0x3F']])], ...STMT, colour: '#8a63f2', tooltip: '初始化 I2C 字符屏 16×2' },
    { type: 'nf_lcd_text', message0: 'LCD1602 第%1行 第%2列 显示 内容 %3', args0: [NUM('ROW', 0, 0, 1), NUM('COL', 0, 0, 15), { type: 'input_value', name: 'VALUE' }], ...STMT, colour: '#8a63f2', tooltip: '在 LCD 指定位置显示（可接文字或数值）' },

    // ===== 传感器 =====
    { type: 'nf_dht_begin', message0: '初始化 DHT11 数据引脚 %1', args0: [PIN('PIN', 4)], ...STMT, colour: '#d29922', tooltip: 'DHT11 温湿度传感器（自动安装库）' },
    { type: 'nf_dht_temp', message0: 'DHT11 温度(℃)', output: 'Number', colour: '#d29922', tooltip: '读取温度，需先初始化 DHT11' },
    { type: 'nf_dht_humi', message0: 'DHT11 湿度(%)', output: 'Number', colour: '#d29922', tooltip: '读取湿度，需先初始化 DHT11' },
    { type: 'nf_ultra', message0: '超声波距离(厘米) 触发%1 回波%2', args0: [NUM('TRIG', 5, 0, 48), NUM('ECHO', 18, 0, 48)], output: 'Number', colour: '#d29922', tooltip: 'HC-SR04 超声波测距（核心库，无需安装）' },
    { type: 'nf_bme_begin', message0: '初始化 BME280(温度/湿度/气压)', ...STMT, colour: '#d29922', tooltip: 'I2C 环境传感器 BME280' },
    { type: 'nf_bme_temp', message0: 'BME280 温度(℃)', output: 'Number', colour: '#d29922', tooltip: '' },
    { type: 'nf_bme_humi', message0: 'BME280 湿度(%)', output: 'Number', colour: '#d29922', tooltip: '' },
    { type: 'nf_bme_hpa', message0: 'BME280 气压(百帕)', output: 'Number', colour: '#d29922', tooltip: '' },
    { type: 'nf_mpu_begin', message0: '初始化 MPU6050(姿态传感器)', ...STMT, colour: '#d29922', tooltip: 'I2C 六轴姿态传感器' },
    { type: 'nf_mpu_anglex', message0: 'MPU6050 X轴倾角(度)', output: 'Number', colour: '#d29922', tooltip: '需先初始化 MPU6050' },
    { type: 'nf_mpu_angley', message0: 'MPU6050 Y轴倾角(度)', output: 'Number', colour: '#d29922', tooltip: '需先初始化 MPU6050' },
  ])

  const g = javascriptGenerator.forBlock as Record<string, (block: Blockly.Block) => unknown>
  const val = (block: Blockly.Block, name: string, fallback = '0'): string =>
    (javascriptGenerator.valueToCode(block, name, 64 as never) as string) || fallback
  const str = (v: string): string => `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  const stmt = (fn: (block: Blockly.Block) => string) => (block: Blockly.Block): string => fn(block)

  // 引脚控制
  g.nf_gpio_write = stmt((b) => `digitalWrite(${b.getFieldValue('PIN')}, ${b.getFieldValue('VALUE')});\n`)
  g.nf_gpio_pwm = stmt((b) => `analogWrite(${b.getFieldValue('PIN')}, ${b.getFieldValue('VALUE')});\n`)
  g.nf_gpio_read = (b): [string, number] => [`digitalRead(${b.getFieldValue('PIN')})`, 0]
  g.nf_gpio_mode = stmt((b) => `pinMode(${b.getFieldValue('PIN')}, ${b.getFieldValue('MODE')});\n`)
  g.nf_analog_read = (b): [string, number] => [`analogRead(${b.getFieldValue('PIN')})`, 0]
  g.nf_analog_write = stmt((b) => `analogWrite(${b.getFieldValue('PIN')}, ${b.getFieldValue('VALUE')});\n`)
  g.nf_servo = stmt((b) => `nfServoWrite(${b.getFieldValue('PIN')}, ${b.getFieldValue('ANGLE')});\n`)
  g.nf_tone = stmt((b) => `tone(${b.getFieldValue('PIN')}, ${b.getFieldValue('FREQ')}, ${b.getFieldValue('MS')});\n`)

  // 时间与调试
  g.nf_delay = stmt((b) => `delay(${b.getFieldValue('MS')});\n`)
  g.nf_delay_s = stmt((b) => `delay(${Math.round(Number(b.getFieldValue('S')) * 1000)});\n`)
  g.nf_serial_print = stmt((b) => `Serial.print(${str(String(b.getFieldValue('TEXT')))});\n`)
  g.nf_serial_println = stmt((b) => `Serial.println(${val(b, 'VALUE', '""')});\n`)
  g.nf_millis = (): [string, number] => ['millis()', 0]

  // 网络
  g.nf_wifi_connect = stmt((b) => once(b, `nfWifiConnect(${str(String(b.getFieldValue('SSID')))}, ${str(String(b.getFieldValue('PASS')))});`))
  g.nf_wifi_ready = (): [string, number] => ['nfWifiReady()', 0]
  g.nf_http_get = (b): [string, number] => [`nfHttpGet(${str(String(b.getFieldValue('URL')))})`, 0]
  g.nf_mqtt_publish = stmt((b) => `nfMqttPublish(${str(String(b.getFieldValue('TOPIC')))}, ${str(String(b.getFieldValue('MSG')))});\n`)

  // 初始化类积木：包一层静态标志，确保只在第一轮 loop 执行一次
  const once = (block: Blockly.Block, call: string): string =>
    `static bool _nf_${String(block.id).replace(/[^a-zA-Z0-9]/g, '')} = false; if (!_nf_${String(block.id).replace(/[^a-zA-Z0-9]/g, '')}) { ${call} _nf_${String(block.id).replace(/[^a-zA-Z0-9]/g, '')} = true; }\n`

  // 显示屏
  g.nf_oled_init = stmt((b) => once(b, `nfOledBegin(${b.getFieldValue('SDA')}, ${b.getFieldValue('SCL')}, ${b.getFieldValue('ADDR')});`))
  g.nf_oled_clear = stmt(() => 'nfOledClear();\n')
  g.nf_oled_text = stmt((b) => `nfOledText(${b.getFieldValue('X')}, ${b.getFieldValue('Y')}, ${b.getFieldValue('SIZE')}, ${str(String(b.getFieldValue('TEXT')))});\n`)
  g.nf_oled_num = stmt((b) => `nfOledNum(${b.getFieldValue('X')}, ${b.getFieldValue('Y')}, ${b.getFieldValue('SIZE')}, ${val(b, 'VALUE')});\n`)
  g.nf_oled_pixel = stmt((b) => `nfOledPixel(${b.getFieldValue('X')}, ${b.getFieldValue('Y')}, ${b.getFieldValue('C')});\n`)
  g.nf_oled_line = stmt((b) => `nfOledLine(${b.getFieldValue('X1')}, ${b.getFieldValue('Y1')}, ${b.getFieldValue('X2')}, ${b.getFieldValue('Y2')});\n`)
  g.nf_oled_rect = stmt((b) => `nfOledRect(${b.getFieldValue('X')}, ${b.getFieldValue('Y')}, ${b.getFieldValue('W')}, ${b.getFieldValue('H')});\n`)
  g.nf_oled_circle = stmt((b) => `nfOledCircle(${b.getFieldValue('X')}, ${b.getFieldValue('Y')}, ${b.getFieldValue('R')});\n`)
  g.nf_lcd_init = stmt((b) => once(b, `nfLcdBegin(${b.getFieldValue('ADDR')});`))
  g.nf_lcd_text = stmt((b) => `nfLcdText(${b.getFieldValue('ROW')}, ${b.getFieldValue('COL')}, String(${val(b, 'VALUE', '""')}));\n`)

  // 传感器
  g.nf_dht_begin = stmt((b) => once(b, `nfDhtBegin(${b.getFieldValue('PIN')});`))
  g.nf_dht_temp = (): [string, number] => ['nfDhtTemp()', 0]
  g.nf_dht_humi = (): [string, number] => ['nfDhtHumi()', 0]
  g.nf_ultra = (b): [string, number] => [`nfUltraCm(${b.getFieldValue('TRIG')}, ${b.getFieldValue('ECHO')})`, 0]
  g.nf_bme_begin = stmt((b) => once(b, 'nfBmeBegin();'))
  g.nf_bme_temp = (): [string, number] => ['nfBmeTemp()', 0]
  g.nf_bme_humi = (): [string, number] => ['nfBmeHumi()', 0]
  g.nf_bme_hpa = (): [string, number] => ['nfBmeHpa()', 0]
  g.nf_mpu_begin = stmt((b) => once(b, 'nfMpuBegin();'))
  g.nf_mpu_anglex = (): [string, number] => ['nfMpuAngleX()', 0]
  g.nf_mpu_angley = (): [string, number] => ['nfMpuAngleY()', 0]
}

const cat = (name: string, colour: string, contents: { kind: 'block'; type: string }[]) => ({
  kind: 'category' as const,
  name,
  colour,
  contents,
})
const bl = (type: string) => ({ kind: 'block' as const, type })

export const NOVA_TOOLBOX = {
  kind: 'categoryToolbox',
  contents: [
    cat('引脚控制', '#2bbf9a', [
      bl('nf_gpio_write'),
      bl('nf_gpio_read'),
      bl('nf_gpio_mode'),
      bl('nf_gpio_pwm'),
      bl('nf_analog_read'),
      bl('nf_analog_write'),
      bl('nf_servo'),
      bl('nf_tone'),
    ]),
    cat('时间与调试', '#6c8cff', [
      bl('nf_delay'),
      bl('nf_delay_s'),
      bl('nf_millis'),
      bl('nf_serial_print'),
      bl('nf_serial_println'),
    ]),
    cat('网络', '#e0a44a', [
      bl('nf_wifi_connect'),
      bl('nf_wifi_ready'),
      bl('nf_http_get'),
      bl('nf_mqtt_publish'),
    ]),
    cat('显示屏', '#8a63f2', [
      bl('nf_oled_init'),
      bl('nf_oled_clear'),
      bl('nf_oled_text'),
      bl('nf_oled_num'),
      bl('nf_oled_pixel'),
      bl('nf_oled_line'),
      bl('nf_oled_rect'),
      bl('nf_oled_circle'),
      bl('nf_lcd_init'),
      bl('nf_lcd_text'),
    ]),
    cat('传感器', '#d29922', [
      bl('nf_dht_begin'),
      bl('nf_dht_temp'),
      bl('nf_dht_humi'),
      bl('nf_ultra'),
      bl('nf_bme_begin'),
      bl('nf_bme_temp'),
      bl('nf_bme_humi'),
      bl('nf_bme_hpa'),
      bl('nf_mpu_begin'),
      bl('nf_mpu_anglex'),
      bl('nf_mpu_angley'),
    ]),
    {
      kind: 'category',
      name: '逻辑',
      colour: '#5b80a5',
      contents: [bl('controls_if'), bl('logic_compare'), bl('logic_operation'), bl('logic_boolean')],
    },
    {
      kind: 'category',
      name: '循环',
      colour: '#5ba55b',
      contents: [bl('controls_repeat_ext'), bl('controls_whileUntil'), bl('controls_for')],
    },
    {
      kind: 'category',
      name: '数学',
      colour: '#5b67a5',
      contents: [bl('math_number'), bl('math_arithmetic'), bl('math_random_int'), bl('math_modulo'), bl('math_round'), bl('math_constrain')],
    },
    {
      kind: 'category',
      name: '文本',
      colour: '#5ba58c',
      contents: [bl('text'), bl('text_join'), bl('text_length'), bl('text_isEmpty')],
    },
    { kind: 'category', name: '变量', colour: '#a55b80', contents: [bl('variables_get'), bl('variables_set'), bl('math_change')] },
    { kind: 'category', name: '列表', colour: '#745ba5', contents: [bl('lists_create_with'), bl('lists_length'), bl('lists_getIndex'), bl('lists_setIndex'), bl('lists_repeat')] },
  ],
}

export function generateArduinoFromWorkspace(workspace: Blockly.WorkspaceSvg): string {
  const code = javascriptGenerator.workspaceToCode(workspace)
  return code.trim()
}

export function loadWorkspaceXml(workspace: Blockly.WorkspaceSvg, xml: string): void {
  if (!xml) return
  try {
    const dom = Blockly.utils.xml.textToDom(xml)
    Blockly.Xml.clearWorkspaceAndLoadFromXml(dom, workspace)
  } catch {
    // 忽略损坏的图形化工程
  }
}

export function saveWorkspaceXml(workspace: Blockly.WorkspaceSvg): string {
  const dom = Blockly.Xml.workspaceToDom(workspace)
  return Blockly.Xml.domToText(dom)
}
