/* NovaForge 软件版 · 演示数据
 * 与小程序版 data/demo.js 保持一致：一个演示家庭、12 个实体、4 个场景、4 条自动化。
 * 演示模式仅在本地内存中生效，不写入任何服务器。
 */
window.NF = window.NF || {};

(function (NF) {
  'use strict';

  var demoBootstrap = {
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
      { id: 'scene.movie', name: '观影模式', icon: '🎬' },
      { id: 'scene.goodnight', name: '晚安', icon: '🌙' },
      { id: 'scene.away', name: '离家布防', icon: '🛡️' },
      { id: 'scene.morning', name: '起床唤醒', icon: '☀️' }
    ],
    automations: [
      { id: 'automation.motion_light', name: '夜间人体感应开灯', state: 'on' },
      { id: 'automation.hot_ac', name: '温度高于 30°C 开空调', state: 'on' },
      { id: 'automation.door_alert', name: '门磁异常提醒', state: 'off' },
      { id: 'automation.soil_water', name: '土壤缺水提醒', state: 'off' }
    ]
  };

  NF.demo = {
    bootstrap: demoBootstrap
  };
}(window.NF));
