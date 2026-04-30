"""Browser-based login flow for DataHub CLI.

Opens data-platform-api's OAuth login, receives a JWT token
via a localhost callback server, and stores it in ~/.datahub/credentials.json.

Paste mode (login_flow_paste):
  No localhost server required. Platform API returns a base64url-encoded code
  after OAuth; user pastes it into the terminal.
"""

from __future__ import annotations

import base64
import json
import os
import secrets
import stat
import threading
import time
import webbrowser

import httpx
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Optional
from urllib.parse import parse_qs, urlencode, urlparse

_CREDENTIALS_PATH = Path.home() / ".datahub" / "credentials.json"
_CALLBACK_TIMEOUT = 120  # seconds


class CredentialStore:
    """Read/write ~/.datahub/credentials.json."""

    @staticmethod
    def load() -> Optional[dict]:
        """Load stored credentials. Returns None if missing."""
        if not _CREDENTIALS_PATH.exists():
            return None
        try:
            data = json.loads(_CREDENTIALS_PATH.read_text())
            if not data.get("token"):
                return None
            return data
        except (json.JSONDecodeError, KeyError):
            return None

    @staticmethod
    def save(credentials: dict) -> None:
        """Save credentials with restricted file permissions (0600)."""
        _CREDENTIALS_PATH.parent.mkdir(parents=True, exist_ok=True)
        _CREDENTIALS_PATH.write_text(json.dumps(credentials, indent=2))
        os.chmod(_CREDENTIALS_PATH, stat.S_IRUSR | stat.S_IWUSR)

    @staticmethod
    def clear() -> None:
        """Remove stored credentials."""
        if _CREDENTIALS_PATH.exists():
            _CREDENTIALS_PATH.unlink()


def _decode_paste_code(code: str) -> Optional[dict]:
    """base64url(JSON) code → payload dict. 실패 시 None."""
    try:
        padding = "=" * (-len(code) % 4)
        decoded = base64.urlsafe_b64decode(code + padding)
        return json.loads(decoded)
    except Exception:
        return None


class _CallbackHandler(BaseHTTPRequestHandler):
    """HTTP handler that captures the token from the redirect callback.

    지원하는 callback 형식:
      1) `GET /callback?code=<base64url(JSON)>`
         — 신규: Phase 2 통합 API callback → 웹 /auth/complete → fetch 로 전달
      2) `GET /callback?token=...&refresh_token=...&state=...&email=...`
         — 레거시: API 가 직접 localhost 로 302 redirect 하던 방식 (호환 유지)

    CORS:
      - `Access-Control-Allow-Origin: <Origin or *>` 응답
      - `OPTIONS` preflight 지원
      → 웹의 /auth/complete 페이지가 fetch 로 호출 가능
    """

    def _write_cors_headers(self) -> None:
        origin = self.headers.get("Origin", "*")
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Max-Age", "600")

    def do_OPTIONS(self):  # noqa: N802
        self.send_response(204)
        self._write_cors_headers()
        self.end_headers()

    def do_GET(self):  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path != "/callback":
            self.send_response(404)
            self._write_cors_headers()
            self.end_headers()
            return

        params = parse_qs(parsed.query)

        # 형식 1: ?code=<base64>
        code = params.get("code", [None])[0]
        if code:
            payload = _decode_paste_code(code)
            if payload is None:
                self.server.callback_result = {  # type: ignore[attr-defined]
                    "token": None, "refresh_token": None, "state": None,
                    "email": None, "error": "invalid_code",
                }
            else:
                self.server.callback_result = {  # type: ignore[attr-defined]
                    "token": payload.get("token"),
                    "refresh_token": payload.get("refresh_token"),
                    "state": payload.get("state"),
                    "email": payload.get("email"),
                    "error": None,
                }
        else:
            # 형식 2: legacy (?token=...&refresh_token=...&state=...&email=...)
            self.server.callback_result = {  # type: ignore[attr-defined]
                "token": params.get("token", [None])[0],
                "refresh_token": params.get("refresh_token", [None])[0],
                "state": params.get("state", [None])[0],
                "email": params.get("email", [None])[0],
                "error": params.get("error", [None])[0],
            }

        result = self.server.callback_result  # type: ignore[attr-defined]
        error = result.get("error")

        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self._write_cors_headers()
        self.end_headers()

        if error:
            title = "Authentication Failed"
            message = error
            color = "#ef4444"
            icon = "&#10007;"
        else:
            title = "Authentication Successful"
            message = "You may close this window and return to your terminal."
            color = "#22c55e"
            icon = "&#10003;"

        body = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>{title}</title></head>
<body style="margin:0;display:flex;justify-content:center;align-items:center;
min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
background:#f9fafb;">
<div style="text-align:center;padding:2rem;">
<div style="width:64px;height:64px;border-radius:50%;background:{color};
color:white;font-size:32px;line-height:64px;margin:0 auto 1rem;">{icon}</div>
<h2 style="margin:0 0 0.5rem;color:#111827;">{title}</h2>
<p style="color:#6b7280;margin:0;">{message}</p>
</div></body></html>"""
        self.wfile.write(body.encode())

    def log_message(self, format, *args):  # noqa: A002
        """Suppress request logging."""


def login_flow(
    endpoint: str,
    *,
    open_browser: bool = True,
    callback_port: Optional[int] = None,
) -> dict:
    """Run the browser-based login flow via data-platform-api.

    두 경로 중 먼저 도착하는 쪽 사용 (race):
      (A) 자동 — localhost callback server 가 token 수신
          · 로컬 PC 에서 실행 시 브라우저가 localhost:<port> 에 바로 접근 가능
          · 원격이라도 웹의 /auth/complete 가 fetch 로 localhost 호출
            (CORS 허용 — _CallbackHandler 참고)
      (B) 수동 — 사용자가 stdin 에 base64 code 를 붙여넣음 (fallback)
          · 자동 전달 실패 시 웹 페이지가 code 를 UI 에 표시하므로 복사해 붙임

    어느 쪽이 먼저 완료되든 동일한 credentials 를 반환하며, 나머지 thread
    는 프로세스 종료 시 자동 정리됨 (daemon=True).

    Args:
        endpoint: data-platform-api base URL.
        open_browser: SSH 세션 감지 시 자동 skip (_try_open_browser 참고).
        callback_port: 고정 callback 포트. None=동적 할당 (기본). 일반 SSH
            에서 `ssh -L <port>:localhost:<port>` 로 미리 포워딩한 뒤 이 옵션
            으로 같은 포트를 지정하면 (A) 자동 callback 경로가 동작한다.
            VSCode/Cursor Remote 는 자동 포워드라 이 옵션 불필요.

    Returns:
        Dict with token, refresh_token, email, endpoint.

    Raises:
        RuntimeError: 타임아웃, state mismatch, decode 실패 등.
    """
    import sys
    import time

    state = secrets.token_urlsafe(32)

    bind_port = int(callback_port) if callback_port else 0
    try:
        server = HTTPServer(("127.0.0.1", bind_port), _CallbackHandler)
    except OSError as e:
        if callback_port:
            raise RuntimeError(
                f"Cannot bind callback port {callback_port}: {e}. "
                f"Another process may be using it, or remove --callback-port to use a random free port."
            ) from e
        raise
    server.callback_result = None  # type: ignore[attr-defined]
    port = server.server_address[1]

    auth_url = (
        f"{endpoint.rstrip('/')}/api/v1/auth/login?"
        + urlencode({"cli_port": port, "cli_state": state})
    )

    in_ide_terminal = _is_vscode_or_cursor_terminal()
    # 사용자가 명시적으로 callback_port 를 지정 → SSH -L 포워딩 환경 가정.
    # 이 경우 callback URL 을 출력해 사용자/IDE 가 같은 포트로 도달하는지
    # 확인할 수 있게 함. 일반 SSH 에서 사용자가 의도적으로 자동 callback 을
    # 쓰겠다고 신호한 것이므로 노출이 안전.
    show_callback = in_ide_terminal or bool(callback_port)

    print(f"Endpoint: {endpoint}")
    print(f"\nLogin URL:\n  {auth_url}\n")
    _warn_insecure_endpoint(endpoint)

    if show_callback:
        # VSCode/Cursor Remote SSH 의 auto port forwarding 은 터미널 출력에서
        # `http://localhost:<port>` 패턴을 감지해 로컬 localhost 로 투명 포워딩한다.
        # 일반 터미널에서는 이 URL 이 보이면 "클릭해서 여는 곳" 으로 오해를 유발하므로
        # IDE 감지 또는 사용자가 명시적으로 callback_port 를 지정한 경우에만 출력.
        print(f"Callback: http://localhost:{port}/callback\n")
        if in_ide_terminal:
            # IDE 가 위 URL 을 파싱해 포워딩을 설정할 여유(수백 ms) 확보.
            time.sleep(0.5)

    browser_opened = False
    if open_browser:
        browser_opened = _try_open_browser(auth_url)
        if browser_opened:
            print("Browser opened automatically.")
        else:
            print(
                "Could not open browser automatically. Open the Login URL above in a local browser.",
                file=sys.stderr,
            )

    if in_ide_terminal:
        print(
            f"\nWaiting for login... (IDE auto-forward on :{port} / manual paste fallback below)\n"
            f"If auto-transfer fails, the web page will show a code — copy+paste it here."
        )
    elif callback_port:
        print(
            f"\nWaiting for login...\n"
            f"Auto-callback: requires `ssh -L {port}:localhost:{port}` forwarding from your local machine.\n"
            f"If that's set up, login will complete automatically.\n"
            f"Otherwise the web page will show a one-line code — copy it and paste below."
        )
    else:
        hint = (
            "Open the Login URL above in a local browser and complete sign-in."
            if not browser_opened
            else "Complete sign-in in the opened browser."
        )
        print(
            f"\nWaiting for login...\n"
            f"{hint}\n"
            f"The web page will then show a one-line code — copy it and paste below."
        )

    # (A) Callback server thread
    server_thread = threading.Thread(target=server.handle_request, daemon=True)
    server_thread.start()

    # (B) Stdin reader thread
    stdin_result: dict = {}

    def _stdin_reader() -> None:
        while True:
            try:
                line = input("Paste code > ").strip()
            except (EOFError, KeyboardInterrupt):
                return
            if not line:
                continue
            payload = _decode_paste_code(line)
            if payload is None:
                print("  (invalid code, try again)", file=sys.stderr)
                continue
            stdin_result["payload"] = payload
            return

    stdin_thread = threading.Thread(target=_stdin_reader, daemon=True)
    stdin_thread.start()

    # Race: poll both sources until one completes or timeout
    deadline = time.time() + _CALLBACK_TIMEOUT
    result: Optional[dict] = None
    try:
        while time.time() < deadline:
            if server.callback_result is not None:  # type: ignore[attr-defined]
                result = server.callback_result  # type: ignore[attr-defined]
                break
            if "payload" in stdin_result:
                p = stdin_result["payload"]
                result = {
                    "token": p.get("token"),
                    "refresh_token": p.get("refresh_token"),
                    "state": p.get("state"),
                    "email": p.get("email"),
                    "error": None,
                }
                break
            time.sleep(0.3)
    except KeyboardInterrupt:
        server.server_close()
        raise RuntimeError("Login cancelled by user.")

    server.server_close()

    if result is None:
        raise RuntimeError(f"Login timed out after {_CALLBACK_TIMEOUT} seconds.")
    if result.get("error"):
        raise RuntimeError(f"Login failed: {result['error']}")
    if not result.get("token"):
        raise RuntimeError("No token received from server.")
    if result.get("state") != state:
        raise RuntimeError("State mismatch — possible CSRF attack.")

    credentials = {
        "token": result["token"],
        "refresh_token": result.get("refresh_token", ""),
        "email": result.get("email", ""),
        "endpoint": endpoint,
    }
    CredentialStore.save(credentials)
    return credentials


# ── Paste / OOB mode (cli_paste=true) ────────────────
#
# 로컬 HTTP 서버·포트 포워딩 없이 동작하는 가장 단순한 no-browser 흐름:
#   1. /auth/login?cli_paste=true&cli_state=<state> URL 출력
#   2. 사용자가 URL 을 브라우저에서 열어 OAuth 완료
#   3. 플랫폼이 base64url(JSON) code 를 HTML 페이지에 표시
#   4. 사용자가 code 를 복사 → 터미널 붙여넣기
#   5. SDK 가 디코딩 후 credentials 저장


def login_flow_paste(endpoint: str) -> dict:
    """Paste-mode login — no localhost server or port-forwarding required.

    Platform API must support ``cli_paste=true`` on ``/api/v1/auth/login``.
    After OAuth the platform shows a one-line base64url code; the user pastes
    it here and credentials are decoded and saved locally.

    Args:
        endpoint: data-platform-api base URL.

    Returns:
        Dict with ``token``, ``refresh_token``, ``email``, ``endpoint``.

    Raises:
        RuntimeError: If the code is invalid, the state mismatches, or no token.
    """
    state = secrets.token_urlsafe(32)

    auth_url = (
        f"{endpoint.rstrip('/')}/api/v1/auth/login?"
        + urlencode({"cli_paste": "true", "cli_state": state})
    )

    print(f"\nOpen the following URL in your browser:\n\n    {auth_url}\n")
    print("After authorization, copy the code shown on the page and paste it below.")
    print("(이 창을 닫지 마세요 — 코드는 30분 내 사용해야 합니다)\n")

    try:
        code = input("Paste code here: ").strip()
    except (EOFError, KeyboardInterrupt) as exc:
        raise RuntimeError("Login cancelled.") from exc

    if not code:
        raise RuntimeError("No code entered.")

    # Decode base64url → JSON (re-add stripped padding)
    padded = code + "=" * (-len(code) % 4)
    try:
        payload = json.loads(base64.urlsafe_b64decode(padded))
    except Exception as exc:
        raise RuntimeError(
            f"Invalid code (decoding failed: {exc}). "
            "Make sure you copied the full code from the browser page."
        ) from exc

    if payload.get("state") != state:
        raise RuntimeError(
            "State mismatch — the code does not match this login session. "
            "Make sure you used the URL printed above and did not refresh the page."
        )

    if not payload.get("token"):
        raise RuntimeError("No token found in code.")

    credentials = {
        "token": payload["token"],
        "refresh_token": payload.get("refresh_token", ""),
        "email": payload.get("email", ""),
        "endpoint": endpoint,
    }
    CredentialStore.save(credentials)
    return credentials


# ── Device Authorization Grant (원격 환경 친화) ────────
#
# RFC 8628 단순화 변형. 포트 포워딩·HTTPServer 불필요:
#   1. POST {endpoint}/api/v1/auth/device/init → {device_code, verification_uri}
#   2. verification_uri 를 사용자에게 출력 (로컬 브라우저에서 열기)
#   3. POST {endpoint}/api/v1/auth/device/token 을 interval 마다 polling
#   4. 428 pending → 계속 polling, 200 → 토큰 저장, 400 → 에러
#
# 서버 측 `/api/v1/auth/device/*` 엔드포인트 배포 필수.

_DEVICE_DEFAULT_POLL_INTERVAL = 5    # 서버가 응답으로 내려주는 값 우선, 없으면 이 값
_DEVICE_DEFAULT_TIMEOUT = 600        # 서버 expires_in 우선, 없으면 이 값
_DEVICE_MAX_POLL_INTERVAL = 30       # 서버가 악의적 긴 interval 내려줘도 여기서 cap
_DEVICE_NET_RETRY_DELAYS = (0.5, 1.0, 2.0)  # 네트워크 글리치 재시도 백오프


def _is_ssh_session() -> bool:
    """원격 SSH 세션에서 실행 중인지 감지. SSH_CONNECTION / SSH_TTY 모두 체크."""
    return bool(os.environ.get("SSH_CONNECTION") or os.environ.get("SSH_TTY"))


def _is_vscode_or_cursor_terminal() -> bool:
    """VSCode / Cursor integrated terminal 감지.

    이 환경에서는 IDE 가 원격 VM 의 loopback LISTEN 포트를 자동으로
    로컬 머신 localhost 로 포워딩해준다 (auto port forwarding). 최근
    버전은 터미널 출력의 `http://localhost:<port>` 패턴을 감지해
    포워딩을 trigger 하는 "output/hybrid" 모드가 기본이므로, 감지 시
    HTTPServer 바인딩 후 짧게 대기해 IDE 가 포트를 잡을 여유를 준다.
    """
    return (
        os.environ.get("TERM_PROGRAM") == "vscode"
        or bool(os.environ.get("VSCODE_IPC_HOOK_CLI"))
        or bool(os.environ.get("VSCODE_INJECTION"))
    )


def _warn_insecure_endpoint(endpoint: str) -> None:
    """endpoint 가 http:// 면 stderr 경고. production 배포가 아니라는 가정."""
    import sys
    if endpoint.lower().startswith("http://"):
        print(
            "⚠️  WARNING: endpoint is not HTTPS. Tokens will be transmitted in plaintext. "
            "Use only in local development.",
            file=sys.stderr,
        )


def _try_open_browser(url: str) -> bool:
    """브라우저 열기 항상 시도. 실패하면 False 반환.

    SSH 환경(VS Code Remote, SSH X-forwarding 등)에서도 브라우저가 열릴 수
    있는 경우가 있으므로 시도는 무조건 한다. 실패해도 URL 은 이미 콘솔에
    출력돼 있어 수동으로 열 수 있음.
    """
    try:
        return bool(webbrowser.open(url))
    except Exception:
        return False


def login_flow_device(endpoint: str, *, open_browser: bool = True) -> dict:
    """Device flow 로그인 — 원격 SSH / Jupyter / 포트 포워딩 없는 환경용.

    OAuth 2.0 Device Authorization Grant (RFC 8628 단순화 변형):
      1. POST /auth/device/init → device_code, verification_uri
      2. verification_uri 를 사용자에게 출력 (+ open_browser 시도)
      3. POST /auth/device/token 를 interval 마다 polling
      4. 200 → credentials 저장, 428 → 대기, 400 → 만료/거부

    Args:
        endpoint: data-platform-api base URL.
        open_browser: True 면 webbrowser.open() 시도.
                      원격 SSH 세션(SSH_CONNECTION env) 에서는 자동 skip.

    Returns:
        {"token", "refresh_token", "email", "endpoint"}

    Raises:
        RuntimeError: device_code 만료, 서버 에러, 타임아웃, 사용자 중단.
    """
    import sys

    base = endpoint.rstrip("/")
    _warn_insecure_endpoint(base)

    # 1) /device/init
    try:
        init_resp = httpx.post(f"{base}/api/v1/auth/device/init", timeout=15)
    except httpx.HTTPError as exc:
        raise RuntimeError(f"/auth/device/init 요청 실패: {exc}") from exc
    if init_resp.status_code != 200:
        raise RuntimeError(
            f"/auth/device/init 비정상 응답 {init_resp.status_code}: {init_resp.text}\n"
            "서버에 device flow 엔드포인트가 배포되어 있는지 확인하세요."
        )
    init = init_resp.json()
    device_code = init["device_code"]
    verification_uri = init["verification_uri"]
    server_interval = int(init.get("interval") or _DEVICE_DEFAULT_POLL_INTERVAL)
    interval = max(1, min(server_interval, _DEVICE_MAX_POLL_INTERVAL))
    expires_in = int(init.get("expires_in") or _DEVICE_DEFAULT_TIMEOUT)

    # 2) 사용자에게 URL 안내
    print("\n로컬 브라우저에서 아래 URL 을 열어 Google 로그인을 완료하세요:\n")
    print(f"  {verification_uri}\n")
    if open_browser:
        if _try_open_browser(verification_uri):
            print("브라우저가 자동으로 열렸습니다.")
        else:
            # SSH 세션이거나 webbrowser.open() 실패 — 사용자에게 명시
            print(
                "브라우저가 자동으로 열리지 않았습니다. 위 URL 을 복사해서 로컬 브라우저에 여세요.",
                file=sys.stderr,
            )
    print(f"(인증 완료 대기 중... 최대 {expires_in}s, {interval}s 간격으로 polling. Ctrl+C 로 취소)\n")

    # 3) polling (네트워크 글리치 retry + Ctrl+C 처리)
    deadline = time.time() + expires_in
    try:
        while time.time() < deadline:
            tok_resp = _poll_device_token_with_retry(base, device_code, interval)

            if tok_resp.status_code == 200:
                payload = tok_resp.json()
                credentials = {
                    "token": payload["access_token"],
                    "refresh_token": payload.get("refresh_token", ""),
                    "email": payload.get("email", ""),
                    "endpoint": base,
                }
                CredentialStore.save(credentials)
                return credentials

            if tok_resp.status_code == 428:
                time.sleep(interval)
                continue

            if tok_resp.status_code == 400:
                try:
                    detail = tok_resp.json().get("detail", "")
                except Exception:
                    detail = tok_resp.text
                raise RuntimeError(f"Device flow 실패: {detail}")

            raise RuntimeError(
                f"/auth/device/token 예기치 않은 응답 {tok_resp.status_code}: {tok_resp.text}"
            )
    except KeyboardInterrupt:
        raise RuntimeError(
            "Device flow 가 취소되었습니다. "
            f"device_code 는 서버 측 TTL({expires_in}s) 만료 후 자동 정리됩니다."
        )

    raise RuntimeError(f"Device flow 타임아웃 ({expires_in}s). 다시 시도하세요.")


def _poll_device_token_with_retry(base: str, device_code: str, interval: int):
    """POST /auth/device/token — 네트워크 글리치 시 짧은 백오프로 재시도.

    일시적 네트워크 단절(Wi-Fi 전환, DNS 블립 등) 로 polling 전체가 중단되지
    않도록 단일 요청 실패 시 0.5/1/2초 백오프로 최대 3회 재시도.
    """
    last_exc: Exception | None = None
    for backoff in (0.0,) + _DEVICE_NET_RETRY_DELAYS:
        if backoff:
            time.sleep(backoff)
        try:
            return httpx.post(
                f"{base}/api/v1/auth/device/token",
                json={"device_code": device_code},
                timeout=10,
            )
        except httpx.HTTPError as exc:
            last_exc = exc
            continue

    raise RuntimeError(
        f"/auth/device/token 요청이 {len(_DEVICE_NET_RETRY_DELAYS) + 1}회 연속 실패: {last_exc}"
    ) from last_exc
