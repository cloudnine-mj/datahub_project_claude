"""MCP OAuth 2.1 Authorization Server.

MCP 스펙(2025-03-26)에 따라 Claude Desktop/Claude Code 등 MCP 클라이언트가
OAuth 인증을 수행할 수 있도록 엔드포인트를 제공합니다.

플로우:
1. MCP 클라이언트가 /mcp 연결 시도 → 401 + WWW-Authenticate 헤더
2. 클라이언트가 /.well-known/oauth-authorization-server 조회
3. 클라이언트가 /oauth/register 로 동적 클라이언트 등록
4. 클라이언트가 /oauth/authorize 로 브라우저 열기 → Google OAuth 리다이렉트
5. 사용자가 Google 로그인 → /oauth/callback → authorization code 발급
6. 클라이언트가 /oauth/token 으로 code → access token 교환
7. 이후 MCP 요청에 Bearer 토큰 첨부
"""

from __future__ import annotations

import base64
import hashlib
import logging
import secrets
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import jwt
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel

from app.config import settings
from app.database import SessionLocal
from app.dependencies import get_or_create_user
from app.services.google_oauth import exchange_authorization_code, get_user_info
from mcp_app.session_store import session_store

logger = logging.getLogger(__name__)

router = APIRouter()

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"


def _get_base_url(request: Request) -> str:
    """요청에서 base URL 추출."""
    if settings.oauth_redirect_uri:
        from urllib.parse import urlparse
        parsed = urlparse(settings.oauth_redirect_uri)
        return f"{parsed.scheme}://{parsed.netloc}"
    return str(request.base_url).rstrip("/")


def _create_service_token(email: str) -> str:
    """MCP용 서비스 JWT 생성."""
    payload = {
        "email": email,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expiry_minutes),
        "scope": "mcp",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


# ── RFC 8414: OAuth Authorization Server Metadata ──


@router.get("/.well-known/oauth-authorization-server")
def oauth_metadata(request: Request):
    """OAuth 2.1 Authorization Server 메타데이터."""
    base = _get_base_url(request)
    return {
        "issuer": base,
        "authorization_endpoint": f"{base}/oauth/authorize",
        "token_endpoint": f"{base}/oauth/token",
        "registration_endpoint": f"{base}/oauth/register",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "code_challenge_methods_supported": ["S256"],
        "token_endpoint_auth_methods_supported": ["none"],
        "scopes_supported": ["mcp"],
    }


# ── RFC 7591: Dynamic Client Registration ──


class ClientRegistrationRequest(BaseModel):
    client_name: str | None = None
    redirect_uris: list[str] = []
    grant_types: list[str] = ["authorization_code"]
    response_types: list[str] = ["code"]
    token_endpoint_auth_method: str = "none"


@router.post("/oauth/register")
def register_client(body: ClientRegistrationRequest):
    """MCP 클라이언트 동적 등록. client_id를 발급합니다."""
    client_id = f"mcp_{secrets.token_urlsafe(16)}"
    client_data = {
        "client_id": client_id,
        "client_name": body.client_name or "MCP Client",
        "redirect_uris": body.redirect_uris,
        "grant_types": body.grant_types,
        "response_types": body.response_types,
        "token_endpoint_auth_method": body.token_endpoint_auth_method,
        "created_at": time.time(),
    }
    session_store.set_client(client_id, client_data)

    return {
        "client_id": client_id,
        "client_name": client_data["client_name"],
        "redirect_uris": body.redirect_uris,
        "grant_types": body.grant_types,
        "response_types": body.response_types,
        "token_endpoint_auth_method": body.token_endpoint_auth_method,
    }


# ── Authorization Endpoint ──


@router.get("/oauth/authorize")
def authorize(
    request: Request,
    response_type: str = Query(...),
    client_id: str = Query(...),
    redirect_uri: str = Query(...),
    state: str = Query(""),
    code_challenge: str = Query(""),
    code_challenge_method: str = Query("S256"),
    scope: str = Query("mcp"),
):
    """OAuth 인가 엔드포인트. Google OAuth로 리다이렉트합니다."""
    if response_type != "code":
        raise HTTPException(status_code=400, detail="Unsupported response_type")

    if not code_challenge:
        raise HTTPException(status_code=400, detail="code_challenge required (PKCE)")

    internal_state = secrets.token_urlsafe(32)
    session_store.set_pending(internal_state, {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "mcp_state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": code_challenge_method,
    })  # TTL 10분 (default)

    base = _get_base_url(request)
    google_callback = f"{base}/oauth/callback"

    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": google_callback,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
        "state": internal_state,
    }
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


# ── Google OAuth Callback → MCP Authorization Code 발급 ──


@router.get("/oauth/callback")
def oauth_callback(
    request: Request,
    code: str = "",
    state: str = "",
    error: str = "",
):
    """Google OAuth 콜백. Google token → 사용자 확인 → MCP auth code 발급."""
    if error:
        return HTMLResponse(f"<h1>인증 실패</h1><p>{error}</p>", status_code=400)

    if not code or not session_store.has_pending(state):
        raise HTTPException(status_code=400, detail="Invalid callback")

    pending = session_store.pop_pending(state)
    if pending is None:
        raise HTTPException(status_code=400, detail="Session expired or invalid")

    base = _get_base_url(request)
    google_callback = f"{base}/oauth/callback"

    access_token = exchange_authorization_code(
        code=code,
        redirect_uri=google_callback,
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
    )
    userinfo = get_user_info(access_token)
    email = userinfo.email

    db = SessionLocal()
    try:
        get_or_create_user(db, email)
    finally:
        db.close()

    mcp_code = secrets.token_urlsafe(32)
    session_store.set_auth_code(mcp_code, {
        "email": email,
        "client_id": pending["client_id"],
        "code_challenge": pending["code_challenge"],
        "code_challenge_method": pending["code_challenge_method"],
        "redirect_uri": pending["redirect_uri"],
    })  # TTL 5분 (default)

    redirect_uri = pending["redirect_uri"]
    separator = "&" if "?" in redirect_uri else "?"
    redirect_url = f"{redirect_uri}{separator}code={mcp_code}"
    if pending.get("mcp_state"):
        redirect_url += f"&state={pending['mcp_state']}"

    return RedirectResponse(redirect_url)


# ── Token Endpoint ──


@router.post("/oauth/token")
async def token(request: Request):
    """authorization code → access token 교환 (PKCE 검증 포함)."""
    body = await request.form()
    params = dict(body)
    grant_type = params.get("grant_type", "")

    if grant_type == "authorization_code":
        code = params.get("code", "")
        code_verifier = params.get("code_verifier", "")

        auth_code = session_store.pop_auth_code(code)
        if auth_code is None:
            return JSONResponse(
                {"error": "invalid_grant", "error_description": "Invalid or expired code"},
                status_code=400,
            )

        # PKCE 검증 (S256)
        if auth_code["code_challenge"] and code_verifier:
            digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
            expected = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
            if expected != auth_code["code_challenge"]:
                return JSONResponse(
                    {"error": "invalid_grant", "error_description": "PKCE verification failed"},
                    status_code=400,
                )

        access_token = _create_service_token(auth_code["email"])
        refresh_tok = secrets.token_urlsafe(48)
        session_store.set_refresh_token(refresh_tok, {"email": auth_code["email"]})  # TTL 7일 (default)

        return JSONResponse({
            "access_token": access_token,
            "token_type": "Bearer",
            "expires_in": settings.jwt_expiry_minutes * 60,
            "refresh_token": refresh_tok,
            "scope": "mcp",
        })

    elif grant_type == "refresh_token":
        refresh_tok = params.get("refresh_token", "")

        stored = session_store.get_refresh_token(refresh_tok)
        if stored is None:
            return JSONResponse(
                {"error": "invalid_grant", "error_description": "Invalid or expired refresh token"},
                status_code=400,
            )

        access_token = _create_service_token(stored["email"])

        return JSONResponse({
            "access_token": access_token,
            "token_type": "Bearer",
            "expires_in": settings.jwt_expiry_minutes * 60,
            "refresh_token": refresh_tok,
            "scope": "mcp",
        })

    return JSONResponse({"error": "unsupported_grant_type"}, status_code=400)
