import { parentPort, workerData } from 'node:worker_threads'
import { createRequire, syncBuiltinESMExports } from 'node:module'
import type { SpawnOptions } from 'node:child_process'
import type { Thread } from '@openai/codex-sdk'
import type { SdkWorkerOptions } from './codex-sdk-chat'
import type { ChatResult } from '../shared/api'

const port = parentPort!
const options = workerData as SdkWorkerOptions

// This worker has its own module cache. Apply hidden process options only here,
// before importing the SDK, whose spawn API currently has no windowsHide option.
const childProcess = createRequire(__filename)(
  'node:child_process'
) as typeof import('node:child_process')
const spawn = childProcess.spawn
childProcess.spawn = ((
  command: string,
  args: readonly string[] = [],
  config: SpawnOptions = {}
) => {
  const { signal, ...rest } = config
  const executable = command.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1')
  const executableArgs =
    command === options.binaryPath ? [...(options.binaryArgs ?? []), ...args] : args
  const child = spawn(executable, executableArgs, {
    ...rest,
    windowsHide: true,
    detached: process.platform !== 'win32'
  })
  const stop = (): void => {
    if (!child.pid || child.exitCode !== null || child.signalCode !== null) return
    if (process.platform === 'win32') {
      const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/T', '/F'], {
        windowsHide: true
      })
      killer.on('error', () => child.kill())
      killer.on('close', (code) => {
        if (code !== 0) child.kill()
      })
    } else {
      try {
        process.kill(-child.pid, 'SIGKILL')
      } catch {
        child.kill('SIGKILL')
      }
    }
  }
  signal?.addEventListener('abort', stop, { once: true })
  child.once('close', () => signal?.removeEventListener('abort', stop))
  if (signal?.aborted) stop()
  return child
}) as typeof childProcess.spawn
syncBuiltinESMExports()

async function start(): Promise<void> {
  const { Codex } = await import('@openai/codex-sdk')
  const env = Object.fromEntries(
    Object.entries(options.env ?? process.env).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  )
  const client = new Codex({ codexPathOverride: options.binaryPath, env })
  let thread: Thread | undefined
  let controller: AbortController | undefined
  port.on('message', async (message) => {
    if (message.type === 'cancel') {
      controller?.abort()
      return
    }
    if (message.type !== 'send' || controller) return
    controller = new AbortController()
    const signal = controller.signal
    let result: ChatResult = { status: 'completed' }
    let completed = false
    let hasMessage = false
    try {
      thread ??= client.startThread({
        workingDirectory: options.cwd,
        skipGitRepoCheck: true,
        sandboxMode: 'read-only',
        approvalPolicy: 'never'
      })
      const { events } = await thread.runStreamed(message.prompt, { signal })
      for await (const event of events) {
        if (event.type === 'turn.started')
          port.postMessage({
            type: 'event',
            event: { type: 'status', text: 'Codex SDK가 답변을 생성하고 있습니다…' }
          })
        if (
          (event.type === 'item.updated' || event.type === 'item.completed') &&
          event.item.type === 'agent_message'
        ) {
          hasMessage = true
          port.postMessage({
            type: 'event',
            event: { type: 'message', id: event.item.id, text: event.item.text }
          })
        }
        if (event.type === 'turn.completed') completed = true
        if (event.type === 'turn.failed') result = { status: 'error', error: event.error.message }
        if (event.type === 'error') result = { status: 'error', error: event.message }
      }
      if (result.status === 'completed' && (!completed || !hasMessage))
        result = { status: 'error', error: 'SDK 응답을 받지 못했습니다.' }
    } catch (error) {
      result = {
        status: 'error',
        error: error instanceof Error ? error.message : 'SDK 응답 생성에 실패했습니다.'
      }
    } finally {
      if (signal.aborted) result = { status: 'cancelled' }
      controller = undefined
      port.postMessage({ type: 'result', result })
    }
  })
}

void start().catch((error) => {
  port.postMessage({
    type: 'result',
    result: {
      status: 'error',
      error: error instanceof Error ? error.message : 'SDK 초기화에 실패했습니다.'
    }
  })
  port.close()
})
