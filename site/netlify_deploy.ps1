# NovaForge 官方下载页 —— 部署到 Netlify（国外托管，纯 API，无需装 CLI）
#
# 一次性准备：注册 Netlify → User settings → Applications → Personal access tokens → 新建 token
# 然后任选一种方式运行：
#   $env:NETLIFY_AUTH_TOKEN = "你的token"; .\netlify_deploy.ps1
#   .\netlify_deploy.ps1 -Token "你的token"
#
# 首次运行会新建一个站点并返回 https://<随机名>.netlify.app 域名；
# 之后把 -SiteId 记下来，再次部署时传 -SiteId 即可覆盖同一个站点。

param(
    [string]$Token = $env:NETLIFY_AUTH_TOKEN,
    [string]$SiteId = "",
    [string]$SiteName = "",
    [string]$ZipPath = ""
)

$ErrorActionPreference = "Stop"

if (-not $Token) {
    throw "缺少 Netlify token。请设置 `$env:NETLIFY_AUTH_TOKEN 或使用 -Token 参数传入。"
}

$site = $PSScriptRoot
if (-not $ZipPath) {
    $ZipPath = Join-Path $site "_deploy\novaforge-site.zip"
}

# 打包（排除 .git、预览图、临时目录）
Write-Host "[1/4] 打包站点"
Add-Type -AssemblyName System.IO.Compression.FileSystem
$deployDir = Split-Path $ZipPath -Parent
New-Item -ItemType Directory -Force -Path $deployDir | Out-Null
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }

$skip = @('.git', '_preview', '_deploy')
$tmp = Join-Path $env:TEMP ("nf_site_" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
Get-ChildItem $site -Force | Where-Object { $skip -notcontains $_.Name } | ForEach-Object {
    Copy-Item $_.FullName -Destination $tmp -Recurse -Force
}
[System.IO.Compression.ZipFile]::CreateFromDirectory($tmp, $ZipPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)
Remove-Item $tmp -Recurse -Force
Write-Host ("      包大小 {0:N2} MB" -f ((Get-Item $ZipPath).Length / 1MB))

$headers = @{ Authorization = "Bearer $Token" }

# 创建或复用站点
if (-not $SiteId) {
    Write-Host "[2/4] 新建站点"
    $body = @{}
    if ($SiteName) { $body.name = $SiteName }
    $created = Invoke-RestMethod -Uri "https://api.netlify.com/api/v1/sites" -Method Post `
        -Headers $headers -ContentType "application/json" -Body ($body | ConvertTo-Json)
    $SiteId = $created.id
    Write-Host "      site_id  = $SiteId"
    Write-Host "      site_url = $($created.ssl_url)"
} else {
    Write-Host "[2/4] 复用站点 $SiteId"
}

# 上传 zip 部署
Write-Host "[3/4] 上传并部署"
$zipBytes = [System.IO.File]::ReadAllBytes($ZipPath)
$deploy = Invoke-RestMethod -Uri "https://api.netlify.com/api/v1/sites/$SiteId/deploys" -Method Post `
    -Headers $headers -ContentType "application/zip" -Body $zipBytes
$deployId = $deploy.id
Write-Host "      deploy_id = $deployId"

# 轮询状态
Write-Host "[4/4] 等待构建"
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 3
    $d = Invoke-RestMethod -Uri "https://api.netlify.com/api/v1/deploys/$deployId" -Headers $headers
    Write-Host "      state = $($d.state)"
    if ($d.state -eq "ready") {
        Write-Host "`n部署成功：" -ForegroundColor Green
        Write-Host "  $($d.ssl_url)"
        Write-Host "`n下次更新时记住这个 site_id：$SiteId"
        break
    }
    if ($d.state -in @("error", "rejected")) {
        throw "部署失败：$($d.error_message)"
    }
}
