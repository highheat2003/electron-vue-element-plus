import os
import platform
import secrets
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.routers.hello import router
from app.routers.stocks import router as stocks_router
from app.schemas.hello import HealthResponse


def create_app(token: str) -> FastAPI:
    if len(token) < 32:
        raise ValueError("Backend token must be at least 32 characters")
    bearer = HTTPBearer(auto_error=False)

    async def authorize(
        credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    ) -> None:
        if credentials is None or not secrets.compare_digest(
            credentials.credentials.encode(), token.encode()
        ):
            raise HTTPException(status_code=401, detail="Unauthorized")

    app = FastAPI(
        title="Desktop Python Backend",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        dependencies=[Depends(authorize)],
    )
    app.include_router(router)
    app.include_router(stocks_router)

    @app.get("/health", response_model=HealthResponse)
    async def health():
        return HealthResponse(
            status="ok",
            service="desktop-python-backend",
            python_version=platform.python_version(),
            pid=os.getpid(),
        )

    return app
