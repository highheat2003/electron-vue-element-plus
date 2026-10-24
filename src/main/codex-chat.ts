import { execFile, spawn } from 'node:child_process'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { delimiter, dirname, join } from 'node:path'
import { createInterface } from 'node:readline'
import type { ChatEvent, ChatResult, ChatStatus } from '../shared/api'

export interface CodexLaunch {
  command: string
  args: string[]
  env?: NodeJS.ProcessEnv
}

export function resolveCodexLaunch(
  directories = [
    ...(process.env.PATH ?? '').split(delimiter).map((path) => path.replace(/^"|"$/g, '')),
    dirname(process.execPath),
    ...(process.env.APPDATA ? [join(process.env.APPDATA, 'npm')] : [])
  ].filter(Boolean)
): CodexLaunch {
  for (const directory of directories) {
    const binary = join(directory, process.platform === 'win32' ? 'codex.exe' : 'codex')
    if (existsSync(binary)) return { command: binary, args: [] }
    const script = join(directory, 'node_modules', '@openai', 'codex', 'bin', 'codex.js')
    if (existsSync(script)) {
      if (process.platform === 'win32') {
        // The npm JS launcher spawns codex.exe without windowsHide. Bypass it
        // so our hidden process options apply to the native CLI itself.
        const packageRoot = realpathSync(join(dirname(script), '..'))
        const target =
          process.arch === 'arm64' ? 'aarch64' : process.arch === 'x64' ? 'x86_64' : undefined
        if (!target) throw new Error(`지원하지 않는 Windows 아키텍처입니다: ${process.arch}`)
        let vendorRoot = join(packageRoot, 'vendor')
        try {
          const manifest = createRequire(script).resolve(
            `@openai/codex-win32-${process.arch}/package.json`
          )
          vendorRoot = join(dirname(manifest), 'vendor')
        } catch {
          // Older CLI installations keep the native binary in their own vendor directory.
        }
        const nativeBinary = join(vendorRoot, `${target}-pc-windows-msvc`, 'bin', 'codex.exe')
        if (!existsSync(nativeBinary)) {
          throw new Error(
            'Codex 실행 파일을 찾을 수 없습니다. npm install -g @openai/codex로 다시 설치한 후 앱을 재시작하세요.'
          )
        }
        return {
          command: nativeBinary,
          args: [],
          env: { ...process.env, CODEX_MANAGED_PACKAGE_ROOT: packageRoot }
        }
      }
      return {
        command: process.execPath,
        args: [script],
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
      }
    }
  }
  throw new Error(
    'Codex CLI를 찾을 수 없습니다. 터미널에서 npm install -g @openai/codex를 실행한 후 앱을 다시 시작하세요.'
  )
}

function inspectCli(launch: CodexLaunch, args: string[]): Promise<{ code: number; text: string }> {
  return new Promise((resolve) => {
    execFile(
      launch.command,
      [...launch.args, ...args],
      { env: launch.env, windowsHide: true, timeout: 15_000, maxBuffer: 64 * 1024 },
      (error, stdout, stderr) =>
        resolve({ code: error ? 1 : 0, text: `${stdout}\n${stderr}`.trim() })
    )
  })
}

export async function getCodexStatus(launchOverride?: CodexLaunch): Promise<ChatStatus> {
  try {
    const launch = launchOverride ?? resolveCodexLaunch()
    const version = await inspectCli(launch, ['--version'])
    if (version.code !== 0) {
      return {
        available: false,
        authenticated: false,
        message: 'Codex CLI를 실행하지 못했습니다. CLI 설치 상태를 확인하세요.'
      }
    }
    const login = await inspectCli(launch, ['login', 'status'])
    return {
      available: true,
      authenticated: login.code === 0,
      version: version.text,
      message:
        login.code === 0
          ? 'Codex CLI에 연결되었습니다.'
          : '터미널에서 codex login을 실행한 후 연결을 다시 확인하세요.'
    }
  } catch (error) {
    return {
      available: false,
      authenticated: false,
      message: error instanceof Error ? error.message : 'CLI 연결 확인에 실패했습니다.'
    }
  }
}

export class CodexChat {
  private threadId?: string
  private child?: ChildProcessWithoutNullStreams
  private stopping = false

  reset(): void {
    if (this.child) throw new Error('응답을 중지한 후 새 대화를 시작하세요.')
    this.threadId = undefined
  }

  cancel(): void {
    const child = this.child
    if (!child || this.stopping) return
    this.stopping = true
    if (process.platform === 'win32' && child.pid) {
      const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/T', '/F'], {
        windowsHide: true
      })
      killer.on('error', () => child.kill())
      killer.on('close', (code) => {
        if (code !== 0) child.kill()
      })
    } else {
      // The CLI is a process group so its tool processes are stopped as well.
      try {
        process.kill(-child.pid!, 'SIGKILL')
      } catch {
        child.kill('SIGKILL')
      }
    }
  }

  async send(
    prompt: string,
    emit: (
      event:
        | Omit<Extract<ChatEvent, { type: 'status' }>, 'requestId'>
        | Omit<Extract<ChatEvent, { type: 'message' }>, 'requestId'>
    ) => void,
    launch = resolveCodexLaunch(),
    cwd = process.cwd(),
    timeoutMs = 300_000
  ): Promise<ChatResult> {
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 32_000) {
      throw new Error('메시지는 1~32,000자로 입력하세요.')
    }
    if (this.child) throw new Error('이미 응답을 생성하고 있습니다.')
    const args = [
      '--ask-for-approval',
      'never',
      'exec',
      '--sandbox',
      'read-only',
      '--skip-git-repo-check',
      '--json'
    ]
    if (this.threadId) args.push('resume', this.threadId)
    args.push('-')

    const child = spawn(launch.command, [...launch.args, ...args], {
      cwd,
      env: launch.env,
      windowsHide: true,
      detached: process.platform !== 'win32',
      stdio: ['pipe', 'pipe', 'pipe']
    })
    this.child = child
    this.stopping = false
    let stderr = ''
    let failure = ''
    let completed = false
    let hasMessage = false
    let timedOut = false
    const lines = createInterface({ input: child.stdout })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      stderr = (stderr + chunk).slice(-8000)
    })
    child.stdin.on('error', () => {
      /* Process errors are reported through close/error. */
    })
    lines.on('line', (line) => {
      let event
      try {
        event = JSON.parse(line)
      } catch {
        return
      }
      if (!event || typeof event !== 'object') return
      if (event.type === 'thread.started' && typeof event.thread_id === 'string')
        this.threadId = event.thread_id
      if (event.type === 'turn.started') emit({ type: 'status', text: '답변을 생성하고 있습니다…' })
      if (
        event.type === 'item.completed' &&
        event.item?.type === 'agent_message' &&
        typeof event.item.text === 'string'
      ) {
        hasMessage = true
        emit({ type: 'message', id: String(event.item.id), text: event.item.text })
      }
      if (event.type === 'turn.completed') completed = true
      if (event.type === 'turn.failed' || event.type === 'error') {
        failure = event.error?.message || event.message || 'Codex 응답 생성에 실패했습니다.'
      }
    })
    const timer = setTimeout(() => {
      timedOut = true
      this.cancel()
    }, timeoutMs)
    return new Promise((resolve) => {
      let processError = ''
      child.on('error', (error) => {
        processError = error.message
      })
      child.on('close', (code) => {
        clearTimeout(timer)
        lines.close()
        const cancelled = this.stopping
        this.child = undefined
        this.stopping = false
        if (timedOut)
          resolve({ status: 'error', error: '응답 시간이 5분을 초과했습니다. 다시 시도해 주세요.' })
        else if (cancelled) resolve({ status: 'cancelled' })
        else if (code === 0 && completed && hasMessage && !failure) resolve({ status: 'completed' })
        else
          resolve({
            status: 'error',
            error:
              failure ||
              processError ||
              stderr.trim() ||
              'Codex 응답을 받지 못했습니다. CLI 로그인 상태를 확인하세요.'
          })
      })
      // User text never enters a shell command or a CLI option.
      child.stdin.end(prompt, 'utf8')
    })
  }
}
