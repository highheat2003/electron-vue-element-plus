from typing import Literal
import re

from fastapi import APIRouter, HTTPException, Query

from app.schemas.stocks import StockHistory
from app.services.stocks import get_stock_history

router = APIRouter(prefix="/api/stocks", tags=["stocks"])


@router.get("/history", response_model=StockHistory)
def history(
    symbol: str = Query(default=""),
    interval: Literal["1d", "1wk", "1mo"] = "1d",
    years: int = Query(default=3),
) -> StockHistory:
    if years not in (3, 5, 10):
        raise HTTPException(status_code=422, detail="조회 기간은 3년, 5년, 10년 중 선택하세요.")
    symbol = symbol.strip().upper()
    if not symbol:
        raise HTTPException(status_code=422, detail="종목코드를 입력하세요.")
    if not re.fullmatch(r"[A-Z][A-Z0-9-]{0,19}", symbol):
        raise HTTPException(status_code=422, detail="올바른 미국 주식 ticker를 입력하세요. 예: AAPL, MSFT, BRK-B")
    # A synchronous route runs blocking yfinance requests in FastAPI's thread pool.
    return get_stock_history(symbol, interval, years)
