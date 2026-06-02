"""대시보드 통계 스키마."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ActivityItem(BaseModel):
    action: str
    resource_type: str | None
    resource_id: str | None
    user_email: str | None
    timestamp: datetime


class DashboardStats(BaseModel):
    total_repos: int
    total_users: int
    total_orgs: int
    recent_activity: list[ActivityItem]
