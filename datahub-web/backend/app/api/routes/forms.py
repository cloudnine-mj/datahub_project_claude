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
from app.models import Form, FormAttachment, User
from app.models.form import FORM_TYPES
from app.models.form import STATUS_VALUES
from app.schemas.form import FormAttachmentOut, FormCreate, FormDetail, FormListItem, StatusChange

router = APIRouter(prefix="/forms", tags=["forms"])

MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50MB (UI hint 와 일치)


def _next_request_no(db: Session) -> str:
    """REQ-YYYY-NNNNN — 연도별 카운터.

    SQLite max() 로 단순 처리. 동시성 충돌 가능성 있으나 단일 사용자 시나리오에서는 무해.
    """
    year = datetime.utcnow().year
    prefix = f"REQ-{year}-"
    last = (
        db.query(Form)
        .filter(Form.request_no.like(f"{prefix}%"))
        .order_by(Form.id.desc())
        .first()
    )
    seq = 1
    if last:
        try:
            seq = int(last.request_no.rsplit("-", 1)[-1]) + 1
        except ValueError:
            seq = 1
    return f"{prefix}{seq:05d}"


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
    form = db.query(Form).filter(Form.id == form_id).first()
    if not form:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="form not found")
    if form.submitter_id != user.id and user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="수정 권한이 없습니다.")
    form.project_name = payload.project_name
    form.payload = payload.payload
    form.status = payload.status
    if payload.submitter_name is not None:
        form.submitter_name = payload.submitter_name
    if payload.submitter_email is not None:
        form.submitter_email = payload.submitter_email
    if payload.submitter_department is not None:
        form.submitter_department = payload.submitter_department
    db.commit()
    db.refresh(form)
    return form


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


def _compute_total_cost(cost_str: str, count: int, currency_kind: str | None) -> str:
    """예상 비용 문자열의 첫 숫자 × 인원 수 → 통화 기호와 함께 포맷.

    프론트의 computeTotal 과 동일 로직 (USD: $N, KRW: N원, 그 외: 숫자만).
    """
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
    if currency_kind == "USD":
        return f"${formatted}"
    if currency_kind == "KRW":
        return f"{formatted}원"
    return formatted


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
        currency = b.get("currency") or {}
        kind = currency.get("kind") if isinstance(currency, dict) else None
        cost = b.get("cost") or ""
        count = len(members)
        total = _compute_total_cost(cost, count, kind)
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
