"""Audit Trail schema — 거버넌스 전체 활동 로그."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AuditFieldChange(BaseModel):
    """form.edited 이벤트의 필드 단위 변경. before/after 는 임의 JSON 값.

    field 는 백엔드 키 (예: 'project_name' 또는 payload 의 한국어 key)."""

    field: str
    before: Any = None
    after: Any = None


class AuditEvent(BaseModel):
    """집계 이벤트 — 별도 audit_events 테이블 없이 기존 데이터(approval_history,
    edit_history, form_comments, posts) 를 일관 포맷으로 변환해 반환.

    severity 매핑:
      - info     : created / commented / edited
      - success  : approved / reviewing 진입
      - warning  : (예약) 향후 임계 알림 등
      - danger   : rejected / deleted

    changes 는 form.edited 같이 구조화된 변경 내역이 있는 이벤트에서만 채워짐.
    그 외 이벤트는 None (UI 에서 펼침 비활성).
    """

    timestamp: datetime
    actor: str
    action: str  # 'form.created', 'form.approved', 'form.commented', 'post.created' 등
    target: str  # request_no, doc_no, board path 등
    detail: str
    severity: str  # 'info' | 'success' | 'warning' | 'danger'
    changes: list[AuditFieldChange] | None = Field(default=None)
