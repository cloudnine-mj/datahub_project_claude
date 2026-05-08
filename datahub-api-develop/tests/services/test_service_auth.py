"""서비스 간 JWT 인증 테스트 — service_auth.py"""

from __future__ import annotations

import time
from unittest.mock import patch

import jwt
import pytest
from fastapi import HTTPException

from app.services.service_auth import create_service_token, verify_service_token

_TEST_SECRET = "test-secret-key-for-unit-tests-only-32chars"


@pytest.fixture(autouse=True)
def patch_settings():
    """모든 테스트에 테스트용 시크릿 주입."""
    with patch("app.services.service_auth.settings") as mock_settings:
        mock_settings.internal_service_secret = _TEST_SECRET
        mock_settings.internal_service_token_ttl_seconds = 300
        yield mock_settings


class TestCreateServiceToken:
    def test_returns_string(self):
        token = create_service_token()
        assert isinstance(token, str)
        assert len(token) > 0

    def test_default_caller_is_dpa(self):
        token = create_service_token()
        payload = jwt.decode(token, _TEST_SECRET, algorithms=["HS256"])
        assert payload["sub"] == "dpa"

    def test_custom_caller(self):
        token = create_service_token(caller="dia")
        payload = jwt.decode(token, _TEST_SECRET, algorithms=["HS256"])
        assert payload["sub"] == "dia"

    def test_scope_is_internal(self):
        token = create_service_token()
        payload = jwt.decode(token, _TEST_SECRET, algorithms=["HS256"])
        assert payload["scope"] == "internal"

    def test_contains_required_claims(self):
        token = create_service_token()
        payload = jwt.decode(token, _TEST_SECRET, algorithms=["HS256"])
        assert "sub" in payload
        assert "iat" in payload
        assert "exp" in payload

    def test_expiry_matches_ttl(self):
        with patch("app.services.service_auth.settings") as mock:
            mock.internal_service_secret = _TEST_SECRET
            mock.internal_service_token_ttl_seconds = 60
            token = create_service_token()
        payload = jwt.decode(token, _TEST_SECRET, algorithms=["HS256"])
        assert payload["exp"] - payload["iat"] == 60


class TestVerifyServiceToken:
    def test_valid_token_returns_caller(self):
        token = create_service_token(caller="dpa")
        result = verify_service_token(token)
        assert result == "dpa"

    def test_roundtrip_custom_caller(self):
        token = create_service_token(caller="dia")
        result = verify_service_token(token)
        assert result == "dia"

    def test_expired_token_raises_401(self):
        # TTL 0초로 즉시 만료 토큰 생성
        import datetime

        now = datetime.datetime.now(datetime.timezone.utc)
        payload = {
            "sub": "dpa",
            "scope": "internal",
            "iat": now,
            "exp": now - datetime.timedelta(seconds=1),  # 이미 만료
        }
        token = jwt.encode(payload, _TEST_SECRET, algorithm="HS256")
        with pytest.raises(HTTPException) as exc_info:
            verify_service_token(token)
        assert exc_info.value.status_code == 401
        assert "expired" in exc_info.value.detail

    def test_invalid_signature_raises_401(self):
        token = create_service_token()
        # 다른 시크릿으로 서명된 토큰
        tampered = jwt.encode(
            jwt.decode(token, _TEST_SECRET, algorithms=["HS256"]),
            "wrong-secret-completely-different-key!!",
            algorithm="HS256",
        )
        with pytest.raises(HTTPException) as exc_info:
            verify_service_token(tampered)
        assert exc_info.value.status_code == 401

    def test_wrong_scope_raises_401(self):
        import datetime

        now = datetime.datetime.now(datetime.timezone.utc)
        payload = {
            "sub": "dpa",
            "scope": "external",  # 잘못된 scope
            "iat": now,
            "exp": now + datetime.timedelta(seconds=300),
        }
        token = jwt.encode(payload, _TEST_SECRET, algorithm="HS256")
        with pytest.raises(HTTPException) as exc_info:
            verify_service_token(token)
        assert exc_info.value.status_code == 401

    def test_missing_sub_raises_401(self):
        import datetime

        now = datetime.datetime.now(datetime.timezone.utc)
        payload = {
            "scope": "internal",
            "iat": now,
            "exp": now + datetime.timedelta(seconds=300),
            # sub 없음
        }
        token = jwt.encode(payload, _TEST_SECRET, algorithm="HS256")
        with pytest.raises(HTTPException) as exc_info:
            verify_service_token(token)
        assert exc_info.value.status_code == 401

    def test_missing_iat_raises_401(self):
        import datetime

        now = datetime.datetime.now(datetime.timezone.utc)
        payload = {
            "sub": "dpa",
            "scope": "internal",
            # iat 없음
            "exp": now + datetime.timedelta(seconds=300),
        }
        token = jwt.encode(payload, _TEST_SECRET, algorithm="HS256")
        with pytest.raises(HTTPException) as exc_info:
            verify_service_token(token)
        assert exc_info.value.status_code == 401

    def test_missing_exp_raises_401(self):
        import datetime

        now = datetime.datetime.now(datetime.timezone.utc)
        payload = {
            "sub": "dpa",
            "scope": "internal",
            "iat": now,
            # exp 없음
        }
        token = jwt.encode(payload, _TEST_SECRET, algorithm="HS256")
        with pytest.raises(HTTPException) as exc_info:
            verify_service_token(token)
        assert exc_info.value.status_code == 401

    def test_garbage_token_raises_401(self):
        with pytest.raises(HTTPException) as exc_info:
            verify_service_token("not.a.valid.jwt.token")
        assert exc_info.value.status_code == 401

    def test_error_messages_do_not_reveal_internals(self):
        """에러 메시지가 scope 클레임 존재를 노출하지 않는지 확인."""
        import datetime

        now = datetime.datetime.now(datetime.timezone.utc)
        payload = {
            "sub": "dpa",
            "scope": "wrong",
            "iat": now,
            "exp": now + datetime.timedelta(seconds=300),
        }
        token = jwt.encode(payload, _TEST_SECRET, algorithm="HS256")
        with pytest.raises(HTTPException) as exc_info:
            verify_service_token(token)
        # "Not a service token" 같은 힌트가 없어야 함
        assert "scope" not in exc_info.value.detail
        assert "internal" not in exc_info.value.detail
