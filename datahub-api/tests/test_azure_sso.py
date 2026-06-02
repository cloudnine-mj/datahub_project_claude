"""Azure AD SSO PR 2 — JWKS cache + token verify + dependencies branch.

전체 token 발급/검증 cycle 은 PR 3 (login flow) 에서 통합 검증.
"""

import time
from unittest.mock import MagicMock, patch

import pytest


# ── JWKS cache ─────────────────────────────────────────────


class TestJwksCache:
    def setup_method(self):
        from app.services.jwks import invalidate_jwks
        invalidate_jwks()

    def test_fetches_keys_and_caches(self, monkeypatch):
        from app.services import jwks

        fake_key = MagicMock(name="rsa_key")
        fetch_calls = []

        def fake_fetch(self, tenant_id):
            fetch_calls.append(tenant_id)
            return {"kid-1": fake_key}

        monkeypatch.setattr(jwks.JWKSCache, "_fetch", fake_fetch)

        # 첫 호출 → fetch
        k1 = jwks.get_signing_key("tenant-x", "kid-1")
        # 두 번째 → cache hit
        k2 = jwks.get_signing_key("tenant-x", "kid-1")
        assert k1 is fake_key and k2 is fake_key
        assert len(fetch_calls) == 1

    def test_unknown_kid_raises_without_force_refresh(self, monkeypatch):
        from app.services import jwks

        def fake_fetch(self, tenant_id):
            return {"kid-1": MagicMock(name="key1")}

        monkeypatch.setattr(jwks.JWKSCache, "_fetch", fake_fetch)
        # cache 채우기
        jwks.get_signing_key("t", "kid-1")
        # 이 시점에 cache 가 {kid-1: ...} — kid-2 는 stale 판정 (key not in cache → refetch)
        # 본 케이스에서 fake_fetch 가 kid-2 도 안 줌 → 결국 KeyError
        with pytest.raises(KeyError):
            jwks.get_signing_key("t", "kid-2")

    def test_force_refresh_replaces_cache(self, monkeypatch):
        from app.services import jwks

        # 첫 fetch: kid-1 만
        old_key = MagicMock(name="old")
        new_key = MagicMock(name="new")

        seq = [{"kid-1": old_key}, {"kid-2": new_key}]
        fetch_calls = []

        def fake_fetch(self, tenant_id):
            fetch_calls.append(tenant_id)
            return seq.pop(0)

        monkeypatch.setattr(jwks.JWKSCache, "_fetch", fake_fetch)

        k1 = jwks.get_signing_key("t", "kid-1")
        assert k1 is old_key
        # force refresh 로 두 번째 fetch → kid-2 만 있는 keyset 으로 교체
        k2 = jwks.get_signing_key("t", "kid-2", force_refresh=True)
        assert k2 is new_key
        assert len(fetch_calls) == 2


# ── Azure token verify ──────────────────────────────────────


class TestAzureTokenVerify:
    def test_raises_when_client_id_unset(self, monkeypatch):
        from app.services import azure_oauth
        monkeypatch.setattr(azure_oauth.settings, "azure_ad_client_id", "")
        with pytest.raises(azure_oauth.AzureTokenError, match="client_id"):
            azure_oauth.verify_azure_id_token("dummy")

    def test_rejects_token_without_kid_header(self, monkeypatch):
        from app.services import azure_oauth
        monkeypatch.setattr(azure_oauth.settings, "azure_ad_client_id", "client-x")
        with patch("jwt.get_unverified_header", return_value={}):
            with pytest.raises(azure_oauth.AzureTokenError, match="kid"):
                azure_oauth.verify_azure_id_token("dummy")

    def test_rejects_tenant_not_in_allowlist(self, monkeypatch):
        from app.services import azure_oauth
        monkeypatch.setattr(azure_oauth.settings, "azure_ad_client_id", "client-x")
        monkeypatch.setattr(azure_oauth.settings, "azure_ad_tenant_id", "tenant-allowed")
        monkeypatch.setattr(azure_oauth.settings, "azure_allowed_tenants", "")
        with patch("jwt.get_unverified_header", return_value={"kid": "k1"}), \
                patch("jwt.decode", return_value={"tid": "tenant-blocked"}):
            with pytest.raises(azure_oauth.AzureTokenError, match="not in allowlist"):
                azure_oauth.verify_azure_id_token("dummy")

    def test_rejects_disallowed_email_domain(self, monkeypatch):
        from app.services import azure_oauth
        monkeypatch.setattr(azure_oauth.settings, "azure_ad_client_id", "client-x")
        monkeypatch.setattr(azure_oauth.settings, "azure_ad_tenant_id", "tenant-1")
        monkeypatch.setattr(azure_oauth.settings, "azure_allowed_email_domain", "lgresearch.ai")

        # signature verify success 시뮬레이트
        decoded_calls = []

        def fake_decode(token, *args, **kwargs):
            decoded_calls.append(kwargs)
            if kwargs.get("options") == {"verify_signature": False}:
                return {"tid": "tenant-1"}
            return {"email": "user@outside.com", "tid": "tenant-1"}

        with patch("jwt.get_unverified_header", return_value={"kid": "k1"}), \
                patch("jwt.decode", side_effect=fake_decode), \
                patch("app.services.azure_oauth.get_signing_key", return_value=MagicMock()):
            with pytest.raises(azure_oauth.AzureTokenError, match="domain"):
                azure_oauth.verify_azure_id_token("dummy")

    def test_success_returns_claims(self, monkeypatch):
        from app.services import azure_oauth
        monkeypatch.setattr(azure_oauth.settings, "azure_ad_client_id", "client-x")
        monkeypatch.setattr(azure_oauth.settings, "azure_ad_tenant_id", "tenant-1")
        monkeypatch.setattr(azure_oauth.settings, "azure_allowed_email_domain", "lgresearch.ai")

        claims = {"email": "user@lgresearch.ai", "tid": "tenant-1", "oid": "oid-abc"}

        def fake_decode(token, *args, **kwargs):
            if kwargs.get("options") == {"verify_signature": False}:
                return {"tid": "tenant-1"}
            return claims

        with patch("jwt.get_unverified_header", return_value={"kid": "k1"}), \
                patch("jwt.decode", side_effect=fake_decode), \
                patch("app.services.azure_oauth.get_signing_key", return_value=MagicMock()):
            result = azure_oauth.verify_azure_id_token("dummy")
        assert result == claims


# ── dependencies.py 분기 ─────────────────────────────────


class TestDependenciesAzureBranch:
    def test_flag_off_skips_azure(self, monkeypatch):
        from app import dependencies
        monkeypatch.setattr(dependencies.settings, "azure_sso_enabled", False)
        # azure_oauth.verify_azure_id_token 이 호출되면 안 됨 — 호출 시 raise
        with patch("app.services.azure_oauth.verify_azure_id_token", side_effect=AssertionError("should not be called")):
            assert dependencies._try_verify_azure_token("dummy") is None

    def test_flag_on_returns_email(self, monkeypatch):
        from app import dependencies
        monkeypatch.setattr(dependencies.settings, "azure_sso_enabled", True)
        with patch(
            "app.services.azure_oauth.verify_azure_id_token",
            return_value={"email": "user@lgresearch.ai", "oid": "x"},
        ):
            email = dependencies._try_verify_azure_token("dummy")
        assert email == "user@lgresearch.ai"

    def test_flag_on_verify_fail_returns_none(self, monkeypatch):
        from app import dependencies
        monkeypatch.setattr(dependencies.settings, "azure_sso_enabled", True)
        from app.services.azure_oauth import AzureTokenError
        with patch(
            "app.services.azure_oauth.verify_azure_id_token",
            side_effect=AzureTokenError("bad"),
        ):
            assert dependencies._try_verify_azure_token("dummy") is None


# ── User model: Azure 컬럼 ───────────────────────────────


class TestUserAzureColumns:
    def test_user_accepts_azure_columns(self):
        from app.models import User
        u = User(
            email="u@lgresearch.ai",
            azure_oid="oid-abc",
            azure_tid="tid-xyz",
        )
        assert u.azure_oid == "oid-abc"
        assert u.azure_tid == "tid-xyz"
        assert u.linked_at is None
