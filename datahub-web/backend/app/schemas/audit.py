"""Audit Trail schema — 거버넌스 전체 활동 로그."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class AuditEvent(BaseModel):
    """집계 이벤트 — 별도 audit_events 테이블 없이 기존 데이터(approval_history,
    edit_history, form_comments, posts) 를 일관 포맷으로 변환해 반환.

    severity 매핑:
      - info     : created / commented / edited
      - success  : approved / reviewing 진입
      - warning  : (예약) 향후 임계 알림 등
      - danger   : rejected / deleted
    """

    timestamp: datetime
    actor: str
    action: str  # 'form.created', 'form.approved', 'form.commented', 'post.created' 등
    target: str  # request_no, doc_no, board path 등
    detail: str
    severity: str  # 'info' | 'success' | 'warning' | 'danger'
