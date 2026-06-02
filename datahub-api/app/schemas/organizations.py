"""Organization CRUD 스키마."""

from __future__ import annotations

import re
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, field_validator

from app.schemas.repos import RepoInfo

_ORG_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9\-]{0,38}[a-z0-9]$|^[a-z0-9]$")


class OrganizationCreate(BaseModel):
    org_name: str
    description: Optional[str] = None
    visibility: Literal["public", "private"] = "private"
    avatar_url: Optional[str] = None

    @field_validator("org_name")
    @classmethod
    def validate_org_name(cls, v: str) -> str:
        if not _ORG_NAME_RE.match(v):
            raise ValueError(
                "org_name must be 1–40 characters, "
                "lowercase alphanumeric and hyphens only, "
                "and cannot start or end with a hyphen"
            )
        return v


class OrganizationUpdate(BaseModel):
    description: Optional[str] = None
    visibility: Optional[Literal["public", "private"]] = None
    avatar_url: Optional[str] = None


class OrganizationInfo(BaseModel):
    id: int
    org_name: str
    owner: str
    description: Optional[str] = None
    visibility: str
    avatar_url: Optional[str] = None
    created_at: datetime


class OrganizationListResponse(BaseModel):
    orgs: List[OrganizationInfo]
    total: int
    page: int
    size: int


class OrgRepoListResponse(BaseModel):
    repos: List[RepoInfo]


class OrgStatsResponse(BaseModel):
    org_name: str
    member_count: int = 0
    repo_count: int = 0
    total_size_bytes: int = 0


class OrganizationMemberGrant(BaseModel):
    email: str
    role: Literal["maintainer", "contributor", "guest"]


class OrganizationMemberInfo(BaseModel):
    email: str
    role: str
    granted_by: str


class OrganizationMemberListResponse(BaseModel):
    members: List[OrganizationMemberInfo]


class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = None


class TeamInfo(BaseModel):
    name: str
    description: Optional[str] = None
    member_count: int = 0


class TeamListResponse(BaseModel):
    teams: List[TeamInfo]


class TeamMemberGrant(BaseModel):
    email: str


class TeamMemberInfo(BaseModel):
    email: str


class TeamMemberListResponse(BaseModel):
    members: List[TeamMemberInfo]


class TeamRepoGrant(BaseModel):
    role: Literal["maintainer", "contributor", "guest"]


class TeamRepoPermissionInfo(BaseModel):
    repo_name: str
    role: str


class TeamRepoPermissionListResponse(BaseModel):
    permissions: List[TeamRepoPermissionInfo]
