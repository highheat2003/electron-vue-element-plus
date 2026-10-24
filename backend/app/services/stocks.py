import calendar
import math
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import yfinance as yf
from fastapi import HTTPException
from yfinance.exceptions import YFTickerMissingError

from app.schemas.stocks import StockCandle, StockHistory


def get_stock_history(symbol: str, interval: str, years: int = 3) -> StockHistory:
    today = datetime.now(ZoneInfo("America/New_York")).date()
    year = today.year - years
    start = today.replace(year=year, day=min(today.day, calendar.monthrange(year, today.month)[1]))
    try:
        frame = yf.Ticker(symbol).history(
            start=start.isoformat(),
            end=(today + timedelta(days=1)).isoformat(),
            interval=interval,
            auto_adjust=True,
            actions=False,
            timeout=15,
            raise_errors=True,
        )
    except YFTickerMissingError as error:
        raise HTTPException(
            status_code=404,
            detail="종목을 찾을 수 없거나 조회 가능한 데이터가 없습니다.",
        ) from error
    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail="주가 조회에 실패했습니다. 네트워크 연결 또는 데이터 제공처 상태를 확인한 뒤 다시 시도하세요.",
        ) from error

    # Chart times must be unique and sorted, with finite, valid OHLC values.
    candles: dict[str, StockCandle] = {}
    for index, row in frame.iterrows():
        values = [float(row[key]) for key in ("Open", "High", "Low", "Close")]
        if not all(math.isfinite(value) and value > 0 for value in values):
            continue
        opening, high, low, close = values
        volume = float(row["Volume"])
        if not math.isfinite(volume) or volume < 0 or not volume.is_integer():
            continue
        if high < max(opening, close, low) or low > min(opening, close, high):
            continue
        day = index.date()
        if day > today:
            continue
        candles[day.isoformat()] = StockCandle(
            time=day.isoformat(), open=opening, high=high, low=low, close=close,
            volume=int(volume),
        )
    if not candles:
        raise HTTPException(status_code=404, detail="종목을 찾을 수 없거나 조회 가능한 데이터가 없습니다.")
    return StockHistory(
        symbol=symbol,
        interval=interval,
        years=years,
        start=start.isoformat(),
        end=today.isoformat(),
        fetchedAt=datetime.now(timezone.utc).isoformat(),
        candles=[candles[day] for day in sorted(candles)],
    )
