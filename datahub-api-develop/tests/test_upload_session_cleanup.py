"""CopySession 만료 정리 테스트.

UploadSession/UploadSessionFile 은 #58 에서 제거됨.
현행 CopySession 모델 기준으로 재작성.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

from app.models import CopySession
from app.services.copy_session_cleanup import cleanup_expired_copy_sessions


def _make_session(status: str, expired: bool) -> CopySession:
    delta = timedelta(minutes=5)
    s = CopySession(
        id=f"sess-{status}-{'exp' if expired else 'ok'}",
        dest_repo="demo",
        dest_branch="main",
        user_id=1,
        status=status,
        expires_at=datetime.now(timezone.utc) - delta if expired else datetime.now(timezone.utc) + delta,
    )
    return s


def test_cleanup_marks_expired_active_sessions() -> None:
    """만료된 active 세션이 expired 로 마킹되어야 한다."""
    session = _make_session("active", expired=True)

    db = MagicMock()
    db.query.return_value.filter.return_value.limit.return_value.all.return_value = [session]

    summary = cleanup_expired_copy_sessions(db, batch_size=10)

    assert session.status == "expired"
    db.commit.assert_called_once()
    assert summary == {"expired_sessions": 1}


def test_cleanup_marks_expired_pending_sessions() -> None:
    """만료된 pending 세션도 expired 로 마킹되어야 한다."""
    session = _make_session("pending", expired=True)

    db = MagicMock()
    db.query.return_value.filter.return_value.limit.return_value.all.return_value = [session]

    summary = cleanup_expired_copy_sessions(db, batch_size=10)

    assert session.status == "expired"
    assert summary == {"expired_sessions": 1}


def test_cleanup_returns_zero_when_nothing_expired() -> None:
    """만료 세션이 없으면 0을 반환하고 commit 하지 않는다."""
    db = MagicMock()
    db.query.return_value.filter.return_value.limit.return_value.all.return_value = []

    summary = cleanup_expired_copy_sessions(db)

    assert summary == {"expired_sessions": 0}
    db.commit.assert_not_called()
