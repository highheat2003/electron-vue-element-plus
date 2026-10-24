from datetime import datetime
from unittest.mock import Mock
from zoneinfo import ZoneInfo

import pandas as pd
import pytest
from fastapi.testclient import TestClient
from yfinance.exceptions import YFPricesMissingError, YFTzMissingError

from app.main import create_app
from app.services import stocks

TOKEN = "stock-test-" + "x" * 48
HEADERS = {"Authorization": f"Bearer {TOKEN}"}


@pytest.fixture
def client():
    with TestClient(create_app(TOKEN)) as client:
        yield client


def mock_ticker(monkeypatch, frame):
    ticker = Mock()
    ticker.history.return_value = frame
    factory = Mock(return_value=ticker)
    monkeypatch.setattr(stocks.yf, "Ticker", factory)
    return ticker, factory


@pytest.mark.parametrize("interval", [None, "1d", "1wk", "1mo"])
@pytest.mark.parametrize("years", [None, 3, 5, 10])
def test_history_intervals_dates_and_candle_cleanup(client, monkeypatch, interval, years):
    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(2024, 2, 29, 12, tzinfo=tz)

    monkeypatch.setattr(stocks, "datetime", FrozenDateTime)
    frame = pd.DataFrame(
        {"Open": [10, 12, 11, float("nan"), 15], "High": [12, 15, 14, 15, 10],
         "Low": [9, 10, 10, 10, 8], "Close": [11, 14, 12, 12, 9],
         "Volume": [100, 200, 0, 400, 500]},
        index=pd.to_datetime(["2024-02-28", "2024-02-29", "2024-02-28", "2024-02-27", "2024-02-26"]).tz_localize(ZoneInfo("America/New_York")),
    )
    ticker, factory = mock_ticker(monkeypatch, frame)
    params = {"symbol": "aapl"}
    if interval:
        params["interval"] = interval
    if years is not None:
        params["years"] = years
    response = client.get("/api/stocks/history", params=params, headers=HEADERS)
    assert response.status_code == 200
    body = response.json()
    assert body["symbol"] == "AAPL"
    assert body["interval"] == (interval or "1d")
    expected_start = f"{2024 - (years or 3)}-02-28"
    assert body["years"] == (years or 3)
    assert body["start"] == expected_start
    assert body["end"] == "2024-02-29"
    assert [candle["time"] for candle in body["candles"]] == ["2024-02-28", "2024-02-29"]
    assert body["candles"][0]["open"] == 11
    assert [candle["volume"] for candle in body["candles"]] == [0, 200]
    factory.assert_called_once_with("AAPL")
    args = ticker.history.call_args.kwargs
    assert args["start"] == expected_start
    assert args["end"] == "2024-03-01"  # yfinance end is exclusive
    assert args["interval"] == (interval or "1d")


@pytest.mark.parametrize("volume", [float("nan"), float("inf"), -1, 1.5])
def test_invalid_volume_is_not_returned(client, monkeypatch, volume):
    frame = pd.DataFrame(
        {"Open": [10, 10], "High": [12, 12], "Low": [9, 9], "Close": [11, 11],
         "Volume": [volume, 123456789]},
        index=pd.to_datetime(["2024-02-28", "2024-02-29"]),
    )
    mock_ticker(monkeypatch, frame)
    response = client.get("/api/stocks/history?symbol=AAPL", headers=HEADERS)
    assert response.status_code == 200
    assert len(response.json()["candles"]) == 1
    assert response.json()["candles"][0]["volume"] == 123456789


def test_history_errors(client, monkeypatch):
    ticker, _ = mock_ticker(monkeypatch, pd.DataFrame())
    response = client.get("/api/stocks/history?symbol=AAPL", headers=HEADERS)
    assert response.status_code == 404
    assert response.json()["detail"] == "종목을 찾을 수 없거나 조회 가능한 데이터가 없습니다."
    for error in [YFPricesMissingError("UNKNOWN", ""), YFTzMissingError("UNKNOWN")]:
        ticker.history.side_effect = error
        response = client.get("/api/stocks/history?symbol=UNKNOWN", headers=HEADERS)
        assert response.status_code == 404
        assert response.json()["detail"] == "종목을 찾을 수 없거나 조회 가능한 데이터가 없습니다."
    ticker.history.side_effect = RuntimeError("private provider error")
    response = client.get("/api/stocks/history?symbol=AAPL", headers=HEADERS)
    assert response.status_code == 502
    assert "네트워크 연결 또는 데이터 제공처 상태" in response.json()["detail"]
    assert "private provider error" not in response.text


@pytest.mark.parametrize("symbol, message", [
    ("", "종목코드를 입력하세요."),
    ("   ", "종목코드를 입력하세요."),
    ("AAPL!", "올바른 미국 주식 ticker를 입력하세요."),
    ("005930.KS", "올바른 미국 주식 ticker를 입력하세요."),
])
def test_symbol_error_messages(client, monkeypatch, symbol, message):
    _, factory = mock_ticker(monkeypatch, pd.DataFrame())
    response = client.get("/api/stocks/history", params={"symbol": symbol}, headers=HEADERS)
    assert response.status_code == 422
    assert response.json()["detail"].startswith(message)
    factory.assert_not_called()


def test_history_auth_and_validation(client, monkeypatch):
    _, factory = mock_ticker(monkeypatch, pd.DataFrame())
    assert client.get("/api/stocks/history?symbol=AAPL").status_code == 401
    for query in ["symbol=", "symbol=../secret", "symbol=AAPL&interval=1m", "symbol=005930.KS",
                  "symbol=AAPL&years=0", "symbol=AAPL&years=2", "symbol=AAPL&years=100",
                  "symbol=AAPL&years=3.5", "symbol=AAPL&years=invalid"]:
        assert client.get(f"/api/stocks/history?{query}", headers=HEADERS).status_code == 422
    factory.assert_not_called()
