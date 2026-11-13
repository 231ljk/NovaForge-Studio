import { useState } from 'react'
import {
  availabilityTopic,
  commandTopic,
  discoveryPayload,
  discoveryTopic,
  generateHaYaml,
  generateMqttConfig,
  stateTopic
} from '../../../shared/ha'
import { useApp } from '../store'

export function HomeAssistant(): React.ReactElement {
  const { activeProject, activeBoard, updateProject, notify } = useApp()
  const project = activeProject!
  const board = activeBoard!

  const [host, setHost] = useState(project.net.mqttHost)
  const [port, setPort] = useState(String(project.net.mqttPort))
  const [user, setUser] = useState(project.net.mqttUser)
  const [pass, setPass] = useState(project.net.mqttPass)
  const [selectedPin, setSelectedPin] = useState(project.pins[0]?.id ?? '')

  const selected = project.pins.find((p) => p.id === selectedPin) ?? project.pins[0]
  const yaml = generateHaYaml(project, board)

  const saveMqtt = (): void => {
    updateProject(project.id, {
      net: {
        ...project.net,
        mqttHost: host,
        mqttPort: Number(port) || 1883,
        mqttUser: user,
        mqttPass: pass
      }
    })
    notify('MQTT 配置已保存，重新编译烧录后生效', 'success')
  }

  const copy = async (text: string, label: string): Promise<void> => {
    await window.api.copyText(text)
    notify(`已复制${label}`, 'success')
  }

  return (
    <div className="control-layout">
      <div className="firmware-main">
        <section className="panel">
          <div className="section-head">
            <h3>设备控制授权码</h3>
            <button className="btn ghost small" onClick={() => void copy(project.ctrlToken, '授权码')}>
              复制授权码
            </button>
          </div>
          <div className="auth-code" style={{ fontSize: 20 }}>
            {project.ctrlToken}
          </div>
          <p className="paragraph">
            每个项目在烧录时都会写入一枚 128 位随机授权令牌。固件只接受携带令牌的控制指令——
            <b>别人即使自己安装 Home Assistant 并添加我们的扩展，没有这枚授权码也操作不了你的设备</b>
            （状态可匿名读取，控制必须持码）。在 HA 集成配置/发现确认时粘贴本授权码即可。
          </p>
        </section>

        <section className="panel">
          <div className="section-head">
            <h3>HA 社区集成（推荐 · 免 MQTT）</h3>
            <span className="muted small">zeroconf 自动发现</span>
          </div>
          <p className="paragraph">
            本工程附带 Home Assistant 社区集成，位于
            ha-integration/custom_components/novaforge。固件开机后通过 mDNS 广播
            _novaforge._tcp 服务，HA 会自动发现设备并创建开关/传感器实体，
            全程走局域网 HTTP，不需要 MQTT Broker，也不需要刷任何第三方固件。
          </p>
          <div className="flow-steps">
            <div className="flow-step">
              <span className="flow-num">1</span>
              <div>
                <b>安装集成</b>
                <p>
                  将 ha-integration/custom_components/novaforge 复制到 HA 的
                  config/custom_components/ 目录；或在 HACS 中添加本仓库为自定义仓库。
                </p>
              </div>
            </div>
            <div className="flow-step">
              <span className="flow-num">2</span>
              <div>
                <b>重启 Home Assistant</b>
                <p>重启后集成自动加载，开始监听局域网内的 NovaForge 设备。</p>
              </div>
            </div>
            <div className="flow-step">
              <span className="flow-num">3</span>
              <div>
                <b>确认发现并粘贴授权码</b>
                <p>
                  「设置 → 设备与服务」中会出现发现的设备，点击确认，
                  粘贴上方的设备控制授权码即可；也可手动「添加集成 → NovaForge」输入设备 IP + 授权码。
                  没有授权码的实例无法控制设备。
                </p>
              </div>
            </div>
          </div>
          <p className="muted small">
            设备以芯片 MAC 派生的硬件 ID（形如 nf-a4cf12ff7e2a）作为唯一标识：
            即使多台设备同名、或你之后随意修改设备名称，也不会串号、掉线或重复注册。
          </p>
        </section>

        <section className="panel">
          <div className="section-head">
            <h3>无需额外固件（MQTT 方式）</h3>
          </div>
          <p className="paragraph">
            NovaForge 生成的固件内置 MQTT Discovery。设备联网后会自动在 Home Assistant
            中注册开关/传感器实体，你不需要再刷 ESPHome、Tasmota 等第三方固件。只要在 HA
            中启用 MQTT 集成，并保证设备与 MQTT Broker 网络互通即可。
          </p>
          <div className="flow-steps">
            <div className="flow-step">
              <span className="flow-num">1</span>
              <div>
                <b>填写 MQTT Broker</b>
                <p>通常在树莓派或 NAS 上运行 Mosquitto，端口 1883。</p>
              </div>
            </div>
            <div className="flow-step">
              <span className="flow-num">2</span>
              <div>
                <b>编译并烧录固件</b>
                <p>配置会写入固件，设备启动后自动连接并发布发现消息。</p>
              </div>
            </div>
            <div className="flow-step">
              <span className="flow-num">3</span>
              <div>
                <b>HA 自动出现设备</b>
                <p>在「设置 → 设备与服务 → MQTT」可见设备与全部引脚实体。</p>
              </div>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="section-head">
            <h3>实体预览</h3>
            <span className="muted small">{project.pins.length} 个实体</span>
          </div>
          {project.pins.length === 0 ? (
            <div className="empty-inline">还没有引脚功能，请先在「编写固件」中配置。</div>
          ) : (
            <>
              <div className="entity-table">
                <div className="entity-row head">
                  <span>实体</span>
                  <span>类型</span>
                  <span>状态主题</span>
                  <span>命令主题</span>
                </div>
                {project.pins.map((pin) => (
                  <button
                    key={pin.id}
                    className={`entity-row ${selected?.id === pin.id ? 'selected' : ''}`}
                    onClick={() => setSelectedPin(pin.id)}
                  >
                    <span>{pin.label}</span>
                    <span>{pin.mode === 'output' ? 'switch' : 'binary_sensor'}</span>
                    <span className="mono">{stateTopic(project, pin)}</span>
                    <span className="mono">
                      {pin.mode === 'output' ? commandTopic(project, pin) : '—'}
                    </span>
                  </button>
                ))}
              </div>
              {selected && (
                <div className="payload-block">
                  <div className="payload-head">
                    <span className="mono">{discoveryTopic(project, selected)}</span>
                    <button
                      className="btn ghost small"
                      onClick={() => void copy(discoveryPayload(project, selected, board), '发现报文')}
                    >
                      复制发现报文
                    </button>
                  </div>
                  <pre className="raw-json">{discoveryPayload(project, selected, board)}</pre>
                </div>
              )}
              <div className="muted small mono">可用性主题: {availabilityTopic(project)}</div>
            </>
          )}
        </section>

        <section className="panel">
          <div className="section-head">
            <h3>手动配置（可选）</h3>
            <button className="btn ghost small" onClick={() => void copy(yaml, ' YAML')}>
              复制 YAML
            </button>
          </div>
          <p className="muted small">仅在自动发现不可用时使用，粘贴到 Home Assistant 的 configuration.yaml。</p>
          <pre className="raw-json tall">{yaml}</pre>
        </section>
      </div>

      <aside className="firmware-side">
        <section className="panel">
          <div className="section-head">
            <h3>MQTT Broker</h3>
            <span className="muted small">写入固件</span>
          </div>
          <div className="form compact">
            <label className="field">
              <span>服务器地址</span>
              <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="homeassistant.local" />
            </label>
            <label className="field">
              <span>端口</span>
              <input value={port} onChange={(e) => setPort(e.target.value)} placeholder="1883" />
            </label>
            <label className="field">
              <span>用户名</span>
              <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="可选" />
            </label>
            <label className="field">
              <span>密码</span>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="可选"
              />
            </label>
            <button className="btn ghost small full" onClick={saveMqtt}>
              保存 MQTT 配置
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="section-head">
            <h3>固件 MQTT 配置</h3>
            <button
              className="btn ghost small"
              onClick={() => void copy(generateMqttConfig(project), '配置')}
            >
              复制
            </button>
          </div>
          <pre className="raw-json">{generateMqttConfig(project)}</pre>
        </section>

        <section className="panel">
          <div className="section-head">
            <h3>设备信息</h3>
          </div>
          <div className="kv">
            <div>
              <span>设备名称</span>
              <b>{project.name}</b>
            </div>
            <div>
              <span>开发板</span>
              <b>{board.name}</b>
            </div>
            <div>
              <span>MQTT 状态</span>
              <b>{project.net.mqttHost ? '已配置' : '未配置'}</b>
            </div>
            <div>
              <span>Wi-Fi</span>
              <b>{project.net.ssid || '未配置'}</b>
            </div>
          </div>
        </section>
      </aside>
    </div>
  )
}
