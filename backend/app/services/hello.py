import platform
from datetime import datetime, timezone

from app.schemas.hello import HelloResponse


def say_hello(name: str) -> HelloResponse:
    return HelloResponse(
        name=name,
        message=f"안녕하세요, {name}님! Python 백엔드에서 보내는 인사입니다.",
        timestamp=datetime.now(timezone.utc).isoformat(),
        python_version=platform.python_version(),
    )
