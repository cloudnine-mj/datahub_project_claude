"""Tests for login_flow_device (OAuth 2.0 Device Authorization Grant)."""

from __future__ import annotations

import io
import json
from unittest.mock import MagicMock, patch

import httpx
import pytest

from datahub.auth import (
    CredentialStore,
    _DEVICE_MAX_POLL_INTERVAL,
    _DEVICE_NET_RETRY_DELAYS,
    _is_ssh_session,
    _try_open_browser,
    _warn_insecure_endpoint,
    login_flow_device,
)


# ──────────────────────────────────────────────
# Helpers


def _init_resp(interval: int = 5, expires_in: int = 600) -> MagicMock:
    r = MagicMock(spec=httpx.Response)
    r.status_code = 200
    r.json.return_value = {
        "device_code": "DC-abc123",
        "verification_uri": "https://example.com/auth/device?device_code=DC-abc123",
        "interval": interval,
        "expires_in": expires_in,
    }
    return r


def _token_resp(status_code: int, body: dict | None = None) -> MagicMock:
    r = MagicMock(spec=httpx.Response)
    r.status_code = status_code
    r.text = json.dumps(body or {})
    r.json.return_value = body or {}
    return r


# ──────────────────────────────────────────────
# Helper-level tests


class TestSshDetection:
    def test_no_ssh(self, monkeypatch):
        monkeypatch.delenv("SSH_CONNECTION", raising=False)
        monkeypatch.delenv("SSH_TTY", raising=False)
        assert _is_ssh_session() is False

    def test_ssh_connection(self, monkeypatch):
        monkeypatch.setenv("SSH_CONNECTION", "1.2.3.4 11111 5.6.7.8 22")
        assert _is_ssh_session() is True

    def test_ssh_tty(self, monkeypatch):
        monkeypatch.delenv("SSH_CONNECTION", raising=False)
        monkeypatch.setenv("SSH_TTY", "/dev/pts/0")
        assert _is_ssh_session() is True


class TestTryOpenBrowser:
    def test_attempts_even_on_ssh(self, monkeypatch):
        """SSH 세션에서도 webbrowser.open() 은 시도한다 (VS Code Remote 등에서
        자동 포워딩되는 환경이 있으므로). 실패해도 URL 은 이미 콘솔에 출력돼
        있으니 무해하다."""
        monkeypatch.setenv("SSH_CONNECTION", "1 2 3 4")
        with patch("datahub.auth.webbrowser.open", return_value=True) as mock_open:
            assert _try_open_browser("https://example.com") is True
            mock_open.assert_called_once_with("https://example.com")

    def test_success_locally(self, monkeypatch):
        monkeypatch.delenv("SSH_CONNECTION", raising=False)
        monkeypatch.delenv("SSH_TTY", raising=False)
        with patch("datahub.auth.webbrowser.open", return_value=True) as mock_open:
            assert _try_open_browser("https://example.com") is True
            mock_open.assert_called_once_with("https://example.com")

    def test_failure_returns_false(self, monkeypatch):
        with patch("datahub.auth.webbrowser.open", side_effect=RuntimeError("no display")):
            assert _try_open_browser("https://example.com") is False


class TestInsecureWarning:
    def test_http_warns(self, capsys):
        _warn_insecure_endpoint("http://dev.example.com")
        assert "HTTPS" in capsys.readouterr().err

    def test_https_silent(self, capsys):
        _warn_insecure_endpoint("https://api.example.com")
        assert capsys.readouterr().err == ""


# ──────────────────────────────────────────────
# login_flow_device happy path + edges


class TestLoginFlowDevice:
    def test_happy_path_saves_credentials(self, tmp_path, monkeypatch):
        monkeypatch.delenv("SSH_CONNECTION", raising=False)
        monkeypatch.delenv("SSH_TTY", raising=False)
        cred_path = tmp_path / "credentials.json"
        monkeypatch.setattr("datahub.auth._CREDENTIALS_PATH", cred_path)

        with patch("httpx.post") as post, \
             patch("datahub.auth.webbrowser.open", return_value=True), \
             patch("datahub.auth.time.sleep"):
            # init → 1st poll 428 (pending) → 2nd poll 200
            post.side_effect = [
                _init_resp(interval=1, expires_in=60),
                _token_resp(428, {"detail": "authorization_pending"}),
                _token_resp(200, {
                    "access_token": "JWT-OK",
                    "refresh_token": "REFRESH-OK",
                    "email": "user@example.com",
                }),
            ]
            creds = login_flow_device("https://api.example.com")

        assert creds["token"] == "JWT-OK"
        assert creds["refresh_token"] == "REFRESH-OK"
        assert creds["email"] == "user@example.com"
        assert creds["endpoint"] == "https://api.example.com"
        saved = json.loads(cred_path.read_text())
        assert saved["token"] == "JWT-OK"

    def test_expired_token_raises(self, tmp_path, monkeypatch):
        monkeypatch.setattr("datahub.auth._CREDENTIALS_PATH", tmp_path / "creds.json")
        with patch("httpx.post") as post, \
             patch("datahub.auth.time.sleep"):
            post.side_effect = [
                _init_resp(interval=1),
                _token_resp(400, {"detail": "expired_token"}),
            ]
            with pytest.raises(RuntimeError, match="expired_token"):
                login_flow_device("https://api.example.com", open_browser=False)

    def test_interval_capped(self, tmp_path, monkeypatch):
        """서버가 과도한 interval 내려줘도 클라는 _DEVICE_MAX_POLL_INTERVAL 로 제한."""
        monkeypatch.setattr("datahub.auth._CREDENTIALS_PATH", tmp_path / "creds.json")
        sleep_calls = []
        with patch("httpx.post") as post, \
             patch("datahub.auth.time.sleep", side_effect=sleep_calls.append):
            post.side_effect = [
                _init_resp(interval=9999),     # 악의적 긴 interval
                _token_resp(428),
                _token_resp(200, {"access_token": "X", "refresh_token": "Y", "email": "e@x"}),
            ]
            login_flow_device("https://api.example.com", open_browser=False)

        # 1회 pending → 1회 sleep 호출. 캡된 값으로 호출되어야 함.
        assert sleep_calls == [_DEVICE_MAX_POLL_INTERVAL]

    def test_ssh_still_attempts_browser(self, tmp_path, monkeypatch):
        """SSH 세션에서도 webbrowser.open() 시도는 한다 (VS Code Remote 등).
        실패 시엔 URL 출력 fallback."""
        monkeypatch.setenv("SSH_CONNECTION", "1.2.3.4 10 5.6.7.8 22")
        monkeypatch.setattr("datahub.auth._CREDENTIALS_PATH", tmp_path / "creds.json")
        with patch("httpx.post") as post, \
             patch("datahub.auth.webbrowser.open", return_value=True) as browser, \
             patch("datahub.auth.time.sleep"):
            post.side_effect = [
                _init_resp(interval=1),
                _token_resp(200, {"access_token": "T", "refresh_token": "R", "email": "e@x"}),
            ]
            login_flow_device("https://api.example.com")

        browser.assert_called_once()

    def test_keyboard_interrupt(self, tmp_path, monkeypatch):
        monkeypatch.setattr("datahub.auth._CREDENTIALS_PATH", tmp_path / "creds.json")
        with patch("httpx.post") as post, \
             patch("datahub.auth.time.sleep", side_effect=KeyboardInterrupt):
            post.side_effect = [
                _init_resp(interval=1),
                _token_resp(428),
            ]
            with pytest.raises(RuntimeError, match="취소"):
                login_flow_device("https://api.example.com", open_browser=False)

    def test_network_glitch_retry_recovers(self, tmp_path, monkeypatch):
        """단일 httpx.HTTPError → 재시도 → 성공."""
        monkeypatch.setattr("datahub.auth._CREDENTIALS_PATH", tmp_path / "creds.json")
        # post 호출 순서: init(성공), token(글리치 1), token(성공)
        with patch("httpx.post") as post, \
             patch("datahub.auth.time.sleep"):
            post.side_effect = [
                _init_resp(interval=1),
                httpx.ConnectError("transient"),
                _token_resp(200, {"access_token": "T", "refresh_token": "R", "email": "e@x"}),
            ]
            creds = login_flow_device("https://api.example.com", open_browser=False)

        assert creds["token"] == "T"

    def test_network_persistent_failure_raises(self, tmp_path, monkeypatch):
        """네트워크 실패가 재시도 예산(4회) 모두 소진되면 RuntimeError."""
        monkeypatch.setattr("datahub.auth._CREDENTIALS_PATH", tmp_path / "creds.json")
        with patch("httpx.post") as post, \
             patch("datahub.auth.time.sleep"):
            post.side_effect = [
                _init_resp(interval=1),
                # 1 + 3 retries = 4회 모두 실패
                httpx.ConnectError("down"),
                httpx.ConnectError("down"),
                httpx.ConnectError("down"),
                httpx.ConnectError("down"),
            ]
            with pytest.raises(RuntimeError, match="요청이.*연속 실패"):
                login_flow_device("https://api.example.com", open_browser=False)

    def test_init_404_helpful_message(self, monkeypatch, tmp_path):
        """서버에 device flow 엔드포인트 미배포 시 친절한 메시지."""
        monkeypatch.setattr("datahub.auth._CREDENTIALS_PATH", tmp_path / "creds.json")
        with patch("httpx.post") as post:
            r = MagicMock(spec=httpx.Response)
            r.status_code = 404
            r.text = "Not Found"
            post.return_value = r
            with pytest.raises(RuntimeError, match="device flow"):
                login_flow_device("https://api.example.com", open_browser=False)
