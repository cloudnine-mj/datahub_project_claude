"""MCP OAuth 세션 저장소.

Redis 기반 세션 저장소와 in-memory fallback을 제공합니다.
REDIS_URL이 설정되면 Redis를 사용하고, 미설정 시 in-memory (단일 파드 개발용)로 동작합니다.

키 네임스페이스:
  mcp:client:{client_id}   — 등록된 MCP 클라이언트 (TTL 없음)
  mcp:pending:{state}      — PKCE + state 임시 저장 (TTL 10분)
  mcp:code:{code}          — authorization code (TTL 5분)
  mcp:refresh:{token}      — refresh token (TTL 7일)
"""

from __future__ import annotations

import json
import time
from typing import Optional

from app.config import settings


def _make_store() -> "_OAuthStore":
    if settings.redis_url:
        return _RedisStore(settings.redis_url)
    return _InMemoryStore()


class _OAuthStore:
    """OAuth 세션 저장소 인터페이스."""

    # ── Registered Clients ────────────────────────────

    def set_client(self, client_id: str, data: dict) -> None:
        raise NotImplementedError

    def get_client(self, client_id: str) -> Optional[dict]:
        raise NotImplementedError

    # ── Pending Auth (PKCE + state) ───────────────────

    def set_pending(self, state: str, data: dict, ttl: int = 600) -> None:
        raise NotImplementedError

    def pop_pending(self, state: str) -> Optional[dict]:
        raise NotImplementedError

    def get_pending(self, state: str) -> Optional[dict]:
        """비파괴 읽기. polling 류 용도 (device flow 등)."""
        raise NotImplementedError

    def has_pending(self, state: str) -> bool:
        raise NotImplementedError

    # ── Authorization Codes ───────────────────────────

    def set_auth_code(self, code: str, data: dict, ttl: int = 300) -> None:
        raise NotImplementedError

    def pop_auth_code(self, code: str) -> Optional[dict]:
        raise NotImplementedError

    # ── Refresh Tokens ────────────────────────────────

    def set_refresh_token(self, token: str, data: dict, ttl: int = 86400 * 7) -> None:
        raise NotImplementedError

    def get_refresh_token(self, token: str) -> Optional[dict]:
        raise NotImplementedError

    def delete_refresh_token(self, token: str) -> None:
        raise NotImplementedError


class _RedisStore(_OAuthStore):
    """Redis 기반 세션 저장소."""

    def __init__(self, url: str) -> None:
        import redis

        self._r = redis.from_url(url, decode_responses=True)

    def _key(self, prefix: str, value: str) -> str:
        return f"mcp:{prefix}:{value}"

    def set_client(self, client_id: str, data: dict) -> None:
        self._r.set(self._key("client", client_id), json.dumps(data))

    def get_client(self, client_id: str) -> Optional[dict]:
        raw = self._r.get(self._key("client", client_id))
        return json.loads(raw) if raw else None

    def set_pending(self, state: str, data: dict, ttl: int = 600) -> None:
        self._r.setex(self._key("pending", state), ttl, json.dumps(data))

    def pop_pending(self, state: str) -> Optional[dict]:
        key = self._key("pending", state)
        raw = self._r.getdel(key)
        return json.loads(raw) if raw else None

    def get_pending(self, state: str) -> Optional[dict]:
        raw = self._r.get(self._key("pending", state))
        return json.loads(raw) if raw else None

    def has_pending(self, state: str) -> bool:
        return bool(self._r.exists(self._key("pending", state)))

    def set_auth_code(self, code: str, data: dict, ttl: int = 300) -> None:
        self._r.setex(self._key("code", code), ttl, json.dumps(data))

    def pop_auth_code(self, code: str) -> Optional[dict]:
        key = self._key("code", code)
        raw = self._r.getdel(key)
        return json.loads(raw) if raw else None

    def set_refresh_token(self, token: str, data: dict, ttl: int = 86400 * 7) -> None:
        self._r.setex(self._key("refresh", token), ttl, json.dumps(data))

    def get_refresh_token(self, token: str) -> Optional[dict]:
        raw = self._r.get(self._key("refresh", token))
        return json.loads(raw) if raw else None

    def delete_refresh_token(self, token: str) -> None:
        self._r.delete(self._key("refresh", token))


class _InMemoryStore(_OAuthStore):
    """In-memory 세션 저장소 (개발용 fallback, 단일 파드 환경).

    만료 처리는 get/pop 시점에 lazy 방식으로 수행합니다.
    """

    def __init__(self) -> None:
        self._clients: dict[str, dict] = {}
        self._pending: dict[str, dict] = {}   # state → {data, expires_at}
        self._codes: dict[str, dict] = {}     # code → {data, expires_at}
        self._refresh: dict[str, dict] = {}   # token → {data, expires_at}

    def set_client(self, client_id: str, data: dict) -> None:
        self._clients[client_id] = data

    def get_client(self, client_id: str) -> Optional[dict]:
        return self._clients.get(client_id)

    def set_pending(self, state: str, data: dict, ttl: int = 600) -> None:
        self._pending[state] = {"data": data, "expires_at": time.time() + ttl}

    def pop_pending(self, state: str) -> Optional[dict]:
        entry = self._pending.pop(state, None)
        if entry is None or entry["expires_at"] < time.time():
            return None
        return entry["data"]

    def get_pending(self, state: str) -> Optional[dict]:
        entry = self._pending.get(state)
        if entry is None:
            return None
        if entry["expires_at"] < time.time():
            self._pending.pop(state, None)
            return None
        return entry["data"]

    def has_pending(self, state: str) -> bool:
        entry = self._pending.get(state)
        if entry is None:
            return False
        if entry["expires_at"] < time.time():
            self._pending.pop(state, None)
            return False
        return True

    def set_auth_code(self, code: str, data: dict, ttl: int = 300) -> None:
        self._codes[code] = {"data": data, "expires_at": time.time() + ttl}

    def pop_auth_code(self, code: str) -> Optional[dict]:
        entry = self._codes.pop(code, None)
        if entry is None or entry["expires_at"] < time.time():
            return None
        return entry["data"]

    def set_refresh_token(self, token: str, data: dict, ttl: int = 86400 * 7) -> None:
        self._refresh[token] = {"data": data, "expires_at": time.time() + ttl}

    def get_refresh_token(self, token: str) -> Optional[dict]:
        entry = self._refresh.get(token)
        if entry is None or entry["expires_at"] < time.time():
            self._refresh.pop(token, None)
            return None
        return entry["data"]

    def delete_refresh_token(self, token: str) -> None:
        self._refresh.pop(token, None)


# 모듈 레벨 싱글톤 — 앱 시작 시 한 번만 초기화
session_store: _OAuthStore = _make_store()
