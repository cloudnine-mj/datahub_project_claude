"""Azure AD JWKS cache (governance §api-specs/auth-api-spec §Azure AD OIDC).

Public key 캐시 — Azure JWKS endpoint 로부터 1회 fetch 후 TTL 60min 보관.
unknown `kid` 검증 시도 시 force refresh 로 key rotation 대응.
"""

from __future__ import annotations

import logging
import threading
import time
from typing import Any

import httpx
from jwt.algorithms import RSAAlgorithm


logger = logging.getLogger(__name__)

JWKS_TTL_SECONDS = 60 * 60  # 60min, governance §api-specs/auth-api-spec
JWKS_HTTP_TIMEOUT = 5.0


class JWKSCache:
    """Tenant 당 JWKS keys 캐시. kid → public key 로 빠른 lookup.

    governance §api-specs/auth-api-spec §Azure AD OIDC:
        - 60min TTL
        - kid 인덱스
        - unknown kid → force refresh (key rotation 대응)
    """

    def __init__(self) -> None:
        # tenant_id → (fetched_at, {kid: RSA public key})
        self._cache: dict[str, tuple[float, dict[str, Any]]] = {}
        self._lock = threading.Lock()

    def _jwks_url(self, tenant_id: str) -> str:
        return f"https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys"

    def _fetch(self, tenant_id: str) -> dict[str, Any]:
        url = self._jwks_url(tenant_id)
        logger.info("jwks.fetch tenant=%s url=%s", tenant_id, url)
        resp = httpx.get(url, timeout=JWKS_HTTP_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        keys: dict[str, Any] = {}
        for jwk in data.get("keys", []):
            kid = jwk.get("kid")
            if not kid:
                continue
            try:
                keys[kid] = RSAAlgorithm.from_jwk(jwk)
            except Exception as exc:
                logger.warning("jwks.skip_invalid_key kid=%s err=%s", kid, exc)
        return keys

    def get_key(self, tenant_id: str, kid: str, *, force_refresh: bool = False) -> Any:
        """`kid` 의 RSA public key. cache miss / TTL 만료 / force_refresh 시 refetch.

        unknown kid (key rotation 후) 발견 시 caller 가 force_refresh=True 로 한 번 더 호출.
        """
        with self._lock:
            cached = self._cache.get(tenant_id)
            now = time.time()
            stale = (
                cached is None
                or (now - cached[0]) > JWKS_TTL_SECONDS
                or force_refresh
                or kid not in cached[1]
            )
            if stale:
                keys = self._fetch(tenant_id)
                self._cache[tenant_id] = (now, keys)
            else:
                keys = cached[1]
        key = keys.get(kid)
        if key is None:
            raise KeyError(f"Unknown kid {kid!r} in JWKS for tenant {tenant_id!r}")
        return key

    def invalidate(self, tenant_id: str | None = None) -> None:
        with self._lock:
            if tenant_id is None:
                self._cache.clear()
            else:
                self._cache.pop(tenant_id, None)


# 모듈 레벨 singleton
_cache = JWKSCache()


def get_signing_key(tenant_id: str, kid: str, *, force_refresh: bool = False) -> Any:
    return _cache.get_key(tenant_id, kid, force_refresh=force_refresh)


def invalidate_jwks(tenant_id: str | None = None) -> None:
    _cache.invalidate(tenant_id)
