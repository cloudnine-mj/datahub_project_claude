"""Dependency helpers — 인증 + DB 세션.

인증 우선순위:
  1. data-platform-api 의 `platform_token` httpOnly 쿠키 (HS256 JWT)
     — settings.platform_jwt_secret 으로 검증 가능할 때만 동작.
  2. 옛 mock — `X-User-Email` 헤더 (로컬 개발 편의용).
  3. 둘 다 없으면 settings.default_admin_email 로 fallback (로컬 개발 편의).

운영에서는 settings.platform_jwt_secret 을 plat-api 와 동일하게 주입하면
1번 경로만 동작. 2·3 fallback 은 환경 변수 DATAHUB_AUTH_DISABLE_MOCK=true
으로 비활성 가능.
"""

from __future__ import annotations

from fastapi import Cookie, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.db.session import get_db
from app.models import User

try:
    import jwt as _jwt  # PyJWT — pyproject 의 의존성에 포함되어 있어야 함
except Exception:  # pragma: no cover
    _jwt = None  # type: ignore[assignment]


def _email_from_platform_token(token: str) -> str | None:
    """plat-api JWT 검증 → email claim 반환. 실패 시 None."""
    if not token or not _jwt or not settings.platform_jwt_secret:
        return None
    try:
        payload = _jwt.decode(
            token,
            settings.platform_jwt_secret,
            algorithms=["HS256"],
        )
    except Exception:
        return None
    email = payload.get("email")
    return email if isinstance(email, str) else None


def get_current_user(
    x_user_email: str | None = Header(default=None),
    platform_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> User:
    # 1) 운영 — plat-api JWT 쿠키 검증
    email = _email_from_platform_token(platform_token or "")

    # 2) mock — X-User-Email 헤더
    if not email and not settings.disable_mock_auth:
        email = x_user_email

    # 3) fallback — default admin
    if not email and not settings.disable_mock_auth:
        email = settings.default_admin_email

    if not email:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="not authenticated")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        # plat-api 가 검증한 사용자라면 우리 DB 에 자동 upsert (real-user 페더레이션)
        # mock 경로면 이름 모르니 이메일 prefix 를 임시 이름으로 사용
        if settings.platform_jwt_secret and not settings.disable_mock_auth is False:
            user = User(email=email, name=email.split("@")[0], role="viewer")
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=f"unknown user: {email}")
    return user


def require_board_write(board_type: str):
    """게시판 글쓰기 권한 의존성 — 화면 12 분기 (403 → 프론트가 권한없음 화면)."""

    def _checker(user: User = Depends(get_current_user)) -> User:
        if not user.can_write_board(board_type):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="이 게시판에 글을 작성할 권한이 없습니다.",
            )
        return user

    return _checker
