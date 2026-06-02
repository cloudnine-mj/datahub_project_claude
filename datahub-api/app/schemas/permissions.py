"""권한 관리 스키마."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class GrantPermissionRequest(BaseModel):
    email: str
    role: str


class PermissionInfo(BaseModel):
    email: str
    role: str
    granted_by: str


class PermissionListResponse(BaseModel):
    permissions: list[PermissionInfo]


class RepoMemberGrantRequest(BaseModel):
    role: Literal["maintainer", "contributor", "guest"]


class RepoMemberInfo(BaseModel):
    principal: str
    role: str
    granted_by: str
    granted_at: datetime | None = None


class RepoMemberListResponse(BaseModel):
    items: list[RepoMemberInfo]
