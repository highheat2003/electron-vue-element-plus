import type { ExchangeRatePoint, ExchangeRates } from '../shared/api'
import type { Store } from './database/store'

const endpoint = 'https://api.frankfurter.dev/v2/providers/ecb/rates'

export async function getAndStoreExchangeRates(
  store: Pick<Store, 'saveExchangeRateIfMissing'>,
  fetcher = fetch
): Promise<ExchangeRates> {
  const result = await getExchangeRates(fetcher)
  const latest = result.points.at(-1)!
  store.saveExchangeRateIfMissing(`${result.base}/${result.quote}`, latest)
  return result
}

export function parseRates(value: unknown): ExchangeRatePoint[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('환율 데이터가 없습니다.')
  const points = new Map<string, ExchangeRatePoint>()
  for (const row of value) {
    if (
      !row ||
      row.base !== 'USD' ||
      row.quote !== 'KRW' ||
      typeof row.date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
      !Number.isFinite(Date.parse(row.date)) ||
      new Date(row.date).toISOString().slice(0, 10) !== row.date ||
      typeof row.rate !== 'number' ||
      !Number.isFinite(row.rate) ||
      row.rate <= 0
    )
      throw new Error('환율 데이터 형식이 올바르지 않습니다.')
    points.set(row.date, { date: row.date, rate: row.rate })
  }
  return [...points.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export async function getExchangeRates(fetcher = fetch): Promise<ExchangeRates> {
  async function request(params: URLSearchParams): Promise<ExchangeRatePoint[]> {
    const response = await fetcher(`${endpoint}?${params}`, { signal: AbortSignal.timeout(20_000) })
    if (!response.ok) throw new Error(`환율 조회에 실패했습니다. (HTTP ${response.status})`)
    return parseRates(await response.json())
  }
  try {
    const latest = (await request(new URLSearchParams({ base: 'USD', quotes: 'KRW' }))).at(-1)!
    const start = new Date(`${latest.date}T00:00:00Z`)
    start.setUTCDate(start.getUTCDate() - 366)
    const history = await request(
      new URLSearchParams({
        base: 'USD',
        quotes: 'KRW',
        from: start.toISOString().slice(0, 10),
        to: latest.date
      })
    )
    const points = [
      ...new Map([...history, latest].map((point) => [point.date, point])).values()
    ].sort((a, b) => a.date.localeCompare(b.date))
    if (points.length < 2) throw new Error('환율 추이를 표시할 데이터가 부족합니다.')
    return { base: 'USD', quote: 'KRW', points, fetchedAt: new Date().toISOString() }
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new Error('환율 조회 시간이 초과되었습니다. 다시 시도해 주세요.', { cause: error })
    }
    if (error instanceof TypeError)
      throw new Error('환율 서버에 연결하지 못했습니다. 인터넷 연결을 확인하세요.', {
        cause: error
      })
    throw error
  }
}
