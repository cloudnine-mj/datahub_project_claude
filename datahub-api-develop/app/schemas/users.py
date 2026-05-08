"""사용자 프로필 스키마."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class RepoSummary(BaseModel):
    repo_name: str
    visibility: str
    created_at: datetime


class UserProfile(BaseModel):
    username: str
    email: str
    avatar_url: Optional[str] = None
    joined_at: datetime
    repos: list[RepoSummary]


class MeResponse(BaseModel):
    user_id: int
    email: str
    username: str
    is_active: bool
    joined_at: datetime
