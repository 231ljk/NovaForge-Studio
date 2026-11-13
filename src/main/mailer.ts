import net from 'node:net'
import tls from 'node:tls'

/**
 * 内置发信邮箱（只用于发送注册/登录验证码）。
 *
 * 配置写死在主进程里、不提供任何界面入口，普通用户无法把验证码通道改到自己的邮箱。
 * 注意：163 邮箱必须使用「客户端授权密码」，不是网页登录密码。
 */
const BUILTIN: {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
} = {
  host: 'smtp.163.com',
  port: 465,
  secure: true,
  user: '15261164497@163.com',
  pass: 'KYsNGKuUNgcpH4Uc',
  from: '15261164497@163.com'
}

/* ---------------- SMTP 会话 ---------------- */

class SmtpSession {
  socket: net.Socket
  private buffer = ''
  private replies: string[] = []
  private waiter: ((line: string) => void) | null = null

  constructor(socket: net.Socket) {
    this.socket = socket
    this.attach(socket)
  }

  private attach(socket: net.Socket): void {
    this.socket = socket
    socket.setEncoding('utf8')
    socket.on('data', (chunk: string) => {
      this.buffer += chunk
      let idx: number
      while ((idx = this.buffer.indexOf('\r\n')) >= 0) {
        const line = this.buffer.slice(0, idx)
        this.buffer = this.buffer.slice(idx + 2)
        // 多行响应的中间行形如 "250-XXX"，只有 "250 XXX" 才是最终行
        if (!/^\d{3} /.test(line)) continue
        if (this.waiter) {
          const waiter = this.waiter
          this.waiter = null
          waiter(line)
        } else {
          this.replies.push(line)
        }
      }
    })
  }

  read(timeoutMs = 20_000): Promise<string> {
    const queued = this.replies.shift()
    if (queued) return Promise.resolve(queued)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiter = null
        reject(new Error('SMTP 响应超时'))
      }, timeoutMs)
      this.waiter = (line) => {
        clearTimeout(timer)
        resolve(line)
      }
    })
  }

  async cmd(line: string, expect: string): Promise<string> {
    this.socket.write(`${line}\r\n`)
    const res = await this.read()
    if (!res.startsWith(expect)) throw new Error(`SMTP 指令失败: ${res}`)
    return res
  }

  async upgrade(host: string): Promise<void> {
    const old = this.socket
    old.removeAllListeners('data')
    const secured = tls.connect({ socket: old, servername: host, rejectUnauthorized: true })
    await new Promise<void>((resolve, reject) => {
      secured.once('secureConnect', () => resolve())
      secured.once('error', reject)
    })
    this.buffer = ''
    this.attach(secured)
  }

  close(): void {
    try {
      this.socket.end()
    } catch {
      /* ignore */
    }
  }
}

function encodeHeader(value: string): string {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
}

export async function sendMail(to: string, subject: string, body: string): Promise<void> {
  const cfg = BUILTIN

  const raw = cfg.secure
    ? tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host, rejectUnauthorized: true })
    : net.connect({ host: cfg.host, port: cfg.port })

  const session = new SmtpSession(raw)
  try {
    await new Promise<void>((resolve, reject) => {
      raw.once(cfg.secure ? 'secureConnect' : 'connect', () => resolve())
      raw.once('error', reject)
      setTimeout(() => reject(new Error('SMTP 连接超时')), 20_000)
    })

    const greeting = await session.read()
    if (!greeting.startsWith('220')) throw new Error(`SMTP 服务拒绝连接: ${greeting}`)

    await session.cmd('EHLO novaforge', '250')

    if (!cfg.secure) {
      await session.cmd('STARTTLS', '220')
      await session.upgrade(cfg.host)
      await session.cmd('EHLO novaforge', '250')
    }

    await session.cmd('AUTH LOGIN', '334')
    await session.cmd(Buffer.from(cfg.user, 'utf8').toString('base64'), '334')
    await session.cmd(Buffer.from(cfg.pass, 'utf8').toString('base64'), '235')

    await session.cmd(`MAIL FROM:<${cfg.from}>`, '250')
    await session.cmd(`RCPT TO:<${to}>`, '250')
    await session.cmd('DATA', '354')

    const payload = [
      `From: ${encodeHeader('NovaForge Studio')} <${cfg.from}>`,
      `To: <${to}>`,
      `Subject: ${encodeHeader(subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(body, 'utf8').toString('base64'),
    ].join('\r\n')

    session.socket.write(`${payload}\r\n.\r\n`)
    const done = await session.read()
    if (!done.startsWith('250')) throw new Error(`邮件发送失败: ${done}`)
    session.cmd('QUIT', '221').catch(() => {})
  } finally {
    session.close()
  }
}
