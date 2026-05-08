"""서비스 간 JWT 인증 — DPA ↔ DIA 내부 서비스 인증.

DPA가 DIA를 호출할 때 X-Service-Token 헤더로 단기 JWT를 발급·전달한다.
DIA는 동일 secret으로 서명을 검증해 내부 서비스 요청임을 확인한다.

이슈 #33 구현.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException

from app.config import settings


def create_service_token(caller: str = "dpa") -> str:
    """DPA → DIA 호출용 단기 서비스 JWT를 생성한다.

    Args:
        caller: 호출 서비스 식별자 (기본값 "dpa")

    Returns:
        HS256 서명된 JWT 문자열
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": caller,
        "scope": "internal",
        "iat": now,
        "exp": now + timedelta(seconds=settings.internal_service_token_ttl_seconds),
    }
    return jwt.encode(payload, settings.internal_service_secret, algorithm="HS256")


def verify_service_token(token: str) -> str:
    """서비스 JWT를 검증하고 caller(sub)를 반환한다.

    Args:
        token: X-Service-Token 헤더 값

    Returns:
        caller 식별자 ("dpa" 등)

    Raises:
        HTTPException 401: 서명 불일치, 만료, scope 오류
    """
    try:
        payload = jwt.decode(
            token,
            settings.internal_service_secret,
            algorithms=["HS256"],
            options={"require": ["exp", "iat", "sub"]},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Service token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid service token")

    if payload.get("scope") != "internal":
        raise HTTPException(status_code=401, detail="Invalid service token")

    caller = payload.get("sub")
    if not caller:
        raise HTTPException(status_code=401, detail="Invalid service token")

    return caller
