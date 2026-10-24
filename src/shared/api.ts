export interface AppInfo {
  version: string
  platform: string
  electron: string
  chrome: string
  node: string
}
export interface DesktopApi {
  getStockHistory: (
    symbol: string,
    interval: StockInterval,
    years?: StockYears
  ) => Promise<StockHistory>
  getBackendStatus: () => Promise<BackendStatus>
  getBackendHello: (name: string) => Promise<BackendHelloResponse>
  getAppInfo: () => Promise<AppInfo>
  getDatabaseExamples: () => Promise<DatabaseExampleData>
  getExchangeRates: () => Promise<ExchangeRates>
  getExchangeRateHistory: () => Promise<ExchangeRateHistoryRow[]>
  openExternalLink: (url: string) => Promise<void>
  getChatStatus: () => Promise<ChatStatus>
  sendChat: (request: ChatRequest) => Promise<ChatResult>
  cancelChat: () => Promise<void>
  resetChat: () => Promise<void>
  onChatEvent: (listener: (event: ChatEvent) => void) => () => void
  getSdkChatStatus: () => Promise<ChatStatus>
  sendSdkChat: (request: ChatRequest) => Promise<ChatResult>
  cancelSdkChat: () => Promise<void>
  resetSdkChat: () => Promise<void>
  onSdkChatEvent: (listener: (event: ChatEvent) => void) => () => void
}

export interface ChatStatus {
  available: boolean
  authenticated: boolean
  version?: string
  message: string
}

export interface ChatRequest {
  requestId: string
  prompt: string
}

export type ChatEvent =
  | { requestId: string; type: 'status'; text: string }
  | { requestId: string; type: 'message'; id: string; text: string }

export interface ChatResult {
  status: 'completed' | 'cancelled' | 'error'
  error?: string
}

export interface ExchangeRatePoint {
  date: string
  rate: number
}

export interface ExchangeRateHistoryRow {
  exchangeType: string
  rateDate: string
  exchangeRate: number
}

export interface ExchangeRates {
  base: 'USD'
  quote: 'KRW'
  points: ExchangeRatePoint[]
  fetchedAt: string
}

export interface DatabaseExampleRow {
  id: number
  code: string
  name: string
  email: string
  department: string
  status: 'active' | 'inactive'
  createdAt: string
}

export interface DatabaseExampleData {
  path: string
  table: 'test_users'
  rows: DatabaseExampleRow[]
}

export interface BackendStatus {
  connected: boolean
  message: string
  pythonVersion?: string
  pid?: number
}

export interface BackendHelloResponse {
  name: string
  message: string
  timestamp: string
  pythonVersion: string
}

export type StockInterval = '1d' | '1wk' | '1mo'
export type StockYears = 3 | 5 | 10

export interface StockCandle {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface StockHistory {
  symbol: string
  interval: StockInterval
  years: StockYears
  start: string
  end: string
  fetchedAt: string
  candles: StockCandle[]
}
