import type { Board, PinAssignment, Project } from './types'
import { deviceId } from './firmware'

export function baseTopic(project: Project): string {
  return `novaforge/${deviceId(project)}`
}

export function stateTopic(project: Project, pin: PinAssignment): string {
  return `${baseTopic(project)}/state/${pin.label}`
}

export function commandTopic(project: Project, pin: PinAssignment): string {
  return `${baseTopic(project)}/set/${pin.label}`
}

export function availabilityTopic(project: Project): string {
  return `${baseTopic(project)}/available`
}

export function discoveryTopic(project: Project, pin: PinAssignment): string {
  const component = pin.mode === 'output' ? 'switch' : 'binary_sensor'
  return `homeassistant/${component}/${deviceId(project)}/${pin.label}/config`
}

export function discoveryPayload(project: Project, pin: PinAssignment, board?: Board): string {
  const id = deviceId(project)
  const isOutput = pin.mode === 'output'
  // 说明：这是「按项目 ID」的预览报文。真实固件在运行时会用芯片 MAC 派生的
  // 硬件 ID（形如 nf-a4cf12ff7e2a）替换 ids 与 uniq_id 前缀，因此设备改名不影响识别。
  const payload: Record<string, unknown> = {
    name: pin.label,
    uniq_id: `${id}-${pin.label}`,
    stat_t: stateTopic(project, pin),
    avty_t: availabilityTopic(project),
    dev: {
      ids: [id],
      name: project.name,
      mf: 'NovaForge',
      mdl: board?.name ?? project.name,
      sw: '1.0.0'
    }
  }
  if (isOutput) {
    payload.cmd_t = commandTopic(project, pin)
    payload.pl_on = '1'
    payload.pl_off = '0'
  }
  return JSON.stringify(payload, null, 2)
}

export function generateHaYaml(project: Project, board: Board): string {
  const id = deviceId(project)
  const lines: string[] = []
  lines.push('# NovaForge Studio 生成的 Home Assistant 手动配置（可选）')
  lines.push('# 推荐方式一：安装 HA 社区集成（ha-integration/custom_components/novaforge），')
  lines.push('#            设备通过 mDNS（_novaforge._tcp）自动发现，走局域网 HTTP，免 MQTT。')
  lines.push('# 推荐方式二：固件内置 MQTT Discovery，连上 Broker 后自动注册实体。')
  lines.push('# 以上两种方式都无需粘贴以下内容；以下 YAML 仅在前两者不可用时兜底。')
  lines.push('mqtt:')
  const outputs = project.pins.filter((p) => p.mode === 'output')
  const inputs = project.pins.filter((p) => p.mode !== 'output')
  if (outputs.length) {
    lines.push('  switch:')
    for (const p of outputs) {
      lines.push(`    - name: "${project.name} - ${p.label}"`)
      lines.push(`      unique_id: ${id}-${p.label}`)
      lines.push(`      state_topic: "${stateTopic(project, p)}"`)
      lines.push(`      command_topic: "${commandTopic(project, p)}"`)
      lines.push('      payload_on: "1"')
      lines.push('      payload_off: "0"')
      lines.push(`      availability_topic: "${availabilityTopic(project)}"`)
    }
  }
  if (inputs.length) {
    lines.push('  binary_sensor:')
    for (const p of inputs) {
      lines.push(`    - name: "${project.name} - ${p.label}"`)
      lines.push(`      unique_id: ${id}-${p.label}`)
      lines.push(`      state_topic: "${stateTopic(project, p)}"`)
      lines.push('      payload_on: "1"')
      lines.push('      payload_off: "0"')
      lines.push(`      availability_topic: "${availabilityTopic(project)}"`)
    }
  }
  lines.push('')
  lines.push(`# 设备型号: ${board.name} (${board.chip})`)
  const ip = project.net.mdns ? `http://${project.net.mdns}.local/api/state` : 'http://<设备IP>/api/state'
  lines.push(`# 本地 HTTP 控制接口: ${ip}`)
  return lines.join('\n')
}

export function generateMqttConfig(project: Project): string {
  return JSON.stringify(
    {
      host: project.net.mqttHost,
      port: project.net.mqttPort,
      username: project.net.mqttUser,
      password: project.net.mqttPass,
      base_topic: baseTopic(project),
      discovery_prefix: 'homeassistant'
    },
    null,
    2
  )
}
