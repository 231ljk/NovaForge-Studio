# 微信登录与小程序界面收敛

## Context

当前 `weapp` 的 HA 扩展端已经实现 `wx.login code → jscode2session → openid → HA 会话`，AppID/AppSecret 配置也已存在，但登录页没有微信按钮，现有 JS 还会因缺少 HA 地址而阻止进入。用户要求：微信及其他登录方式都不能因暂未填写 HA 地址而卡住，允许先进入小程序、稍后在“我的”中连接家庭；同时收敛六个页面的宣传文案、渐变和模板化卡片，保留全部实际功能。

## 实施方案

### 1. 将“登录方式”和“家庭连接”拆成两个状态

- 修改 `weapp/services/store.js`，允许保存 `pending: true`、无 HA token、无 HA 地址的待连接会话；只有演示模式或同时具备地址和 token 时才自动 `refresh()`。
- 增加统一的连接状态判断，供首页、场景、AI、我的和添加设备页复用。待连接时不请求 `/api/novaforge/*`，退出登录也不调用远端 logout。
- 待连接状态只记录用户选择的 provider 和显示名，**不表示第三方身份已经通过服务端鉴权**，不伪造设备、场景或 AI 数据。
- 已有真实会话、GitHub 同账号发现和演示模式保持兼容。

### 2. 放出并补完整微信登录

- 修改 `weapp/pages/login/index.js/.wxml/.wxss`：微信登录作为主按钮，GitHub 自动对接和演示模式保留为次级入口。
- 有可用 HA 地址时，沿用 `pingHa → wx.login → ha.wxLogin → store.signIn`；没有地址时先进入待连接首页，不再阻断。
- 将获取微信 code 的小函数移到 `weapp/services/ha.js`，供登录页和“我的”连接家庭时复用。无地址时不白白调用 `wx.login`，也不保存一次性 code。
- 在“我的”增加家庭地址填写与连接操作：校验并探测 HA 后，微信用户重新获取新 code，再调用现有 `/api/novaforge/account/wx-login` 获取正式 token；成功后才转为已连接状态。
- GitHub 授权成功但未发现家庭时也允许进入待连接状态；保留本次 GitHub token 仅用于随后在用户指定的 HA 上完成 `token-login`，正式连接后不再保存该第三方 token。
- HA 的 `account.py` 已有微信鉴权、错误映射和会话签发，本次复用，不另建微信账号体系，不把 AppSecret 放到小程序。

### 3. 待连接状态下的页面行为

- 首页显示普通空状态和“去连接家庭”按钮，统计与设备列表不伪造数据。
- 场景、AI、腾讯服务和添加设备在家庭未连接时显示简短提示，不发送业务请求；演示模式仍可完整体验。
- “我的”清楚区分“待连接 / 已连接 / 演示家庭”，微信 provider 增加中文标签；连接失败保留当前页面和输入，正式连接成功后再刷新家庭数据。

### 4. 全部界面去模板化

统一采用纯色背景、常规标题、12–16rpx 圆角、细分隔线和弱阴影；减少大渐变、胶囊按钮、装饰性状态点、重复说明和夸张文案，不调整既有业务操作的位置逻辑。

- `app.wxss/app.json`：收敛全局卡片、标题、颜色和 tab 文案，保留深色变量与安全区。
- 登录页：删除三步宣传引导和大渐变品牌区，说明压缩为“可先进入应用，稍后在‘我的’中连接 Home Assistant”。
- 首页 `pages/home/*`：渐变 Hero 改普通页头，“让家更懂你”改为真实家庭名称；取消负边距叠卡和设备开启渐变，保留设备统计、点按控制和添加入口。
- 场景 `pages/scenes/*`：标题改“场景”，删除每张卡重复的“轻点即可执行”等说明，执行图标改明确文字，自动化开关保持不变。
- AI `pages/ai/*`：标题改“AI 助手”，缩短能力说明、欢迎语、模型描述和处理中提示；保留模型选择、知识库、附件、腾讯文档链接和聊天功能。
- 我的 `pages/me/*`：资料卡去渐变，连接状态与地址设置使用普通列表/表单；腾讯生态、会议、权限和主题功能不删。
- 添加设备 `pages/add-device/*`：合并重复的自动搜索说明，按钮改纯色，自动扫描、配对及失败后的手动添加均保留。
- 同步清理页面 JS 中用户可见的模板化文案，但不为了改文案重构无关逻辑，不新增图片或法律页面。

## 主要修改文件

- `weapp/services/store.js`、`weapp/services/ha.js`
- `weapp/pages/login/index.js/.wxml/.wxss`
- `weapp/pages/me/index.js/.wxml/.wxss`
- `weapp/pages/home/index.js/.wxml/.wxss`
- `weapp/pages/scenes/index.wxml/.wxss`
- `weapp/pages/ai/index.js/.wxml/.wxss`
- `weapp/pages/add-device/index.js/.wxml/.wxss`
- `weapp/app.wxss`（`app.json` 仅在确需调整导航文案时修改）

## 验证

1. 运行现有 `.tmp-shots/check.js`，并对全部小程序 JS 做语法检查、JSON 做解析；扩展端 Python 继续做 AST 校验。
2. 微信开发者工具验证：无 HA 地址点击微信可进入待连接首页；日志中无空地址请求；补填非法地址有明确错误，补填真实地址后完成 `wx.login/jscode2session` 并获得正式会话。
3. 验证 GitHub 无家庭时可先进入、后连接；已有 GitHub 自动发现、真实微信直登、退出登录和演示模式不回归。
4. 待连接时首页、场景、AI、腾讯服务和添加设备均不发送业务请求；连接后设备控制、场景、AI 附件/知识库、会议和扫描恢复正常。
5. 检查六个页面的浅色/深色、小屏与安全区；确认小程序代码中无 AppSecret，界面无残留宣传语和误导性的“已连接/已鉴权”状态。
