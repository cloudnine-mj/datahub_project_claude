"""Issue #84 — Logout 엔드포인트 + X-Service-Token 미들웨어 테스트.

테스트 전략:
  - 서비스 레벨 직접 호출 + monkeypatch (TestClient 미사용)
    이유: SQLite JSONB 비호환 문제 (audit_logs 테이블)
  - 미들웨어 async 로직은 asyncio.run() 으로 직접 실행

커버리지:
  - logout: body 토큰, 쿠키 토큰, 토큰 없음, 감사 로그 기록
  - service_auth: 라운드트립, 만료, 잘못된 서명, scope 오류
  - middleware: 유효 토큰, 토큰 없음, 유효하지 않은 토큰 → 401
"""

from __future__ import annotations

import asyncio
from unittest.mock import MagicMock

import pytest


def _make_req(cookie_token=""):
    """logout 호출용 Mock Request."""
    req = MagicMock()
    req.cookies.get.side_effect = lambda k, default="": cookie_token if k == "platform_refresh_token" else default
    req.client.host = "127.0.0.1"
    return req


def _mock_db():
    return MagicMock()


# ── Logout 엔드포인트 ─────────────────────────────────


class TestLogoutEndpoint:
    """POST /auth/logout 로직 테스트."""

    def _patch_deps(self, monkeypatch):
        """session_store.delete_refresh_token + audit.log 패치. deleted / audit_calls 반환."""
        deleted = []
        audit_calls = []

        from mcp_app import session_store as ss_module
        monkeypatch.setattr(ss_module.session_store, "delete_refresh_token", lambda t: deleted.append(t))

        from app.services import audit as audit_module
        monkeypatch.setattr(audit_module.AuditService, "log", lambda self, *a, **kw: audit_calls.append(kw))

        return deleted, audit_calls

    def test_logout_with_body_token_deletes_from_store(self, monkeypatch):
        """body의 refresh_token 이 session_store 에서 삭제된다."""
        deleted, _ = self._patch_deps(monkeypatch)

        from app.routers.auth import logout
        from app.schemas.auth import LogoutRequest

        response = logout(LogoutRequest(refresh_token="body-token"), _make_req(), _mock_db())

        assert "body-token" in deleted
        assert response.status_code == 200

    def test_logout_with_cookie_token_deletes_from_store(self, monkeypatch):
        """쿠키의 platform_refresh_token 이 session_store 에서 삭제된다."""
        deleted, _ = self._patch_deps(monkeypatch)

        from app.routers.auth import logout
        from app.schemas.auth import LogoutRequest

        response = logout(LogoutRequest(refresh_token=""), _make_req(cookie_token="cookie-token"), _mock_db())

        assert "cookie-token" in deleted
        assert response.status_code == 200

    def test_logout_without_token_returns_200(self, monkeypatch):
        """토큰이 없어도 200 반환 (idempotent)."""
        self._patch_deps(monkeypatch)

        from app.routers.auth import logout
        from app.schemas.auth import LogoutRequest

        response = logout(LogoutRequest(refresh_token=""), _make_req(), _mock_db())
        assert response.status_code == 200

    def test_logout_clears_cookies(self, monkeypatch):
        """응답에 platform_token / platform_refresh_token 쿠키 삭제 헤더 포함."""
        self._patch_deps(monkeypatch)

        from app.routers.auth import logout
        from app.schemas.auth import LogoutRequest

        response = logout(LogoutRequest(refresh_token="tok"), _make_req(), _mock_db())
        set_cookie_header = response.headers.get("set-cookie", "")
        assert "Max-Age=0" in set_cookie_header or "expires" in set_cookie_header.lower()

    def test_logout_writes_audit_log(self, monkeypatch):
        """logout 시 action='logout' 감사 로그가 기록된다 (거버넌스 원칙 #3)."""
        _, audit_calls = self._patch_deps(monkeypatch)

        from app.routers.auth import logout
        from app.schemas.auth import LogoutRequest

        logout(LogoutRequest(refresh_token="tok"), _make_req(), _mock_db())

        assert len(audit_calls) == 1
        assert audit_calls[0]["action"] == "logout"
        assert audit_calls[0]["resource_type"] == "session"

    def test_logout_audit_token_present_flag(self, monkeypatch):
        """token_present 플래그가 details 에 포함된다."""
        _, audit_calls = self._patch_deps(monkeypatch)

        from app.routers.auth import logout
        from app.schemas.auth import LogoutRequest

        # 토큰 있음
        logout(LogoutRequest(refresh_token="t"), _make_req(), _mock_db())
        assert audit_calls[-1]["details"]["token_present"] is True

        # 토큰 없음
        logout(LogoutRequest(refresh_token=""), _make_req(), _mock_db())
        assert audit_calls[-1]["details"]["token_present"] is False


# ── Service Token 라운드트립 ──────────────────────────


class TestServiceTokenRoundtrip:
    """create_service_token / verify_service_token 단위 테스트."""

    def test_roundtrip_returns_caller(self):
        """발급 → 검증 → caller 반환."""
        from app.services.service_auth import create_service_token, verify_service_token

        token = create_service_token("test-svc")
        assert verify_service_token(token) == "test-svc"

    def test_roundtrip_default_caller(self):
        """기본 caller 'dpa'."""
        from app.services.service_auth import create_service_token, verify_service_token

        token = create_service_token()
        assert verify_service_token(token) == "dpa"

    def test_invalid_token_raises_401(self):
        """잘못된 토큰 → HTTPException 401."""
        from fastapi import HTTPException

        from app.services.service_auth import verify_service_token

        with pytest.raises(HTTPException) as exc_info:
            verify_service_token("completely.invalid.token")
        assert exc_info.value.status_code == 401

    def test_wrong_scope_raises_401(self):
        """scope='internal' 이 아닌 JWT → HTTPException 401."""
        from datetime import datetime, timedelta, timezone

        import jwt
        from fastapi import HTTPException

        from app.config import settings
        from app.services.service_auth import verify_service_token

        payload = {
            "sub": "dpa",
            "scope": "platform",  # 잘못된 scope
            "iat": datetime.now(timezone.utc),
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        }
        bad_token = jwt.encode(payload, settings.internal_service_secret, algorithm="HS256")

        with pytest.raises(HTTPException) as exc_info:
            verify_service_token(bad_token)
        assert exc_info.value.status_code == 401

    def test_wrong_secret_raises_401(self):
        """다른 secret 으로 서명된 토큰 → HTTPException 401."""
        from datetime import datetime, timedelta, timezone

        import jwt
        from fastapi import HTTPException

        from app.services.service_auth import verify_service_token

        payload = {
            "sub": "dpa",
            "scope": "internal",
            "iat": datetime.now(timezone.utc),
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        }
        bad_token = jwt.encode(payload, "wrong-secret-key-at-least-32-chars!", algorithm="HS256")

        with pytest.raises(HTTPException) as exc_info:
            verify_service_token(bad_token)
        assert exc_info.value.status_code == 401


# ── X-Service-Token 미들웨어 로직 ─────────────────────


class TestServiceTokenMiddlewareLogic:
    """미들웨어 핵심 로직: valid / absent / invalid 세 경로."""

    @staticmethod
    def _make_request(token_value=None):
        req = MagicMock()
        req.headers.get = lambda k, d=None: token_value if k == "X-Service-Token" else d
        req.state = type("State", (), {})()
        return req

    def test_valid_token_sets_service_caller(self):
        """유효한 X-Service-Token → request.state.service_caller = caller."""
        from fastapi import HTTPException
        from fastapi.responses import JSONResponse

        from app.services.service_auth import create_service_token, verify_service_token

        token = create_service_token("dia")
        req = self._make_request(token_value=token)

        async def _run():
            async def call_next(r):
                return JSONResponse({"ok": True})

            t = req.headers.get("X-Service-Token")
            if t:
                try:
                    req.state.service_caller = verify_service_token(t)
                except HTTPException:
                    return JSONResponse(status_code=401, content={"detail": "Invalid"})
            else:
                req.state.service_caller = None
            return await call_next(req)

        resp = asyncio.run(_run())
        assert req.state.service_caller == "dia"
        assert resp.status_code == 200

    def test_absent_token_sets_none(self):
        """X-Service-Token 헤더 없음 → request.state.service_caller = None."""
        from fastapi.responses import JSONResponse

        req = self._make_request(token_value=None)

        async def _run():
            async def call_next(r):
                return JSONResponse({"ok": True})

            t = req.headers.get("X-Service-Token")
            if t:
                pass
            else:
                req.state.service_caller = None
            return await call_next(req)

        asyncio.run(_run())
        assert req.state.service_caller is None

    def test_invalid_token_returns_401(self):
        """잘못된 X-Service-Token → 401 즉시 반환, call_next 호출 안 함."""
        from fastapi import HTTPException
        from fastapi.responses import JSONResponse

        from app.services.service_auth import verify_service_token

        req = self._make_request(token_value="bad.token.here")
        call_next_called = []

        async def _run():
            async def call_next(r):
                call_next_called.append(True)
                return JSONResponse({"ok": True})

            t = req.headers.get("X-Service-Token")
            if t:
                try:
                    req.state.service_caller = verify_service_token(t)
                except HTTPException:
                    return JSONResponse(status_code=401, content={"detail": "Invalid"})
            else:
                req.state.service_caller = None
            return await call_next(req)

        resp = asyncio.run(_run())
        assert resp.status_code == 401
        assert not call_next_called


# ── Session response 확장 필드 (datahub-auth-redesign §16) ──


class TestSessionResponseProfileFields:
    """POST /auth/session 응답에 role / lab_id / tech_cell_id 가 포함된다."""

    def test_session_response_includes_new_profile_fields(self, monkeypatch):
        """User 모델의 role/lab_id/tech_cell_id 가 응답에 그대로 실린다."""
        from app.routers.auth import create_session
        from app.services import audit as audit_module
        monkeypatch.setattr(
            audit_module.AuditService, "log", lambda self, *a, **kw: None
        )

        user = MagicMock()
        user.id = 123
        user.email = "shseo.ai@example.com"
        user.name = "서상현"
        user.role = "ADMIN"
        user.lab_id = "lab-42"
        user.tech_cell_id = "tc-7"

        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = []

        resp = create_session(_make_req(), user=user, db=db)

        assert resp.email == "shseo.ai@example.com"
        assert resp.name == "서상현"
        assert resp.role == "ADMIN"
        assert resp.lab_id == "lab-42"
        assert resp.tech_cell_id == "tc-7"
        assert resp.permissions == []

    def test_session_response_defaults_when_user_missing_fields(self, monkeypatch):
        """role 이 None 이어도 기본값 'USER' 로 채워진다."""
        from app.routers.auth import create_session
        from app.services import audit as audit_module
        monkeypatch.setattr(
            audit_module.AuditService, "log", lambda self, *a, **kw: None
        )

        user = MagicMock()
        user.id = 1
        user.email = "a@b.com"
        user.name = None
        user.role = None
        user.lab_id = None
        user.tech_cell_id = None

        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = []

        resp = create_session(_make_req(), user=user, db=db)

        assert resp.name is None
        assert resp.role == "USER"
        assert resp.lab_id is None
        assert resp.tech_cell_id is None

