from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers.auth import router as auth_router


def test_refresh_endpoint_rotates_platform_refresh_token(monkeypatch) -> None:
    class FakeStore:
        def __init__(self) -> None:
            self.saved = []
            self.deleted = []

        def get_refresh_token(self, token: str):
            if token == "old-refresh":
                return {"email": "user@example.com", "scope": "platform"}
            return None

        def set_refresh_token(self, token: str, data: dict, ttl: int = 0) -> None:
            self.saved.append((token, data, ttl))

        def delete_refresh_token(self, token: str) -> None:
            self.deleted.append(token)

    fake_store = FakeStore()
    monkeypatch.setattr("app.routers.auth.session_store", fake_store)

    app = FastAPI()
    app.include_router(auth_router)
    client = TestClient(app)

    response = client.post("/auth/refresh", json={"refresh_token": "old-refresh"})

    assert response.status_code == 200
    body = response.json()
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["expires_in"] == 30 * 60
    assert fake_store.deleted == ["old-refresh"]
    assert fake_store.saved[0][1] == {"email": "user@example.com", "scope": "platform"}
