"""신청서 — 화면 5,8,9,10,11.

URL:
  GET  /forms                  → 내 문서 목록 (전체 탭)
  GET  /forms?form_type=...    → 종류별 필터
  POST /forms                  → 신청서 제출
  GET  /forms/{id}             → 상세 (read-only 보기)
  PATCH /forms/{id}            → 수정 (제출자 or admin)
  GET  /forms/{id}/export      → Excel 다운로드

  파일 첨부:
  POST   /forms/{id}/attachments         → 업로드 (multipart/form-data, file)
  GET    /forms/{id}/attachments/{aid}   → 다운로드
  DELETE /forms/{id}/attachments/{aid}   → 삭제
"""

from __future__ import annotations

import secrets
from datetime import datetime
from io import BytesIO
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse, StreamingResponse
from openpyxl import Workbook
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import settings
from app.db.session import get_db
from app.models import Form, FormAttachment, FormComment, User
from app.models.form import FORM_TYPES
from app.models.form import STATUS_VALUES
from app.schemas.form import (
    FormAttachmentOut,
    FormCommentCreate,
    FormCommentOut,
    FormCreate,
    FormDetail,
    FormListItem,
    StatusChange,
)

router = APIRouter(prefix="/forms", tags=["forms"])

MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50MB (UI hint 와 일치)


def _next_request_no(db: Session) -> str:
    """REQ-YYYY-NNNNN — 연도별 카운터.

    versioning 으로 인한 '-vN' 접미는 무시하고 base 시퀀스 max + 1.
    예: REQ-2026-00001, REQ-2026-00001-v2, REQ-2026-00002 가 있으면 다음은 00003.
    """
    import re

    year = datetime.utcnow().year
    prefix = f"REQ-{year}-"
    rows = (
        db.query(Form.request_no)
        .filter(Form.request_no.like(f"{prefix}%"))
        .all()
    )
    max_seq = 0
    for (rn,) in rows:
        # '-vN' suffix 제거
        base = re.sub(r"-v\d+$", "", rn)
        # base 가 'REQ-YYYY-NNNNN' 형태인지 — 마지막 토큰이 정수면 비교
        try:
            n = int(base.rsplit("-", 1)[-1])
        except ValueError:
            continue
        if n > max_seq:
            max_seq = n
    return f"{prefix}{max_seq + 1:05d}"


@router.get("", response_model=list[FormListItem])
def list_forms(
    form_type: str | None = Query(None),
    mine: bool = Query(True, description="True 면 본인 제출분만 반환 — '내 문서 목록'"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Form]:
    q = db.query(Form)
    if mine:
        q = q.filter(Form.submitter_id == user.id)
    if form_type:
        if form_type not in FORM_TYPES:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"unknown form_type: {form_type}")
        q = q.filter(Form.form_type == form_type)
    return q.order_by(Form.submitted_at.desc()).all()


@router.post("", response_model=FormDetail, status_code=status.HTTP_201_CREATED)
def submit_form(
    payload: FormCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if payload.form_type not in FORM_TYPES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"unknown form_type: {payload.form_type}")

    # 신청자 정보는 사용자 입력 우선, 없으면 로그인 사용자로 fallback.
    # 추후 감사·추적이 필요하면 submitter_id 는 항상 로그인 사용자로 고정.
    form = Form(
        request_no=_next_request_no(db),
        form_type=payload.form_type,
        project_name=payload.project_name,
        submitter_id=user.id,
        submitter_name=payload.submitter_name or user.name,
        submitter_email=payload.submitter_email or user.email,
        submitter_department=payload.submitter_department or user.department,
        status=payload.status,
        payload=payload.payload,
    )
    # 제출 상태로 생성되는 경우 — 사용자에게도 보이도록 '최초 제출' 이력을 자동 추가
    if payload.status == "submitted":
        form.approval_history = [{
            "status": "submitted",
            "changed_by": user.name,
            "changed_at": datetime.utcnow().isoformat(),
            "comment": "최초 제출",
        }]
    db.add(form)
    db.commit()
    db.refresh(form)
    return form


@router.get("/{form_id}", response_model=FormDetail)
def get_form(
    form_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    form = db.query(Form).filter(Form.id == form_id).first()
    if not form:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="form not found")
    if form.submitter_id != user.id and user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="조회 권한이 없습니다.")
    return form


@router.patch("/{form_id}", response_model=FormDetail)
def update_form(
    form_id: int,
    payload: FormCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """수정 — 기존 row 를 그대로 mutate. 매 수정마다 버전을 올리지 않음.

    edit_history 에는 변경 diff 를 누적해 추적 가능 (UI 노출은 별도).
    """
    form = db.query(Form).filter(Form.id == form_id).first()
    if not form:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="form not found")
    if form.submitter_id != user.id and user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="수정 권한이 없습니다.")

    changes = _compute_form_diff(form, payload)
    prev_status = form.status

    form.project_name = payload.project_name
    form.payload = payload.payload
    form.status = payload.status

    # 임시저장(draft) → 제출(submitted) 첫 전환 시 '최초 제출' 이력 자동 추가
    if prev_status != "submitted" and payload.status == "submitted" and not (form.approval_history or []):
        form.approval_history = [{
            "status": "submitted",
            "changed_by": user.name,
            "changed_at": datetime.utcnow().isoformat(),
            "comment": "최초 제출",
        }]
    if payload.submitter_name is not None:
        form.submitter_name = payload.submitter_name
    if payload.submitter_email is not None:
        form.submitter_email = payload.submitter_email
    if payload.submitter_department is not None:
        form.submitter_department = payload.submitter_department

    # 변경된 게 있으면 edit_history 에 누적 (새 버전 row 는 만들지 않음)
    if changes:
        history = list(form.edit_history or [])
        history.append({
            "edited_by": user.name,
            "edited_at": datetime.utcnow().isoformat(),
            "changes": changes,
        })
        form.edit_history = history

    db.commit()
    db.refresh(form)
    return form


def _compute_form_diff(form: Form, payload: FormCreate) -> list[dict]:
    """수정 전 form 의 값과 새 payload 비교 → 변경된 필드 리스트.

    공통 메타(프로젝트명/신청자 정보) + payload 내부 키 모두 검사.
    중첩 dict/list 는 deep equality 만 비교 (sub-key diff 는 안 만듦).
    submitter_* 가 None 으로 들어오면 변경 없음으로 취급.
    """
    out: list[dict] = []

    if form.project_name != payload.project_name:
        out.append({
            "field": "프로젝트명",
            "before": form.project_name,
            "after": payload.project_name,
        })

    submitter_fields = (
        ("신청자 이름", form.submitter_name, payload.submitter_name),
        ("이메일", form.submitter_email, payload.submitter_email),
        ("소속", form.submitter_department, payload.submitter_department),
    )
    for label, before, after in submitter_fields:
        if after is not None and before != after:
            out.append({"field": label, "before": before, "after": after})

    before_payload = form.payload or {}
    after_payload = payload.payload or {}
    for key in set(before_payload) | set(after_payload):
        b = before_payload.get(key)
        a = after_payload.get(key)
        if b != a:
            out.append({"field": key, "before": b, "after": a})

    return out


@router.patch("/{form_id}/status", response_model=FormDetail)
def change_form_status(
    form_id: int,
    body: StatusChange,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """신청서 상태 변경 — admin 만 가능. 변경 이력은 approval_history 에 누적.

    실제 환경에서는 전자결재 시스템 webhook 으로 들어오겠지만, MVP 는
    admin 이 직접 reviewing/approved/rejected 로 전이.
    """
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="관리자만 상태를 변경할 수 있습니다.")
    if body.status not in STATUS_VALUES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"unknown status: {body.status}")

    form = db.query(Form).filter(Form.id == form_id).first()
    if not form:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="form not found")
    # 자기 결재 방지 — admin 이라도 본인이 제출한 신청서는 본인이 처리 X
    if form.submitter_id == user.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="본인이 제출한 신청서의 상태는 변경할 수 없습니다.",
        )

    history = list(form.approval_history or [])
    history.append({
        "status": body.status,
        "changed_by": user.name,
        "changed_at": datetime.utcnow().isoformat(),
        "comment": body.comment,
    })
    form.status = body.status
    form.approval_history = history
    db.commit()
    db.refresh(form)
    return form


@router.delete("/{form_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_form(
    form_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """신청서 삭제 — 제출자 본인 또는 admin 만 가능. 첨부 파일도 함께 정리."""
    form = db.query(Form).filter(Form.id == form_id).first()
    if not form:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="form not found")
    if form.submitter_id != user.id and user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="삭제 권한이 없습니다.")

    # 첨부 디스크 파일 정리 (DB row 는 cascade 로 삭제됨)
    for att in form.attachments:
        try:
            Path(att.stored_path).unlink(missing_ok=True)
        except OSError:
            pass

    db.delete(form)
    db.commit()


_CURRENCY_SYMBOL = {
    "USD": "$", "KRW": "₩", "EUR": "€", "JPY": "¥", "CNY": "¥",
    "GBP": "£", "HKD": "HK$", "AUD": "A$", "CAD": "C$", "SGD": "S$",
    "CHF": "CHF", "TWD": "NT$", "INR": "₹", "VND": "₫", "THB": "฿",
    "IDR": "Rp", "MYR": "RM", "PHP": "₱",
}


def _currency_prefix(currency: dict | None) -> str:
    """프론트 currencyPrefix 와 동일 — kind/custom 조합으로 prefix."""
    if not currency:
        return ""
    kind = currency.get("kind") if isinstance(currency, dict) else None
    if not kind:
        return ""
    if kind == "기타":
        code = (currency.get("custom") or "").strip()
        if not code:
            return ""
        return _CURRENCY_SYMBOL.get(code, code)
    return _CURRENCY_SYMBOL.get(kind, kind)


def _compute_total_cost(cost_str: str, count: int, currency: dict | None) -> str:
    """예상 비용 첫 숫자 × 인원 수 → 통화 prefix 포함 문자열. 프론트 computeTotal 과 동일."""
    import re
    if not cost_str or count <= 0:
        return ""
    m = re.search(r"-?\d+(?:\.\d+)?", cost_str.replace(",", ""))
    if not m:
        return ""
    try:
        n = float(m.group(0))
    except ValueError:
        return ""
    total = round(n * count)
    formatted = f"{total:,}"
    prefix = _currency_prefix(currency)
    if not prefix:
        return formatted
    return f"{prefix}{formatted}" if len(prefix) <= 1 else f"{prefix} {formatted}"


def _render_productivity_tool_table(ws, payload: dict) -> None:
    """업무생산성 도구 신청서 — service_blocks 를 표 형태로 출력.

    컬럼: 서비스명 / 활용 방안 / 예상 비용 / 결제 방식 / 사용 인원 / 인원 수 / 총 비용
    """
    blocks = payload.get("서비스_목록") or []
    if not isinstance(blocks, list):
        return

    headers = ["서비스명", "활용 방안", "예상 비용", "결제 방식", "사용 인원", "인원 수", "총 비용"]
    ws.append(headers)
    for b in blocks:
        if not isinstance(b, dict):
            continue
        members = b.get("members") or []
        if not isinstance(members, list):
            members = []
        currency = b.get("currency") if isinstance(b.get("currency"), dict) else None
        cost = b.get("cost") or ""
        count = len(members)
        total = _compute_total_cost(cost, count, currency)
        ws.append([
            b.get("service_name", "") or "",
            b.get("usage", "") or "",
            cost,
            b.get("payment_method", "") or "",
            ", ".join(str(m) for m in members),
            count,
            total,
        ])

    # 표 컬럼 폭 조정 (헤더 후 7 컬럼)
    widths = [22, 40, 18, 14, 30, 8, 14]
    for i, w in enumerate(widths):
        col_letter = chr(ord("A") + i)
        ws.column_dimensions[col_letter].width = w


def _render_api_usage_plan_table(ws, payload: dict) -> None:
    """API 활용 계획서 — 한 행 짜리 표.

    컬럼: 연관 프로젝트 / API 사용 목적 / 서비스명 / 사용 기간 / 결제 통화 / 총 예상비용
    """
    headers = ["연관 프로젝트", "API 사용 목적", "서비스명", "사용 기간", "결제 통화", "총 예상비용"]
    ws.append(headers)

    services = payload.get("서비스_목록") or []
    if isinstance(services, list):
        services_str = ", ".join(str(s) for s in services if s)
    else:
        services_str = str(services)

    period = payload.get("사용_기간") or {}
    if isinstance(period, dict):
        start = period.get("start") or ""
        end = period.get("end") or ""
        period_str = f"{start} ~ {end}" if (start or end) else ""
    else:
        period_str = str(period)

    currency = payload.get("결제_통화") or {}
    if isinstance(currency, dict):
        kind = currency.get("kind") or ""
        custom = currency.get("custom") or ""
        currency_str = f"기타({custom})" if kind == "기타" else kind
    else:
        currency_str = str(currency)

    ws.append([
        payload.get("관련_프로젝트", "") or "",
        payload.get("API_사용_목적", "") or "",
        services_str,
        period_str,
        currency_str,
        payload.get("총_예상_비용", "") or "",
    ])

    widths = [22, 40, 30, 24, 14, 18]
    for i, w in enumerate(widths):
        col_letter = chr(ord("A") + i)
        ws.column_dimensions[col_letter].width = w


@router.get("/{form_id}/export")
def export_form(
    form_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Excel Export — 화면 8/9 의 'Excel' 버튼."""
    form = db.query(Form).filter(Form.id == form_id).first()
    if not form:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="form not found")
    if form.submitter_id != user.id and user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="조회 권한이 없습니다.")

    wb = Workbook()
    ws = wb.active
    ws.title = "신청서"

    header_rows: list[tuple[str, str]] = [
        ("신청번호", form.request_no),
        ("신청서 종류", form.form_type),
        ("프로젝트명", form.project_name),
        ("신청자", form.submitter_name),
        ("이메일", form.submitter_email),
        ("소속", form.submitter_department or ""),
        ("상태", form.status),
        ("제출일", form.submitted_at.strftime("%Y-%m-%d %H:%M")),
        ("", ""),
    ]
    for row in header_rows:
        ws.append(row)

    if form.form_type == "productivity_tool":
        _render_productivity_tool_table(ws, form.payload)
    elif form.form_type == "api_usage_plan":
        _render_api_usage_plan_table(ws, form.payload)
    else:
        ws.append(("--- 상세 ---", ""))
        for k, v in form.payload.items():
            ws.append((str(k), str(v) if not isinstance(v, (dict, list)) else str(v)))
        ws.column_dimensions["A"].width = 24
        ws.column_dimensions["B"].width = 60

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)

    filename = f"{form.request_no}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── 파일 첨부 ─────────────────────────────────────────────────────────────────


def _check_form_owner(form_id: int, db: Session, user: User) -> Form:
    form = db.query(Form).filter(Form.id == form_id).first()
    if not form:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="form not found")
    if form.submitter_id != user.id and user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="권한이 없습니다.")
    return form


@router.post(
    "/{form_id}/attachments",
    response_model=FormAttachmentOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_attachment(
    form_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """파일 1개 업로드 — 50MB 제한.

    저장 경로: `uploads/forms/{form_id}/{token}_{원본파일명}`
    원본 파일명은 별도 컬럼에 그대로 보관 (다운로드 시 노출).
    """
    form = _check_form_owner(form_id, db, user)

    # 50MB 제한 — 미리 head 만 읽어서 크기 추정 후, 전체 읽고 재검증
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"파일 크기는 {MAX_UPLOAD_BYTES // (1024 * 1024)}MB 이하여야 합니다.",
        )

    # 디렉토리 + 충돌 방지 파일명
    target_dir: Path = settings.upload_dir / "forms" / str(form.id)
    target_dir.mkdir(parents=True, exist_ok=True)
    safe_name = (file.filename or "unnamed").replace("/", "_").replace("\\", "_")
    stored_name = f"{secrets.token_hex(8)}_{safe_name}"
    target_path = target_dir / stored_name
    target_path.write_bytes(contents)

    att = FormAttachment(
        form_id=form.id,
        filename=safe_name,
        stored_path=str(target_path),
        size_bytes=len(contents),
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    return att


@router.get("/{form_id}/attachments/{att_id}")
def download_attachment(
    form_id: int,
    att_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _check_form_owner(form_id, db, user)
    att = (
        db.query(FormAttachment)
        .filter(FormAttachment.id == att_id, FormAttachment.form_id == form_id)
        .first()
    )
    if not att:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="attachment not found")
    if not Path(att.stored_path).exists():
        raise HTTPException(status.HTTP_410_GONE, detail="파일이 디스크에서 사라졌습니다.")
    return FileResponse(att.stored_path, filename=att.filename)


@router.delete("/{form_id}/attachments/{att_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attachment(
    form_id: int,
    att_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _check_form_owner(form_id, db, user)
    att = (
        db.query(FormAttachment)
        .filter(FormAttachment.id == att_id, FormAttachment.form_id == form_id)
        .first()
    )
    if not att:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="attachment not found")
    # 디스크에서 먼저 삭제 시도 (실패해도 DB row 는 삭제 — 고아 파일 방지)
    try:
        Path(att.stored_path).unlink(missing_ok=True)
    except OSError:
        pass
    db.delete(att)
    db.commit()


# ── 댓글 — 신청서별 단일 스레드 ─────────────────────────────────
# 권한: form 조회 가능한 사용자 (제출자 본인 또는 admin) 만 작성/조회 가능.
# '권한 부여된 검토자' 컨셉은 향후 ACL 모델 도입 시 _check_form_owner 를 확장하면
# 댓글에도 자동 반영됨.


@router.get("/{form_id}/comments", response_model=list[FormCommentOut])
def list_form_comments(
    form_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[FormComment]:
    _check_form_owner(form_id, db, user)
    return (
        db.query(FormComment)
        .filter(FormComment.form_id == form_id)
        .order_by(FormComment.created_at.asc())
        .all()
    )


@router.post(
    "/{form_id}/comments",
    response_model=FormCommentOut,
    status_code=status.HTTP_201_CREATED,
)
def create_form_comment(
    form_id: int,
    payload: FormCommentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _check_form_owner(form_id, db, user)
    comment = FormComment(
        form_id=form_id,
        author_id=user.id,
        author_name=user.name,
        author_role=user.role,
        body=payload.body.strip(),
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@router.delete("/{form_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_form_comment(
    form_id: int,
    comment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _check_form_owner(form_id, db, user)
    comment = (
        db.query(FormComment)
        .filter(FormComment.id == comment_id, FormComment.form_id == form_id)
        .first()
    )
    if not comment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="comment not found")
    # 작성자 본인 또는 admin 만 삭제 가능
    if comment.author_id != user.id and user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="삭제 권한이 없습니다.")
    db.delete(comment)
    db.commit()
