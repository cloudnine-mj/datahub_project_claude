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

    submitter_* 필드는 모두 선택값. 비워서 보내면 백엔드가 로그인 사용자의
    정보로 자동 채움. 사용자가 폼에서 직접 수정한 경우 그 값으로 들어감.
    """

    form_type: str
    project_name: str = Field(min_length=1, max_length=300)
    payload: dict[str, Any] = Field(default_factory=dict)
    status: str = "submitted"  # 'draft' 로 보내면 임시저장
    submitter_name: str | None = None
    submitter_email: EmailStr | None = None
    submitter_department: str | None = None


class ApprovalEntry(BaseModel):
    status: str
    changed_by: str
    changed_at: datetime
    comment: str | None = None


class FieldChange(BaseModel):
    """수정 이력의 필드별 변경. before/after 는 임의 JSON 값.

    field 는 백엔드 키 (예: '프로젝트명' 또는 payload 의 key — 'API_사용_목적' 등).
    프론트가 FORM_SCHEMAS 로 라벨 매핑.
    """

    field: str
    before: Any = None
    after: Any = None


class EditHistoryEntry(BaseModel):
    edited_by: str
    edited_at: datetime
    changes: list[FieldChange] = Field(default_factory=list)


class FormListItem(BaseModel):
    """내 문서 목록 row — 화면 5/8 의 (신청서 종류 / 프로젝트명 / 제출일 / 상태 / Export).

    admin 검토 페이지에서는 submitter_name 도 사용.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    request_no: str
    form_type: str
    project_name: str
    submitter_name: str
    submitted_at: datetime
    status: str
    version: int = 1
    parent_form_id: int | None = None


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
    version: int = 1
    parent_form_id: int | None = None
    approval_history: list[ApprovalEntry] | None = None
    edit_history: list[EditHistoryEntry] | None = None
    payload: dict[str, Any]
    submitted_at: datetime
    updated_at: datetime
    attachments: list[FormAttachmentOut] = []


class StatusChange(BaseModel):
    """admin 의 신청서 상태 변경 — reviewing/approved/rejected."""

    status: str  # STATUS_VALUES 중 하나
    comment: str | None = None


class FormCommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class FormCommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    form_id: int
    author_id: int
    author_name: str
    author_role: str
    body: str
    created_at: datetime
