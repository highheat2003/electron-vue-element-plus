from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from app.schemas.hello import HelloResponse
from app.services.hello import say_hello

router = APIRouter(prefix="/api", tags=["hello"])


@router.get("/hello", response_model=HelloResponse)
async def hello(name: Annotated[str, Query(min_length=1, max_length=50)] = "개발자"):
    name = name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="이름을 입력하세요.")
    return say_hello(name)
