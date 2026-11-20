# NovaForge 官方下载页 —— 推送到国内代码仓库（Gitee / GitCode）
# 用法：
#   .\deploy.ps1 -RepoUrl "https://gitee.com/你的用户名/novaforge-site.git"
#   .\deploy.ps1 -RepoUrl "https://gitcode.com/你的用户名/novaforge-site.git" -Branch main

param(
    [Parameter(Mandatory = $true)][string]$RepoUrl,
    [string]$Branch = "main",
    [string]$Message = "更新 NovaForge 官方下载页"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$site = $PSScriptRoot
Write-Host "[1/4] 站点目录: $site"

if (-not (Test-Path (Join-Path $site "index.html"))) {
    throw "当前目录不是站点根目录（缺少 index.html）"
}
if (-not (Test-Path (Join-Path $site ".git"))) {
    throw "当前目录尚未初始化 git 仓库"
}

# 提交本地改动
Write-Host "[2/4] 提交本地改动"
git -C $site add -A
$pending = git -C $site status --porcelain
if ($pending) {
    git -C $site -c user.name="NovaForge" -c user.email="dev@novaforge.local" commit -m $Message
} else {
    Write-Host "      无改动，跳过提交"
}

# 配置远端
Write-Host "[3/4] 配置远端 -> $RepoUrl"
$exist = git -C $site remote
if ($exist -contains "origin") {
    git -C $site remote set-url origin $RepoUrl
} else {
    git -C $site remote add origin $RepoUrl
}

# 推送
Write-Host "[4/4] 推送到 $Branch"
git -C $site branch -M $Branch
git -C $site push -u origin $Branch

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n推送完成。" -ForegroundColor Green
    Write-Host "若仓库已开启静态托管，等待 1-2 分钟后访问托管地址即可。"
} else {
    Write-Host "`n推送失败：请检查仓库地址、账号权限，或先执行 git config --global credential.helper manager 完成一次登录。" -ForegroundColor Yellow
}
