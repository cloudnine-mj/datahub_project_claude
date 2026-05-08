"""Google 액세스 토큰 검증.

google_oauth.get_user_info()를 래핑하여 레거시 호출 인터페이스를 유지합니다.
내부적으로 deprecated tokeninfo 엔드포인트 대신 userinfo 엔드포인트를 사용합니다.
"""

from __future__ import annotations

from fastapi import HTTPException

from app.services.google_oauth import ALLOWED_DOMAIN, get_user_info


def verify_google_token(access_token: str) -> str:
    """Google 액세스 토큰을 검증하고 이메일을 반환.

    Args:
        access_token: Google OAuth2 액세스 토큰

    Returns:
        토큰에 연결된 이메일 주소

    Raises:
        HTTPException: 토큰이 유효하지 않거나 이메일이 없는 경우, 또는 허용되지 않은 도메인인 경우
    """
    return get_user_info(access_token).email


__all__ = ["verify_google_token", "ALLOWED_DOMAIN"]
