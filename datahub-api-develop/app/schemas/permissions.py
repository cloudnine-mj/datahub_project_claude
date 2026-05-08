"""권한 관리 스키마."""

from __future__ import annotations

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
