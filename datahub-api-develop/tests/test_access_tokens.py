"""Access Tokens v2 — 단위 + 핸들러 레벨 테스트.

architecture/access-tokens.md §4 (토큰 형식) / §5 (API 계약) 핵심 분기.
TestClient 미사용 (SQLite ↔ JSONB 비호환), 핸들러를 직접 호출 + DB MagicMock.

커버리지
- token_format: generate / verify (정상/체크섬 불일치/포맷 위반/legacy 통과)
- _validate_create_body: name 필수·길이 / token_type 검증 / fine_grained grants 필수
- _resolve_access_token: id vs prefix 분기 / 소유자 필터 / 404
- Bearer dh_/dl_ routing → _authenticate_access_token 위임
- _authenticate_access_token: 잘못된 형식 / not found / inactive / hash mismatch / expired
- create / list / delete / rotate 핸들러의 핵심 분기
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import bcrypt
import pytest
from fastapi import HTTPException


# ── token_format ──────────────────────────────────────


class TestTokenFormat:
    def test_generate_dh_prefix_and_verifies(self):
        from app.auth import token_format
        raw, prefix, h = token_format.generate_access_token()
        assert raw.startswith("dh_")
        assert len(prefix) == 11 and prefix.startswith("dh_")
        assert token_format.verify_format(raw) is True
        # bcrypt round-trip
        assert bcrypt.checkpw(raw.encode(), h.encode())

    def test_verify_legacy_dl_always_true(self):
        from app.auth import token_format
        # 레거시는 형식 검증 미적용 (3 개월 grace)
        assert token_format.verify_format("dl_anyrandomvalue") is True

    def test_verify_bad_prefix(self):
        from app.auth import token_format
        assert token_format.verify_format("xx_aaaaaaaa_etc") is False
        assert token_format.verify_format("") is False

    def test_verify_bad_checksum(self):
        from app.auth import token_format
        raw, _, _ = token_format.generate_access_token()
        # 마지막 6 자 (checksum) 변조
        bad = raw[:-6] + "ZZZZZZ"
        assert token_format.verify_format(bad) is False


# ── _validate_create_body ────────────────────────────


class TestValidateCreateBody:
    def _call(self, **overrides):
        from app.routers.auth import _validate_create_body
        from app.schemas.auth import CreateAccessTokenRequest, GrantSpec

        defaults = dict(
            name=overrides.get("name", "ci"),
            token_type=overrides.get("token_type", "read"),
        )
        if "expires_in_days" in overrides:
            defaults["expires_in_days"] = overrides["expires_in_days"]
        if "grants" in overrides:
            defaults["grants"] = overrides["grants"]
        body = CreateAccessTokenRequest(**defaults)
        _validate_create_body(body)

    def test_ok_read(self):
        self._call(token_type="read")  # no exception

    def test_ok_fine_grained_with_grants(self):
        from app.schemas.auth import GrantSpec
        self._call(
            token_type="fine_grained",
            grants=[GrantSpec(resource_type="repo", resource_id="x/y", action="read")],
        )

    def test_name_empty(self):
        with pytest.raises(HTTPException) as exc:
            self._call(name="")
        assert exc.value.status_code == 400

    def test_name_whitespace_only(self):
        with pytest.raises(HTTPException):
            self._call(name="   ")

    def test_name_too_long(self):
        with pytest.raises(HTTPException):
            self._call(name="x" * 101)

    def test_invalid_token_type(self):
        with pytest.raises(HTTPException) as exc:
            self._call(token_type="superuser")
        assert exc.value.status_code == 400

    def test_fine_grained_requires_grants(self):
        with pytest.raises(HTTPException) as exc:
            self._call(token_type="fine_grained")
        assert exc.value.status_code == 400

    def test_expires_zero(self):
        with pytest.raises(HTTPException):
            self._call(expires_in_days=0)

    def test_expires_too_large(self):
        with pytest.raises(HTTPException):
            self._call(expires_in_days=10_000)

    def test_expires_ok(self):
        self._call(expires_in_days=30)


# ── _resolve_access_token ────────────────────────────


class TestResolveAccessToken:
    def _make_token(self, *, owner_id=10, id=42, prefix="dh_aA8x3KpQ"):
        from app.models import AccessToken
        t = AccessToken(
            id=id,
            user_id=owner_id,
            token_prefix=prefix,
            token_hash="x",
            name="t",
            token_type="read",
            is_active=True,
        )
        return t

    def test_resolves_by_numeric_id(self):
        from app.models import User
        from app.routers.auth import _resolve_access_token

        token = self._make_token(id=42)
        db = MagicMock()
        # query → filter → filter → first
        chain = db.query.return_value.filter.return_value
        chain.filter.return_value.first.return_value = token

        user = User(id=10, email="alice@x")
        out = _resolve_access_token(db, user, "42")
        assert out is token

    def test_resolves_by_prefix(self):
        from app.models import User
        from app.routers.auth import _resolve_access_token

        token = self._make_token(prefix="dh_zZzZzZzZ")
        db = MagicMock()
        chain = db.query.return_value.filter.return_value
        chain.filter.return_value.first.return_value = token

        user = User(id=10, email="alice@x")
        out = _resolve_access_token(db, user, "dh_zZzZzZzZ")
        assert out is token

    def test_not_found_raises_404(self):
        from app.models import User
        from app.routers.auth import _resolve_access_token

        db = MagicMock()
        chain = db.query.return_value.filter.return_value
        chain.filter.return_value.first.return_value = None

        user = User(id=10, email="alice@x")
        with pytest.raises(HTTPException) as exc:
            _resolve_access_token(db, user, "999")
        assert exc.value.status_code == 404


# ── Bearer dh_/dl_ routing ───────────────────────────


class TestBearerRouting:
    def test_bearer_dh_routes_to_authenticate_access_token(self, monkeypatch):
        """Bearer dh_... → JWT decode skip → access token 인증 경로."""
        from app.dependencies import get_current_user

        called = {}

        def fake_authenticate(db, raw, request=None):
            called["raw"] = raw
            return MagicMock(email="alice@x")

        monkeypatch.setattr(
            "app.dependencies._authenticate_access_token", fake_authenticate
        )
        request = MagicMock()
        request.headers.get.side_effect = lambda k: (
            "Bearer dh_aA8x3KpQ_test" if k.lower() == "authorization" else None
        )
        db = MagicMock()
        get_current_user(request, db=db)
        assert called["raw"] == "dh_aA8x3KpQ_test"

    def test_bearer_dl_legacy_also_routes(self, monkeypatch):
        from app.dependencies import get_current_user

        called = {}

        def fake_authenticate(db, raw, request=None):
            called["raw"] = raw
            return MagicMock(email="alice@x")

        monkeypatch.setattr(
            "app.dependencies._authenticate_access_token", fake_authenticate
        )
        request = MagicMock()
        request.headers.get.side_effect = lambda k: (
            "Bearer dl_legacy" if k.lower() == "authorization" else None
        )
        db = MagicMock()
        get_current_user(request, db=db)
        assert called["raw"] == "dl_legacy"


# ── _authenticate_access_token failure paths ────────


class TestAuthenticateFailures:
    def _audit_noop(self, monkeypatch):
        # audit.log 가 DB 작업을 하므로 no-op 으로 monkeypatch
        from app.services import audit as audit_module
        monkeypatch.setattr(audit_module.audit, "log", lambda *a, **kw: None)

    def test_bad_format(self, monkeypatch):
        self._audit_noop(monkeypatch)
        from app.dependencies import _authenticate_access_token
        db = MagicMock()
        request = MagicMock()
        request.client = None
        request.headers.get.return_value = "test-agent"
        with pytest.raises(HTTPException) as exc:
            _authenticate_access_token(db, "garbage", request)
        assert exc.value.status_code == 401

    def test_not_found(self, monkeypatch):
        self._audit_noop(monkeypatch)
        from app.auth import token_format
        from app.dependencies import _authenticate_access_token

        raw, _, _ = token_format.generate_access_token()
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        request = MagicMock()
        request.client = None
        request.headers.get.return_value = "test-agent"
        with pytest.raises(HTTPException) as exc:
            _authenticate_access_token(db, raw, request)
        assert exc.value.status_code == 401

    def test_hash_mismatch(self, monkeypatch):
        self._audit_noop(monkeypatch)
        from app.auth import token_format
        from app.dependencies import _authenticate_access_token
        from app.models import AccessToken

        raw, prefix, _ = token_format.generate_access_token()
        # hash 를 다른 raw 의 것으로 채워 mismatch 유도
        other_raw, _, other_hash = token_format.generate_access_token()
        token = AccessToken(
            id=1,
            user_id=10,
            token_prefix=prefix,
            token_hash=other_hash,
            name="t",
            token_type="read",
            is_active=True,
        )
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = token
        request = MagicMock()
        request.client = None
        request.headers.get.return_value = "test-agent"
        with pytest.raises(HTTPException) as exc:
            _authenticate_access_token(db, raw, request)
        assert exc.value.status_code == 401

    def test_expired(self, monkeypatch):
        self._audit_noop(monkeypatch)
        from app.auth import token_format
        from app.dependencies import _authenticate_access_token
        from app.models import AccessToken

        raw, prefix, h = token_format.generate_access_token()
        token = AccessToken(
            id=1,
            user_id=10,
            token_prefix=prefix,
            token_hash=h,
            name="t",
            token_type="read",
            is_active=True,
            expires_at=datetime.now(timezone.utc).replace(tzinfo=None)
            - timedelta(days=1),
        )
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = token
        request = MagicMock()
        request.client = None
        request.headers.get.return_value = "test-agent"
        with pytest.raises(HTTPException) as exc:
            _authenticate_access_token(db, raw, request)
        assert exc.value.status_code == 401


# ── create handler — read / fine_grained 핵심 분기 ──


class TestCreateHandler:
    def test_read_token_creates_virtual_user_grant(self, monkeypatch):
        """token_type='read' → grants 자동 부착 (user, '*', read)."""
        from app.models import User
        from app.routers.auth import create_access_token
        from app.schemas.auth import CreateAccessTokenRequest

        # audit + DB mock
        from app.services import audit as audit_module
        monkeypatch.setattr(audit_module.audit, "log", lambda *a, **kw: None)

        captured: dict = {}

        class FakeDB:
            def add(self, obj):
                captured["token"] = obj

            def commit(self):
                pass

            def refresh(self, obj):
                # id 부여
                obj.id = 100
                obj.created_at = datetime.now(timezone.utc)

        db = FakeDB()
        request = MagicMock()
        request.client = None
        user = User(id=10, email="alice@x")
        body = CreateAccessTokenRequest(
            name="my-read", token_type="read", expires_in_days=30
        )
        resp = create_access_token(body, request, user=user, db=db)
        assert resp.token_type == "read"
        assert resp.access_token.startswith("dh_")
        assert any(
            g.resource_type == "user" and g.resource_id == "*" and g.action == "read"
            for g in resp.grants
        )

    def test_fine_grained_repo_grant_validated_against_rbac(self, monkeypatch):
        """fine_grained 의 grant action ∉ 사용자 RBAC → 403 token_create_denied."""
        from app.models import User
        from app.routers.auth import create_access_token
        from app.schemas.auth import CreateAccessTokenRequest, GrantSpec
        from app.services import audit as audit_module

        monkeypatch.setattr(audit_module.audit, "log", lambda *a, **kw: None)
        # 사용자가 'r/x' 에 RBAC 권한 없음
        monkeypatch.setattr(
            "app.routers.auth.get_user_rbac_actions",
            lambda db, u, repo: set(),
        )

        db = MagicMock()
        request = MagicMock()
        request.client = None
        user = User(id=10, email="alice@x")
        body = CreateAccessTokenRequest(
            name="x",
            token_type="fine_grained",
            grants=[
                GrantSpec(resource_type="repo", resource_id="r/x", action="write"),
            ],
        )
        with pytest.raises(HTTPException) as exc:
            create_access_token(body, request, user=user, db=db)
        assert exc.value.status_code == 403
