"""Tests for login_flow race (HTTPServer callback + stdin prompt)."""

from __future__ import annotations

import base64
import json
from unittest.mock import MagicMock, patch

import pytest

from datahub.auth import (
    _CallbackHandler,
    _decode_paste_code,
    _is_vscode_or_cursor_terminal,
    login_flow,
)


def _make_code(state: str, token: str = "T", refresh: str = "R", email: str = "u@e.com") -> str:
    payload = json.dumps(
        {"token": token, "refresh_token": refresh, "state": state, "email": email},
        separators=(",", ":"),
    )
    return base64.urlsafe_b64encode(payload.encode()).rstrip(b"=").decode()


class TestDecodePasteCode:
    def test_valid(self):
        code = _make_code("s1")
        p = _decode_paste_code(code)
        assert p["token"] == "T"
        assert p["state"] == "s1"

    def test_invalid_returns_none(self):
        assert _decode_paste_code("!!!not-base64!!!") is None

    def test_empty_returns_none(self):
        assert _decode_paste_code("") is None


class TestCallbackHandlerFormats:
    """_CallbackHandler 가 2가지 callback 형식 모두 처리."""

    def test_code_format_decodes_payload(self):
        """?code=<base64> — 신규 통합 경로."""
        # 직접 handler 를 호출하지 않고, parse_qs 로직만 검증
        # (실제 HTTPServer 통합 테스트는 E2E 에서)
        from urllib.parse import parse_qs

        code = _make_code("s1", token="JWT123")
        params = parse_qs(f"code={code}")
        received_code = params["code"][0]
        payload = _decode_paste_code(received_code)
        assert payload["token"] == "JWT123"

    def test_legacy_format_direct_params(self):
        """?token=...&state=...&email=... — legacy 경로, 여전히 처리됨."""
        from urllib.parse import parse_qs

        params = parse_qs("token=JWT&refresh_token=R&state=s1&email=u@e.com")
        assert params["token"][0] == "JWT"
        assert params["state"][0] == "s1"


class TestLoginFlowRace:
    """login_flow 의 race 로직 — server vs stdin 우선순위."""

    def test_stdin_wins_when_callback_server_silent(self, tmp_path, monkeypatch):
        """브라우저 callback 이 안 오고 사용자가 수동 paste 만 한 경우."""
        monkeypatch.setattr("datahub.auth._CREDENTIALS_PATH", tmp_path / "creds.json")
        monkeypatch.delenv("SSH_CONNECTION", raising=False)
        monkeypatch.delenv("SSH_TTY", raising=False)

        # state 가 stdin payload 와 일치해야 state-mismatch 에러 안 남
        captured_state = {}

        original_token_urlsafe = __import__("datahub.auth", fromlist=["secrets"]).secrets.token_urlsafe

        def fake_token_urlsafe(n):
            s = original_token_urlsafe(n)
            captured_state["s"] = s
            return s

        with patch("datahub.auth.secrets.token_urlsafe", side_effect=fake_token_urlsafe), \
             patch("datahub.auth.HTTPServer") as MockServer, \
             patch("datahub.auth.webbrowser.open"), \
             patch("datahub.auth.time.sleep"):
            # server.callback_result 는 계속 None
            srv = MagicMock()
            srv.callback_result = None
            srv.server_address = ("127.0.0.1", 12345)
            MockServer.return_value = srv

            # stdin 에서 바로 유효 code 들어옴
            # input 호출되기 전 state 가 결정돼 있어야 하므로 lambda 에서 captured_state 사용
            def fake_input(prompt=""):
                # captured_state["s"] 가 secrets.token_urlsafe 호출 후 채워짐
                return _make_code(captured_state["s"], token="STDIN-JWT")

            with patch("builtins.input", fake_input):
                creds = login_flow("https://api.example.com")

        assert creds["token"] == "STDIN-JWT"

    def test_callback_wins_before_stdin(self, tmp_path, monkeypatch):
        """HTTPServer 가 먼저 callback 수신하고 stdin 은 blocking."""
        monkeypatch.setattr("datahub.auth._CREDENTIALS_PATH", tmp_path / "creds.json")
        monkeypatch.delenv("SSH_CONNECTION", raising=False)
        monkeypatch.delenv("SSH_TTY", raising=False)

        captured_state = {}
        original_token_urlsafe = __import__("datahub.auth", fromlist=["secrets"]).secrets.token_urlsafe

        def fake_token_urlsafe(n):
            s = original_token_urlsafe(n)
            captured_state["s"] = s
            return s

        with patch("datahub.auth.secrets.token_urlsafe", side_effect=fake_token_urlsafe), \
             patch("datahub.auth.HTTPServer") as MockServer, \
             patch("datahub.auth.webbrowser.open"), \
             patch("datahub.auth.time.sleep"):
            srv = MagicMock()
            srv.server_address = ("127.0.0.1", 9999)
            # server.callback_result 를 곧 채움
            def populate_on_handle(*a, **kw):
                srv.callback_result = {
                    "token": "SERVER-JWT",
                    "refresh_token": "SR",
                    "state": captured_state["s"],
                    "email": "server@e.com",
                    "error": None,
                }
            srv.handle_request = MagicMock(side_effect=populate_on_handle)
            srv.callback_result = None
            MockServer.return_value = srv

            # stdin 은 영원히 blocking (empty input → 재시도 loop)
            def blocking_input(prompt=""):
                import time as _t
                _t.sleep(60)  # 충분히 긴 시간
                return ""

            with patch("builtins.input", blocking_input):
                creds = login_flow("https://api.example.com")

        assert creds["token"] == "SERVER-JWT"

    def _run_login_flow_capturing_stdout(self, tmp_path, monkeypatch):
        """login_flow 를 mock 으로 돌려 stdout 을 문자열로 수거.

        race 조건 차단: stdin thread 는 patched input 안에서 영원히 대기.
        server callback 이 먼저 완료해 race 를 승리하도록 구성.
        """
        import contextlib
        import io
        import threading

        monkeypatch.setattr("datahub.auth._CREDENTIALS_PATH", tmp_path / "creds.json")
        monkeypatch.delenv("SSH_CONNECTION", raising=False)
        monkeypatch.delenv("SSH_TTY", raising=False)

        captured_state = {}
        original_token_urlsafe = __import__("datahub.auth", fromlist=["secrets"]).secrets.token_urlsafe

        def fake_token_urlsafe(n):
            s = original_token_urlsafe(n)
            captured_state["s"] = s
            return s

        thread_entered = threading.Event()
        never_set = threading.Event()
        def blocking_input(*a, **kw):
            thread_entered.set()
            never_set.wait()
            return ""  # 도달 불가

        buf = io.StringIO()
        with patch("datahub.auth.secrets.token_urlsafe", side_effect=fake_token_urlsafe), \
             patch("datahub.auth.HTTPServer") as MockServer, \
             patch("datahub.auth.webbrowser.open"), \
             patch("datahub.auth.time.sleep"), \
             patch("builtins.input", blocking_input), \
             contextlib.redirect_stdout(buf):
            srv = MagicMock()
            srv.server_address = ("127.0.0.1", 44605)

            def populate_on_handle(*a, **kw):
                srv.callback_result = {
                    "token": "T", "refresh_token": "R",
                    "state": captured_state["s"],
                    "email": "u@e.com", "error": None,
                }
            srv.handle_request = MagicMock(side_effect=populate_on_handle)
            srv.callback_result = None
            MockServer.return_value = srv

            login_flow("https://api.example.com")
            assert thread_entered.wait(timeout=2.0), \
                "stdin thread failed to enter patched input — race guard lost"

        return buf.getvalue(), MockServer

    def test_http_server_binds_loopback_and_ide_emits_callback_url(self, tmp_path, monkeypatch):
        """IDE 환경에서: HTTPServer 는 127.0.0.1 바인딩 + 감지용 callback URL 출력."""
        monkeypatch.setenv("TERM_PROGRAM", "vscode")

        out, MockServer = self._run_login_flow_capturing_stdout(tmp_path, monkeypatch)

        bind_call = MockServer.call_args
        assert bind_call.args[0] == ("127.0.0.1", 0), \
            f"HTTPServer must bind to 127.0.0.1:0, got {bind_call.args[0]}"
        assert "http://localhost:44605/callback" in out, \
            "IDE 환경에서는 감지 트리거용 callback URL 이 stdout 에 있어야 한다"

    def test_plain_terminal_hides_callback_url(self, tmp_path, monkeypatch):
        """일반 터미널(IDE 아님)에서는 `http://localhost:<port>` 을 출력하지 않는다.
        사용자가 localhost URL 을 클릭해서 여는 곳으로 오해하는 UX 회귀 방지."""
        for var in ("TERM_PROGRAM", "VSCODE_IPC_HOOK_CLI", "VSCODE_INJECTION"):
            monkeypatch.delenv(var, raising=False)

        out, _ = self._run_login_flow_capturing_stdout(tmp_path, monkeypatch)

        assert "http://localhost" not in out, \
            "일반 터미널에서는 localhost callback URL 을 stdout 에 노출하면 안 된다"
        # paste 안내는 반드시 있어야 함
        assert "paste" in out.lower() or "code" in out.lower(), \
            "일반 터미널에서는 paste/code 안내가 있어야 한다"

    def test_http_server_binds_loopback_for_ide_autoforward(self, tmp_path, monkeypatch):
        """레거시 테스트 유지: IDE 환경에서 바인딩 + URL 출력 검증."""
        import contextlib
        import io

        monkeypatch.setattr("datahub.auth._CREDENTIALS_PATH", tmp_path / "creds.json")
        monkeypatch.delenv("SSH_CONNECTION", raising=False)
        monkeypatch.delenv("SSH_TTY", raising=False)
        monkeypatch.setenv("TERM_PROGRAM", "vscode")

        captured_state = {}
        original_token_urlsafe = __import__("datahub.auth", fromlist=["secrets"]).secrets.token_urlsafe

        def fake_token_urlsafe(n):
            s = original_token_urlsafe(n)
            captured_state["s"] = s
            return s

        # stdin thread 가 patched input 안에서 대기하도록 유도해, patch 해제 후
        # real input() 이 호출되는 race 를 차단 (daemon thread 는 종료 시 정리).
        import threading
        thread_entered = threading.Event()
        never_set = threading.Event()
        def blocking_input(*a, **kw):
            thread_entered.set()
            never_set.wait()
            return ""  # 도달 불가

        buf = io.StringIO()
        with patch("datahub.auth.secrets.token_urlsafe", side_effect=fake_token_urlsafe), \
             patch("datahub.auth.HTTPServer") as MockServer, \
             patch("datahub.auth.webbrowser.open"), \
             patch("datahub.auth.time.sleep"), \
             patch("builtins.input", blocking_input), \
             contextlib.redirect_stdout(buf):
            srv = MagicMock()
            srv.server_address = ("127.0.0.1", 44605)

            def populate_on_handle(*a, **kw):
                srv.callback_result = {
                    "token": "T", "refresh_token": "R",
                    "state": captured_state["s"],
                    "email": "u@e.com", "error": None,
                }
            srv.handle_request = MagicMock(side_effect=populate_on_handle)
            srv.callback_result = None
            MockServer.return_value = srv

            login_flow("https://api.example.com")
            # patch 해제 전 stdin thread 가 patched input 에 진입했는지 확인
            assert thread_entered.wait(timeout=2.0), \
                "stdin thread failed to enter patched input — race guard lost"

        # 1) 바인딩 주소 — loopback 필수 (IDE process-mode 감지 조건)
        bind_call = MockServer.call_args
        assert bind_call.args[0] == ("127.0.0.1", 0), \
            f"HTTPServer must bind to 127.0.0.1:0, got {bind_call.args[0]}"

        # 2) stdout 에 감지 가능한 URL 출력 (IDE output-mode 감지 조건)
        out = buf.getvalue()
        assert "http://localhost:44605/callback" in out, \
            "Callback URL must be emitted in 'http://localhost:PORT' form for IDE auto-forward"

    def test_ide_env_detection(self, monkeypatch):
        """VSCode/Cursor integrated terminal 환경 변수 감지."""
        for var in ("TERM_PROGRAM", "VSCODE_IPC_HOOK_CLI", "VSCODE_INJECTION"):
            monkeypatch.delenv(var, raising=False)
        assert _is_vscode_or_cursor_terminal() is False

        monkeypatch.setenv("TERM_PROGRAM", "vscode")
        assert _is_vscode_or_cursor_terminal() is True
        monkeypatch.setenv("TERM_PROGRAM", "iTerm.app")
        assert _is_vscode_or_cursor_terminal() is False

        monkeypatch.setenv("VSCODE_IPC_HOOK_CLI", "/tmp/vscode.sock")
        assert _is_vscode_or_cursor_terminal() is True

    def test_state_mismatch_raises(self, tmp_path, monkeypatch):
        monkeypatch.setattr("datahub.auth._CREDENTIALS_PATH", tmp_path / "creds.json")
        monkeypatch.delenv("SSH_CONNECTION", raising=False)
        monkeypatch.delenv("SSH_TTY", raising=False)

        with patch("datahub.auth.HTTPServer") as MockServer, \
             patch("datahub.auth.webbrowser.open"), \
             patch("datahub.auth.time.sleep"):
            srv = MagicMock()
            srv.server_address = ("127.0.0.1", 1)
            srv.callback_result = None
            MockServer.return_value = srv

            # 잘못된 state 로 수동 paste
            def fake_input(prompt=""):
                return _make_code("wrong-state", token="T")

            with patch("builtins.input", fake_input):
                with pytest.raises(RuntimeError, match="State mismatch"):
                    login_flow("https://api.example.com")
