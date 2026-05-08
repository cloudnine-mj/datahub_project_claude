"""Google OAuth2 공통 서비스.

authorization code → token exchange, user info 조회를 한 곳에서 관리합니다.

Note: Google token exchange endpoint는 표준 OAuth2 form POST입니다.
google-auth-oauthlib.Flow는 client_secrets.json 기반이라 이 환경에 맞지 않아
httpx로 직접 구현합니다 (SDK-First 원칙상 불가피한 직접 구현).
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx
from fastapi import HTTPException

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

ALLOWED_DOMAIN = "lgresearch.ai"


@dataclass
class GoogleUserInfo:
    """Google 사용자 정보."""
    email: str
    name: str
    picture: str


def exchange_authorization_code(
    code: str,
    redirect_uri: str,
    client_id: str,
    client_secret: str,
) -> str:
    """Google authorization code → access token 교환.

    Args:
        code: Google OAuth authorization code
        redirect_uri: 콜백 URI (Google Console에 등록된 값)
        client_id: Google OAuth client ID
        client_secret: Google OAuth client secret

    Returns:
        Google access token

    Raises:
        HTTPException: 코드 교환 실패 또는 토큰 누락
    """
    resp = httpx.post(
        GOOGLE_TOKEN_URL,
        data={
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        },
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Failed to exchange authorization code")

    access_token = resp.json().get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="No access token in Google response")

    return access_token


def get_user_info(access_token: str) -> GoogleUserInfo:
    """Google access token → 사용자 정보 조회 + 도메인 검증.

    Args:
        access_token: Google OAuth access token

    Returns:
        GoogleUserInfo (email, name, picture)

    Raises:
        HTTPException: userinfo 조회 실패, 이메일 누락, 허용되지 않은 도메인
    """
    resp = httpx.get(
        GOOGLE_USERINFO_URL,
        headers={"Authorization": f"Bearer {access_token}"},
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Failed to get user info from Google")

    info = resp.json()
    email = info.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="No email in Google user info")

    if not email.endswith(f"@{ALLOWED_DOMAIN}"):
        raise HTTPException(
            status_code=403,
            detail=f"Only @{ALLOWED_DOMAIN} accounts are allowed",
        )

    return GoogleUserInfo(
        email=email,
        name=info.get("name", ""),
        picture=info.get("picture", ""),
    )
