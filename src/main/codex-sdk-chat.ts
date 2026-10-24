import { Worker } from 'node:worker_threads'
import { join } from 'node:path'
import type { ChatEvent, ChatResult } from '../shared/api'

export interface SdkWorkerOptions {
  binaryPath?: string
  binaryArgs?: string[]
  cwd: string
  env?: NodeJS.ProcessEnv
}

type Update =
  | Omit<Extract<ChatEvent, { type: 'status' }>, 'requestId'>
  | Omit<Extract<ChatEvent, { type: 'message' }>, 'requestId'>

export class CodexSdkChat {
  private worker?: Worker
  private pending?: { emit: (event: Update) => void; resolve: (result: ChatResult) => void }
  private timeout?: ReturnType<typeof setTimeout>
  private stopTimeout?: ReturnType<typeof setTimeout>
  private timedOut = false
  private disposing = false
  private options: SdkWorkerOptions
  private workerPath: string

  constructor(options: SdkWorkerOptions, workerPath = join(__dirname, 'codex-sdk-worker.js')) {
    this.options = options
    this.workerPath = workerPath
  }

  private finish(result: ChatResult): void {
    clearTimeout(this.timeout)
    clearTimeout(this.stopTimeout)
    this.timeout = undefined
    this.stopTimeout = undefined
    const pending = this.pending
    this.pending = undefined
    pending?.resolve(
      this.timedOut ? { status: 'error', error: '응답 시간이 5분을 초과했습니다.' } : result
    )
    if (this.disposing) this.terminate()
  }

  private terminate(): void {
    const worker = this.worker
    this.worker = undefined
    if (worker) void worker.terminate()
  }

  reset(): void {
    if (this.pending) throw new Error('응답을 중지한 후 새 대화를 시작하세요.')
    this.terminate()
  }

  cancel(): void {
    if (!this.pending || this.stopTimeout) return
    this.worker?.postMessage({ type: 'cancel' })
    this.stopTimeout = setTimeout(() => {
      this.terminate()
      this.finish({ status: 'cancelled' })
    }, 5000)
  }

  dispose(): void {
    this.disposing = true
    if (this.pending) this.cancel()
    else this.terminate()
  }

  async send(prompt: string, emit: (event: Update) => void): Promise<ChatResult> {
    if (this.disposing) throw new Error('종료된 채팅입니다.')
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 32000)
      throw new Error('메시지는 1~32,000자로 입력하세요.')
    if (this.pending) throw new Error('이미 응답을 생성하고 있습니다.')
    if (!this.worker) {
      const worker = new Worker(this.workerPath, { workerData: this.options })
      this.worker = worker
      worker.on('message', (message) => {
        if (worker !== this.worker) return
        if (message.type === 'event') this.pending?.emit(message.event)
        else if (message.type === 'result') this.finish(message.result)
      })
      worker.on('error', (error) => {
        if (worker !== this.worker) return
        this.terminate()
        this.finish({ status: 'error', error: error.message })
      })
      worker.on('exit', () => {
        if (worker !== this.worker) return
        this.worker = undefined
        this.finish({ status: 'error', error: 'SDK 연결이 종료되었습니다. 다시 시도해 주세요.' })
      })
    }
    this.timedOut = false
    return new Promise((resolve) => {
      this.pending = { emit, resolve }
      this.timeout = setTimeout(() => {
        this.timedOut = true
        this.cancel()
      }, 300000)
      this.worker!.postMessage({ type: 'send', prompt })
    })
  }
}
