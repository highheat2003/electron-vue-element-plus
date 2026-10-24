import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PythonBackendProcess } from '../src/main/python/process.ts'
import { PythonBackendClient } from '../src/main/python/client.ts'

const root = fileURLToPath(new URL('../backend', import.meta.url))
const binary = process.env.PYTHON_BACKEND_TEST_EXECUTABLE
const launch = {
  command:
    binary ??
    join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'),
  args: binary ? [] : ['-m', 'app'],
  cwd: binary ? dirname(binary) : root
}

test(
  'starts real FastAPI, shares startup, authenticates, calls hello and shuts down',
  { timeout: 25000 },
  async (t) => {
    const backend = new PythonBackendProcess(launch)
    t.after(() => backend.stop())
    const [first, second] = await Promise.all([backend.start(), backend.start()])
    assert.equal(first.url, second.url)
    assert.equal(first.token, second.token)
    assert.ok(first.url.startsWith('http://127.0.0.1:'))
    const client = new PythonBackendClient(backend)
    const status = await client.status()
    assert.equal(status.connected, true)
    assert.ok(status.pid > 0)
    const response = await client.hello('  김하늘 & ?  ')
    assert.equal(response.name, '김하늘 & ?')
    assert.ok(response.message.includes('김하늘 & ?님'))
    assert.ok(Number.isFinite(Date.parse(response.timestamp)))
    assert.equal((await fetch(`${first.url}/health`)).status, 401)
    assert.equal(
      (await fetch(`${first.url}/api/hello`, { headers: { Authorization: 'Bearer wrong' } }))
        .status,
      401
    )
    await assert.rejects(client.hello(' '), /이름/)
    await assert.rejects(client.hello('x'.repeat(51)), /이름/)
    await backend.stop()
    await assert.rejects(fetch(`${first.url}/health`, { signal: AbortSignal.timeout(1000) }))
    await assert.rejects(backend.start(), /종료/)
  }
)

test(
  'multiple instances get different ports and independent authentication',
  { timeout: 25000 },
  async (t) => {
    const first = new PythonBackendProcess(launch)
    const second = new PythonBackendProcess(launch)
    t.after(async () => {
      await Promise.all([first.stop(), second.stop()])
    })
    const [a, b] = await Promise.all([first.start(), second.start()])
    assert.notEqual(a.url, b.url)
    assert.notEqual(a.token, b.token)
    assert.equal(
      (await fetch(`${a.url}/health`, { headers: { Authorization: `Bearer ${b.token}` } })).status,
      401
    )
  }
)

test(
  'startup failures are reported without crashing the application',
  { timeout: 10000 },
  async (t) => {
    const backend = new PythonBackendProcess({
      command: 'missing-python-backend-executable',
      args: [],
      cwd: root
    })
    t.after(() => backend.stop())
    const status = await new PythonBackendClient(backend).status()
    assert.equal(status.connected, false)
    assert.match(status.message, /backend:setup/)
  }
)
