from pydantic import BaseModel


class HelloResponse(BaseModel):
    name: str
    message: str
    timestamp: str
    python_version: str


class HealthResponse(BaseModel):
    status: str
    service: str
    python_version: str
    pid: int
