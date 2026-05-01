"""Dependency helpers — 가짜 인증 + DB 세션.

실제 OAuth 통합 전까지는 클라이언트가 `X-User-Email` 헤더로 사용자를 가장한다.
헤더가 없으면 settings.default_admin_email 로 fallback (로컬 개발 편의).
"""

from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.db.session import get_db
from app.models import User


def get_current_user(
    x_user_email: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    email = x_user_email or settings.default_admin_email
    user = db.query(User).filter(User.email == email).first()
    if not user:
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
