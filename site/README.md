---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: 698792bbe4e82ee6ccb56d3c5baba08b_e564e305e21c11f18c5752540024e231
    ReservedCode1: qbSDZ/2GRUduqtjUS4HqlWfJYhDd5ZynRpfFA3JD0l/+ZwdLlbFiokydv2VMrol60QiVg107eWi1eUVjDzbw4u0IFeJ8Xr2C/Nz+7ey9+mHD6/nkg5fz16UqbQnP2KdgyPNEhOVIGqaKH5sWJsViER0I1Ylqol/WrWzlTDfkSAPZNYO5K3tBFW5heDI=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: 698792bbe4e82ee6ccb56d3c5baba08b_e564e305e21c11f18c5752540024e231
    ReservedCode2: qbSDZ/2GRUduqtjUS4HqlWfJYhDd5ZynRpfFA3JD0l/+ZwdLlbFiokydv2VMrol60QiVg107eWi1eUVjDzbw4u0IFeJ8Xr2C/Nz+7ey9+mHD6/nkg5fz16UqbQnP2KdgyPNEhOVIGqaKH5sWJsViER0I1Ylqol/WrWzlTDfkSAPZNYO5K3tBFW5heDI=
---

# NovaForge Studio 官方下载页

纯静态站点：无构建步骤、无外部 CDN 依赖，可放进任何静态托管（国内对象存储 / 云服务器 / EdgeOne Pages / 任意代码仓库的静态托管）。

## 目录结构

```
site/
├── index.html                       首页（单页：下载 / 能力 / 系统要求 / 常见问题）
├── assets/
│   ├── style.css                    样式（移动优先，断点 640 / 900 / 1080）
│   ├── app.js                       交互（设备识别、复制校验值、移动菜单、入场动画）
│   └── favicon.svg                  站点图标
├── downloads/
│   └── NovaForge-Studio-0.1.0-android-release.apk   3,309,985 B
├── deploy.ps1                       Git 推送脚本（GitHub / Gitee / GitCode）
├── netlify_deploy.ps1               Netlify 一键部署脚本（纯 API）
├── .github/workflows/pages.yml      GitHub Pages 自动发布
└── README.md
```

## 响应式设计

| 断点 | 表现 |
|---|---|
| < 620px | 单列堆叠，平台卡片逐张排布；顶栏汉堡菜单展开；系统要求表格横向滚动 |
| 620 – 899px | 平台卡片两列、能力卡片两列 |
| 900 – 1079px | 顶栏导航常显、Hero 变双栏（右侧设备示意卡）、平台卡片两列 |
| ≥ 1080px | 平台卡片三列、能力卡片四列 |

另含：`viewport-fit=cover` 刘海屏适配、`prefers-color-scheme` 深色模式、`prefers-reduced-motion` 动画降级、`env(safe-area-inset-bottom)` 底部安全区。

## 设备识别

`assets/app.js` 读取 UA，自动完成三件事：

1. 高亮当前设备对应的平台卡片；
2. 顶部提示「已识别到你的设备：xxx」；
3. 主按钮文案随之变化（Android 直连下载 / 其他平台跳转「查看全部平台」）。

微信内置浏览器识别为 `weapp`，主按钮显示「小程序即将开放」。

## 本地预览

```powershell
python -m http.server 8899 --bind 127.0.0.1 --directory "D:\桌面\ESP32软件开发\site"
```

## 更新版本时的三处改动

1. `index.html` → Android 卡片里的 `href`、`tag`（版本号与体积）；
2. `index.html` → `#apkHash` 的 SHA-256；
3. `assets/app.js` → 主按钮里写死的 APK 路径。

## 平台开放状态

| 平台 | 入口 | 状态 |
|---|---|---|
| Android | `downloads/*.apk` 直接下载 | 已开放 v0.1.0（3.16 MB，SHA-256 已核对） |
| Windows / macOS / Linux | Release 资产直链 | 已发布 0.1.0 |
| HarmonyOS | Release 资产直链 `NovaForge-Studio-0.1.0-harmony-signed.hap` | 调试签名可用（需 AGC 设备白名单；正式版待发布证书） |
| iOS | `downloads/*.ipa` 直链 | 已开放 v0.1.0 未签名 IPA（744,941 B，需自签安装） |
| 微信小程序 | `#weappBtn` 占位按钮 | 正式版过审后改为跳转 |

小程序上线后，把 `#weappBtn` 换成以下任一形式：

- 明文链接：`<a class="btn btn-primary" href="https://wxaurl.cn/xxxx">打开小程序</a>`
- 公众号内嵌入：`<wx-open-launch-weapp>` 开放标签（需公众号 JS-SDK 与已认证域名）

## 部署方案（国外托管）

| 方案 | 说明 | 费用 | 本机可达性（已实测） |
|---|---|---|---|
| 推荐 | **Netlify**（zip 直传 / Git 自动部署） | 免费额度 | api.netlify.com ✅、app.netlify.com ✅ |
| 备选 | **Vercel**（CLI 或 Git） | 免费额度 | api.vercel.com ✅ |
| 备选 | **GitHub Pages**（本目录已带 Actions 工作流） | 免费 | github.com ❌（连接被重置，需代理） |
| 备选 | **Cloudflare Pages** | 免费额度 | api.cloudflare.com ✅、dash.cloudflare.com ❌（控制台需代理） |
| 备选 | **VPS + Nginx**（境外机器） | 服务器费用 | 取决于机房的连通性 |

### 方案一：Netlify（最省事，无需 Git）

```powershell
cd "D:\桌面\ESP32软件开发\site"
$env:NETLIFY_AUTH_TOKEN = "你的token"   # Netlify → User settings → Applications → Personal access tokens
.\netlify_deploy.ps1
```

脚本会自动打包、新建站点、上传、轮询到 `ready` 并打印 `https://xxx.netlify.app`。
记住返回的 `site_id`，后续更新传 `-SiteId <id>` 覆盖同一站点。

也可以完全不走命令行：把 `releases\NovaForge-site-20261117.zip` 拖到 <https://app.netlify.com/drop>，立刻得到域名。

### 方案二：Vercel CLI

```powershell
npm i -g vercel
cd "D:\桌面\ESP32软件开发\site"
vercel --prod
```

纯静态目录无需构建配置，输出目录选 `.`。

### 方案三：GitHub Pages

本目录已内置 `.github/workflows/pages.yml`，把整个 `site` 目录（含 `.github`）作为一个独立仓库推到 GitHub 的 `main` 分支后：

1. 仓库 → Settings → Pages → Source 选 **GitHub Actions**；
2. 之后每次 push 自动发布到 `https://<用户名>.github.io/<仓库名>/`。

> 本机当前直连 github.com 被重置（`Recv failure: Connection was reset`），推送需先开代理；`*.github.io` 域名本身可访问。

### 方案四：Cloudflare Pages

控制台 → Workers & Pages → Create → Pages → Upload assets，把 `site` 目录（或 zip）拖入即可；Git 集成方式需先能访问 GitHub。

### 域名与证书

四个平台默认域名均自带 HTTPS。绑自有域名时：Netlify / Vercel / Cloudflare 只需改 DNS，无需备案；若日后同时服务中国大陆用户，再单独准备已备案域名并行发布。

## 待补充项

- [ ] 自定义域名（如需，页脚 `footer-note` 处填备案号则仅国内方案需要）
- [ ] 代码仓库地址（页脚 `#repoLink` 的 `data-url` 属性）
- [ ] 其余平台安装包与下载链接

## 自测记录

| 项目 | 结果 |
|---|---|
| 静态资源可访问性 | `style.css` / `app.js` / `favicon.svg` / `apk` 均 200，Content-Type 正确 |
| 桌面 1440×900 | 渲染正常，无溢出、无重叠 |
| iPhone UA 390×844 | 单列布局，UA 识别为 iOS，主按钮切为「下载 iOS 版 v0.1.0（未签名）」 |
| Android UA 412×915 | UA 识别为 Android，主按钮切为「下载 Android 版 v0.1.0」 |
| 7 张平台卡片 | Windows / macOS / iOS / Linux / Android / HarmonyOS / 微信小程序 全部到位 |
| 系统要求表格 | 列未被裁切 |
| APK 副本哈希 | `527C07F0…48DB5`，与页面声明值、releases 原始包一致 |
*（内容由AI生成，仅供参考）*
