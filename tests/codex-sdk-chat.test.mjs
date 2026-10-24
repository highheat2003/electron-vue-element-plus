import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { CodexSdkChat } from '../src/main/codex-sdk-chat.ts'

const worker = fileURLToPath(new URL('../out/main/codex-sdk-worker.js', import.meta.url))
const fixture = fileURLToPath(new URL('./fixtures/codex-cli.mjs', import.meta.url))

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createChat = () =>
  new CodexSdkChat(
    {
      binaryPath: process.execPath,
      binaryArgs: [fixture],
      cwd: process.cwd(),
      env: { ...process.env, CHAT_TEST_MODE: 'conditional' }
    },
    worker
  )

test('real Codex SDK streams events, preserves Unicode, resumes threads, and resets', async (t) => {
  const chat = createChat()
  t.after(() => chat.dispose())
  const events = []
  const prompt = '한글 줄바꿈\n"quotes" & $(literal)'
  assert.equal((await chat.send(prompt, (event) => events.push(event))).status, 'completed')
  const answer = JSON.parse(events.find((event) => event.type === 'message').text)
  assert.equal(answer.prompt, prompt)
  assert.ok(answer.args.includes('read-only'))
  assert.ok(answer.args.includes('approval_policy="never"'))
  assert.ok(!answer.args.includes('resume'))
  const next = []
  assert.equal((await chat.send('next', (event) => next.push(event))).status, 'completed')
  assert.ok(JSON.parse(next.find((event) => event.type === 'message').text).args.includes('resume'))
  chat.reset()
  const fresh = []
  await chat.send('new', (event) => fresh.push(event))
  assert.ok(
    !JSON.parse(fresh.find((event) => event.type === 'message').text).args.includes('resume')
  )
})

test('SDK cancellation, concurrency protection, and further messages', async (t) => {
  const chat = createChat()
  t.after(() => chat.dispose())
  let notify
  const started = new Promise((resolve) => {
    notify = resolve
  })
  const result = chat.send('hang', () => notify())
  await started
  assert.throws(() => chat.reset(), /응답/)
  await assert.rejects(
    chat.send('second', () => {}),
    /이미/
  )
  chat.cancel()
  assert.equal((await result).status, 'cancelled')
  assert.equal((await chat.send('again', () => {})).status, 'completed')
  const second = chat.send('hang', () => notify())
  chat.cancel()
  assert.equal((await second).status, 'cancelled')
})

test('SDK errors, empty replies, invalid messages and disposed sessions', async (t) => {
  const chat = createChat()
  t.after(() => chat.dispose())
  await assert.rejects(
    chat.send(' ', () => {}),
    /메시지/
  )
  await assert.rejects(
    chat.send('x'.repeat(32001), () => {}),
    /메시지/
  )
  assert.equal((await chat.send('failure', () => {})).status, 'error')
  assert.equal((await chat.send('empty', () => {})).status, 'error')
  chat.dispose()
  await assert.rejects(
    chat.send('after close', () => {}),
    /종료/
  )
})
