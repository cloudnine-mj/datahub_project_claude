from __future__ import annotations

from importlib import import_module

from fastapi import FastAPI
from fastapi import HTTPException
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

rate_limit_module = import_module("app.services.rate_limit")
clear_rate_limits = rate_limit_module.clear_rate_limits
enforce_rate_limit = rate_limit_module.enforce_rate_limit


def test_rate_limit_blocks_repeated_session_requests(monkeypatch) -> None:
    app = FastAPI()
    clear_rate_limits()

    @app.middleware("http")
    async def limiter(request, call_next):
        try:
            enforce_rate_limit(request)
        except HTTPException as exc:
            return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
        return await call_next(request)

    @app.post("/api/v1/auth/session")
    def create_session():
        return {"ok": True}

    monkeypatch.setattr("app.services.rate_limit.settings.rate_limit_session_requests", 2)
    monkeypatch.setattr("app.services.rate_limit.settings.rate_limit_window_seconds", 60)

    client = TestClient(app)
    headers = {"Authorization": "Bearer token-a"}

    assert client.post("/api/v1/auth/session", headers=headers).status_code == 200
    assert client.post("/api/v1/auth/session", headers=headers).status_code == 200
    assert client.post("/api/v1/auth/session", headers=headers).status_code == 429


def test_rate_limit_isolated_per_identity(monkeypatch) -> None:
    app = FastAPI()
    clear_rate_limits()

    @app.middleware("http")
    async def limiter(request, call_next):
        try:
            enforce_rate_limit(request)
        except HTTPException as exc:
            return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
        return await call_next(request)

    @app.post("/api/v1/auth/session")
    def create_session():
        return {"ok": True}

    monkeypatch.setattr("app.services.rate_limit.settings.rate_limit_session_requests", 1)
    monkeypatch.setattr("app.services.rate_limit.settings.rate_limit_window_seconds", 60)

    client = TestClient(app)
    assert client.post("/api/v1/auth/session", headers={"Authorization": "Bearer token-a"}).status_code == 200
    assert client.post("/api/v1/auth/session", headers={"Authorization": "Bearer token-b"}).status_code == 200


def test_in_memory_rate_limit_store_prunes_expired_keys() -> None:
    store = rate_limit_module._InMemoryStore()

    assert store.allow("session:auth:a", now=1.0, window_seconds=10, limit=1) is True
    assert "session:auth:a" in store._windows
    assert store.allow("session:auth:b", now=25.0, window_seconds=10, limit=1) is True
    assert "session:auth:a" not in store._windows


def test_transfer_rate_limit_scope_includes_confirm_and_delete_routes() -> None:
    assert rate_limit_module._scope_for_path("/api/v1/repos/{owner}/{repo}/files/confirm") == ("transfer", 120)
    assert rate_limit_module._scope_for_path("/api/v1/repos/{owner}/{repo}/files/{path:path}") == ("transfer", 120)
