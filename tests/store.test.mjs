import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { createStore } from '../src/main/database/store.ts'
import { getAndStoreExchangeRates } from '../src/main/exchange-rates.ts'

test('migrates version 1 and asynchronously saves latest rates without duplicates or overwrites', async () => {
  const root = mkdtempSync(join(tmpdir(), 'desktop-store-test-'))
  const path = join(root, 'store.sqlite')
  let store
  try {
    store = createStore(path)
    store.close()
    const old = new DatabaseSync(path)
    old.exec(
      "DROP TABLE t_exchange_rate; PRAGMA user_version = 1; UPDATE test_users SET name = '기존 데이터' WHERE id = 1;"
    )
    old.close()
    store = createStore(path)
    assert.equal(store.getExamples().rows[0].name, '기존 데이터')
    assert.deepEqual(store.getExchangeRateHistory(), [])
    const inspect = new DatabaseSync(path, { readOnly: true })
    try {
      assert.deepEqual(
        inspect
          .prepare('PRAGMA table_info(t_exchange_rate)')
          .all()
          .map((row) => row.name),
        ['exchange_type', 'rate_date', 'exchange_rate']
      )
      assert.equal(inspect.prepare('PRAGMA user_version').get().user_version, 2)
      let rate = 1345.9
      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      const fetcher = async (url) =>
        new Response(
          JSON.stringify(
            new URL(url).searchParams.has('from')
              ? [{ date: '2026-10-14', base: 'USD', quote: 'KRW', rate: 1340 }]
              : [{ date: '2026-10-15', base: 'USD', quote: 'KRW', rate }]
          )
        )
      await getAndStoreExchangeRates(store, fetcher)
      rate = 1400
      await getAndStoreExchangeRates(store, fetcher)
      const rows = inspect.prepare('SELECT * FROM t_exchange_rate').all()
      assert.equal(rows.length, 1)
      assert.equal(rows[0].exchange_type, 'USD/KRW')
      assert.equal(rows[0].rate_date, '2026-10-15')
      assert.equal(rows[0].exchange_rate, 1345.9)
      assert.equal(
        store.saveExchangeRateIfMissing('USD/KRW', { date: '2026-10-16', rate: 1346 }),
        true
      )
      assert.equal(
        store.saveExchangeRateIfMissing('EUR/KRW', { date: '2026-10-15', rate: 1500 }),
        true
      )
      assert.throws(() =>
        store.saveExchangeRateIfMissing('USD/KRW', { date: '2026-02-30', rate: 1 })
      )
      assert.throws(() =>
        store.saveExchangeRateIfMissing('USD/KRW', { date: '2026-10-16', rate: -1 })
      )
      await assert.rejects(
        getAndStoreExchangeRates(store, async () => new Response('', { status: 503 }))
      )
      assert.equal(inspect.prepare('SELECT COUNT(*) AS count FROM t_exchange_rate').get().count, 3)
      assert.deepEqual(store.getExchangeRateHistory(), [
        { exchangeType: 'USD/KRW', rateDate: '2026-10-16', exchangeRate: 1346 },
        { exchangeType: 'EUR/KRW', rateDate: '2026-10-15', exchangeRate: 1500 },
        { exchangeType: 'USD/KRW', rateDate: '2026-10-15', exchangeRate: 1345.9 }
      ])
    } finally {
      inspect.close()
    }
    store.close()
    store = createStore(path)
    assert.equal(
      store.saveExchangeRateIfMissing('USD/KRW', { date: '2026-10-15', rate: 999 }),
      false
    )
  } finally {
    store?.close()
    assert.ok(root.startsWith(join(tmpdir(), 'desktop-store-test-')))
    rmSync(root, { recursive: true, force: true })
  }
})

test('copies the bundled template once and preserves existing user data and original template', () => {
  const root = mkdtempSync(join(tmpdir(), 'desktop-store-test-'))
  const template = fileURLToPath(new URL('../resources/database/store.sqlite', import.meta.url))
  const originalBytes = readFileSync(template)
  const path = join(root, 'user-data', 'database', 'store.sqlite')
  let store
  try {
    store = createStore(path, template)
    assert.equal(store.getExamples().rows.length, 12)
    store.close()
    assert.deepEqual(readFileSync(path), originalBytes)
    const connection = new DatabaseSync(path)
    try {
      connection.prepare('UPDATE test_users SET name = ? WHERE id = 1').run('사용자 수정 데이터')
    } finally {
      connection.close()
    }
    store = createStore(path, template)
    assert.equal(store.getExamples().rows[0].name, '사용자 수정 데이터')
    store.close()
    // Existing databases don't depend on the bundled template after first launch.
    store = createStore(path, join(root, 'missing-template.sqlite'))
    assert.equal(store.getExamples().rows[0].name, '사용자 수정 데이터')
    assert.deepEqual(readFileSync(template), originalBytes)
    assert.throws(
      () => createStore(join(root, 'new', 'store.sqlite'), join(root, 'missing.sqlite')),
      /ENOENT/
    )
  } finally {
    store?.close()
    assert.ok(root.startsWith(join(tmpdir(), 'desktop-store-test-')))
    rmSync(root, { recursive: true, force: true })
  }
})

test('creates a real SQLite store, seeds 12 rows once, and preserves edited data on reopen', () => {
  const root = mkdtempSync(join(tmpdir(), 'desktop-store-test-'))
  const path = join(root, 'database', 'store.sqlite')
  let store
  try {
    store = createStore(path)
    const first = store.getExamples()
    assert.equal(first.path, path)
    assert.equal(first.table, 'test_users')
    assert.equal(first.rows.length, 12)
    assert.equal(first.rows[0].name, '김하늘')
    assert.equal(first.rows.filter((row) => row.status === 'inactive').length, 3)
    assert.equal(new Set(first.rows.map((row) => row.code)).size, 12)
    assert.ok(first.rows.every((row) => Number.isFinite(Date.parse(row.createdAt))))
    store.close()
    assert.equal(readFileSync(path).subarray(0, 16).toString(), 'SQLite format 3\0')

    store = createStore(path)
    assert.deepEqual(store.getExamples().rows, first.rows)
    store.close()

    const connection = new DatabaseSync(path)
    try {
      connection
        .prepare('UPDATE test_users SET name = ? WHERE code = ?')
        .run('수정된 이름', 'USER001')
      connection.prepare('DELETE FROM test_users WHERE code = ?').run('USER012')
      assert.throws(() =>
        connection
          .prepare('UPDATE test_users SET status = ? WHERE code = ?')
          .run('invalid', 'USER001')
      )
    } finally {
      connection.close()
    }
    store = createStore(path)
    assert.equal(store.getExamples().rows.length, 11)
    assert.equal(store.getExamples().rows[0].name, '수정된 이름')
    store.close()
    store.close()
  } finally {
    store?.close()
    assert.ok(root.startsWith(join(tmpdir(), 'desktop-store-test-')))
    rmSync(root, { recursive: true, force: true })
  }
})
