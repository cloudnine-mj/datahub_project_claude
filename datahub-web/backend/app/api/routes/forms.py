"""신청서 — 화면 5,8,9,10,11.

URL:
  GET  /forms                  → 내 문서 목록 (전체 탭)
  GET  /forms?form_type=...    → 종류별 필터
  POST /forms                  → 신청서 제출
  GET  /forms/{id}             → 상세 (read-only 보기)
  PATCH /forms/{id}            → 수정 (제출자 or admin)
  GET  /forms/{id}/export      → Excel 다운로드
"""

from __future__ import annotations

from datetime import datetime
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Form, User
from app.models.form import FORM_TYPES
from app.schemas.form import FormCreate, FormDetail, FormListItem

router = APIRouter(prefix="/forms", tags=["forms"])


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

    form = Form(
        request_no=_next_request_no(db),
        form_type=payload.form_type,
        project_name=payload.project_name,
        submitter_id=user.id,
        submitter_name=user.name,
        submitter_email=user.email,
        submitter_department=user.department,
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
    db.commit()
    db.refresh(form)
    return form


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

    rows: list[tuple[str, str]] = [
        ("신청번호", form.request_no),
        ("신청서 종류", form.form_type),
        ("프로젝트명", form.project_name),
        ("신청자", form.submitter_name),
        ("이메일", form.submitter_email),
        ("소속", form.submitter_department or ""),
        ("상태", form.status),
        ("제출일", form.submitted_at.strftime("%Y-%m-%d %H:%M")),
        ("", ""),
        ("--- 상세 ---", ""),
    ]
    for k, v in form.payload.items():
        rows.append((str(k), str(v) if not isinstance(v, (dict, list)) else str(v)))

    for row in rows:
        ws.append(row)

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
