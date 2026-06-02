"""Azure SSO PR 3 (rev.3) — dual-IdP routing (Google + Microsoft).

`?provider=microsoft` 로 Azure 흐름 진입. default = Google (호환).
state prefix `ms:` 로 callback 이 provider 식별.
"""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from fastapi.responses import RedirectResponse


def _mock_request():
    return SimpleNamespace(
        client=SimpleNamespace(host="127.0.0.1"),
        headers={},
        state=SimpleNamespace(),
        url=SimpleNamespace(scheme="https", netloc="dev.datahub.lgair-data.com"),
    )


# ── /auth/login dual-IdP 분기 ────────────────────────────


class TestLoginProviderDispatch:
    def test_default_provider_redirects_to_google(self, monkeypatch):
        """provider 미지정 → Google (기존 호환)."""
        from app.routers import auth as auth_mod
        monkeypatch.setattr(auth_mod.settings, "azure_sso_enabled", True)  # Azure on 이어도 default Google
        monkeypatch.setattr(auth_mod.settings, "google_client_id", "google-x")
        monkeypatch.setattr(auth_mod, "_get_oauth_callback_url", lambda req: "https://dev/cb")
        resp = auth_mod.login(_mock_request())
        assert isinstance(resp, RedirectResponse)
        assert "accounts.google.com" in resp.headers["location"]

    def test_explicit_google_provider(self, monkeypatch):
        from app.routers import auth as auth_mod
        monkeypatch.setattr(auth_mod.settings, "google_client_id", "google-x")
        monkeypatch.setattr(auth_mod, "_get_oauth_callback_url", lambda req: "https://dev/cb")
        resp = auth_mod.login(_mock_request(), provider="google")
        assert "accounts.google.com" in resp.headers["location"]

    def test_microsoft_provider_redirects_to_azure(self, monkeypatch):
        from app.routers import auth as auth_mod
        monkeypatch.setattr(auth_mod.settings, "azure_sso_enabled", True)
        monkeypatch.setattr(auth_mod, "_get_oauth_callback_url", lambda req: "https://dev/cb")
        captured = {}
        def fake_url(state, redirect_uri):
            captured["state"] = state
            captured["redirect_uri"] = redirect_uri
            return "https://login.microsoftonline.com/.../authorize"
        monkeypatch.setattr(auth_mod, "_azure_build_authorize_url", fake_url)
        resp = auth_mod.login(_mock_request(), provider="microsoft")
        assert resp.headers["location"].startswith("https://login.microsoftonline.com")
        # state 에 ms: prefix 가 있어야 callback 이 식별 가능
        assert captured["state"].startswith("ms:")

    def test_microsoft_flag_off_returns_503(self, monkeypatch):
        from app.routers import auth as auth_mod
        monkeypatch.setattr(auth_mod.settings, "azure_sso_enabled", False)
        monkeypatch.setattr(auth_mod, "_get_oauth_callback_url", lambda req: "https://dev/cb")
        with pytest.raises(HTTPException) as exc:
            auth_mod.login(_mock_request(), provider="microsoft")
        assert exc.value.status_code == 503
        assert "Azure" in str(exc.value.detail)


# ── /auth/callback state prefix 분기 ─────────────────────


class TestCallbackStatePrefix:
    def _patch_token_issue(self, monkeypatch, auth_mod):
        monkeypatch.setattr("app.services.audit.AuditService.log", lambda self, *a, **kw: None)
        monkeypatch.setattr(auth_mod, "_create_jwt", lambda email: "jwt-x")
        monkeypatch.setattr(auth_mod, "_issue_refresh_token", lambda email: "rt-x")

    def test_google_state_no_prefix_uses_google_path(self, monkeypatch):
        """state 에 ms: prefix 없으면 Google 흐름. flag 무관."""
        from app.routers import auth as auth_mod
        # Azure flag on 이지만 state 에 ms: 없으면 Google
        monkeypatch.setattr(auth_mod.settings, "azure_sso_enabled", True)
        monkeypatch.setattr(auth_mod, "_get_oauth_callback_url", lambda req: "https://dev/cb")
        monkeypatch.setattr(auth_mod, "exchange_authorization_code", lambda **kw: "g-token")
        monkeypatch.setattr(
            auth_mod, "get_user_info",
            lambda token: SimpleNamespace(email="u@lgresearch.ai", name="U"),
        )
        fake_user = SimpleNamespace(id=1, email="u@lgresearch.ai")
        monkeypatch.setattr(auth_mod, "get_or_create_user", lambda db, email, name=None: fake_user)
        self._patch_token_issue(monkeypatch, auth_mod)

        with patch("app.routers.auth._azure_verify", side_effect=AssertionError("should not be called")):
            resp = auth_mod.callback(_mock_request(), code="g-code", state="/", db=MagicMock())
        assert isinstance(resp, RedirectResponse)

    def test_ms_state_prefix_uses_azure_path(self, monkeypatch):
        """state 가 ms: 로 시작 → Azure code 교환 + verify + linking."""
        from app.routers import auth as auth_mod
        monkeypatch.setattr(auth_mod, "_get_oauth_callback_url", lambda req: "https://dev/cb")
        monkeypatch.setattr(auth_mod, "_azure_exchange_code", lambda code, redirect_uri: "id-token-x")
        monkeypatch.setattr(
            auth_mod, "_azure_verify",
            lambda token: {"email": "u@lgresearch.ai", "name": "U", "oid": "oid-1"},
        )
        fake_user = SimpleNamespace(id=1, email="u@lgresearch.ai", azure_oid=None, azure_tid=None, linked_at=None, name=None)
        monkeypatch.setattr(auth_mod, "get_or_create_user", lambda db, email, name=None: fake_user)
        # PR 6 linking: mock 처리 (실 동작은 test_azure_linking 에서 검증)
        monkeypatch.setattr("app.services.azure_linking.link_azure_identity", lambda db, user, claims, **kw: user)
        self._patch_token_issue(monkeypatch, auth_mod)

        with patch("app.routers.auth.exchange_authorization_code", side_effect=AssertionError("should not be called")):
            resp = auth_mod.callback(_mock_request(), code="az-code", state="ms:/", db=MagicMock())
        assert isinstance(resp, RedirectResponse)

    def test_ms_state_inner_state_preserved(self, monkeypatch):
        """state="ms:device:abc" → Azure 처리 후 inner state ("device:abc") 가 디바이스 분기로 진입."""
        from app.routers import auth as auth_mod
        monkeypatch.setattr(auth_mod, "_get_oauth_callback_url", lambda req: "https://dev/cb")
        monkeypatch.setattr(auth_mod, "_azure_exchange_code", lambda code, redirect_uri: "id-token-x")
        monkeypatch.setattr(
            auth_mod, "_azure_verify",
            lambda token: {"email": "u@lgresearch.ai"},
        )
        fake_user = SimpleNamespace(id=1, email="u@lgresearch.ai")
        monkeypatch.setattr(auth_mod, "get_or_create_user", lambda db, email, name=None: fake_user)
        self._patch_token_issue(monkeypatch, auth_mod)
        # device flow 분기에 진입하는지: session_store 가 device_code 를 받아야 함
        captured_keys = []
        monkeypatch.setattr(
            auth_mod.session_store, "has_pending",
            lambda key: captured_keys.append(key) or True,
        )
        monkeypatch.setattr(auth_mod.session_store, "set_pending", lambda *a, **kw: None)

        resp = auth_mod.callback(_mock_request(), code="az-code", state="ms:device:dev-xyz", db=MagicMock())
        assert isinstance(resp, RedirectResponse)
        # device key 가 호출됐는지 (device 분기 진입 확인)
        assert any("dev-xyz" in str(k) for k in captured_keys)
        # device flow 완료는 전용 success 페이지로 — /auth/complete 의 빈 code
        # manual-paste fallback 으로 새지 않아야 한다.
        assert "/auth/device-success" in resp.headers["location"]
        assert "/auth/complete" not in resp.headers["location"]


# ── /auth/device/authorize provider 분기 ─────────────────


class TestDeviceAuthorizeProvider:
    def test_default_provider_uses_google(self, monkeypatch):
        from app.routers import auth as auth_mod
        monkeypatch.setattr(auth_mod.settings, "azure_sso_enabled", True)
        monkeypatch.setattr(auth_mod.settings, "google_client_id", "google-x")
        monkeypatch.setattr(auth_mod, "_get_oauth_callback_url", lambda req: "https://dev/cb")
        monkeypatch.setattr(auth_mod.session_store, "has_pending", lambda key: True)

        resp = auth_mod.device_authorize(device_code="dev-abc", request=_mock_request())
        assert isinstance(resp, RedirectResponse)
        assert "accounts.google.com" in resp.headers["location"]

    def test_microsoft_provider_uses_azure_with_ms_state(self, monkeypatch):
        from app.routers import auth as auth_mod
        monkeypatch.setattr(auth_mod.settings, "azure_sso_enabled", True)
        monkeypatch.setattr(auth_mod, "_get_oauth_callback_url", lambda req: "https://dev/cb")
        monkeypatch.setattr(auth_mod.session_store, "has_pending", lambda key: True)
        captured = {}
        def fake_url(state, redirect_uri):
            captured["state"] = state
            return "https://login.microsoftonline.com/.../authorize"
        monkeypatch.setattr(auth_mod, "_azure_build_authorize_url", fake_url)

        resp = auth_mod.device_authorize(
            device_code="dev-abc", request=_mock_request(), provider="microsoft"
        )
        assert isinstance(resp, RedirectResponse)
        assert resp.headers["location"].startswith("https://login.microsoftonline.com")
        # state 에 ms: prefix + 내부 device: 인코딩
        assert captured["state"] == "ms:device:dev-abc"

    def test_microsoft_flag_off_returns_503(self, monkeypatch):
        from app.routers import auth as auth_mod
        monkeypatch.setattr(auth_mod.settings, "azure_sso_enabled", False)
        monkeypatch.setattr(auth_mod, "_get_oauth_callback_url", lambda req: "https://dev/cb")
        monkeypatch.setattr(auth_mod.session_store, "has_pending", lambda key: True)

        with pytest.raises(HTTPException) as exc:
            auth_mod.device_authorize(
                device_code="dev-abc", request=_mock_request(), provider="microsoft"
            )
        assert exc.value.status_code == 503
