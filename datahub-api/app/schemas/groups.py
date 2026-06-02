"""Canonical group namespace API schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.repos import RepoInfo


GroupRole = Literal["owner", "maintainer", "contributor", "guest"]


class GroupCreate(BaseModel):
    name: str
    description: str | None = None


class GroupUpdate(BaseModel):
    description: str | None = None


class RenameGroupRequest(BaseModel):
    """PATCH /groups/{group}/slug 의 페이로드 (governance §repo-identity-spec)."""
    new_slug: str
    reason: str | None = None


class RenameGroupResponse(BaseModel):
    group_id: str
    new_slug: str
    old_slug: str
    affected_repo_count: int


class GroupInfo(BaseModel):
    name: str
    type: Literal["group"] = "group"
    current_user_role: GroupRole | None = None
    description: str | None = None
    repo_count: int = 0
    member_count: int = 0
    created_at: datetime


class GroupListResponse(BaseModel):
    items: list[GroupInfo]
    has_more: bool = False
    next_page_token: str | None = None
    # One-release compatibility alias for clients migrating from legacy organization names.
    groups: list[GroupInfo] = Field(default_factory=list)


class GroupMemberGrant(BaseModel):
    """그룹 멤버 추가/role 변경 페이로드.

    Governance §그룹 멤버 (docs/api/groups.md): 그룹 역할은 저장소와 동일한
    4-tier (owner / maintainer / contributor / guest). 단 'owner' 부여는
    별도의 ownership 이전 경로로만 허용 — 라우터가 명시적으로 'owner'
    요청을 403 으로 거절 (`PUT /groups/{name}/members/{principal}` 에서).
    """

    role: str = Field(
        ...,
        json_schema_extra={"enum": ["maintainer", "contributor", "guest"]},
    )


class GroupMemberInfo(BaseModel):
    principal: str
    role: GroupRole
    granted_by: str | None = None
    created_at: datetime


class GroupMemberListResponse(BaseModel):
    items: list[GroupMemberInfo]
    has_more: bool = False
    next_page_token: str | None = None
    # One-release compatibility alias for clients migrating from legacy organization names.
    members: list[GroupMemberInfo] = Field(default_factory=list)


class GroupRepoListResponse(BaseModel):
    items: list[RepoInfo]
    has_more: bool = False
    next_page_token: str | None = None
    # Existing repo-list transition alias.
    repos: list[RepoInfo] = Field(default_factory=list)
