from __future__ import annotations

from collections import deque
import logging
from threading import Lock
from time import time
from typing import Protocol

from fastapi import HTTPException, Request

from app.config import settings

logger = logging.getLogger(__name__)


class _RateLimitStore(Protocol):
    def allow(self, key: str, now: float, window_seconds: int, limit: int) -> bool:
        ...

    def clear(self) -> None:
        ...


class _InMemoryStore:
    def __init__(self) -> None:
        self._windows: dict[str, tuple[deque[float], int]] = {}
        self._lock = Lock()

    def _prune(self, now: float) -> None:
        expired_keys: list[str] = []
        for key, (window, window_seconds) in self._windows.items():
            while window and now - window[0] >= window_seconds:
                window.popleft()
            if not window:
                expired_keys.append(key)
        for key in expired_keys:
            self._windows.pop(key, None)

    def allow(self, key: str, now: float, window_seconds: int, limit: int) -> bool:
        with self._lock:
            self._prune(now)
            if key not in self._windows:
                self._windows[key] = (deque(), window_seconds)
            window, _ = self._windows[key]
            self._windows[key] = (window, window_seconds)
            while window and now - window[0] >= window_seconds:
                window.popleft()
            if len(window) >= limit:
                return False
            window.append(now)
            return True

    def clear(self) -> None:
        with self._lock:
            self._windows.clear()


class _RedisStore:
    _SCRIPT = """
local key = KEYS[1]
local seq_key = KEYS[2]
local now = tonumber(ARGV[1])
local min_score = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])
redis.call('ZREMRANGEBYSCORE', key, '-inf', min_score)
local count = redis.call('ZCARD', key)
if count >= limit then
  redis.call('EXPIRE', key, ttl)
  redis.call('EXPIRE', seq_key, ttl)
  return 0
end
local seq = redis.call('INCR', seq_key)
redis.call('ZADD', key, now, tostring(now) .. ':' .. tostring(seq))
redis.call('EXPIRE', key, ttl)
redis.call('EXPIRE', seq_key, ttl)
return 1
"""

    def __init__(self, url: str) -> None:
        import redis

        self._redis = redis.from_url(url, decode_responses=True)
        self._redis_error = redis.RedisError

    def allow(self, key: str, now: float, window_seconds: int, limit: int) -> bool:
        try:
            allowed = self._redis.eval(
                self._SCRIPT,
                2,
                f"rate-limit:{key}",
                f"rate-limit:{key}:seq",
                str(now),
                str(now - window_seconds),
                str(limit),
                str(max(window_seconds, 1)),
            )
            return bool(allowed)
        except self._redis_error as exc:
            logger.warning("Redis rate limiter unavailable, falling back to in-memory limiter: %s", exc)
            return _get_fallback_store().allow(key, now, window_seconds, limit)

    def clear(self) -> None:
        return None


_store_instance: _RateLimitStore | None = None
_store_redis_url: str | None = None
_fallback_store = _InMemoryStore()


def _get_fallback_store() -> _InMemoryStore:
    return _fallback_store


def _get_store() -> _RateLimitStore:
    global _store_instance, _store_redis_url
    redis_url = getattr(settings, "redis_url", "")
    if _store_instance is None or redis_url != _store_redis_url:
        _store_instance = _RedisStore(redis_url) if redis_url else _get_fallback_store()
        _store_redis_url = redis_url
    return _store_instance


def _scope_for_path(path: str) -> tuple[str, int] | None:
    if path in {"/api/v1/auth/session", "/api/v1/auth/refresh"}:
        return ("session", getattr(settings, "rate_limit_session_requests", 60))
    if path in {
        "/api/v1/repos/{owner}/{repo}/files/download-token",
        "/api/v1/repos/{owner}/{repo}/files/write-token",
        "/api/v1/repos/{owner}/{repo}/files/confirm",
        "/api/v1/repos/{owner}/{repo}/files/{path:path}",
        "/api/v1/repos/{owner}/{repo}/files/copy",
    }:
        return ("transfer", getattr(settings, "rate_limit_transfer_requests", 120))
    return None


def _normalized_path(request: Request) -> str:
    route = request.scope.get("route")
    return getattr(route, "path", request.url.path)


def _identity(request: Request) -> str:
    """버킷 식별자. 키 자체 대신 prefix/앞부분을 써서 raw credential 이 로그/메모리 경로에
    남지 않도록 한다."""
    auth = request.headers.get("authorization")
    if auth:
        parts = auth.split(" ", 1)
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1].strip()
            if token.startswith(("dh_", "dl_")):
                return f"api:{token[:11]}"  # prefix 만
            # JWT 는 길이 긴 토큰이라 앞 16자 만 식별자로 (충돌 확률 무시)
            return f"jwt:{token[:16]}"
        return f"auth:{auth[:16]}"
    client = request.client.host if request.client else "unknown"
    return f"ip:{client}"


def enforce_rate_limit(request: Request) -> None:
    normalized_path = _normalized_path(request)
    scope = _scope_for_path(normalized_path)
    if scope is None:
        return

    scope_name, limit = scope
    window_seconds = getattr(settings, "rate_limit_window_seconds", 60)
    now = time()
    key = f"{scope_name}:{_identity(request)}"

    if not _get_store().allow(key, now, window_seconds, limit):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")


def clear_rate_limits() -> None:
    _get_fallback_store().clear()
