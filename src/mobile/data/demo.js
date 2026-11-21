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

  var REPLIES = [
    '收到。演示模式下我只能在本地回应，接入家庭后就能真实控制设备了。',
    '这件事可以交给我：先看设备状态，再按你的习惯执行。演示模式里我先给个示意答复。',
    '已记录。接入 Home Assistant 之后，我能直接读取实体状态并调用服务，不需要你手动点。',
    '演示环境没有联网，所以我只能给出占位回答。连接家庭后的回答会基于真实设备数据。'
  ];

  var chatIndex = 0;

  function demoChat(text) {
    var q = String(text || '');
    var reply;

    if (/灯|light/i.test(q)) {
      reply = '客厅主灯现在是开着的，卧室吸顶灯是关的。要我帮你把卧室也打开吗？';
    } else if (/温度|空调|climate|热/i.test(q)) {
      reply = '客厅温度 26.4°C、湿度 48%，空调正在制冷。要不要把目标温度调低一度？';
    } else if (/扫地|vacuum/i.test(q)) {
      reply = '扫地机器人当前待机中。我可以立刻让它开始全屋清扫。';
    } else if (/门|锁|lock/i.test(q)) {
      reply = '入户门锁处于已锁状态，最近没有异常开关记录。';
    } else if (/场景|回家|离家|晚安/i.test(q)) {
      reply = '现在有 4 个场景可用：观影模式、晚安、离家布防、起床唤醒。说要哪一个我就执行。';
    } else {
      reply = REPLIES[chatIndex % REPLIES.length];
      chatIndex += 1;
    }

    return reply;
  }

  NF.demo = {
    bootstrap: demoBootstrap,
    chat: demoChat
  };
}(window.NF));
