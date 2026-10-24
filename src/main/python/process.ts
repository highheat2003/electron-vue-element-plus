import { spawn } from 'node:child_process'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createInterface } from 'node:readline'
import { join } from 'node:path'

export interface PythonLaunch {
  command: string
  args: string[]
  cwd: string
}
export interface BackendConnection {
  url: string
  token: string
}

export class PythonBackendProcess {
  private launch: PythonLaunch
  private child?: ChildProcessWithoutNullStreams
  private starting?: Promise<BackendConnection>
  private connection?: BackendConnection
  private closing = false

  constructor(launch: PythonLaunch) {
    this.launch = launch
  }

  async start(): Promise<BackendConnection> {
    if (this.closing) throw new Error('Python 백엔드가 종료 중입니다.')
    if (this.connection && this.child) return this.connection
    if (this.starting) return this.starting
    const pending = this.spawnServer()
    this.starting = pending
    try {
      return await pending
    } finally {
      if (this.starting === pending) this.starting = undefined
    }
  }

  private spawnServer(): Promise<BackendConnection> {
    const token = randomBytes(32).toString('hex')
    const child = spawn(this.launch.command, this.launch.args, {
      cwd: this.launch.cwd,
      env: { ...process.env, DESKTOP_BACKEND_TOKEN: token, PYTHONUTF8: '1', PYTHONUNBUFFERED: '1' },
      shell: false,
      windowsHide: true,
      detached: process.platform !== 'win32',
      stdio: ['pipe', 'pipe', 'pipe']
    })
    this.child = child
    let diagnostic = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      diagnostic = (diagnostic + chunk).slice(-1500)
    })
    child.stdin.on('error', () => {
      /* Exit is handled below. */
    })
    const lines = createInterface({ input: child.stdout })
    return new Promise((resolve, reject) => {
      let settled = false
      let probing = false
      const fail = (error: Error): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        lines.close()
        void this.stopChild(child)
        reject(error)
      }
      const timer = setTimeout(
        () => fail(new Error('Python 백엔드 시작 시간이 초과되었습니다.')),
        15000
      )
      child.on('error', (error) =>
        fail(
          new Error(
            'Python 백엔드를 실행하지 못했습니다. npm run backend:setup을 실행한 후 다시 시도하세요.',
            { cause: error }
          )
        )
      )
      child.once('close', () => {
        if (this.child === child) {
          this.child = undefined
          this.connection = undefined
        }
        lines.close()
        fail(
          new Error(`Python 백엔드가 종료되었습니다.${diagnostic ? ` ${diagnostic.trim()}` : ''}`)
        )
      })
      lines.on('line', async (line) => {
        if (settled || probing) return
        let event
        try {
          event = JSON.parse(line)
        } catch {
          return
        }
        if (
          event?.event !== 'ready' ||
          !Number.isInteger(event.port) ||
          event.port < 1 ||
          event.port > 65535
        )
          return
        probing = true
        const connection = { url: `http://127.0.0.1:${event.port}`, token }
        while (!settled && !this.closing && this.child === child) {
          try {
            const response = await fetch(`${connection.url}/health`, {
              headers: { Authorization: `Bearer ${token}` },
              signal: AbortSignal.timeout(1000)
            })
            const body = await response.json()
            if (response.ok && body.status === 'ok' && body.service === 'desktop-python-backend') {
              settled = true
              clearTimeout(timer)
              lines.close()
              this.connection = connection
              resolve(connection)
              return
            }
          } catch {
            /* Wait until Uvicorn finishes startup. */
          }
          await new Promise((done) => setTimeout(done, 100))
        }
      })
    })
  }

  private async stopChild(child: ChildProcessWithoutNullStreams): Promise<void> {
    if (child.exitCode !== null || child.signalCode !== null) return
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        if (process.platform === 'win32' && child.pid) {
          const killer = spawn(
            join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'taskkill.exe'),
            ['/pid', String(child.pid), '/T', '/F'],
            { windowsHide: true }
          )
          killer.on('error', () => child.kill())
        } else if (child.pid) {
          try {
            process.kill(-child.pid, 'SIGKILL')
          } catch {
            child.kill('SIGKILL')
          }
        }
      }, 2000)
      const deadline = setTimeout(() => {
        clearTimeout(timer)
        resolve()
      }, 4000)
      child.once('close', () => {
        clearTimeout(timer)
        clearTimeout(deadline)
        resolve()
      })
      if (!child.stdin.destroyed) child.stdin.end('shutdown\n')
    })
  }

  async stop(): Promise<void> {
    this.closing = true
    this.connection = undefined
    if (this.child) await this.stopChild(this.child)
  }
}
