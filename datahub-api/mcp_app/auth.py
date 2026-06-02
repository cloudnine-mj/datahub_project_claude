"""MCP 서버 인증 — 기존 data-platform-api 인증 로직 재사용.

Bearer 토큰(JWT 또는 Google access token) / API 키를 검증하여
인증된 사용자 이메일을 반환합니다.
"""

from __future__ import annotations

import jwt
import bcrypt
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.models import ApiKey
from app.services.google_oauth import get_user_info


def _try_verify_jwt(token: str) -> str | None:
    """서비스 JWT를 검증하고 이메일 반환. 실패 시 None."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        return payload.get("email")
    except (jwt.InvalidTokenError, jwt.ExpiredSignatureError):
        return None


def _verify_google_token(access_token: str) -> str | None:
    """Google 액세스 토큰을 검증하고 이메일 반환. 실패 시 None."""
    try:
        return get_user_info(access_token).email
    except HTTPException:
        return None


def _authenticate_api_key(db: Session, raw_key: str) -> str | None:
    """API 키를 검증하고 이메일 반환. 실패 시 None."""
    if not raw_key.startswith("dl_"):
        return None
    prefix = raw_key[:11]
    api_key = db.query(ApiKey).filter(
        ApiKey.key_prefix == prefix,
        ApiKey.is_active == True,  # noqa: E712
    ).first()
    if api_key is None:
        return None
    if not bcrypt.checkpw(raw_key.encode(), api_key.key_hash.encode()):
        return None
    return api_key.user.email


def authenticate_token(token: str) -> str | None:
    """Bearer 토큰(JWT 또는 Google) → 이메일. 실패 시 None."""
    email = _try_verify_jwt(token)
    if email:
        return email
    return _verify_google_token(token)
