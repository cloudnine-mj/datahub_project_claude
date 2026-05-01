from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class FormAttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    size_bytes: int


class FormCreate(BaseModel):
    """공통 + 타입별 자유 페이로드.

    `payload` 는 신청서 종류별로 필드가 다르므로 dict 그대로 보관 (검증 X).
    """

    form_type: str
    project_name: str = Field(min_length=1, max_length=300)
    payload: dict[str, Any] = Field(default_factory=dict)
    status: str = "submitted"  # 'draft' 로 보내면 임시저장


class FormListItem(BaseModel):
    """내 문서 목록 row — 화면 5/8 의 (신청서 종류 / 프로젝트명 / 제출일 / Export)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    request_no: str
    form_type: str
    project_name: str
    submitted_at: datetime
    status: str


class FormDetail(BaseModel):
    """신청서 상세 — 화면 9 (read-only) / 10 (편집 시 초기값)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    request_no: str
    form_type: str
    project_name: str
    submitter_name: str
    submitter_email: EmailStr
    submitter_department: str | None
    status: str
    payload: dict[str, Any]
    submitted_at: datetime
    updated_at: datetime
    attachments: list[FormAttachmentOut] = []
