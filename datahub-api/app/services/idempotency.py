"""Best-effort idempotency replay store for mutating API handlers."""

from __future__ import annotations

import hashlib
import json
import logging
from threading import Lock
from typing import Any, Callable, Protocol

from fastapi import HTTPException, Request
from fastapi.encoders import jsonable_encoder

from app.config import settings

logger = logging.getLogger(__name__)


class _IdempotencyStore(Protocol):
    def run(
        self,
        *,
        actor_id: str,
        scope: str,
        idempotency_key: str,
        request_hash: str,
        response_factory: Callable[[], Any],
    ) -> Any:
        ...

    def clear(self) -> None:
        ...


def _conflict() -> HTTPException:
    return HTTPException(
        status_code=409,
        detail="Idempotency-Key conflict: key was already used with a different request",
    )


def _record_key(actor_id: str, scope: str, idempotency_key: str) -> str:
    digest = hashlib.sha256(f"{actor_id}:{scope}:{idempotency_key}".encode()).hexdigest()
    return f"idempotency:{digest}"


def _hash_request(scope: str, body: Any) -> str:
    payload = {
        "scope": scope,
        "body": jsonable_encoder(body),
    }
    raw = json.dumps(payload, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode()).hexdigest()


class _InMemoryStore:
    def __init__(self) -> None:
        self._records: dict[str, dict[str, Any]] = {}
        self._lock = Lock()

    def run(
        self,
        *,
        actor_id: str,
        scope: str,
        idempotency_key: str,
        request_hash: str,
        response_factory: Callable[[], Any],
    ) -> Any:
        key = _record_key(actor_id, scope, idempotency_key)
        with self._lock:
            record = self._records.get(key)
            if record is not None:
                if record["request_hash"] != request_hash:
                    raise _conflict()
                return record["response"]

        response = response_factory()
        encoded = jsonable_encoder(response)
        with self._lock:
            record = self._records.get(key)
            if record is not None:
                if record["request_hash"] != request_hash:
                    raise _conflict()
                return record["response"]
            self._records[key] = {
                "request_hash": request_hash,
                "response": encoded,
            }
        return response

    def clear(self) -> None:
        with self._lock:
            self._records.clear()


class _RedisStore:
    def __init__(self, url: str) -> None:
        import redis

        self._redis = redis.from_url(url, decode_responses=True)
        self._redis_error = redis.RedisError

    def run(
        self,
        *,
        actor_id: str,
        scope: str,
        idempotency_key: str,
        request_hash: str,
        response_factory: Callable[[], Any],
    ) -> Any:
        key = _record_key(actor_id, scope, idempotency_key)
        ttl = getattr(settings, "idempotency_ttl_seconds", 86400)
        try:
            raw = self._redis.get(key)
            if raw:
                record = json.loads(raw)
                if record["request_hash"] != request_hash:
                    raise _conflict()
                return record["response"]

            response = response_factory()
            record = {
                "request_hash": request_hash,
                "response": jsonable_encoder(response),
            }
            self._redis.setex(key, ttl, json.dumps(record, ensure_ascii=True, sort_keys=True))
            return response
        except HTTPException:
            raise
        except self._redis_error as exc:
            logger.warning("Redis idempotency store unavailable, falling back to memory: %s", exc)
            return _get_fallback_store().run(
                actor_id=actor_id,
                scope=scope,
                idempotency_key=idempotency_key,
                request_hash=request_hash,
                response_factory=response_factory,
            )

    def clear(self) -> None:
        return None


_store_instance: _IdempotencyStore | None = None
_store_redis_url: str | None = None
_fallback_store = _InMemoryStore()


def _get_fallback_store() -> _InMemoryStore:
    return _fallback_store


def _get_store() -> _IdempotencyStore:
    global _store_instance, _store_redis_url
    redis_url = getattr(settings, "redis_url", "")
    if _store_instance is None or redis_url != _store_redis_url:
        _store_instance = _RedisStore(redis_url) if redis_url else _get_fallback_store()
        _store_redis_url = redis_url
    return _store_instance


def _idempotency_key(request: Request) -> str | None:
    headers = getattr(request, "headers", None)
    if headers is None:
        return None
    try:
        value = headers.get("Idempotency-Key") or headers.get("idempotency-key")
    except Exception:
        return None
    if not isinstance(value, str) or not value.strip():
        return None
    return value.strip()


def run_idempotent(
    request: Request,
    *,
    actor_id: int | str,
    scope: str,
    body: Any,
    response_factory: Callable[[], Any],
    required: bool = False,
) -> Any:
    key = _idempotency_key(request)
    if key is None:
        if required:
            raise HTTPException(status_code=400, detail="Idempotency-Key header required")
        return response_factory()

    return _get_store().run(
        actor_id=str(actor_id),
        scope=scope,
        idempotency_key=key,
        request_hash=_hash_request(scope, body),
        response_factory=response_factory,
    )


def clear_idempotency() -> None:
    _get_fallback_store().clear()
