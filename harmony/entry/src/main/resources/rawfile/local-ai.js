/* NovaForge 软件版 · 本地兜底问答
 * 网络不可用或未连接家庭时，用本地规则给出可用的回答，避免界面空转。
 * 只做轻量意图匹配，不假装能控制设备。
 */
window.NF = window.NF || {};

(function (NF) {
  'use strict';

  function findEntities(kb, word) {
    var list = (kb && kb.entities) || [];
    return list.filter(function (item) {
      return new RegExp(word, 'i').test(item.name) || new RegExp(word, 'i').test(item.id);
    });
  }

  function describe(list) {
    return list.slice(0, 4).map(function (item) {
      var view = NF.fmt.toViewEntity(item);
      return view.name + '（' + view.stateLabel + '）';
    }).join('、');
  }

  function answer(text, kb) {
    var q = String(text || '');
    if (!q.trim()) return '你可以问我设备状态、场景，或者直接说要做的事。';

    if (/你(能|可以)做|帮助|怎么用|功能/.test(q)) {
      return '我能做这些：看全屋设备状态并按需开关、一键执行场景、切换自动化，以及用 AI 分析文字、图片和文件。' +
        (NF.store.isConnected() ? '' : '当前还没连上家庭，我只能回答本地问题。');
    }

    if (/灯|light/i.test(q)) {
      var lights = findEntities(kb, '灯|light');
      if (lights.length) return '灯光状态：' + describe(lights) + '。';
      return '当前没有读到灯光设备。连接家庭后我就能看到全部实体。';
    }

    if (/空调|温度|湿度|climate|sensor/i.test(q)) {
      var climate = findEntities(kb, '空调|温度|湿度|climate|sensor');
      if (climate.length) return '温湿度与空调：' + describe(climate) + '。';
      return '当前没有读到温湿度或空调实体。';
    }

    if (/扫地|vacuum/i.test(q)) {
      var vacuum = findEntities(kb, '扫地|vacuum');
      if (vacuum.length) return '扫地机器人：' + describe(vacuum) + '。';
      return '当前没有读到扫地机器人。';
    }

    if (/门|锁|lock/i.test(q)) {
      var lock = findEntities(kb, '门|锁|lock');
      if (lock.length) return '门锁状态：' + describe(lock) + '。';
      return '当前没有读到门锁设备。';
    }

    if (/场景|自动化|automation|scene/i.test(q)) {
      var names = ((kb && kb.scenes) || []).map(function (item) { return item.name; });
      var autos = ((kb && kb.automations) || []).map(function (item) {
        return item.name + '（' + (item.state === 'on' ? '已启用' : '已停用') + '）';
      });
      if (!names.length && !autos.length) return '还没读到场景和自动化。';
      return '场景：' + (names.join('、') || '无') + '。自动化：' + (autos.join('、') || '无') + '。';
    }

    if (/你好|hi|hello|在吗/i.test(q)) return '在。直接说需求，我来处理。';

    return '本地模式只能回答设备和场景相关的问题。接入家庭后，我会把这条转给云端模型深入处理。';
  }

  NF.localAI = { answer: answer };
}(window.NF));
