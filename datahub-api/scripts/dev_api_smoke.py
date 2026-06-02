from __future__ import annotations

import os
import sys
import time
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
import jwt


def _service_jwt(email: str) -> str:
    secret = os.environ["JWT_SECRET"]
    now = datetime.now(timezone.utc)
    payload = {
        "email": email,
        "iat": now,
        "exp": now + timedelta(minutes=30),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def _expect(response: httpx.Response, status_code: int, label: str) -> dict[str, Any]:
    if response.status_code != status_code:
        body = response.text[:1000]
        raise RuntimeError(f"{label} failed: expected {status_code}, got {response.status_code}\n{body}")
    if not response.content:
        return {}
    return response.json()


def _wait_for_health(client: httpx.Client, timeout_seconds: int = 30) -> None:
    deadline = time.monotonic() + timeout_seconds
    last_error = ""
    while time.monotonic() < deadline:
        try:
            response = client.get("/api/v1/health")
            if response.status_code == 200:
                return
            last_error = f"status={response.status_code} body={response.text[:300]}"
        except httpx.RequestError as exc:
            last_error = str(exc)
        time.sleep(1)
    raise RuntimeError(f"health failed: API did not become ready within {timeout_seconds}s; last_error={last_error}")


def main() -> int:
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8080"
    email = os.environ.get("DATAHUB_DEV_SMOKE_EMAIL", "local-dev@example.com")
    bearer = {"Authorization": f"Bearer {_service_jwt(email)}"}

    with httpx.Client(base_url=base_url.rstrip("/"), timeout=10.0) as client:
        _wait_for_health(client)

        licenses = _expect(client.get("/api/v1/meta/licenses"), 200, "meta/licenses")
        if not isinstance(licenses, list) or not licenses:
            raise RuntimeError("meta/licenses failed: expected a non-empty list")

        whoami = _expect(client.get("/api/v1/auth/whoami", headers=bearer), 200, "auth/whoami")
        if whoami.get("email") != email:
            raise RuntimeError(f"auth/whoami returned unexpected email: {whoami}")

        session = _expect(client.post("/api/v1/auth/session", headers=bearer), 200, "auth/session")
        if session.get("email") != email:
            raise RuntimeError(f"auth/session returned unexpected email: {session}")

        token_name = f"local-smoke-{int(time.time())}"
        created = _expect(
            client.post(
                "/api/v1/auth/access-tokens",
                headers=bearer,
                json={"name": token_name, "token_type": "read"},
            ),
            200,
            "auth/access-tokens create",
        )
        access_token = created.get("access_token")
        if not isinstance(access_token, str) or not access_token.startswith(("dh_", "dl_")):
            raise RuntimeError("auth/access-tokens create did not return an access token")

        token_bearer = {"Authorization": f"Bearer {access_token}"}
        listed = _expect(
            client.get("/api/v1/auth/access-tokens", headers=token_bearer),
            200,
            "auth/access-tokens list with issued token",
        )
        if not isinstance(listed.get("access_tokens"), list):
            raise RuntimeError(f"auth/access-tokens list returned unexpected shape: {listed}")

    print(f"OK local API smoke passed: {base_url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
