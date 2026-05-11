"""Audit Trail — 거버넌스 활동 로그.

별도 audit_events 테이블을 두지 않고 기존 도메인 데이터(approval_history,
edit_history, form_comments, posts) 를 일관 포맷으로 집계해서 반환한다.
이후 트래픽/감사 요건이 커지면 이 함수에서 emit 하는 모양 그대로 실제
audit_events 테이블에 적재하도록 전환 가능.

권한: admin 만 조회. (감사 로그 자체가 통제 정보)
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Form, Post, User
from app.schemas.audit import AuditEvent

router = APIRouter(prefix="/audit", tags=["audit"])

_FORM_LABEL = {
    "data_production": "데이터 용역 제작",
    "data_purchase": "데이터 구매",
    "data_subscription": "데이터 구독",
    "product_log_usage": "Product 로그 활용",
    "data_production_plan": "데이터 제작 계획",
    "api_usage_plan": "API 사용 계획",
    "productivity_tool": "업무 생산성 도구",
}


def _severity_for_status(s: str) -> str:
    if s == "approved":
        return "success"
    if s == "rejected":
        return "danger"
    if s == "reviewing":
        return "success"
    return "info"  # submitted, draft


def _parse_iso(v: Any) -> datetime | None:
    if isinstance(v, datetime):
        return v
    if isinstance(v, str):
        try:
            return datetime.fromisoformat(v.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            return None
    return None


@router.get("", response_model=list[AuditEvent])
def list_audit_events(
    days: int = Query(7, ge=1, le=90, description="조회 기간 (일). 최대 90일."),
    search: str | None = Query(None, description="actor/target/detail 부분 일치"),
    severity: str | None = Query(None, description="info/success/warning/danger"),
    mine: bool = Query(False, description="True 면 본인 신청서/본인 행위 이벤트만 — admin 권한 불필요."),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[AuditEvent]:
    # admin 모드 (전체 로그) 만 admin 권한 필요. mine 모드는 본인 데이터라 모두 가능.
    if not mine and user.role != "admin":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail="감사 로그는 관리자만 조회할 수 있습니다."
        )

    since = datetime.utcnow() - timedelta(days=days)
    events: list[dict[str, Any]] = []

    # 1) 신청서 — 제출 / 상태 변경(approval_history) / 수정(edit_history).
    # mine 모드면 본인 제출분만 후보로.
    forms_q = db.query(Form)
    if mine:
        forms_q = forms_q.filter(Form.submitter_id == user.id)
    forms = forms_q.all()
    for form in forms:
        type_label = _FORM_LABEL.get(form.form_type, form.form_type)

        # 1-a) 최초 제출 — approval_history 의 첫 'submitted' 가 없으면 submitted_at 기준 fallback
        first_submit = None
        for entry in form.approval_history or []:
            if entry.get("status") == "submitted":
                first_submit = entry
                break
        submitted_ts = (
            _parse_iso(first_submit["changed_at"]) if first_submit else form.submitted_at
        )
        if submitted_ts and submitted_ts >= since and form.status != "draft":
            events.append(
                {
                    "timestamp": submitted_ts,
                    "actor": first_submit["changed_by"] if first_submit else form.submitter_name,
                    "action": "form.created",
                    "target": form.request_no,
                    "detail": f"{type_label} 신청 — {form.project_name}",
                    "severity": "info",
                }
            )

        # 1-b) 상태 변경 — submitted 제외 (form.created 와 중복)
        for entry in form.approval_history or []:
            s = entry.get("status")
            if s == "submitted":
                continue
            ts = _parse_iso(entry.get("changed_at"))
            if not ts or ts < since:
                continue
            label = {"reviewing": "검토 시작", "approved": "승인", "rejected": "반려"}.get(s, s or "")
            detail = entry.get("comment") or f"{form.project_name} {label}"
            events.append(
                {
                    "timestamp": ts,
                    "actor": entry.get("changed_by", "?"),
                    "action": f"form.{s}",
                    "target": form.request_no,
                    "detail": detail,
                    "severity": _severity_for_status(s or ""),
                }
            )

        # 1-c) 수정 이력 — 필드 단위 changes 도 함께 실어 UI 에서 펼침 가능
        for entry in form.edit_history or []:
            ts = _parse_iso(entry.get("edited_at"))
            if not ts or ts < since:
                continue
            changes_raw = entry.get("changes") or []
            n = len(changes_raw)
            events.append(
                {
                    "timestamp": ts,
                    "actor": entry.get("edited_by", "?"),
                    "action": "form.edited",
                    "target": form.request_no,
                    "detail": f"{form.project_name} — {n}개 필드 수정",
                    "severity": "info",
                    "changes": [
                        {
                            "field": c.get("field", "?"),
                            "before": c.get("before"),
                            "after": c.get("after"),
                        }
                        for c in changes_raw
                        if isinstance(c, dict)
                    ],
                }
            )

    # 2) 댓글(form_comments / Discussions) — 감사 로그에서 일단 제외.
    # 비공식 의사소통이라 거버넌스 추적 대상으로는 노이즈가 크다고 판단.
    # 필요해지면 위 forms 루프와 동일 패턴으로 다시 수집하면 됨.

    # 3) 게시글 — 생성/수정. mine 모드면 본인 작성분만, 일반 사용자는 게시글 작성 권한 없으니
    # 실질적으로 mine=True 한정에선 결과가 비어있을 수 있음 — 그래도 admin 본인이 mine 으로
    # 조회할 경우는 본인 작성글이 노출되어야 자연스러움.
    posts_q = db.query(Post).filter(Post.created_at >= since)
    if mine:
        posts_q = posts_q.filter(Post.author_id == user.id)
    posts = posts_q.all()
    for p in posts:
        target = p.doc_no or f"POST-{p.id}"
        events.append(
            {
                "timestamp": p.created_at,
                "actor": p.author_name,
                "action": f"post.{p.board_type}.created",
                "target": target,
                "detail": f"{p.title}",
                "severity": "info",
            }
        )
        # 수정 이력은 별도 추적 없음 — updated_at 이 created_at 보다 의미있게 늦으면 한 줄 추가
        if p.updated_at and p.created_at and (p.updated_at - p.created_at).total_seconds() > 60:
            if p.updated_at >= since:
                events.append(
                    {
                        "timestamp": p.updated_at,
                        "actor": p.author_name,
                        "action": f"post.{p.board_type}.updated",
                        "target": target,
                        "detail": f"{p.title} 수정",
                        "severity": "info",
                    }
                )

    # 필터링
    if search:
        s = search.lower()
        events = [
            e
            for e in events
            if s in (e["actor"] or "").lower()
            or s in (e["target"] or "").lower()
            or s in (e["detail"] or "").lower()
            or s in (e["action"] or "").lower()
        ]
    if severity:
        events = [e for e in events if e["severity"] == severity]

    events.sort(key=lambda e: e["timestamp"], reverse=True)
    return [AuditEvent(**e) for e in events]
