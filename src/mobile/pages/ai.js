/* NovaForge 软件版 · AI 助手页
 * 能力对齐小程序版 pages/ai：模型切换、知识库开关、附件（图片/文件）、腾讯文档读取、离线兜底。
 */
window.NF = window.NF || {};

(function (NF) {
  'use strict';

  var MODELS = [
    { key: 'qwen', name: '通义千问', tag: '默认' },
    { key: 'mimo', name: '小米 MiMo', tag: '端侧' },
    { key: 'deepseek', name: 'DeepSeek' },
    { key: 'glm', name: '智谱 GLM' },
    { key: 'doubao', name: '豆包' },
    { key: 'kimi', name: 'Kimi' },
    { key: 'hunyuan', name: '腾讯混元' }
  ];

  var SUGGESTIONS = ['家里现在什么状态', '把客厅灯关掉', '总结这份文档', '今晚适合开空调吗'];

  var ui = {
    messages: [],
    pending: [],
    model: 'qwen',
    knowledge: false,
    sending: false,
    enabledModels: null,
    docPanel: false,
    docUrl: '',
    seq: 0
  };

  function nextId() {
    ui.seq += 1;
    return 'm' + Date.now() + '_' + ui.seq;
  }

  function modelName(key) {
    var found = MODELS.filter(function (item) { return item.key === key; })[0];
    return found ? found.name : key;
  }

  function availableModels() {
    if (!ui.enabledModels) return MODELS;
    return MODELS.filter(function (item) { return ui.enabledModels[item.key] !== false; });
  }

  function messageHtml(msg) {
    var isUser = msg.role === 'user';
    var images = (msg.images || []).map(function (src) {
      return '<img class="message-image" src="' + src + '" alt="图片" />';
    }).join('');
    var files = (msg.files || []).map(function (file) {
      return '' +
        '<div class="message-file">' +
          '<span class="file-type">' + NF.esc(file.type || 'FILE') + '</span>' +
          '<span class="file-name">' + NF.esc(file.name) + '</span>' +
        '</div>';
    }).join('');
    var text = msg.text ? '<div class="message-text">' + NF.esc(msg.text).replace(/\n/g, '<br/>') + '</div>' : '';

    return '' +
      '<div class="message-row' + (isUser ? ' message-row-user' : '') + '">' +
        '<div class="avatar">' + (isUser ? '我' : 'AI') + '</div>' +
        '<div class="bubble ' + (isUser ? 'bubble-user' : 'bubble-assistant') + '">' +
          text + images + files +
        '</div>' +
      '</div>';
  }

  function renderMessages() {
    if (!ui.messages.length) {
      return '' +
        '<div class="welcome-card">' +
          '<span class="section-title">有我在</span>' +
          '<span class="section-tip">说说你想做什么，我来查状态、执行或分析。</span>' +
        '</div>';
    }
    return ui.messages.map(messageHtml).join('');
  }

  function renderPending() {
    if (!ui.pending.length) return '';
    var items = ui.pending.map(function (item) {
      var inner = item.kind === 'image'
        ? '<img class="pending-image" src="' + item.dataUrl + '" alt="待发送图片" />'
        : '<div class="pending-file"><span class="file-type">' + NF.esc(item.type || 'FILE') + '</span>' +
          '<span class="file-name">' + NF.esc(item.name) + '</span></div>';
      return '<div class="pending-item" data-pending="' + item.id + '">' + inner +
        '<span class="pending-remove" data-remove="' + item.id + '">×</span></div>';
    }).join('');
    return '<div class="pending-area">' + items + '</div>';
  }

  function renderComposer() {
    var disabled = ui.sending ? ' send-disabled' : '';
    return '' +
      '<div class="composer">' +
        '<div class="attach-button" id="ai-attach">＋</div>' +
        '<div class="input-wrap">' +
          '<input id="ai-input" type="text" placeholder="问点什么，或让我控制设备" autocomplete="off" />' +
        '</div>' +
        '<div class="send-button' + disabled + '" id="ai-send">发送</div>' +
      '</div>';
  }

  function render() {
    var state = NF.store.state;
    var connected = NF.store.isConnected();
    var demo = !!(state.session && state.session.demo);

    var modelOptions = availableModels().map(function (item) {
      var active = item.key === ui.model ? ' model-option-active' : '';
      return '' +
        '<div class="model-option' + active + '" data-model="' + item.key + '">' +
          '<span class="model-name">' + NF.esc(item.name) + '</span>' +
          (item.tag ? '<span class="model-tag">' + NF.esc(item.tag) + '</span>' : '') +
        '</div>';
    }).join('');

    var suggestion = ui.messages.length ? '' :
      '<div class="suggestion-area">' + SUGGESTIONS.map(function (item) {
        return '<div class="suggestion" data-suggestion="' + NF.esc(item) + '">' + NF.esc(item) + '</div>';
      }).join('') + '</div>';

    return '' +
      '<div class="ai page-ai">' +
        '<div class="header">' +
          '<div class="ai-logo">NF</div>' +
          '<span class="header-title">AI 助手</span>' +
        '</div>' +
        '<div class="model-bar"><div class="model-scroll"><div class="model-options">' + modelOptions + '</div></div></div>' +
        '<div class="knowledge-row">' +
          '<span class="row-label">知识库</span>' +
          '<div class="switch' + (ui.knowledge ? ' switch-on' : '') + '" id="ai-knowledge"><span class="switch-dot"></span></div>' +
          '<span class="row-desc" id="ai-doc">腾讯文档</span>' +
        '</div>' +
        (demo ? '<div class="demo-tip">演示模式：回答由本地规则生成</div>' : '') +
        (!connected ? '<div class="offline-tip">还没连接家庭，当前只做本地问答</div>' : '') +
        '<div class="message-scroll" id="ai-messages">' + renderMessages() +
          (ui.sending ? '<div class="message-row"><div class="avatar">AI</div><div class="bubble bubble-assistant typing"><span class="typing-dots"><i></i><i></i><i></i></span></div></div>' : '') +
        '</div>' +
        suggestion +
        (ui.docPanel ? '' +
          '<div class="chat-text-panel">' +
            '<div class="chat-text-head">读取腾讯文档</div>' +
            '<input class="chat-text-input" id="ai-doc-url" placeholder="粘贴腾讯文档链接或文件 ID" value="' + NF.esc(ui.docUrl) + '" />' +
            '<div class="chat-text-add" id="ai-doc-read">读取</div>' +
          '</div>' : '') +
        renderPending() +
        renderComposer() +
      '</div>';
  }

  function scrollToBottom() {
    var box = NF.$('ai-messages');
    if (box) box.scrollTop = box.scrollHeight;
  }

  function refreshDom() {
    var host = NF.$('page-host');
    if (!host || NF.app.currentPage() !== 'ai') return;
    host.innerHTML = render();
    bind();
    scrollToBottom();
  }

  function pushMessage(msg) {
    ui.messages.push(msg);
    refreshDom();
  }

  function history() {
    return ui.messages.slice(-8).map(function (item) {
      return { role: item.role === 'user' ? 'user' : 'assistant', content: item.text || '' };
    });
  }

  async function loadCapabilities() {
    if (!NF.store.isConnected()) return;
    try {
      var res = await NF.ha.capabilities();
      if (res && res.ok && res.models) ui.enabledModels = res.models;
      if (res && res.ok && res.knowledgeBase === false) ui.knowledge = false;
      refreshDom();
    } catch (err) {
      console.error('[AI] load capabilities failed', err);
    }
  }

  async function send(text) {
    var value = String(text || '').trim();
    var attachments = ui.pending.slice();
    if (!value && !attachments.length) return;
    if (ui.sending) return;

    var images = [];
    var files = [];
    var payload = [];

    ui.sending = true;
    ui.pending = [];

    try {
      for (var i = 0; i < attachments.length; i += 1) {
        var item = attachments[i];
        if (item.kind === 'image') images.push(item.dataUrl);
        files.push({ name: item.name, type: item.type });

        var uploaded = await NF.ha.uploadAttachment({
          file: item.file,
          name: item.name,
          mime: item.mime,
          kind: item.kind === 'image' ? 'image' : 'file'
        });
        if (uploaded && uploaded.attachment) payload.push(uploaded.attachment);
      }
    } catch (err) {
      ui.sending = false;
      NF.toast((err && err.message) || '附件上传失败', 2600);
      refreshDom();
      return;
    }

    pushMessage({ role: 'user', text: value, images: images, files: files });
    ui.sending = true;
    refreshDom();

    try {
      var reply;
      if (NF.store.isConnected()) {
        var res = await NF.ha.chat(value, {
          model: ui.model,
          attachments: payload,
          history: history(),
          knowledgeBase: ui.knowledge
        });
        if (!res || !res.ok) throw new Error((res && res.error) || 'AI 没有返回内容');
        reply = res.reply || '（空回答）';
      } else {
        await new Promise(function (resolve) { setTimeout(resolve, 320); });
        reply = NF.localAI.answer(value, NF.store.state.data || {});
      }
      ui.sending = false;
      pushMessage({ role: 'assistant', text: reply });
    } catch (err) {
      console.error('[AI] chat failed', err);
      ui.sending = false;
      var message = (err && err.message) || '请求失败';
      pushMessage({ role: 'assistant', text: '出错了：' + message + '。可以重试，或检查家庭连接。' });
    }
  }

  async function readTencentDoc() {
    var url = String(ui.docUrl || '').trim();
    if (!url) {
      NF.toast('请先粘贴腾讯文档链接或文件 ID');
      return;
    }
    if (!NF.store.isConnected()) {
      NF.toast('请先连接家庭，文档读取走 HA 扩展');
      return;
    }

    NF.showLoading('正在读取文档');
    try {
      var res = await NF.ha.readTencentDoc(url);
      NF.hideLoading();
      if (!res || !res.ok) {
        NF.toast((res && res.error) || '文档读取失败', 2600);
        return;
      }
      var doc = res.doc || {};
      ui.docPanel = false;
      ui.docUrl = '';
      pushMessage({
        role: 'assistant',
        text: '已读取《' + (doc.title || '腾讯文档') + '》' +
          (doc.truncated ? '（内容较长，已截取前部）' : '') + '。你可以直接问我这份文档的重点。'
      });
    } catch (err) {
      NF.hideLoading();
      NF.toast((err && err.message) || '文档读取失败', 2600);
    }
  }

  function pickAttachments() {
    NF.pickFiles('image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.json,.csv', true).then(function (files) {
      if (!files || !files.length) return;

      files.forEach(function (file) {
        var isImage = /^image\//.test(file.type);
        var item = {
          id: nextId(),
          kind: isImage ? 'image' : 'file',
          name: file.name,
          mime: file.type,
          type: isImage ? 'IMG' : (file.name.split('.').pop() || 'FILE').toUpperCase(),
          file: file,
          dataUrl: ''
        };

        if (isImage) {
          NF.readAsDataURL(file).then(function (dataUrl) {
            item.dataUrl = dataUrl;
            refreshDom();
          });
        }
        ui.pending.push(item);
      });
      refreshDom();
    });
  }

  function bind() {
    var host = NF.$('page-host');
    if (!host) return;

    host.querySelectorAll('[data-model]').forEach(function (el) {
      el.addEventListener('click', function () {
        ui.model = el.dataset.model;
        refreshDom();
      });
    });

    host.querySelectorAll('[data-suggestion]').forEach(function (el) {
      el.addEventListener('click', function () {
        var input = NF.$('ai-input');
        if (input) {
          input.value = el.dataset.suggestion;
          input.focus();
        }
      });
    });

    host.querySelectorAll('[data-remove]').forEach(function (el) {
      el.addEventListener('click', function (event) {
        event.stopPropagation();
        ui.pending = ui.pending.filter(function (item) { return item.id !== el.dataset.remove; });
        refreshDom();
      });
    });

    var knowledge = NF.$('ai-knowledge');
    if (knowledge) {
      knowledge.addEventListener('click', function () {
        ui.knowledge = !ui.knowledge;
        refreshDom();
      });
    }

    var doc = NF.$('ai-doc');
    if (doc) {
      doc.addEventListener('click', function () {
        ui.docPanel = !ui.docPanel;
        refreshDom();
        var box = NF.$('ai-doc-url');
        if (box) box.focus();
      });
    }

    var docInput = NF.$('ai-doc-url');
    if (docInput) {
      docInput.addEventListener('input', function () { ui.docUrl = docInput.value; });
    }

    var docRead = NF.$('ai-doc-read');
    if (docRead) docRead.addEventListener('click', readTencentDoc);

    var attach = NF.$('ai-attach');
    if (attach) attach.addEventListener('click', pickAttachments);

    var sendButton = NF.$('ai-send');
    if (sendButton) {
      sendButton.addEventListener('click', function () {
        var input = NF.$('ai-input');
        var value = input ? input.value : '';
        if (input) input.value = '';
        send(value);
      });
    }

    var input = NF.$('ai-input');
    if (input) {
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          var value = input.value;
          input.value = '';
          send(value);
        }
      });
    }
  }

  NF.pages = NF.pages || {};
  NF.pages.ai = {
    render: render,
    bind: bind,
    onShow: function () {
      loadCapabilities();
      setTimeout(scrollToBottom, 30);
    },
    refreshDom: refreshDom
  };
}(window.NF));
