import type { PythonBackendProcess } from './process'
import type { BackendHelloResponse, BackendStatus, StockHistory } from '../../shared/api'

export class PythonBackendClient {
  private process: PythonBackendProcess
  constructor(process: PythonBackendProcess) {
    this.process = process
  }

  private async request(path: string, timeout = 5000): Promise<Record<string, unknown>> {
    const connection = await this.process.start()
    try {
      const response = await fetch(`${connection.url}${path}`, {
        headers: { Authorization: `Bearer ${connection.token}` },
        signal: AbortSignal.timeout(timeout)
      })
      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(
          typeof error?.detail === 'string'
            ? error.detail
            : `Python API 호출에 실패했습니다. (HTTP ${response.status})`
        )
      }
      const body: unknown = await response.json()
      if (!body || typeof body !== 'object' || Array.isArray(body))
        throw new Error('Python API 응답 형식이 올바르지 않습니다.')
      return body as Record<string, unknown>
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError')
        throw new Error('Python API 응답 시간이 초과되었습니다.', { cause: error })
      if (error instanceof TypeError)
        throw new Error('Python 백엔드에 연결하지 못했습니다. 연결 확인을 다시 눌러 주세요.', {
          cause: error
        })
      throw error
    }
  }

  async stockHistory(symbol: string, interval: string, years: number = 3): Promise<StockHistory> {
    if (typeof symbol === 'string' && !symbol.trim()) throw new Error('종목코드를 입력하세요.')
    if (typeof symbol !== 'string' || !/^[A-Z][A-Z0-9-]{0,19}$/.test(symbol.trim().toUpperCase()))
      throw new Error('올바른 미국 주식 ticker를 입력하세요. 예: AAPL, MSFT, BRK-B')
    if (!['1d', '1wk', '1mo'].includes(interval)) throw new Error('잘못된 조회 주기입니다.')
    if (![3, 5, 10].includes(years)) throw new Error('조회 기간은 3년, 5년, 10년 중 선택하세요.')
    const query = new URLSearchParams({
      symbol: symbol.trim().toUpperCase(),
      interval,
      years: String(years)
    })
    const body = await this.request(`/api/stocks/history?${query}`, 45000)
    if (
      body.symbol !== symbol.trim().toUpperCase() ||
      body.interval !== interval ||
      body.years !== years ||
      typeof body.start !== 'string' ||
      typeof body.end !== 'string' ||
      typeof body.fetchedAt !== 'string' ||
      !Array.isArray(body.candles) ||
      !body.candles.length
    )
      throw new Error('주가 응답 형식이 올바르지 않습니다.')
    let previous = ''
    for (const candle of body.candles) {
      if (
        !candle ||
        typeof candle.time !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(candle.time) ||
        candle.time <= previous ||
        !Number.isSafeInteger(candle.volume) ||
        candle.volume < 0 ||
        ![candle.open, candle.high, candle.low, candle.close].every(
          (value) => typeof value === 'number' && Number.isFinite(value) && value > 0
        ) ||
        candle.high < Math.max(candle.open, candle.close, candle.low) ||
        candle.low > Math.min(candle.open, candle.close, candle.high)
      )
        throw new Error('주가 캔들 데이터가 올바르지 않습니다.')
      previous = candle.time
    }
    return body as unknown as StockHistory
  }

  async status(): Promise<BackendStatus> {
    try {
      const body = await this.request('/health')
      if (
        body.status !== 'ok' ||
        body.service !== 'desktop-python-backend' ||
        typeof body.python_version !== 'string' ||
        typeof body.pid !== 'number'
      )
        throw new Error('Python 상태 응답이 올바르지 않습니다.')
      return {
        connected: true,
        pythonVersion: body.python_version,
        pid: body.pid,
        message: 'Python 백엔드에 연결되었습니다.'
      }
    } catch (error) {
      return {
        connected: false,
        message: error instanceof Error ? error.message : '백엔드 연결 확인에 실패했습니다.'
      }
    }
  }

  async hello(name: string): Promise<BackendHelloResponse> {
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 50)
      throw new Error('이름은 1~50자로 입력하세요.')
    const body = await this.request(`/api/hello?${new URLSearchParams({ name: name.trim() })}`)
    if (
      typeof body.name !== 'string' ||
      typeof body.message !== 'string' ||
      typeof body.timestamp !== 'string' ||
      !Number.isFinite(Date.parse(body.timestamp)) ||
      typeof body.python_version !== 'string'
    )
      throw new Error('Python hello 응답이 올바르지 않습니다.')
    return {
      name: body.name,
      message: body.message,
      timestamp: body.timestamp,
      pythonVersion: body.python_version
    }
  }
}
