"""Form — 신청서 (5종).

  - data_production       : 데이터 용역 제작 신청서 (화면 10 입력 폼)
  - data_purchase         : 데이터 구매 신청서   (화면 9 read-only 상세)
  - data_subscription     : 데이터 구독 신청서
  - product_log_usage     : product 로그 데이터 활용 신청서
  - data_production_plan  : 데이터 제작 계획서

타입별 필드 구성이 모두 다르므로, 공통 메타(신청자/프로젝트/상태)만 컬럼으로 두고
타입별 페이로드는 JSON(`payload`) 으로 보관 — 새 신청서 추가 시 마이그레이션 불필요.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

FORM_TYPES = (
    "data_production",
    "data_purchase",
    "data_subscription",
    "product_log_usage",
    "data_production_plan",
)


class Form(Base):
    __tablename__ = "forms"

    id: Mapped[int] = mapped_column(primary_key=True)
    request_no: Mapped[str] = mapped_column(String(40), unique=True, index=True)  # REQ-2024-04291
    form_type: Mapped[str] = mapped_column(String(40), index=True)
    project_name: Mapped[str] = mapped_column(String(300))
    submitter_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    submitter_name: Mapped[str] = mapped_column(String(100))
    submitter_email: Mapped[str] = mapped_column(String(255))
    submitter_department: Mapped[str | None] = mapped_column(String(100), nullable=True)

    status: Mapped[str] = mapped_column(String(20), default="submitted")  # draft / submitted / approved / rejected
    payload: Mapped[dict] = mapped_column(JSON, default=dict)  # 타입별 자유 필드
    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    attachments: Mapped[list["FormAttachment"]] = relationship(
        back_populates="form", cascade="all, delete-orphan"
    )


class FormAttachment(Base):
    __tablename__ = "form_attachments"

    id: Mapped[int] = mapped_column(primary_key=True)
    form_id: Mapped[int] = mapped_column(ForeignKey("forms.id", ondelete="CASCADE"))
    filename: Mapped[str] = mapped_column(String(255))
    stored_path: Mapped[str] = mapped_column(String(500))
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)

    form: Mapped[Form] = relationship(back_populates="attachments")
