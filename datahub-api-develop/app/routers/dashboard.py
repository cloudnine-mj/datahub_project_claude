"""대시보드 통계 엔드포인트.

- GET /dashboard/stats: 플랫폼 전체 통계 (로그인 사용자 전용)
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import AuditLog, Organization, Repo, User
from app.schemas.dashboard import ActivityItem, DashboardStats

router = APIRouter()

_RECENT_ACTIVITY_LIMIT = 20


@router.get("/dashboard/stats", response_model=DashboardStats)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """플랫폼 통계 반환. 로그인한 사용자 누구나 조회 가능."""
    total_repos = db.query(Repo).count()
    total_users = db.query(User).filter(User.is_active == True).count()  # noqa: E712
    total_orgs = db.query(Organization).count()

    recent_logs = (
        db.query(AuditLog)
        .order_by(AuditLog.timestamp.desc())
        .limit(_RECENT_ACTIVITY_LIMIT)
        .all()
    )

    return DashboardStats(
        total_repos=total_repos,
        total_users=total_users,
        total_orgs=total_orgs,
        recent_activity=[
            ActivityItem(
                action=log.action,
                resource_type=log.resource_type,
                resource_id=log.resource_id,
                user_email=log.user_email,
                timestamp=log.timestamp,
            )
            for log in recent_logs
        ],
    )
