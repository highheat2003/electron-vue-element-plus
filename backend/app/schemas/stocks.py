from typing import Literal

from pydantic import BaseModel, Field


class StockCandle(BaseModel):
    time: str
    open: float
    high: float
    low: float
    close: float
    volume: int = Field(ge=0)


class StockHistory(BaseModel):
    symbol: str
    interval: Literal["1d", "1wk", "1mo"]
    years: Literal[3, 5, 10]
    start: str
    end: str
    fetchedAt: str
    candles: list[StockCandle]
