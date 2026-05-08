"""만료된 CopySession 정리 서비스.

스케줄러 또는 관리 스크립트에서 주기적으로 호출하여
expires_at 이 지났지만 아직 terminal 상태(committed/failed/expired)가 아닌
세션을 expired 로 마킹한다.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models import CopySession


def cleanup_expired_copy_sessions(
    db: Session,
    batch_size: int = 100,
) -> dict[str, Any]:
    """만료된 CopySession 을 expired 상태로 마킹한다.

    Args:
        db: SQLAlchemy 세션
        batch_size: 한 번에 처리할 최대 세션 수

    Returns:
        ``{"expired_sessions": int}`` 형태의 처리 요약
    """
    now = datetime.now(timezone.utc)
    terminal = {"committed", "failed", "expired"}

    expired_sessions = (
        db.query(CopySession)
        .filter(
            CopySession.expires_at <= now,
            CopySession.status.notin_(terminal),
        )
        .limit(batch_size)
        .all()
    )

    if not expired_sessions:
        return {"expired_sessions": 0}

    for session in expired_sessions:
        session.status = "expired"

    db.commit()

    return {"expired_sessions": len(expired_sessions)}
