import { useEffect, useRef, useState } from 'react'
import type { ToolchainStatus } from '../../../shared/types'
import type { AuthState } from '../../../shared/auth'
import type { AiConfig, AiProvider, AiStatus } from '../../../shared/ai'
import type { AccountState } from '../../../shared/account'
import { AI_PORT, CLOUD_PRESETS, LOCAL_MODELS } from '../../../shared/ai'
import { useApp } from '../store'

interface AppInfo {
  version: string
  platform: string
  electron: string
  paths: { userData: string; toolchainDir: string; buildDir: string }
}

export function Settings(): React.ReactElement {
  const { notify } = useApp()
  const [status, setStatus] = useState<ToolchainStatus | null>(null)
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [busy, setBusy] = useState('')
  const [logs, setLogs] = useState<string[]>([])
  const [percent, setPercent] = useState<number | null>(null)
  const [auth, setAuth] = useState<AuthState | null>(null)
  const [ai, setAi] = useState<AiStatus | null>(null)
  const [account, setAccount] = useState<AccountState>({ phase: 'signedOut' })
  const [accMode, setAccMode] = useState<'login' | 'register'>('login')
  const [accKind, setAccKind] = useState<'password' | 'code'>('code')
  const [accEmail, setAccEmail] = useState('')
  const [accPassword, setAccPassword] = useState('')
  const [accName, setAccName] = useState('')
  const [accCode, setAccCode] = useState('')
  const [accBusy, setAccBusy] = useState(false)
  const [codeBusy, setCodeBusy] = useState(false)
  const [codeLeft, setCodeLeft] = useState(0)
  const codeTimer = useRef<number | null>(null)
  const [codeTip, setCodeTip] = useState('')
  // —— AI 多形态配置 ——
  const [aiProvider, setAiProvider] = useState<AiProvider>('local')
  const [aiLocalServer, setAiLocalServer] = useState('')
  const [aiLocalModelFile, setAiLocalModelFile] = useState('')
  const [aiCloudPreset, setAiCloudPreset] = useState(CLOUD_PRESETS[0].id)
  const [aiCloudBase, setAiCloudBase] = useState(CLOUD_PRESETS[0].base)
  const [aiCloudKey, setAiCloudKey] = useState('')
  const [aiCloudModel, setAiCloudModel] = useState(CLOUD_PRESETS[0].model)
  const logRef = useRef<HTMLDivElement>(null)

  const refresh = async (): Promise<void> => {
    try {
      setStatus(await window.api.toolchainStatus())
    } catch (err) {
      notify(`读取工具链状态失败: ${String(err)}`, 'error')
    }
  }

  useEffect(() => {
    void refresh()
    void window.api.appInfo().then((v) => setInfo(v as AppInfo))
    void window.api.authStatus().then(setAuth)
    void window.api.accountStatus().then(setAccount).catch(() => {})
    void window.api.aiStatus().then((s) => {
      setAi(s)
      // 从主进程状态回填当前配置
      if (s.provider) setAiProvider(s.provider)
      if (s.server) setAiLocalServer(s.server)
      if (s.model) {
        // 如果主进程找到了一个模型，更新下拉
        const hit = LOCAL_MODELS.find((m) => s.model.toLowerCase().endsWith(m.file.toLowerCase()))
        if (hit) setAiLocalModelFile(hit.file)
        else setAiLocalModelFile(s.model)
      }
      if (s.cloudBase) setAiCloudBase(s.cloudBase)
    }).catch(() => {})
    try {
      const cfg = JSON.parse(localStorage.getItem('nf-ai-cfg') || '{}') as AiConfig
      if (cfg.provider) setAiProvider(cfg.provider)
      if (cfg.server) setAiLocalServer(cfg.server)
      if (cfg.model) setAiLocalModelFile(cfg.model)
      if (cfg.preset) setAiCloudPreset(cfg.preset)
      if (cfg.cloudBase) setAiCloudBase(cfg.cloudBase)
      if (cfg.cloudKey) setAiCloudKey(cfg.cloudKey)
      if (cfg.cloudModel) setAiCloudModel(cfg.cloudModel)
    } catch { /* ignore */ }
    const off = window.api.onProgress((e) => {
      if (e.scope !== 'toolchain') return
      setLogs((prev) => [...prev.slice(-300), e.line.trimEnd()])
      if (typeof e.percent === 'number') setPercent(e.percent)
    })
    return off
  }, [])

  useEffect(() => {
    return () => {
      if (codeTimer.current) window.clearInterval(codeTimer.current)
    }
  }, [])

  // 等待授权期间每 2 秒轮询登录状态
  useEffect(() => {
    if (auth?.phase !== 'waiting') return
    const timer = setInterval(() => {
      void window.api.authStatus().then((s) => {
        setAuth(s)
        if (s.phase === 'authorized') notify(`已登录 @${s.user?.login}`, 'success')
        if (s.phase === 'error') notify(s.error ?? '登录失败', 'error')
      })
    }, 2000)
    return () => clearInterval(timer)
  }, [auth?.phase])

  const login = async (): Promise<void> => {
    const s = await window.api.authStart()
    setAuth(s)
    if (s.phase === 'error') notify(s.error ?? '发起登录失败', 'error')
  }

  const loginGitee = async (): Promise<void> => {
    const s = await window.api.authStartGitee()
    setAuth(s)
    if (s.phase === 'error') notify(s.error ?? '发起登录失败', 'error')
  }

  const logout = async (): Promise<void> => {
    setAuth(await window.api.authLogout())
    notify('已退出登录', 'success')
  }

  // —— 邮箱主账号 ——
  const requestCode = async (): Promise<void> => {
    if (codeBusy) return
    if (!accEmail.trim()) {
      notify('请先填写邮箱', 'error')
      return
    }
    setCodeBusy(true)
    try {
      const res = await window.api.accountRequestCode(
        accEmail.trim(),
        accMode === 'register' ? 'register' : 'login',
      )
      if (res.ok) {
        setCodeTip('验证码已发送，30 秒内有效，请立即填写')
        notify('验证码已发送到邮箱（30 秒内有效）', 'success')
        // 倒计时与服务端 30 秒有效期同步，倒计时归零即作废
        setCodeLeft(30)
        if (codeTimer.current) window.clearInterval(codeTimer.current)
        codeTimer.current = window.setInterval(() => {
          setCodeLeft((left) => {
            if (left <= 1) {
              if (codeTimer.current) window.clearInterval(codeTimer.current)
              codeTimer.current = null
              return 0
            }
            return left - 1
          })
        }, 1000)
      } else {
        setCodeTip(res.error ?? '发送失败')
        notify(res.error ?? '发送失败', 'error')
      }
    } catch (err) {
      setCodeTip(`发送失败: ${String(err)}`)
    } finally {
      setCodeBusy(false)
    }
  }

  const submitAccount = async (): Promise<void> => {
    if (accBusy) return
    setAccBusy(true)
    try {
      const res =
        accMode === 'register'
          ? await window.api.accountRegister(accEmail.trim(), accCode.trim(), accName, accPassword)
          : accKind === 'code'
            ? await window.api.accountLoginCode(accEmail.trim(), accCode.trim())
            : await window.api.accountLogin(accEmail.trim(), accPassword)
      setAccount(res.state)
      if (res.ok) {
        notify(accMode === 'register' ? '注册成功，已登录' : '登录成功', 'success')
        setAccPassword('')
        setAccCode('')
        setCodeTip('')
      } else {
        notify(res.error ?? '操作失败', 'error')
      }
    } catch (err) {
      notify(`账号操作失败: ${String(err)}`, 'error')
    } finally {
      setAccBusy(false)
    }
  }

  const accountLogout = async (): Promise<void> => {
    setAccount(await window.api.accountLogout())
    notify('邮箱账号已退出', 'success')
  }

  const bindRepo = async (provider: 'github' | 'gitee'): Promise<void> => {
    try {
      const st = account.phase === 'signedIn' ? account.account : null
      if (!st) {
        notify('请先注册或登录邮箱账号', 'error')
        return
      }
      const authNow = await window.api.authStatus()
      if (authNow.phase === 'authorized' || authNow.phase === 'waiting') {
        setAccount(await window.api.accountBind(provider))
        return
      }
      // 还没授权过 → 先走仓库授权，授权成功时主进程会自动绑定到邮箱账号
      const s = provider === 'gitee' ? await window.api.authStartGitee() : await window.api.authStart()
      setAuth(s)
      if (s.phase === 'error') notify(s.error ?? '发起授权失败', 'error')
      if (s.phase === 'authorized') {
        setAccount(await window.api.accountBind(provider))
        notify('仓库账号已绑定', 'success')
      }
    } catch (err) {
      notify(`绑定失败: ${String(err)}`, 'error')
    }
  }

  const unbindRepo = async (provider: 'github' | 'gitee'): Promise<void> => {
    setAccount(await window.api.accountUnbind(provider))
    notify('已解绑', 'success')
  }

  const buildAiCfg = (): AiConfig =>
    aiProvider === 'local'
      ? {
          provider: 'local',
          server: aiLocalServer.trim(),
          model: aiLocalModelFile.trim(),
        }
      : {
          provider: 'cloud',
          preset: aiCloudPreset,
          cloudBase: aiCloudBase.trim(),
          cloudKey: aiCloudKey.trim(),
          cloudModel: aiCloudModel.trim(),
        }

  const saveAiCfg = (): void => {
    localStorage.setItem('nf-ai-cfg', JSON.stringify(buildAiCfg()))
  }

  const aiStart = async (): Promise<void> => {
    const cfg = buildAiCfg()
    saveAiCfg()
    if (aiProvider === 'cloud') {
      notify('云端 AI 配置已就绪，发消息时自动连接', 'success')
    } else {
      notify('本地模型启动中（加载约 10~40 秒）…', 'success')
    }
    const s = await window.api.aiStart(cfg)
    setAi(s)
    if (s.state === 'error') notify(s.error ?? 'AI 服务启动失败', 'error')
  }

  const aiStop = async (): Promise<void> => {
    setAi(await window.api.aiStop())
    notify('AI 推理服务已停止', 'success')
  }

  /** 切换云端预设时自动填 base 和 model */
  const applyCloudPreset = (id: string): void => {
    const p = CLOUD_PRESETS.find((x) => x.id === id)
    if (p) {
      setAiCloudPreset(id)
      setAiCloudBase(p.base)
      setAiCloudModel(p.model)
    }
  }

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  const installCli = async (): Promise<void> => {
    setBusy('cli')
    setLogs([])
    setPercent(0)
    const res = await window.api.installCli()
    setPercent(null)
    setBusy('')
    notify(res.ok ? 'arduino-cli 安装完成' : `安装失败: ${res.log}`, res.ok ? 'success' : 'error')
    await refresh()
  }

  const installCore = async (coreId: string): Promise<void> => {
    setBusy(coreId)
    setLogs([])
    setPercent(null)
    const res = await window.api.installCore(coreId)
    setBusy('')
    notify(res.ok ? `${coreId} 核心安装完成` : `${coreId} 安装失败`, res.ok ? 'success' : 'error')
    await refresh()
  }

  return (
    <div className="stack">
      <section className="panel">
        <div className="section-head">
          <h3>账号（邮箱主账号）</h3>
          <span className={`badge ${account.phase === 'signedIn' ? 'ok' : ''}`}>
            {account.phase === 'signedIn' ? account.account?.email : '未登录'}
          </span>
        </div>

        {account.phase === 'signedIn' && account.account ? (
          <>
            <div className="account-row">
              <div className="account-id">
                <b>{account.account.name || account.account.email}</b>
                <span className="muted small">
                  {account.account.email} · 电脑端 / 手机 APP / HA 集成共用此账号
                </span>
              </div>
              <button className="btn ghost small" onClick={() => void accountLogout()}>
                退出账号
              </button>
            </div>

            <div className="muted small" style={{ margin: '14px 0 8px' }}>
              已绑定代码仓库（用同一个邮箱统领所有账号）
            </div>
            {(['github', 'gitee'] as const).map((p) => {
              const repo = account.account?.repos.find((r) => r.provider === p)
              return (
                <div className="account-row" key={p} style={{ marginTop: 8 }}>
                  <div className="account-id">
                    <b>{p === 'github' ? 'GitHub' : 'Gitee'}</b>
                    <span className="muted small">
                      {repo ? `${repo.name || repo.login} · @${repo.login}` : '未绑定'}
                    </span>
                  </div>
                  {repo ? (
                    <button className="btn ghost small" onClick={() => void unbindRepo(p)}>
                      解绑
                    </button>
                  ) : (
                    <button className="btn small" onClick={() => void bindRepo(p)}>
                      绑定
                    </button>
                  )}
                </div>
              )
            })}

            {auth?.phase === 'waiting' && (
              <div className="account-row" style={{ marginTop: 10 }}>
                <div className="account-id">
                  {auth.provider === 'gitee' ? (
                    <span className="muted small">
                      已打开 Gitee 授权页
                      {auth.verificationUri ? '，若浏览器未弹出请点此手动打开' : '，请在浏览器中确认授权'}
                    </span>
                  ) : (
                    <>
                      <span className="muted small">在授权页输入一次性代码：</span>
                      <div className="auth-code">{auth.userCode}</div>
                    </>
                  )}
                  {auth.verificationUri && (
                    <a
                      className="linklike"
                      onClick={() => void window.api.authOpen(auth.verificationUri!)}
                    >
                      {auth.verificationUri}
                    </a>
                  )}
                </div>
                <span className="badge">等待授权中…</span>
              </div>
            )}

            {auth?.phase === 'error' && (
              <div className="small" style={{ color: '#ff7b72', marginTop: 8 }}>
                {auth.error}
              </div>
            )}
          </>
        ) : (
          <>
            {/* —— 第三方仓库一键登录（不依赖邮箱） —— */}
            <div className="muted small" style={{ marginBottom: 8 }}>
              也可以直接用代码仓库账号登录，首次使用后再绑定邮箱即可多端同步。
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button className="btn ghost small" onClick={() => void login()}>
                GitHub 直接登录
              </button>
              <button className="btn ghost small" onClick={() => void loginGitee()}>
                Gitee 直接登录
              </button>
            </div>

            {auth?.phase === 'waiting' && (
              <div className="account-row" style={{ marginTop: 4, marginBottom: 10 }}>
                <div className="account-id">
                  {auth.provider === 'gitee' ? (
                    <span className="muted small">
                      已打开 Gitee 授权页
                      {auth.verificationUri ? '，若浏览器未弹出请点此手动打开' : '，请在浏览器中确认授权'}
                    </span>
                  ) : (
                    <>
                      <span className="muted small">在授权页输入一次性代码：</span>
                      <div className="auth-code">{auth.userCode}</div>
                    </>
                  )}
                  {auth.verificationUri && (
                    <a
                      className="linklike"
                      onClick={() => void window.api.authOpen(auth.verificationUri!)}
                    >
                      {auth.verificationUri}
                    </a>
                  )}
                </div>
                <span className="badge">等待授权中…</span>
              </div>
            )}

            {auth?.phase === 'error' && (
              <div className="small" style={{ color: '#ff7b72', marginBottom: 10 }}>
                {auth.error}
              </div>
            )}

            {/* —— 邮箱主账号 —— */}
            <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0 10px' }} />
            <div className="muted small" style={{ marginBottom: 10 }}>
              用真实邮箱注册主账号，再把 GitHub / Gitee 绑定上来。注册与登录都会向邮箱发送验证码，
              收不到验证码就无法完成注册；手机 APP 用同一邮箱登录后即与电脑连通。
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button
                className={accMode === 'login' ? 'btn small' : 'btn ghost small'}
                onClick={() => {
                  setAccMode('login')
                  setCodeTip('')
                }}
              >
                登录
              </button>
              <button
                className={accMode === 'register' ? 'btn small' : 'btn ghost small'}
                onClick={() => {
                  setAccMode('register')
                  setAccKind('code')
                  setCodeTip('')
                }}
              >
                注册
              </button>
              {accMode === 'login' && (
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  <button
                    className={accKind === 'code' ? 'btn small' : 'btn ghost small'}
                    onClick={() => setAccKind('code')}
                  >
                    验证码
                  </button>
                  <button
                    className={accKind === 'password' ? 'btn small' : 'btn ghost small'}
                    onClick={() => setAccKind('password')}
                  >
                    密码
                  </button>
                </div>
              )}
            </div>
            {accMode === 'register' && (
              <input
                className="input"
                placeholder="昵称（可选）"
                value={accName}
                onChange={(e) => setAccName(e.target.value)}
                style={{ marginBottom: 8, width: '100%' }}
              />
            )}
            <input
              className="input"
              placeholder="邮箱"
              type="email"
              autoComplete="email"
              value={accEmail}
              onChange={(e) => setAccEmail(e.target.value)}
              style={{ marginBottom: 8, width: '100%' }}
            />
            {accMode === 'register' || accKind === 'code' ? (
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  className="input"
                  placeholder="6 位邮箱验证码"
                  inputMode="numeric"
                  value={accCode}
                  onChange={(e) => setAccCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void submitAccount()
                  }}
                  style={{ flex: 1 }}
                />
                <button
                  className="btn ghost small"
                  disabled={codeBusy || codeLeft > 0}
                  onClick={() => void requestCode()}
                >
                  {codeBusy ? '发送中…' : codeLeft > 0 ? `${codeLeft} 秒` : '获取验证码'}
                </button>
              </div>
            ) : null}
            {(accMode === 'register' || accKind === 'password') && (
              <input
                className="input"
                placeholder={accMode === 'register' ? '密码（可选，至少 6 位）' : '密码'}
                type="password"
                autoComplete={accMode === 'register' ? 'new-password' : 'current-password'}
                value={accPassword}
                onChange={(e) => setAccPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submitAccount()
                }}
                style={{ marginBottom: 10, width: '100%' }}
              />
            )}
            {codeTip && (
              <div className="small muted" style={{ marginBottom: 8 }}>
                {codeTip}
              </div>
            )}
            <button className="btn small" disabled={accBusy} onClick={() => void submitAccount()}>
              {accBusy ? '处理中…' : accMode === 'register' ? '注册并登录' : '登录'}
            </button>
          </>
        )}
      </section>

      <section className="panel">
        <div className="section-head">
          <h3>AI 助手</h3>
          <span className={`badge ${ai?.state === 'running' ? 'ok' : ''}`}>
            {ai?.provider === 'cloud'
              ? ai?.state === 'error' ? '配置缺失' : '云端就绪'
              : ai?.state === 'running'
                ? '运行中'
                : ai?.state === 'starting'
                  ? '加载中'
                  : ai?.state === 'error'
                    ? '启动失败'
                    : '未启动'}
          </span>
        </div>

        {/* —— Provider 切换 —— */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          <button
            className={aiProvider === 'local' ? 'btn small' : 'btn ghost small'}
            onClick={() => {
              setAiProvider('local')
              saveAiCfg()
            }}
          >
            本地离线
          </button>
          <button
            className={aiProvider === 'cloud' ? 'btn small' : 'btn ghost small'}
            onClick={() => {
              setAiProvider('cloud')
              saveAiCfg()
            }}
          >
            云端 API
          </button>
        </div>

        {aiProvider === 'local' ? (
          <>
            {/* —— 本地模型选择 —— */}
            <div style={{ marginBottom: 10 }}>
              <span className="muted small" style={{ display: 'block', marginBottom: 6 }}>
                内置模型（从 resources/mimo/、外接盘 A:/MIMO 等多路径自动搜索）
              </span>
              <select
                className="input"
                style={{ width: '100%' }}
                value={
                  LOCAL_MODELS.some((m) => m.file === aiLocalModelFile)
                    ? aiLocalModelFile
                    : 'custom'
                }
                onChange={(e) => {
                  const v = e.target.value
                  if (v !== 'custom') setAiLocalModelFile(v)
                  else setAiLocalModelFile('')
                }}
              >
                <option value="">自动搜索第一个找到的模型</option>
                {LOCAL_MODELS.map((m) => (
                  <option key={m.file} value={m.file}>
                    {m.name} · {m.file}
                  </option>
                ))}
                <option value="custom">自定义模型文件路径…</option>
              </select>
              {(() => {
                const selected = LOCAL_MODELS.find((m) => m.file === aiLocalModelFile)
                if (selected) {
                  return (
                    <div className="muted small" style={{ marginTop: 4 }}>
                      {selected.note}
                    </div>
                  )
                }
                return null
              })()}
            </div>

            {!LOCAL_MODELS.some((m) => m.file === aiLocalModelFile) && aiLocalModelFile && (
              <div style={{ marginBottom: 10 }}>
                <span className="muted small" style={{ display: 'block', marginBottom: 4 }}>
                  自定义模型路径
                </span>
                <input
                  className="input"
                  placeholder="D:\models\my-model.gguf"
                  value={aiLocalModelFile}
                  onChange={(e) => setAiLocalModelFile(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            )}

            <div style={{ marginBottom: 10 }}>
              <span className="muted small" style={{ display: 'block', marginBottom: 4 }}>
                llama-server.exe（留空 = 自动搜索 resources/mimo/）
              </span>
              <input
                className="input"
                placeholder="（自动检测）"
                value={aiLocalServer}
                onChange={(e) => setAiLocalServer(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            {/* —— 当前运行信息 —— */}
            {ai?.state !== 'stopped' && (
              <div className="kv wide" style={{ marginTop: 10 }}>
                <div>
                  <span>推理服务</span>
                  <b className="mono break">{ai?.server || '(内置)'}</b>
                </div>
                <div>
                  <span>模型文件</span>
                  <b className="mono break">{ai?.model || '搜索中…'}</b>
                </div>
                <div>
                  <span>接口地址</span>
                  <b className="mono">http://127.0.0.1:{ai?.port ?? AI_PORT}/v1</b>
                </div>
              </div>
            )}

            <div className="row" style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {ai?.state === 'running' || ai?.state === 'starting' ? (
                <button className="btn ghost small" onClick={() => void aiStop()}>停止推理服务</button>
              ) : (
                <button className="btn small" onClick={() => void aiStart()}>启动推理服务</button>
              )}
              <button
                className="btn ghost small"
                onClick={() => void window.api.aiStatus().then((s) => { setAi(s); if (s.provider) setAiProvider(s.provider); }).catch(() => {})}
              >
                刷新状态
              </button>
            </div>
            <div className="muted small" style={{ marginTop: 8 }}>
              CPU 推理约 5~15 字/秒，首次加载 10~40 秒；对话数据不离开电脑。
              模型与 llama-server 可随安装包分发（resources/mimo/），也可放在外接盘。
            </div>
          </>
        ) : (
          <>
            {/* —— 云端预设 —— */}
            <div style={{ marginBottom: 10 }}>
              <span className="muted small" style={{ display: 'block', marginBottom: 6 }}>
                服务预设（自动填 Base URL 和模型名）
              </span>
              <select
                className="input"
                style={{ width: '100%' }}
                value={aiCloudPreset}
                onChange={(e) => applyCloudPreset(e.target.value)}
              >
                {CLOUD_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                <option value="custom">自定义（手动填）…</option>
              </select>
              {(() => {
                const p = CLOUD_PRESETS.find((x) => x.id === aiCloudPreset)
                if (p) {
                  return (
                    <div className="muted small" style={{ marginTop: 4 }}>
                      注册地址：
                      <a className="linklike" onClick={() => void window.api.authOpen(p.doc)}>
                        {p.doc}
                      </a>
                    </div>
                  )
                }
                return null
              })()}
            </div>

            <div style={{ marginBottom: 10 }}>
              <span className="muted small" style={{ display: 'block', marginBottom: 4 }}>
                Base URL
              </span>
              <input
                className="input"
                placeholder="https://api.deepseek.com/v1"
                value={aiCloudBase}
                onChange={(e) => setAiCloudBase(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: 10 }}>
              <span className="muted small" style={{ display: 'block', marginBottom: 4 }}>
                API Key（加密保存在本机）
              </span>
              <input
                className="input"
                type="password"
                placeholder="sk-..."
                value={aiCloudKey}
                onChange={(e) => setAiCloudKey(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: 10 }}>
              <span className="muted small" style={{ display: 'block', marginBottom: 4 }}>
                模型名
              </span>
              <input
                className="input"
                placeholder="deepseek-chat"
                value={aiCloudModel}
                onChange={(e) => setAiCloudModel(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div className="row" style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn small" onClick={() => void aiStart()}>
                保存并测试
              </button>
              <button
                className="btn ghost small"
                onClick={() => void window.api.aiStatus().then((s) => { setAi(s); if (s.provider) setAiProvider(s.provider); }).catch(() => {})}
              >
                刷新状态
              </button>
            </div>
            <div className="muted small" style={{ marginTop: 8 }}>
              云端走标准 OpenAI Chat Completions 接口（自动补 /chat/completions 路径）。
              密钥用系统安全存储（Windows DPAPI / macOS Keychain）加密，不会明文写到磁盘。
            </div>
          </>
        )}

        {ai?.state === 'error' && (
          <div className="small" style={{ color: '#ff7b72', marginTop: 10 }}>{ai.error}</div>
        )}
      </section>

      <section className="panel">
        <div className="section-head">
          <h3>编译工具链</h3>
          <span className={`badge ${status?.ready ? 'ok' : ''}`}>
            {status?.ready ? '就绪' : '未就绪'}
          </span>
        </div>
        <div className="toolchain-grid">
          <div className="toolchain-card">
            <div className="tc-head">
              <b>arduino-cli</b>
              <span className="muted small">
                {status?.cliVersion ? `版本 ${status.cliVersion}` : '未安装'}
              </span>
            </div>
            <div className="mono small break">{status?.cliPath ?? '未检测到可执行文件'}</div>
            <button
              className="btn ghost small"
              disabled={busy !== ''}
              onClick={() => void installCli()}
            >
              {busy === 'cli' ? '安装中…' : status?.cliPath ? '重新检测' : '安装 arduino-cli'}
            </button>
          </div>

          {(status?.cores ?? []).map((core) => (
            <div className="toolchain-card" key={core.id}>
              <div className="tc-head">
                <b>{core.id}</b>
                <span className={`badge ${core.installed ? 'ok' : ''}`}>
                  {core.installed ? `已安装 ${core.version ?? ''}` : '未安装'}
                </span>
              </div>
              <div className="muted small">
                {core.id === 'esp32:esp32'
                  ? 'ESP32 / S2 / S3 / C3 / C6 / H2 全系列核心'
                  : core.id === 'esp8266:esp8266'
                    ? 'NodeMCU / D1 mini / Feather HUZZAH 等 ESP8266 核心'
                    : core.id === 'rp2040:rp2040'
                      ? '树莓派 Pico / Pico W / Pico 2 的 RP2040 核心'
                      : 'Arduino Uno / Nano / Mega / Leonardo 等 AVR 核心'}
              </div>
              <button
                className="btn ghost small"
                disabled={busy !== '' || !status?.cliPath}
                onClick={() => void installCore(core.id)}
              >
                {busy === core.id ? '安装中…' : core.installed ? '重新安装' : '安装核心'}
              </button>
            </div>
          ))}
        </div>
        <div className="muted small">
          首次安装 ESP32 核心需要下载数百 MB 数据，取决于网络情况；安装过程日志会显示在下方。
        </div>
        {(busy || logs.length > 0) && (
          <>
            {percent !== null && (
              <div className="progress">
                <div className="progress-bar" style={{ width: `${percent}%` }} />
              </div>
            )}
            <div className="console" ref={logRef}>
              {logs.map((line, i) => (
                <div className="console-line" key={i}>
                  {line || ' '}
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <div className="section-head">
          <h3>运行环境</h3>
        </div>
        <div className="kv wide">
          <div>
            <span>应用版本</span>
            <b>{info?.version ?? '读取中…'}</b>
          </div>
          <div>
            <span>系统平台</span>
            <b>{info?.platform ?? '未知'}</b>
          </div>
          <div>
            <span>Electron</span>
            <b>{info?.electron ?? '未知'}</b>
          </div>
          <div>
            <span>数据目录</span>
            <b className="mono break">{info?.paths.userData ?? '—'}</b>
          </div>
          <div>
            <span>工具链目录</span>
            <b className="mono break">{info?.paths.toolchainDir ?? '—'}</b>
          </div>
          <div>
            <span>编译输出</span>
            <b className="mono break">{info?.paths.buildDir ?? '—'}</b>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <h3>平台适配路线</h3>
          <button className="btn ghost small" onClick={() => void refresh()}>
            刷新状态
          </button>
        </div>
        <div className="platform-row">
          <div className="platform-card active">
            <b>Windows</b>
            <span className="muted small">当前版本 · 已支持</span>
            <span className="muted small">Electron 桌面客户端，串口与编译完整可用</span>
          </div>
          <div className="platform-card">
            <b>Linux</b>
            <span className="muted small">下一阶段</span>
            <span className="muted small">复用渲染层，接入系统 arduino-cli 与串口权限</span>
          </div>
          <div className="platform-card active">
            <b>Android</b>
            <span className="muted small">已支持 · 完整客户端</span>
            <span className="muted small">AI 助手、远程编译、HA 设备与 ESP 设备统一控制</span>
          </div>
          <div className="platform-card">
            <b>HarmonyOS</b>
            <span className="muted small">下一阶段</span>
            <span className="muted small">同一套 Web 客户端 + 原生 USB/蓝牙通道，原生支持各类开发板</span>
          </div>
        </div>
      </section>
    </div>
  )
}
