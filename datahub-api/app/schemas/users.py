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


class GroupMembershipSummary(BaseModel):
    """`/users/me` 응답에 포함되는 본인 가입 group 한 줄 요약."""

    name: str
    role: str  # 'owner' | 'maintainer' | 'contributor' | 'guest'


class MeResponse(BaseModel):
    user_id: int
    email: str
    username: str
    is_active: bool
    joined_at: datetime
    # governance §그룹 / §개인 owner: 본인의 personal owner namespace
    # (이메일에서 derived). 저장소 식별자 `owner/repo` 의 owner 자리에
    # 그대로 사용 가능.
    personal_namespace: Optional[str] = None
    # 본인이 가입한 group 들 (개인 owner 제외).
    groups: list[GroupMembershipSummary] = []
