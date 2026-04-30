"""Tests for login_flow_paste (--no-browser paste/OOB mode)."""

from __future__ import annotations

import base64
import json
import secrets
from unittest.mock import MagicMock, patch

import pytest

from datahub.auth import CredentialStore, login_flow_paste


def _make_code(state: str, token: str = "tok123", refresh: str = "ref456", email: str = "u@ex.com") -> str:
    """Encode a valid paste code the way the platform would."""
    payload = json.dumps(
        {"token": token, "refresh_token": refresh, "state": state, "email": email},
        separators=(",", ":"),
    )
    return base64.urlsafe_b64encode(payload.encode()).rstrip(b"=").decode()


class TestLoginFlowPaste:
    """Unit tests for login_flow_paste()."""

    def test_happy_path_saves_credentials(self, tmp_path, monkeypatch):
        """Valid code → credentials saved and returned."""
        captured_state: list[str] = []

        # Intercept secrets.token_urlsafe to capture the generated state
        real_token_urlsafe = secrets.token_urlsafe

        def _fake_token_urlsafe(n: int) -> str:
            state = real_token_urlsafe(n)
            captured_state.append(state)
            return state

        monkeypatch.setattr("datahub.auth.secrets.token_urlsafe", _fake_token_urlsafe)

        # Provide code after state is known
        def _fake_input(_prompt: str) -> str:
            return _make_code(captured_state[0])

        monkeypatch.setattr("builtins.input", _fake_input)

        creds_path = tmp_path / "credentials.json"
        monkeypatch.setattr("datahub.auth._CREDENTIALS_PATH", creds_path)

        result = login_flow_paste("https://api.datahub.lgair-data.com")

        assert result["token"] == "tok123"
        assert result["refresh_token"] == "ref456"
        assert result["email"] == "u@ex.com"
        assert result["endpoint"] == "https://api.datahub.lgair-data.com"
        assert creds_path.exists()

    def test_url_contains_cli_paste_param(self, monkeypatch, capsys):
        """Auth URL must include cli_paste=true and cli_state."""
        captured_state: list[str] = []
        real_token_urlsafe = secrets.token_urlsafe

        def _fake_token_urlsafe(n: int) -> str:
            state = real_token_urlsafe(n)
            captured_state.append(state)
            return state

        monkeypatch.setattr("datahub.auth.secrets.token_urlsafe", _fake_token_urlsafe)

        def _fake_input(_prompt: str) -> str:
            return _make_code(captured_state[0])

        monkeypatch.setattr("builtins.input", _fake_input)
        monkeypatch.setattr("datahub.auth.CredentialStore", MagicMock())

        login_flow_paste("https://api.datahub.lgair-data.com")

        out = capsys.readouterr().out
        assert "cli_paste=true" in out
        assert "cli_state=" in out

    def test_state_mismatch_raises(self, monkeypatch):
        """Code with wrong state → RuntimeError."""
        monkeypatch.setattr("builtins.input", lambda _: _make_code("wrong-state"))
        monkeypatch.setattr("datahub.auth.CredentialStore", MagicMock())

        with pytest.raises(RuntimeError, match="State mismatch"):
            login_flow_paste("https://api.datahub.lgair-data.com")

    def test_invalid_base64_raises(self, monkeypatch):
        """Garbage input → RuntimeError."""
        monkeypatch.setattr("builtins.input", lambda _: "not-valid-base64!!!")
        monkeypatch.setattr("datahub.auth.CredentialStore", MagicMock())

        with pytest.raises(RuntimeError, match="Invalid code"):
            login_flow_paste("https://api.datahub.lgair-data.com")

    def test_empty_input_raises(self, monkeypatch):
        """Empty paste → RuntimeError."""
        monkeypatch.setattr("builtins.input", lambda _: "")
        monkeypatch.setattr("datahub.auth.CredentialStore", MagicMock())

        with pytest.raises(RuntimeError, match="No code entered"):
            login_flow_paste("https://api.datahub.lgair-data.com")

    def test_missing_token_raises(self, monkeypatch):
        """Code with empty token → RuntimeError."""
        state = secrets.token_urlsafe(32)
        monkeypatch.setattr("datahub.auth.secrets.token_urlsafe", lambda _: state)
        code = _make_code(state, token="")
        monkeypatch.setattr("builtins.input", lambda _: code)
        monkeypatch.setattr("datahub.auth.CredentialStore", MagicMock())

        with pytest.raises(RuntimeError, match="No token"):
            login_flow_paste("https://api.datahub.lgair-data.com")

    def test_keyboard_interrupt_raises(self, monkeypatch):
        """Ctrl+C / EOF → RuntimeError('Login cancelled')."""
        monkeypatch.setattr("builtins.input", lambda _: (_ for _ in ()).throw(KeyboardInterrupt()))
        monkeypatch.setattr("datahub.auth.CredentialStore", MagicMock())

        with pytest.raises(RuntimeError, match="Login cancelled"):
            login_flow_paste("https://api.datahub.lgair-data.com")


class TestLoginCLINoBrowser:
    """CLI --no-browser flag routes to login_flow_paste."""

    def test_no_browser_calls_paste_flow(self, monkeypatch):
        """datahub login --no-browser must use login_flow_paste, not login_flow."""
        from click.testing import CliRunner
        from datahub.cli import cli

        mock_paste = MagicMock(return_value={"token": "t", "refresh_token": "r", "email": "u@ex.com", "endpoint": "https://api.datahub.lgair-data.com"})

        with patch("datahub.auth.login_flow_paste", mock_paste):
            runner = CliRunner()
            result = runner.invoke(cli, ["login", "--no-browser"])

        mock_paste.assert_called_once()
        assert result.exit_code == 0

    def test_default_login_calls_login_flow(self, monkeypatch):
        """datahub login (no flags) must use login_flow with open_browser=True."""
        from click.testing import CliRunner
        from datahub._defaults import DEFAULT_ENDPOINT
        from datahub.cli import cli

        mock_flow = MagicMock(return_value={"token": "t", "refresh_token": "r", "email": "u@ex.com", "endpoint": DEFAULT_ENDPOINT})

        with patch("datahub.auth.login_flow", mock_flow):
            runner = CliRunner()
            result = runner.invoke(cli, ["login"])

        mock_flow.assert_called_once_with(
            DEFAULT_ENDPOINT, open_browser=True, callback_port=None
        )

    def test_login_with_callback_port_passed_through(self, monkeypatch):
        """`datahub login --callback-port 8765` must forward the port to login_flow."""
        from click.testing import CliRunner
        from datahub._defaults import DEFAULT_ENDPOINT
        from datahub.cli import cli

        mock_flow = MagicMock(return_value={"token": "t", "refresh_token": "r", "email": "u@ex.com", "endpoint": DEFAULT_ENDPOINT})

        with patch("datahub.auth.login_flow", mock_flow):
            runner = CliRunner()
            result = runner.invoke(cli, ["login", "--callback-port", "8765"])

        mock_flow.assert_called_once_with(
            DEFAULT_ENDPOINT, open_browser=True, callback_port=8765
        )
        assert result.exit_code == 0
