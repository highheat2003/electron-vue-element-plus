import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseRates, getExchangeRates } from '../src/main/exchange-rates.ts'

test('validates USD/KRW direction, positive finite rates, dates, sorts and deduplicates', () => {
  const rows = [
    { date: '2026-10-15', base: 'USD', quote: 'KRW', rate: 1345.9 },
    { date: '2026-10-14', base: 'USD', quote: 'KRW', rate: 1340 },
    { date: '2026-10-15', base: 'USD', quote: 'KRW', rate: 1346 }
  ]
  assert.deepEqual(parseRates(rows), [
    { date: '2026-10-14', rate: 1340 },
    { date: '2026-10-15', rate: 1346 }
  ])
  for (const invalid of [
    [],
    {},
    [{ ...rows[0], base: 'KRW' }],
    [{ ...rows[0], rate: 0 }],
    [{ ...rows[0], rate: Infinity }],
    [{ ...rows[0], date: '2026-02-30' }]
  ]) {
    assert.throws(() => parseRates(invalid))
  }
})

test('requests one year relative to latest publication and merges latest point', async () => {
  const urls = []
  const fixtures = [
    [{ date: '2026-10-15', base: 'USD', quote: 'KRW', rate: 1345.9 }],
    [{ date: '2026-10-14', base: 'USD', quote: 'KRW', rate: 1340 }]
  ]
  const result = await getExchangeRates(async (url) => {
    urls.push(new URL(url))
    return new Response(JSON.stringify(fixtures.shift()))
  })
  assert.equal(urls[0].searchParams.get('base'), 'USD')
  assert.equal(urls[0].searchParams.get('quotes'), 'KRW')
  assert.equal(urls[1].searchParams.get('to'), '2026-10-15')
  assert.equal(urls[1].searchParams.get('from'), '2025-10-14')
  assert.equal(result.points.length, 2)
  assert.equal(result.points.at(-1).rate, 1345.9)
  assert.ok(Number.isFinite(Date.parse(result.fetchedAt)))
})

test('reports HTTP, network, timeout, and insufficient data errors', async () => {
  await assert.rejects(
    getExchangeRates(async () => new Response('', { status: 503 })),
    /HTTP 503/
  )
  await assert.rejects(
    getExchangeRates(async () => {
      throw new TypeError('fetch failed')
    }),
    /인터넷/
  )
  await assert.rejects(
    getExchangeRates(async () => {
      throw new DOMException('timeout', 'TimeoutError')
    }),
    /초과/
  )
  await assert.rejects(
    getExchangeRates(
      async () =>
        new Response(
          JSON.stringify([{ date: '2026-10-15', base: 'USD', quote: 'KRW', rate: 1345.9 }])
        )
    ),
    /부족/
  )
})
