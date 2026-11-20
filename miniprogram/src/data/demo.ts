import type { Bootstrap } from '@/types/ha';

// 演示模式数据：不连接真实 HA 也能完整体验界面与交互
export const demoBootstrap: Bootstrap = {
  ok: true,
  name: '演示家庭',
  entities: [
    { id: 'light.living_room', name: '客厅主灯', domain: 'light', state: 'on' },
    { id: 'light.bedroom', name: '卧室吸顶灯', domain: 'light', state: 'off' },
    { id: 'switch.desk', name: '书桌插座', domain: 'switch', state: 'on' },
    { id: 'climate.living_room', name: '客厅空调', domain: 'climate', state: 'cool' },
    { id: 'cover.bedroom', name: '卧室窗帘', domain: 'cover', state: 'closed' },
    { id: 'fan.study', name: '书房循环扇', domain: 'fan', state: 'off' },
    { id: 'vacuum.robot', name: '扫地机器人', domain: 'vacuum', state: 'idle' },
    { id: 'lock.front_door', name: '入户门锁', domain: 'lock', state: 'locked' },
    { id: 'media_player.tv', name: '客厅电视', domain: 'media_player', state: 'playing' },
    { id: 'sensor.living_temp', name: '客厅温度', domain: 'sensor', state: '26.4', unit: '°C' },
    { id: 'sensor.living_hum', name: '客厅湿度', domain: 'sensor', state: '48', unit: '%' },
    { id: 'person.owner', name: '我的位置', domain: 'person', state: 'home' }
  ],
  scenes: [
    { id: 'scene.movie', name: '观影模式' },
    { id: 'scene.sleep', name: '晚安' },
    { id: 'scene.leave', name: '离家布防' },
    { id: 'scene.morning', name: '起床唤醒' }
  ],
  automations: [
    { id: 'automation.night_light', name: '夜间人体感应开灯', state: 'on' },
    { id: 'automation.temp_guard', name: '温度高于 30°C 开空调', state: 'on' },
    { id: 'automation.door_alert', name: '门磁异常提醒', state: 'off' },
    { id: 'automation.plant', name: '土壤缺水提醒', state: 'on' }
  ]
};

export const demoChat = (text: string): string => {
  if (/开.*灯|灯.*开/.test(text)) return '好的，已为你打开客厅主灯，当前亮度 80%。（演示模式）';
  if (/关.*灯|灯.*关/.test(text)) return '客厅主灯已关闭。还有其他需要吗？（演示模式）';
  if (/空调|温度/.test(text)) return '客厅现在 26.4°C，空调制冷中，设定 26°C。（演示模式）';
  if (/场景|观影|晚安/.test(text)) return '已执行「观影模式」：主灯调暗、窗帘关闭、电视打开。（演示模式）';
  return '这是演示回复：连接真实 Home Assistant 后，我会通过 NovaForge 插件理解指令并控制你的设备。（演示模式）';
};
