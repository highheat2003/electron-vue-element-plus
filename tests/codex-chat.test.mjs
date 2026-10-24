import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CodexChat, resolveCodexLaunch } from '../src/main/codex-chat.ts'

const fixture = fileURLToPath(new URL('./fixtures/codex-cli.mjs', import.meta.url))
// JavaScript fixture helper intentionally has no TypeScript return annotation.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const launch = (mode = '') => ({
  command: process.execPath,
  args: [fixture],
  env: { ...process.env, CHAT_TEST_MODE: mode }
})

test(
  'Windows npm installations launch the native binary instead of the console-opening JS wrapper',
  { skip: process.platform !== 'win32' },
  () => {
    const root = mkdtempSync(join(tmpdir(), 'codex-chat-launch-'))
    try {
      const packageRoot = join(root, 'node_modules', '@openai', 'codex')
      mkdirSync(join(packageRoot, 'bin'), { recursive: true })
      writeFileSync(
        join(packageRoot, 'bin', 'codex.js'),
        'throw new Error("JS wrapper must not run")'
      )
      const nativePackage = join(
        packageRoot,
        'node_modules',
        '@openai',
        `codex-win32-${process.arch}`
      )
      const target = process.arch === 'arm64' ? 'aarch64' : 'x86_64'
      const binaryDirectory = join(nativePackage, 'vendor', `${target}-pc-windows-msvc`, 'bin')
      mkdirSync(binaryDirectory, { recursive: true })
      writeFileSync(join(nativePackage, 'package.json'), '{}')
      const binary = join(binaryDirectory, 'codex.exe')
      writeFileSync(binary, '')
      const resolved = resolveCodexLaunch([root])
      assert.equal(resolved.command, binary)
      assert.deepEqual(resolved.args, [])
      assert.equal(resolved.env.CODEX_MANAGED_PACKAGE_ROOT, packageRoot)
      rmSync(binary)
      assert.throws(() => resolveCodexLaunch([root]), /실행 파일/)
      const legacyRoot = join(root, 'legacy')
      const legacyPackage = join(legacyRoot, 'node_modules', '@openai', 'codex')
      mkdirSync(join(legacyPackage, 'bin'), { recursive: true })
      writeFileSync(join(legacyPackage, 'bin', 'codex.js'), '')
      const legacyDirectory = join(legacyPackage, 'vendor', `${target}-pc-windows-msvc`, 'bin')
      mkdirSync(legacyDirectory, { recursive: true })
      writeFileSync(join(legacyDirectory, 'codex.exe'), '')
      assert.equal(resolveCodexLaunch([legacyRoot]).command, join(legacyDirectory, 'codex.exe'))
    } finally {
      assert.ok(root.startsWith(join(tmpdir(), 'codex-chat-launch-')))
      rmSync(root, { recursive: true, force: true })
    }
  }
)

test('Unicode stdin, JSONL buffering, session resume, and reset', async () => {
  const chat = new CodexChat()
  const events = []
  const prompt = '한글 줄바꿈\n"quotes" & $(literal) --help'
  assert.equal(
    (await chat.send(prompt, (event) => events.push(event), launch())).status,
    'completed'
  )
  const answer = JSON.parse(events.find((event) => event.type === 'message').text)
  assert.equal(answer.prompt, prompt)
  assert.ok(!answer.args.includes(prompt))
  assert.ok(answer.args.includes('read-only'))
  assert.ok(!answer.args.includes('resume'))
  assert.equal(answer.args.at(-1), '-')

  const resumed = []
  await chat.send('next', (event) => resumed.push(event), launch())
  const resumeArgs = JSON.parse(resumed.find((event) => event.type === 'message').text).args
  assert.deepEqual(resumeArgs.slice(-3), ['resume', 'fixture-thread', '-'])

  chat.reset()
  const reset = []
  await chat.send('new', (event) => reset.push(event), launch())
  assert.ok(
    !JSON.parse(reset.find((event) => event.type === 'message').text).args.includes('resume')
  )
})

test('CLI failure and missing response produce errors', async () => {
  const chat = new CodexChat()
  const failure = await chat.send('test', () => {}, launch('failure'))
  assert.equal(failure.status, 'error')
  assert.equal(failure.error, '로그인이 필요합니다.')
  assert.equal((await chat.send('test', () => {}, launch('empty'))).status, 'error')
})

test('cancellation rejects concurrent sends/reset and permits subsequent sends', async () => {
  const chat = new CodexChat()
  let started
  const ready = new Promise((resolve) => {
    started = resolve
  })
  const pending = chat.send('test', () => started(), launch('hang'))
  await ready
  assert.throws(() => chat.reset(), /응답/)
  await assert.rejects(
    chat.send('second', () => {}, launch()),
    /이미/
  )
  chat.cancel()
  assert.equal((await pending).status, 'cancelled')
  assert.equal((await chat.send('again', () => {}, launch())).status, 'completed')
})

test('timeout terminates CLI and returns error', async () => {
  const chat = new CodexChat()
  const result = await chat.send('test', () => {}, launch('hang'), process.cwd(), 500)
  assert.equal(result.status, 'error')
  assert.match(result.error, /초과/)
})

test('invalid prompts and missing executable are handled', async () => {
  const chat = new CodexChat()
  await assert.rejects(
    chat.send(' ', () => {}, launch()),
    /메시지/
  )
  await assert.rejects(
    chat.send('x'.repeat(32001), () => {}, launch()),
    /메시지/
  )
  assert.equal(
    (await chat.send('test', () => {}, { command: 'missing-codex-fixture-executable', args: [] }))
      .status,
    'error'
  )
})
