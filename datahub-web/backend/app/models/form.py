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
    "api_usage_plan",
    "productivity_tool",
)

# 신청서 상태 — 전자결재 시스템과 연동되기 전 mock 워크플로우.
#   draft       : 임시저장 (작성 중)
#   submitted   : 제출됨 — 검토 대기
#   reviewing   : 검토 중 (관리자가 픽업)
#   approved    : 승인 완료
#   rejected    : 반려
STATUS_VALUES = ("draft", "submitted", "reviewing", "approved", "rejected")


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

    status: Mapped[str] = mapped_column(String(20), default="submitted")
    # 상태 변경 이력 — [{status, changed_by, changed_at, comment}, ...]
    approval_history: Mapped[list | None] = mapped_column(JSON, nullable=True)
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
