import type { Board, Project } from './types'

export function deviceId(project: Project): string {
  return 'nf-' + project.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)
}

function cstr(v: string): string {
  return '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ') + '"'
}

/** 生成 128 位随机控制授权令牌（32 位十六进制） */
export function randomCtrlToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** 确保项目持有控制令牌（旧项目缺省时补发） */
export function ensureCtrlToken(project: Project): string {
  if (!project.ctrlToken) project.ctrlToken = randomCtrlToken()
  return project.ctrlToken
}

function pinTables(project: Project): string {
  const pins = project.pins
  if (pins.length === 0) {
    return `const int NF_PIN_COUNT = 0;
const char *NF_KEYS[1] = {""};
const int NF_GPIOS[1] = {-1};
const bool NF_IS_INPUT[1] = {false};
int nfValues[1] = {0};`
  }
  const keys = pins.map((p) => cstr(p.label || `GPIO${p.gpio}`)).join(', ')
  const gpios = pins.map((p) => p.gpio).join(', ')
  const inputs = pins.map((p) => (p.mode === 'output' ? 'false' : 'true')).join(', ')
  return `const int NF_PIN_COUNT = ${pins.length};
const char *NF_KEYS[${pins.length}] = {${keys}};
const int NF_GPIOS[${pins.length}] = {${gpios}};
const bool NF_IS_INPUT[${pins.length}] = {${inputs}};
int nfValues[${pins.length}] = {${pins.map(() => 0).join(', ')}};`
}

function loopBody(project: Project): string {
  if (project.mode === 'blocks') {
    return project.generatedCode
      .split('\n')
      .map((l) => (l.trim() ? '  ' + l : l))
      .join('\n')
  }
  return `  // 你的逻辑位于完整代码模式中，可自由编辑`
}

/**
 * 积木运行时胶水层：按工作区实际使用的积木（扫描生成代码的标记），
 * 条件注入显示屏 / 传感器 / 舵机 / HTTP 等驱动与工具函数。
 */
function blockGlue(project: Project, withNetwork: boolean, family: Board['family'] = 'esp32'): string {
  if (project.mode !== 'blocks') return ''
  const used = project.generatedCode || ''
  const has = (mark: string): boolean => used.includes(mark)
  const inc: string[] = []
  const body: string[] = []
  const addInc = (...lines: string[]): void => {
    for (const l of lines) if (!inc.includes(l)) inc.push(l)
  }

  addInc('#include <Wire.h>')

  if (has('nfOled')) {
    addInc('#include <Adafruit_GFX.h>', '#include <Adafruit_SSD1306.h>')
    body.push(`
// ===== OLED SSD1306 128x64 显示 =====
static Adafruit_SSD1306 nfOled(128, 64, &Wire, -1);
static bool nfOledOk = false;
void nfOledBegin(int sda, int scl, uint8_t addr) {
  if (nfOledOk) return;
  Wire.begin(sda, scl);
  nfOledOk = nfOled.begin(addr, true);
  if (nfOledOk) {
    nfOled.clearDisplay();
    nfOled.setTextColor(SSD1306_WHITE);
    nfOled.setTextSize(1);
    nfOled.display();
  }
}
void nfOledClear() { if (nfOledOk) { nfOled.clearDisplay(); nfOled.display(); } }
void nfOledText(int x, int y, int size, String t) {
  if (!nfOledOk) return;
  nfOled.setTextSize(size < 1 ? 1 : size);
  nfOled.setCursor(x, y);
  nfOled.print(t);
  nfOled.display();
}
void nfOledNum(int x, int y, int size, double v) {
  if (!nfOledOk) return;
  nfOled.setTextSize(size < 1 ? 1 : size);
  nfOled.setCursor(x, y);
  nfOled.print(v, 2);
  nfOled.display();
}
void nfOledPixel(int x, int y, int c) {
  if (!nfOledOk) return;
  nfOled.drawPixel(x, y, c ? SSD1306_WHITE : SSD1306_BLACK);
  nfOled.display();
}
void nfOledLine(int x1, int y1, int x2, int y2) {
  if (!nfOledOk) return;
  nfOled.drawLine(x1, y1, x2, y2, SSD1306_WHITE);
  nfOled.display();
}
void nfOledRect(int x, int y, int w, int h) {
  if (!nfOledOk) return;
  nfOled.drawRect(x, y, w, h, SSD1306_WHITE);
  nfOled.display();
}
void nfOledCircle(int x, int y, int r) {
  if (!nfOledOk) return;
  nfOled.drawCircle(x, y, r, SSD1306_WHITE);
  nfOled.display();
}`)
  }

  if (has('nfLcd')) {
    addInc('#include <LiquidCrystal_I2C.h>')
    body.push(`
// ===== LCD1602 字符屏 =====
static LiquidCrystal_I2C *nfLcdP = nullptr;
void nfLcdBegin(uint8_t addr) {
  if (nfLcdP) return;
  nfLcdP = new LiquidCrystal_I2C(addr, 16, 2);
  nfLcdP->init();
  nfLcdP->backlight();
}
void nfLcdText(int row, int col, String t) {
  if (!nfLcdP) return;
  nfLcdP->setCursor(col, row);
  nfLcdP->print(t);
}`)
  }

  if (has('nfDht')) {
    addInc('#include <DHT.h>')
    body.push(`
// ===== DHT11 温湿度 =====
static DHT *nfDhtP = nullptr;
void nfDhtBegin(int pin) {
  if (nfDhtP) return;
  nfDhtP = new DHT(pin, DHT11);
  nfDhtP->begin();
}
float nfDhtTemp() {
  if (!nfDhtP) return 0;
  float v = nfDhtP->readTemperature();
  return isnan(v) ? 0 : v;
}
float nfDhtHumi() {
  if (!nfDhtP) return 0;
  float v = nfDhtP->readHumidity();
  return isnan(v) ? 0 : v;
}`)
  }

  if (has('nfUltra')) {
    body.push(`
// ===== HC-SR04 超声波测距 =====
float nfUltraCm(int trig, int echo) {
  pinMode(trig, OUTPUT);
  digitalWrite(trig, LOW);
  delayMicroseconds(2);
  digitalWrite(trig, HIGH);
  delayMicroseconds(10);
  digitalWrite(trig, LOW);
  long us = pulseIn(echo, HIGH, 30000L);
  return us * 0.0343 / 2.0f;
}`)
  }

  if (has('nfBme')) {
    addInc('#include <Adafruit_BME280.h>', '#include <Adafruit_Sensor.h>')
    body.push(`
// ===== BME280 温湿压 =====
static Adafruit_BME280 nfBmeObj;
static bool nfBmeOk = false;
void nfBmeBegin() {
  if (nfBmeOk) return;
  Wire.begin();
  nfBmeOk = nfBmeObj.begin(0x76) || nfBmeObj.begin(0x77);
}
float nfBmeTemp() { return nfBmeOk ? nfBmeObj.readTemperature() : 0; }
float nfBmeHumi() { return nfBmeOk ? nfBmeObj.readHumidity() : 0; }
float nfBmeHpa() { return nfBmeOk ? nfBmeObj.readPressure() / 100.0f : 0; }`)
  }

  if (has('nfMpu')) {
    addInc('#include <Adafruit_MPU6050.h>', '#include <Adafruit_Sensor.h>')
    body.push(`
// ===== MPU6050 姿态 =====
static Adafruit_MPU6050 nfMpuObj;
static bool nfMpuOk = false;
void nfMpuBegin() {
  if (nfMpuOk) return;
  Wire.begin();
  nfMpuOk = nfMpuObj.begin();
  if (nfMpuOk) {
    nfMpuObj.setAccelerometerRange(MPU6050_RANGE_8_G);
    nfMpuObj.setGyroRange(MPU6050_RANGE_500_DEG);
    nfMpuObj.setFilterBandwidth(MPU6050_BAND_21_HZ);
  }
}
float nfMpuAngleX() {
  if (!nfMpuOk) return 0;
  sensors_event_t a, g, t;
  nfMpuObj.getEvent(&a, &g, &t);
  return atan2(a.acceleration.y, sqrt(a.acceleration.x * a.acceleration.x + a.acceleration.z * a.acceleration.z)) * 57.2958f;
}
float nfMpuAngleY() {
  if (!nfMpuOk) return 0;
  sensors_event_t a, g, t;
  nfMpuObj.getEvent(&a, &g, &t);
  return atan2(-a.acceleration.x, sqrt(a.acceleration.y * a.acceleration.y + a.acceleration.z * a.acceleration.z)) * 57.2958f;
}`)
  }

  if (has('nfServoWrite')) {
    if (family === 'esp32') {
      addInc('#include <ESP32Servo.h>')
    } else if (family === 'avr' || family === 'esp8266') {
      // AVR 与 ESP8266 核心均内置 Servo 库
      addInc('#include <Servo.h>')
    }
    if (family === 'esp32' || family === 'avr' || family === 'esp8266') {
      body.push(`
// ===== 舵机（8 路池） =====
static Servo nfServoPool[8];
static int nfServoPinPool[8] = {-1, -1, -1, -1, -1, -1, -1, -1};
void nfServoWrite(int pin, int angle) {
  int slot = -1;
  for (int i = 0; i < 8; i++) if (nfServoPinPool[i] == pin) { slot = i; break; }
  if (slot < 0) {
    for (int i = 0; i < 8; i++) if (nfServoPinPool[i] == -1) {
      slot = i;
      nfServoPinPool[i] = pin;
      nfServoPool[i].attach(pin, 500, 2400);
      break;
    }
  }
  if (slot >= 0) nfServoPool[slot].write(angle);
}`)
    }
  }

  if (withNetwork && (has('nfWifiConnect') || has('nfWifiReady') || has('nfHttpGet'))) {
    addInc(family === 'esp8266' ? '#include <ESP8266HTTPClient.h>' : '#include <HTTPClient.h>')
    body.push(`
// ===== 网络积木 =====
void nfWifiConnect(const char *ssid, const char *pass) {
  WiFi.begin(ssid, pass);
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) delay(500);
}
bool nfWifiReady() { return WiFi.status() == WL_CONNECTED; }
String nfHttpGet(const char *url) {
  String out;
  HTTPClient hc;
  if (hc.begin(url)) {
    int code = hc.GET();
    if (code > 0) out = hc.getString();
    hc.end();
  }
  return out;
}`)
  }

  if (!withNetwork && (has('nfWifiConnect') || has('nfWifiReady') || has('nfHttpGet'))) {
    body.push(`
// ===== 网络积木（无网络桩函数） =====
void nfWifiConnect(const char *, const char *) {}
bool nfWifiReady() { return false; }
String nfHttpGet(const char *) { return ""; }`)
  }

  if (has('nfMqttPublish')) {
    if (withNetwork) {
      addInc('extern PubSubClient nfMqtt;')
      body.push(`
// ===== MQTT 发布包装 =====
void nfMqttPublish(const char *topic, const char *msg) {
  if (nfMqtt.connected()) nfMqtt.publish(topic, msg);
}`)
    } else {
      body.push(`
// ===== MQTT 发布（无网络桩函数） =====
void nfMqttPublish(const char *, const char *) {}`)
    }
  }

  return inc.join('\n') + '\n' + body.join('\n')
}

function networkTemplate(project: Project, board: Board): string {
  const id = deviceId(project)
  const n = project.net
  const e8266 = board.family === 'esp8266'
  const inc = e8266
    ? `#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <ESP8266mDNS.h>
#include <PubSubClient.h>`
    : `#include <WiFi.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include <PubSubClient.h>`
  const serverType = e8266 ? 'ESP8266WebServer' : 'WebServer'
  return `/*
 * NovaForge Studio 自动生成固件
 * 开发板: ${board.name} (${board.chip})
 * 设备标识: ${id}
 * 协议: Wi-Fi HTTP + MQTT(Home Assistant 自动发现)
 */
${inc}
${blockGlue(project, true, board.family)}

#define NF_DEVICE_ID ${cstr(id)}
#define NF_DEVICE_NAME ${cstr(project.name)}
#define NF_DEVICE_MODEL ${cstr(board.name)}
#define NF_FW_VERSION "1.0.0"

// 控制授权令牌：/api/set 必须携带正确 token 才能操作引脚，
// 未持有令牌的 Home Assistant / 第三方实例无法控制本设备
const char *NF_TOKEN = ${cstr(ensureCtrlToken(project))};

${pinTables(project)}

const char *NF_SSID = ${cstr(n.ssid)};
const char *NF_PASSWORD = ${cstr(n.password)};
const char *NF_MQTT_HOST = ${cstr(n.mqttHost)};
const int NF_MQTT_PORT = ${Number(n.mqttPort) || 1883};
const char *NF_MQTT_USER = ${cstr(n.mqttUser)};
const char *NF_MQTT_PASS = ${cstr(n.mqttPass)};
const char *NF_BASE_TOPIC = "novaforge/${id}";

WiFiClient nfNet;
${serverType} nfServer(80);
PubSubClient nfMqtt(nfNet);

// 硬件唯一标识（由芯片 MAC 派生），与设备名称解耦：改名不影响 HA 配对与识别
String nfHwId = "nf-unknown";

String nfMakeHwId() {
  char buf[24];
${
  e8266
    ? `  // ESP8266：芯片唯一 ID
  snprintf(buf, sizeof(buf), "nf-%08x", (unsigned int)ESP.getChipId());`
    : `  uint64_t mac = ESP.getEfuseMac();
  snprintf(buf, sizeof(buf), "nf-%04x%08x",
           (unsigned int)((mac >> 32) & 0xFFFF),
           (unsigned int)(mac & 0xFFFFFFFF));`
}
  return String(buf);
}

void nfPublishState(int i) {
  if (!nfMqtt.connected()) return;
  char topic[96];
  snprintf(topic, sizeof(topic), "%s/state/%s", NF_BASE_TOPIC, NF_KEYS[i]);
  nfMqtt.publish(topic, nfValues[i] ? "1" : "0", true);
}

void nfApply(int i, int value) {
  if (i < 0 || i >= NF_PIN_COUNT) return;
  if (!NF_IS_INPUT[i]) digitalWrite(NF_GPIOS[i], value ? HIGH : LOW);
  nfValues[i] = value;
}

void nfSendCors() {
  nfServer.sendHeader("Access-Control-Allow-Origin", "*");
  nfServer.sendHeader("Access-Control-Allow-Headers", "*");
}

void nfHandleState() {
  // 带了 token 就必须正确（供集成配置时验证授权）；不带 token 为匿名只读
  if (nfServer.has("token") && nfServer.arg("token") != String(NF_TOKEN)) {
    nfSendCors();
    nfServer.send(403, "application/json", "{\\"ok\\":false,\\"err\\":\\"unauthorized\\"}");
    return;
  }
  String json = "{\\"ok\\":true,\\"id\\":\\"" + nfHwId + "\\",\\"device\\":\\"" + String(NF_DEVICE_ID);
  json += "\\",\\"name\\":\\"" + String(NF_DEVICE_NAME) + "\\",\\"model\\":\\"" + String(NF_DEVICE_MODEL);
  json += "\\",\\"fw\\":\\"novaforge\\",\\"ver\\":\\"" + String(NF_FW_VERSION) + "\\",\\"pins\\":[";
  for (int i = 0; i < NF_PIN_COUNT; i++) {
    if (i > 0) json += ",";
    json += "{\\"key\\":\\"" + String(NF_KEYS[i]) + "\\",\\"gpio\\":" + String(NF_GPIOS[i]);
    json += ",\\"mode\\":\\"" + String(NF_IS_INPUT[i] ? "in" : "out") + "\\",\\"value\\":" + String(nfValues[i]) + "}";
  }
  json += "]}";
  nfSendCors();
  nfServer.send(200, "application/json", json);
}

void nfHandleSet() {
  // 控制指令必须携带授权令牌：没有令牌的实例（即使装了官方扩展）不允许操作设备
  if (nfServer.arg("token") != String(NF_TOKEN)) {
    nfSendCors();
    nfServer.send(403, "application/json", "{\\"ok\\":false,\\"err\\":\\"unauthorized\\"}");
    return;
  }
  String key = nfServer.arg("key");
  int value = nfServer.arg("value").toInt();
  for (int i = 0; i < NF_PIN_COUNT; i++) {
    if (key == NF_KEYS[i]) {
      nfApply(i, value);
      nfPublishState(i);
    }
  }
  nfSendCors();
  nfHandleState();
}

void nfMqttCallback(char *topic, byte *payload, unsigned int len) {
  String t(topic);
  String prefix = String(NF_BASE_TOPIC) + "/set/";
  if (!t.startsWith(prefix)) return;
  String key = t.substring(prefix.length());
  int value = (len > 0 && (payload[0] == '1' || payload[0] == 'O' || payload[0] == 'o')) ? 1 : 0;
  for (int i = 0; i < NF_PIN_COUNT; i++) {
    if (key == NF_KEYS[i]) {
      nfApply(i, value);
      nfPublishState(i);
    }
  }
}

void nfDiscover() {
  // uniq_id 与 dev.ids 一律使用硬件 ID（nfHwId），与设备名无关：
  // 任意改名、多台同名设备同时接入都不会冲突
  char topic[110];
  char payload[512];
  const char *id = nfHwId.c_str();
  for (int i = 0; i < NF_PIN_COUNT; i++) {
    const char *component = NF_IS_INPUT[i] ? "binary_sensor" : "switch";
    snprintf(topic, sizeof(topic), "homeassistant/%s/%s/%s/config", component, id, NF_KEYS[i]);
    if (NF_IS_INPUT[i]) {
      snprintf(payload, sizeof(payload),
        "{\\"name\\":\\"%s\\",\\"uniq_id\\":\\"%s-%s\\",\\"stat_t\\":\\"%s/state/%s\\","
        "\\"avty_t\\":\\"%s/available\\",\\"dev\\":{\\"ids\\":[\\"%s\\"],\\"name\\":\\"%s\\","
        "\\"mf\\":\\"NovaForge\\",\\"mdl\\":\\"%s\\",\\"sw\\":\\"%s\\"}}",
        NF_KEYS[i], id, NF_KEYS[i], NF_BASE_TOPIC, NF_KEYS[i], NF_BASE_TOPIC,
        id, NF_DEVICE_NAME, NF_DEVICE_MODEL, NF_FW_VERSION);
    } else {
      snprintf(payload, sizeof(payload),
        "{\\"name\\":\\"%s\\",\\"uniq_id\\":\\"%s-%s\\",\\"stat_t\\":\\"%s/state/%s\\",\\"cmd_t\\":\\"%s/set/%s\\","
        "\\"pl_on\\":\\"1\\",\\"pl_off\\":\\"0\\",\\"avty_t\\":\\"%s/available\\","
        "\\"dev\\":{\\"ids\\":[\\"%s\\"],\\"name\\":\\"%s\\",\\"mf\\":\\"NovaForge\\",\\"mdl\\":\\"%s\\",\\"sw\\":\\"%s\\"}}",
        NF_KEYS[i], id, NF_KEYS[i], NF_BASE_TOPIC, NF_KEYS[i], NF_BASE_TOPIC, NF_KEYS[i],
        NF_BASE_TOPIC, id, NF_DEVICE_NAME, NF_DEVICE_MODEL, NF_FW_VERSION);
    }
    nfMqtt.publish(topic, payload, true);
  }
}

void nfConnectMqtt() {
  if (strlen(NF_MQTT_HOST) == 0) return;
  if (nfMqtt.connected()) return;
  char will[96];
  snprintf(will, sizeof(will), "%s/available", NF_BASE_TOPIC);
  if (nfMqtt.connect(nfHwId.c_str(), NF_MQTT_USER, NF_MQTT_PASS, will, 0, true, "offline")) {
    nfMqtt.publish(will, "online", true);
    nfDiscover();
    for (int i = 0; i < NF_PIN_COUNT; i++) nfPublishState(i);
  }
}

void setup() {
  Serial.begin(115200);
  delay(200);
  for (int i = 0; i < NF_PIN_COUNT; i++) {
    pinMode(NF_GPIOS[i], NF_IS_INPUT[i] ? (NF_GPIOS[i] >= 34 ? INPUT : INPUT_PULLUP) : OUTPUT);
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(NF_SSID, NF_PASSWORD);
  Serial.print("正在连接 Wi-Fi");
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  }

  nfHwId = nfMakeHwId();
  Serial.print("硬件 ID: ");
  Serial.println(nfHwId);

  if (MDNS.begin(NF_DEVICE_ID)) {
    MDNS.addService("http", "tcp", 80);
    // 广播 NovaForge 专属服务，供 HA 社区集成（zeroconf）自动发现
    MDNS.addService("_novaforge", "_tcp", 80);
    MDNS.addServiceTxt("_novaforge", "_tcp", "id", nfHwId.c_str());
    MDNS.addServiceTxt("_novaforge", "_tcp", "name", NF_DEVICE_NAME);
    MDNS.addServiceTxt("_novaforge", "_tcp", "fw", "novaforge");
    MDNS.addServiceTxt("_novaforge", "_tcp", "ver", NF_FW_VERSION);
    MDNS.addServiceTxt("_novaforge", "_tcp", "board", NF_DEVICE_MODEL);
  }

  nfServer.on("/api/state", HTTP_GET, nfHandleState);
  nfServer.on("/api/set", HTTP_GET, nfHandleSet);
  nfServer.on("/api/set", HTTP_OPTIONS, []() { nfSendCors(); nfServer.send(204); });
  nfServer.begin();

  nfMqtt.setServer(NF_MQTT_HOST, NF_MQTT_PORT);
  nfMqtt.setCallback(nfMqttCallback);

${project.mode === 'blocks' ? '' : '  // 代码模式：setup 区域的逻辑由你自由编写'}
}

void loop() {
  nfServer.handleClient();
  if (WiFi.status() == WL_CONNECTED) {
    nfConnectMqtt();
    nfMqtt.loop();
  }
  for (int i = 0; i < NF_PIN_COUNT; i++) {
    if (NF_IS_INPUT[i]) nfValues[i] = digitalRead(NF_GPIOS[i]);
  }
${loopBody(project)}
  delay(20);
}
`
}

function serialTemplate(project: Project, board: Board): string {
  return `/*
 * NovaForge Studio 自动生成固件（串口控制版）
 * 开发板: ${board.name} (${board.chip})
 * 该芯片系列不生成 Wi-Fi/MQTT 代码，使用 USB 串口协议控制引脚。
 * 串口协议: NF:SET:<key>:<0|1>   NF:STATE
 */
#include <Arduino.h>
${blockGlue(project, false, board.family)}

${pinTables(project)}

void nfApply(int i, int value) {
  if (i < 0 || i >= NF_PIN_COUNT) return;
  if (!NF_IS_INPUT[i]) digitalWrite(NF_GPIOS[i], value ? HIGH : LOW);
  nfValues[i] = value;
}

void nfPrintState() {
  Serial.print("STATE");
  for (int i = 0; i < NF_PIN_COUNT; i++) {
    Serial.print(" ");
    Serial.print(NF_KEYS[i]);
    Serial.print("=");
    Serial.print(nfValues[i]);
  }
  Serial.println();
}

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < NF_PIN_COUNT; i++) {
    pinMode(NF_GPIOS[i], NF_IS_INPUT[i] ? INPUT_PULLUP : OUTPUT);
  }
  nfPrintState();
}

void loop() {
  if (Serial.available()) {
    String line = Serial.readStringUntil('\\n');
    line.trim();
    if (line == "NF:STATE" || line == "STATE") nfPrintState();
    if (line.startsWith("NF:SET:")) {
      String rest = line.substring(7);
      int sep = rest.indexOf(':');
      String key = rest.substring(0, sep);
      int value = rest.substring(sep + 1).toInt();
      for (int i = 0; i < NF_PIN_COUNT; i++) {
        if (key == NF_KEYS[i]) nfApply(i, value);
      }
      nfPrintState();
    }
  }
${loopBody(project)}
}
`
}

export function buildFirmware(project: Project, board: Board): string {
  ensureCtrlToken(project)
  if (project.language === 'micropython') {
    return buildMicroPython(project, board)
  }
  if (board.family === 'esp32' || board.family === 'esp8266') return networkTemplate(project, board)
  return serialTemplate(project, board)
}

export function buildMicroPython(project: Project, board: Board): string {
  const pins = project.pins
  const lines = pins.map(
    (p, i) =>
      `p${i} = Pin(${p.gpio}, Pin.${p.mode === 'output' ? 'OUT' : 'IN'})  # ${p.label}`
  )
  return `# NovaForge Studio 自动生成固件（MicroPython）
# 开发板: ${board.name}
from machine import Pin
import time

${lines.join('\n')}

while True:
${
  project.generatedCode
    ? project.generatedCode
        .split('\n')
        .map((l) => '    ' + l)
        .join('\n')
    : '    pass'
}
`
}
