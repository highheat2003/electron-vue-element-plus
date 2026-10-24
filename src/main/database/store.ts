import { constants, copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type {
  DatabaseExampleData,
  DatabaseExampleRow,
  ExchangeRatePoint,
  ExchangeRateHistoryRow
} from '../../shared/api'

export interface Store {
  getExamples: () => DatabaseExampleData
  getExchangeRateHistory: () => ExchangeRateHistoryRow[]
  saveExchangeRateIfMissing: (exchangeType: string, point: ExchangeRatePoint) => boolean
  close: () => void
}

export function createStore(path: string, templatePath?: string): Store {
  mkdirSync(dirname(path), { recursive: true })
  if (templatePath && !existsSync(path)) {
    try {
      copyFileSync(templatePath, path, constants.COPYFILE_EXCL)
    } catch (error) {
      // Another app instance may have created the user DB in the meantime.
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
  }
  const database = new DatabaseSync(path, { timeout: 5000 })
  try {
    database.exec('PRAGMA foreign_keys = ON;')
    const version = Number(database.prepare('PRAGMA user_version').get()?.user_version)
    if (version === 0) {
      database.exec('BEGIN IMMEDIATE')
      try {
        database.exec(`
          CREATE TABLE IF NOT EXISTS test_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            department TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
          ) STRICT;
        `)
        const insert = database.prepare(`
          INSERT INTO test_users (code, name, email, department, status)
          VALUES (?, ?, ?, ?, ?) ON CONFLICT(code) DO NOTHING
        `)
        const names = [
          '김하늘',
          '이서준',
          '박지우',
          '최민서',
          '정도윤',
          '강서연',
          '조유진',
          '윤시우',
          '장수빈',
          '임지호',
          '한예린',
          '오현우'
        ]
        const departments = ['개발팀', '기획팀', '디자인팀', '운영팀']
        names.forEach((name, index) => {
          insert.run(
            `USER${String(index + 1).padStart(3, '0')}`,
            name,
            `user${index + 1}@example.com`,
            departments[index % departments.length],
            index % 4 === 3 ? 'inactive' : 'active'
          )
        })
        database.exec('PRAGMA user_version = 1; COMMIT;')
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
    } else if (version !== 1 && version !== 2) {
      throw new Error(`지원하지 않는 데이터베이스 버전입니다: ${version}`)
    }
    if (version < 2) {
      database.exec('BEGIN IMMEDIATE')
      try {
        database.exec(`
          CREATE TABLE IF NOT EXISTS t_exchange_rate (
            exchange_type TEXT NOT NULL,
            rate_date TEXT NOT NULL,
            exchange_rate REAL NOT NULL CHECK (exchange_rate > 0),
            PRIMARY KEY (exchange_type, rate_date)
          ) STRICT;
          PRAGMA user_version = 2;
          COMMIT;
        `)
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
    }
  } catch (error) {
    database.close()
    throw error
  }

  return {
    getExchangeRateHistory: () =>
      database
        .prepare(
          `
      SELECT exchange_type AS exchangeType, rate_date AS rateDate, exchange_rate AS exchangeRate
      FROM t_exchange_rate ORDER BY rate_date DESC, exchange_type ASC
    `
        )
        .all()
        .map((row) => ({
          exchangeType: String(row.exchangeType),
          rateDate: String(row.rateDate),
          exchangeRate: Number(row.exchangeRate)
        })),
    saveExchangeRateIfMissing: (exchangeType, point) => {
      if (
        !/^[A-Z]{3}\/[A-Z]{3}$/.test(exchangeType) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(point.date) ||
        !Number.isFinite(Date.parse(point.date)) ||
        new Date(point.date).toISOString().slice(0, 10) !== point.date ||
        !Number.isFinite(point.rate) ||
        point.rate <= 0
      )
        throw new Error('저장할 환율 데이터가 올바르지 않습니다.')
      const result = database
        .prepare(
          `
        INSERT INTO t_exchange_rate (exchange_type, rate_date, exchange_rate)
        VALUES (?, ?, ?) ON CONFLICT(exchange_type, rate_date) DO NOTHING
      `
        )
        .run(exchangeType, point.date, point.rate)
      return Number(result.changes) > 0
    },
    getExamples: () => {
      const rows: DatabaseExampleRow[] = database
        .prepare(
          `
        SELECT id, code, name, email, department, status, created_at AS createdAt
        FROM test_users ORDER BY id
      `
        )
        .all()
        .map((row) => ({
          id: Number(row.id),
          code: String(row.code),
          name: String(row.name),
          email: String(row.email),
          department: String(row.department),
          status: row.status === 'active' ? 'active' : 'inactive',
          createdAt: String(row.createdAt)
        }))
      return { path, table: 'test_users', rows }
    },
    close: () => {
      if (database.isOpen) database.close()
    }
  }
}
