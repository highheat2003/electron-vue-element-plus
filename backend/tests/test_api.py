import pytest
from fastapi.testclient import TestClient

from app.main import create_app

TOKEN = "test-only-token-" + "x" * 48


@pytest.fixture
def client():
    with TestClient(create_app(TOKEN)) as client:
        yield client


def test_requires_authentication(client):
    for path in ["/health", "/api/hello"]:
        assert client.get(path).status_code == 401
        assert client.get(path, headers={"Authorization": "Bearer wrong"}).status_code == 401


def test_health(client):
    response = client.get("/health", headers={"Authorization": f"Bearer {TOKEN}"})
    assert response.status_code == 200
    assert response.json()["service"] == "desktop-python-backend"
    assert response.json()["status"] == "ok"
    assert response.json()["pid"] > 0


def test_hello_unicode_and_default(client):
    headers = {"Authorization": f"Bearer {TOKEN}"}
    response = client.get("/api/hello", params={"name": "  김하늘 & ?  "}, headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "김하늘 & ?"
    assert "김하늘 & ?님" in body["message"]
    assert body["python_version"]
    assert body["timestamp"].endswith("+00:00")
    assert client.get("/api/hello", headers=headers).json()["name"] == "개발자"


@pytest.mark.parametrize("name", ["", "   ", "x" * 51])
def test_validates_names(client, name):
    assert client.get("/api/hello", params={"name": name}, headers={"Authorization": f"Bearer {TOKEN}"}).status_code == 422


def test_no_public_docs_and_no_insecure_default_token(client):
    assert client.get("/docs").status_code == 404
    with pytest.raises(ValueError):
        create_app("")
