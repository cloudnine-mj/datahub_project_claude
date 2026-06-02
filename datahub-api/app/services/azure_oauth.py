"""Azure AD OIDC token verification + auth URL helpers (governance §api-specs/auth-api-spec §Azure AD OIDC).

- RS256 signature verify via JWKS (`jwks.py`)
- claims: iss (Authority), aud (client_id), tid (allowed tenants), exp
- domain policy: `azure_allowed_email_domain` 1차 안전망 (tid 검증 보완)
- authorization URL build + code exchange (PR 3 login flow)
"""

from __future__ import annotations

import logging
from typing import Any
from urllib.parse import urlencode

import httpx
import jwt
from jwt.exceptions import InvalidTokenError

from app.config import settings
from app.services.jwks import get_signing_key


logger = logging.getLogger(__name__)

OIDC_HTTP_TIMEOUT = 10.0


class AzureTokenError(Exception):
    """Azure OIDC token verify 실패. caller 는 401 응답으로 매핑."""


def _authority(tenant_id: str) -> str:
    return f"https://login.microsoftonline.com/{tenant_id}/v2.0"


def _authorize_endpoint(tenant_id: str) -> str:
    return f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/authorize"


def _token_endpoint(tenant_id: str) -> str:
    return f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"


def build_authorize_url(state: str, redirect_uri: str) -> str:
    """Azure /authorize URL 생성. governance §auth-api-spec §Azure AD OIDC.

    scope: openid email profile (id_token 만 필요)
    response_type: code (Authorization Code flow)
    response_mode: query (callback 에 ?code=... 로 도착)
    """
    if not settings.azure_ad_client_id or not settings.azure_ad_tenant_id:
        raise AzureTokenError("Azure AD tenant/client not configured")
    params = {
        "client_id": settings.azure_ad_client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "response_mode": "query",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
    }
    return f"{_authorize_endpoint(settings.azure_ad_tenant_id)}?{urlencode(params)}"


def exchange_code_for_id_token(code: str, redirect_uri: str) -> str:
    """POST /token — authorization code 를 id_token 으로 교환.

    governance §auth-api-spec §Azure AD OIDC: confidential client (client_secret).
    응답에 id_token 이 없거나 verify 실패 시 AzureTokenError.

    Returns:
        id_token (caller 가 verify_azure_id_token 으로 검증해야 함)
    """
    if not settings.azure_ad_client_secret:
        raise AzureTokenError("Azure AD client_secret not configured")
    payload = {
        "client_id": settings.azure_ad_client_id,
        "client_secret": settings.azure_ad_client_secret,
        "code": code,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
        "scope": "openid email profile",
    }
    try:
        resp = httpx.post(
            _token_endpoint(settings.azure_ad_tenant_id),
            data=payload,
            headers={"Accept": "application/json"},
            timeout=OIDC_HTTP_TIMEOUT,
        )
    except httpx.HTTPError as exc:
        raise AzureTokenError(f"token endpoint network error: {exc}") from exc
    if resp.status_code != 200:
        # Azure 가 error / error_description JSON 으로 응답
        try:
            body = resp.json()
        except Exception:
            body = {"raw": resp.text[:200]}
        raise AzureTokenError(f"token exchange failed ({resp.status_code}): {body}")
    data = resp.json()
    id_token = data.get("id_token")
    if not id_token:
        raise AzureTokenError("token response missing id_token")
    return id_token


def _allowed_tenants() -> set[str]:
    """추가 tenant allowlist (콤마 분리). 비면 settings.azure_ad_tenant_id 만 허용."""
    raw = (settings.azure_allowed_tenants or "").strip()
    if not raw:
        return {settings.azure_ad_tenant_id} if settings.azure_ad_tenant_id else set()
    return {t.strip() for t in raw.split(",") if t.strip()}


def verify_azure_id_token(token: str) -> dict[str, Any]:
    """Azure AD id_token 검증 후 claims dict 반환.

    governance §auth-api-spec:
        - signature: RS256 via JWKS
        - iss: `https://login.microsoftonline.com/{tid}/v2.0`
        - aud: settings.azure_ad_client_id
        - tid: allowlist 통과
        - exp: 자동 (jwt.decode)

    실패 → AzureTokenError. caller 는 401 + audit log.
    """
    if not settings.azure_ad_client_id:
        raise AzureTokenError("Azure AD client_id is not configured")

    # 1) Decode header to get kid
    try:
        unverified_header = jwt.get_unverified_header(token)
    except InvalidTokenError as exc:
        raise AzureTokenError(f"malformed token header: {exc}") from exc

    kid = unverified_header.get("kid")
    if not kid:
        raise AzureTokenError("token header missing kid")

    # 2) Resolve signing key — tenant_id 는 unverified payload 의 tid 또는 settings.tenant_id
    unverified_payload = jwt.decode(token, options={"verify_signature": False})
    tid = unverified_payload.get("tid") or settings.azure_ad_tenant_id
    if not tid:
        raise AzureTokenError("token missing tid claim and no default tenant")

    allowed = _allowed_tenants()
    if allowed and tid not in allowed:
        raise AzureTokenError(f"tenant {tid!r} not in allowlist")

    try:
        signing_key = get_signing_key(tid, kid)
    except KeyError:
        # unknown kid 발견 시 force refresh 1회
        signing_key = get_signing_key(tid, kid, force_refresh=True)
    except Exception as exc:
        raise AzureTokenError(f"failed to resolve signing key: {exc}") from exc

    # 3) Verify signature + claims
    try:
        claims = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            audience=settings.azure_ad_client_id,
            issuer=_authority(tid),
            options={"require": ["exp", "iss", "aud"]},
        )
    except InvalidTokenError as exc:
        raise AzureTokenError(f"token verify failed: {exc}") from exc

    # 4) Domain 1차 안전망 (governance §auth-and-api-keys §1.3)
    email = claims.get("email") or claims.get("preferred_username")
    if settings.azure_allowed_email_domain:
        if not email or "@" not in email:
            raise AzureTokenError("token missing email/preferred_username claim")
        if email.split("@", 1)[1].lower() != settings.azure_allowed_email_domain.lower():
            raise AzureTokenError(f"email domain not allowed: {email!r}")

    return claims
