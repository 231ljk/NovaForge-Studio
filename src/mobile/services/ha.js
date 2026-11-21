/* NovaForge 软件版 · 服务层
 * 与 HA（NovaForge 扩展）以及 GitHub Device Flow 通信。
 * 演示模式（demo）全部走本地 mock，无需后端即可体验完整交互。
 * 迁移自小程序版 weapp/services/ha.js，接口与返回结构保持一致。
 */
window.NF = window.NF || {};

(function (NF) {
  'use strict';

  var config = { haUrl: '', token: '', demo: false };

  var GH_CLIENT_ID = 'Ov23liGYZuxISGkahFRw'; // 与 HA 插件一致的公共 OAuth Client ID（非密钥）
  var GH_SCOPE = 'read:user gist';
  var GIST_FILE = 'novaforge-hub.json';

  var configure = function (c) { Object.assign(config, c); };

  function raw(opt) {
    var headers = opt.form
      ? { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }
      : { 'Content-Type': 'application/json' };
    Object.assign(headers, opt.headers || {});

    return NF.http(opt.url, {
      method: opt.method || 'GET',
      headers: headers,
      json: opt.form ? undefined : opt.data,
      form: opt.form ? opt.data : undefined,
      timeout: opt.timeout || 15000
    }).then(function (res) {
      return res.data;
    }, function (err) {
      console.error('[HA] request failed', opt.url, err && err.message);
      if (err && err.status === 401) throw err;
      throw new Error((err && err.message) || 'network error');
    });
  }

  // ---------------- 演示模式数据 ----------------

  var demoState = JSON.parse(JSON.stringify(NF.demo.bootstrap));

  function demoSnapshot() {
    return {
      ok: true,
      name: demoState.name,
      entities: demoState.entities.map(function (item) { return Object.assign({}, item); }),
      scenes: demoState.scenes.map(function (item) { return Object.assign({}, item); }),
      automations: demoState.automations.map(function (item) { return Object.assign({}, item); })
    };
  }

  function demoService(data) {
    var domain = String((data && data.domain) || '');
    var service = String((data && data.service) || '');
    var payload = (data && data.data) || {};
    var entityId = String(payload.entity_id || '');

    var entity = demoState.entities.filter(function (item) { return item.id === entityId; })[0];
    var automation = demoState.automations.filter(function (item) { return item.id === entityId; })[0];

    if (automation && domain === 'automation') {
      automation.state = service === 'turn_on' ? 'on' : 'off';
      return;
    }
    if (!entity) return;

    if (domain === 'lock') entity.state = service === 'lock' ? 'locked' : 'unlocked';
    else if (domain === 'cover') entity.state = service === 'open_cover' ? 'open' : 'closed';
    else if (domain === 'climate') entity.state = service === 'turn_off' ? 'off' : 'cool';
    else if (domain === 'media_player') entity.state = service === 'turn_off' ? 'paused' : 'playing';
    else if (domain === 'vacuum') entity.state = service === 'turn_off' ? 'idle' : 'on';
    else if (domain !== 'button' && domain !== 'scene' && domain !== 'script') {
      entity.state = service === 'turn_off' ? 'off' : 'on';
    }
  }

  // 腾讯生态演示数据：结构与服务端 TENCENT_SERVICES 一致
  function demoTencentServices() {
    return {
      knowledge_base: { label: '腾讯知识库', description: 'AI 问答时检索你的私有知识库', configured: true, planned: false },
      docs: { label: '腾讯文档', description: '读取在线文档/表格/幻灯片，交给 AI 总结分析', configured: true, planned: false },
      meeting: { label: '腾讯会议', description: '创建会议、查询会议列表、获取入会链接', configured: true, planned: false },
      ocr: { label: '腾讯云 OCR', description: '图片文字识别', configured: false, planned: true },
      translate: { label: '腾讯翻译君', description: '多语言文本翻译', configured: false, planned: true },
      map: { label: '腾讯位置服务', description: '定位与到家/离家自动化', configured: false, planned: true },
      cos: { label: '腾讯云 COS', description: '附件与固件包分发', configured: false, planned: true },
      wecom: { label: '企业微信', description: '设备告警推送到企业微信', configured: false, planned: true }
    };
  }

  var demoMeetings = [
    {
      id: 'demo-seed',
      code: '123 456 789',
      subject: 'NovaForge 固件评审（演示）',
      start_time: Math.floor(Date.now() / 1000) + 3600,
      end_time: Math.floor(Date.now() / 1000) + 7200,
      join_url: 'https://meeting.tencent.com/dm/demo',
      status: 'scheduled'
    }
  ];

  function demoApi(path, data) {
    return new Promise(function (resolve) {
      console.log('[HA][demo]', path);

      switch (path) {
        case '/api/novaforge/mobile/bootstrap':
          resolve(demoSnapshot());
          break;

        case '/api/novaforge/mobile/service':
          demoService(data);
          resolve({ ok: true });
          break;

        case '/api/novaforge/mobile/chat': {
          var attachments = (data && data.attachments) || [];
          var suffix = attachments.length ? '\n\n已模拟分析 ' + attachments.length + ' 个附件。' : '';
          resolve({ ok: true, reply: NF.demo.chat(String((data && data.text) || '')) + suffix });
          break;
        }

        case '/api/novaforge/mobile/capabilities':
          resolve({
            ok: true,
            models: { qwen: true, mimo: true, deepseek: true, glm: true, doubao: true, kimi: true, hunyuan: true },
            knowledgeBase: true,
            tencent: demoTencentServices()
          });
          break;

        case '/api/novaforge/mobile/tencent':
          resolve({ ok: true, services: demoTencentServices() });
          break;

        case '/api/novaforge/mobile/tencent-doc': {
          var source = String((data && (data.url || data.file_id)) || '');
          if (!/docs\.qq\.com|^[A-Za-z0-9_-]{8,}$/.test(source.trim())) {
            resolve({ ok: false, error: '没有识别到腾讯文档链接或文件 ID' });
            break;
          }
          resolve({
            ok: true,
            doc: {
              id: 'demo-doc',
              title: 'NovaForge 产品需求（演示文档）',
              type: 'doc',
              content: '这是一份演示用腾讯文档正文。\n\n一、固件：刷入第三方开发板后原生接入 Home Assistant。\n二、扩展：把全品牌家电映射到手机端。\n三、AI：端侧千问 + 云端七家国内模型，支持知识库、文档与会议。',
              truncated: false
            }
          });
          break;
        }

        case '/api/novaforge/mobile/tencent-doc-auth':
          resolve({ ok: true, authorizeUrl: 'https://docs.qq.com/oauth/v2/authorize?demo=1' });
          break;

        case '/api/novaforge/mobile/tencent-meeting': {
          var subject = String((data && data.subject) || 'NovaForge 会议');
          var now = Math.floor(Date.now() / 1000);
          demoMeetings.unshift({
            id: 'demo-' + now,
            code: '888 666 123',
            subject: subject,
            start_time: now + 600,
            end_time: now + 4200,
            join_url: 'https://meeting.tencent.com/dm/demo',
            status: 'scheduled'
          });
          resolve({ ok: true, meeting: demoMeetings[0] });
          break;
        }

        case '/api/novaforge/mobile/tencent-meetings':
          resolve({ ok: true, meetings: demoMeetings.slice(), total: demoMeetings.length });
          break;

        case '/api/novaforge/mobile/tencent-meeting-cancel': {
          var id = String((data && data.meeting_id) || '');
          var index = demoMeetings.findIndex(function (item) { return item.id === id; });
          if (index >= 0) demoMeetings.splice(index, 1);
          resolve({ ok: true });
          break;
        }

        case '/api/novaforge/mobile/scan':
          resolve({
            ok: true,
            subnet: '192.168.31.',
            devices: [{ name: 'NovaForge-ESP32 开发板', host: '192.168.31.66', port: 80 }]
          });
          break;

        case '/api/novaforge/mobile/add-device':
          resolve({ ok: true });
          break;

        default:
          resolve({ ok: true });
      }
    });
  }

  function api(path, opt) {
    var options = opt || {};
    if (config.demo) return demoApi(path, options.data);

    var headers = {};
    if (config.token) headers.Authorization = 'Bearer ' + config.token;

    return raw({
      url: config.haUrl + path,
      method: options.method || 'GET',
      data: options.data,
      headers: headers,
      timeout: options.timeout
    });
  }

  // ---------------- 业务接口 ----------------

  var bootstrap = function () { return api('/api/novaforge/mobile/bootstrap'); };

  var callService = function (domain, service, data) {
    return api('/api/novaforge/mobile/service', { method: 'POST', data: { domain: domain, service: service, data: data } });
  };

  var chat = function (text, options) {
    var opts = options || {};
    return api('/api/novaforge/mobile/chat', {
      method: 'POST',
      data: {
        text: text,
        model: opts.model || 'qwen',
        attachments: opts.attachments || [],
        history: opts.history || [],
        knowledge_base: !!opts.knowledgeBase
      },
      timeout: 120000
    });
  };

  var capabilities = function () { return api('/api/novaforge/mobile/capabilities'); };

  /** 附件上传：file 为浏览器 File；返回 { ok, attachment } */
  var uploadAttachment = function (file) {
    if (config.demo) {
      return Promise.resolve({
        ok: true,
        attachment: {
          id: 'demo-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          name: file.name,
          type: file.kind || 'file',
          mime: file.mime || 'application/octet-stream'
        }
      });
    }

    var headers = config.token ? { Authorization: 'Bearer ' + config.token } : {};
    return NF.upload(config.haUrl + '/api/novaforge/mobile/attachment', { file: file, name: 'file' }, headers, 60000)
      .then(function (res) {
        var body = res.data;
        if (res.status < 200 || res.status >= 300 || !body || !body.ok) {
          throw new Error((body && body.error) || '附件上传失败');
        }
        return body;
      });
  };

  var logoutRemote = function () {
    return api('/api/novaforge/mobile/logout', { method: 'POST', data: {} }).catch(function () { return { ok: false }; });
  };

  var scanDevices = function (subnet) {
    return api('/api/novaforge/mobile/scan', { method: 'POST', data: { subnet: subnet }, timeout: 30000 });
  };

  var addDevice = function (host, port, token) {
    return api('/api/novaforge/mobile/add-device', { method: 'POST', data: { host: host, port: port, token: token } });
  };

  // ---------------- 腾讯生态（文档 / 会议 / 服务目录） ----------------

  var tencentServices = function () { return api('/api/novaforge/mobile/tencent'); };

  /** 读取腾讯文档正文，返回 { ok, doc: { title, content, ... } } */
  var readTencentDoc = function (urlOrId) {
    return api('/api/novaforge/mobile/tencent-doc', { method: 'POST', data: { url: urlOrId }, timeout: 40000 });
  };

  /** 腾讯文档授权：不传 code 返回授权链接，传 code 完成换令牌 */
  var tencentDocAuth = function (code) {
    return api('/api/novaforge/mobile/tencent-doc-auth', { method: 'POST', data: { code: code || '' } });
  };

  var createTencentMeeting = function (data) {
    return api('/api/novaforge/mobile/tencent-meeting', {
      method: 'POST',
      data: {
        subject: (data && data.subject) || 'NovaForge 会议',
        start_time: (data && data.start_time) || 0,
        end_time: (data && data.end_time) || 0,
        invitees: (data && data.invitees) || []
      },
      timeout: 40000
    });
  };

  var listTencentMeetings = function (page) {
    return api('/api/novaforge/mobile/tencent-meetings', { method: 'POST', data: { page: page || 1, size: 10 } });
  };

  var cancelTencentMeeting = function (meetingId) {
    return api('/api/novaforge/mobile/tencent-meeting-cancel', { method: 'POST', data: { meeting_id: meetingId } });
  };

  // ---------------- 账号（GitHub / Gitee / 邮箱 → HA 会话） ----------------

  /** 探测地址是不是一台装了 NovaForge 扩展的 HA */
  var pingHa = function (base) {
    return raw({ url: base + '/api/novaforge/account/ping', timeout: 8000 }).then(
      function (res) {
        if (!res || res.ok !== true) throw new Error((res && res.error) || '这个地址没有 NovaForge 登录接口');
        return res;
      },
      function () {
        throw new Error('连不上这个地址，请检查 IP、端口，并确认手机在同一网络');
      }
    );
  };

  /** 用第三方账号令牌换 HA 会话：{ ok, token, expiresAt, account } */
  var tokenLogin = function (base, token, provider) {
    return raw({
      url: base + '/api/novaforge/account/token-login',
      method: 'POST',
      data: { provider: provider || 'github', token: token },
      timeout: 12000
    }).then(
      function (res) {
        if (!res || !res.ok) throw new Error((res && res.error) || '这个家庭没有绑定当前账号');
        if (!res.token) throw new Error('HA 没有返回登录令牌，请更新 NovaForge 扩展后重试');
        res.haUrl = base;
        return res;
      },
      function (err) {
        var msg = (err && err.message) || '';
        if (/timeout/i.test(msg)) throw new Error('登录超时，请确认手机能访问这个 HA 地址');
        throw new Error('连接 HA 失败：' + msg);
      }
    );
  };

  /** 邮箱验证码：发送 */
  var requestCode = function (base, email) {
    return raw({
      url: base + '/api/novaforge/account/request-code',
      method: 'POST',
      data: { email: email },
      timeout: 20000
    }).then(function (res) {
      if (!res || !res.ok) throw new Error((res && res.error) || '验证码发送失败');
      return res;
    });
  };

  /** 邮箱验证码：登录 */
  var loginByCode = function (base, email, code) {
    return raw({
      url: base + '/api/novaforge/account/login',
      method: 'POST',
      data: { email: email, code: code },
      timeout: 20000
    }).then(function (res) {
      if (!res || !res.ok) throw new Error((res && res.error) || '登录失败，请检查验证码');
      if (!res.token) throw new Error('HA 没有返回登录令牌，请更新 NovaForge 扩展后重试');
      res.haUrl = base;
      return res;
    });
  };

  /** Gitee OAuth：发起（返回授权地址或设备码） */
  var giteeStart = function (base) {
    return raw({ url: base + '/api/novaforge/account/gitee-start', method: 'POST', data: {}, timeout: 20000 });
  };

  /** Gitee OAuth：轮询换令牌 */
  var giteePoll = function (base, session) {
    return raw({
      url: base + '/api/novaforge/account/gitee-poll',
      method: 'POST',
      data: { session: session },
      timeout: 20000
    });
  };

  // ---------------- GitHub Device Flow（同账号自动对接） ----------------

  var githubStart = function () {
    return raw({
      url: 'https://github.com/login/device/code',
      method: 'POST',
      form: true,
      data: { client_id: GH_CLIENT_ID, scope: GH_SCOPE }
    });
  };

  var githubPoll = function (deviceCode) {
    return raw({
      url: 'https://github.com/login/oauth/access_token',
      method: 'POST',
      form: true,
      data: {
        client_id: GH_CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
      }
    });
  };

  var githubUser = function (token) {
    return raw({
      url: 'https://api.github.com/user',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' }
    });
  };

  var githubGists = function (token) {
    return raw({
      url: 'https://api.github.com/gists?per_page=100',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' }
    });
  };

  var githubRaw = function (url, token) {
    return raw({ url: url, headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' } });
  };

  /** 从 Gist 中找出 novaforge-hub.json 记录的 HA 地址列表 */
  var discoverHa = async function (token) {
    var gists = await githubGists(token);
    var list = Array.isArray(gists) ? gists : [];
    var target = list.filter(function (item) {
      var files = (item && item.files) || {};
      return Object.prototype.hasOwnProperty.call(files, GIST_FILE);
    })[0];

    if (!target) throw new Error('这个 GitHub 账号里还没有 ' + GIST_FILE + '，请先在 HA 扩展里生成');
    var file = target.files[GIST_FILE];
    var body = await githubRaw(file.raw_url, token);
    var urls = (body && (body.urls || body.hosts)) || [];
    if (typeof urls === 'string') urls = [urls];

    var clean = urls.map(function (item) { return NF.fmt.normalizeUrl(item); }).filter(Boolean);
    if (!clean.length) throw new Error('Gist 里没有可用的 HA 地址');
    return clean;
  };

  /** 依次尝试 Gist 中记录的 HA 地址，直到 token-login 成功 */
  var pairHa = async function (urls, token, provider) {
    for (var i = 0; i < urls.length; i += 1) {
      var base = urls[i];
      try {
        var res = await tokenLogin(base, token, provider);
        if (res && res.ok && res.token) {
          res.haUrl = base;
          return res;
        }
        throw new Error((res && res.error) || 'HA 拒绝了这次登录');
      } catch (err) {
        console.error('[HA] pair failed', base, err);
        if (i === urls.length - 1) {
          throw new Error('已找到家庭，但暂时无法连接。请确认 HA 扩展正在运行，且手机可以访问家庭网络');
        }
      }
    }
    throw new Error('这台 HA 没有可用地址');
  };

  NF.ha = {
    GIST_FILE: GIST_FILE,
    config: config,
    configure: configure,
    bootstrap: bootstrap,
    callService: callService,
    chat: chat,
    capabilities: capabilities,
    uploadAttachment: uploadAttachment,
    logoutRemote: logoutRemote,
    scanDevices: scanDevices,
    addDevice: addDevice,
    tencentServices: tencentServices,
    readTencentDoc: readTencentDoc,
    tencentDocAuth: tencentDocAuth,
    createTencentMeeting: createTencentMeeting,
    listTencentMeetings: listTencentMeetings,
    cancelTencentMeeting: cancelTencentMeeting,
    pingHa: pingHa,
    tokenLogin: tokenLogin,
    requestCode: requestCode,
    loginByCode: loginByCode,
    giteeStart: giteeStart,
    giteePoll: giteePoll,
    githubStart: githubStart,
    githubPoll: githubPoll,
    githubUser: githubUser,
    githubGists: githubGists,
    githubRaw: githubRaw,
    discoverHa: discoverHa,
    pairHa: pairHa
  };
}(window.NF));
