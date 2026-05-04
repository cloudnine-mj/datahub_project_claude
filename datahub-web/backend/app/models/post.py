"""Post — 게시판 게시글 (데이터 관리 정책 / 제작 프로세스 / 활용 요청 프로세스).

board_type 으로 게시판을 구분 (별도 Board 테이블 없이 enum 으로 관리).

정책 게시판(policy)에서만 활용되는 메타필드 7종이 추가로 있음 — 사용자 여정 분석
(Step 1~4) 의 Opportunity 를 데이터 모델로 매핑한 결과:
  - summary       : Step 2 — 한 줄 설명
  - tags          : Step 2 — 분류 (적재/보안/PII 등)
  - severity      : Step 2,3 — 필수/권장/참고
  - applies_to    : Step 3 — 적용 대상 (누가 봐야 하는지)
  - tldr          : Step 4 — TL;DR 요약
  - action_items  : Step 4 — '이 정책을 지키려면 해야 할 것' 체크리스트
  - examples      : Step 4 — 올바른/잘못된 사례

다른 게시판도 같은 컬럼을 보유하지만 비워두면 단순 게시판으로 동작 (UI 가 분기).
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

# 게시판 종류 — Governance 인덱스의 4개 카드 중 게시판형 3개
BOARD_TYPES = ("policy", "production_process", "usage_process")

# 정책 중요도 — Step 2,3 의 사용자 판단 보조
SEVERITY_VALUES = ("required", "recommended", "reference")  # 필수 / 권장 / 참고


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    board_type: Mapped[str] = mapped_column(String(40), index=True)
    title: Mapped[str] = mapped_column(String(300))
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    content: Mapped[str] = mapped_column(Text)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    author_name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 정책 메타 (모두 선택값 — 비워두면 단순 게시판처럼 동작)
    summary: Mapped[str | None] = mapped_column(String(500), nullable=True)
    tags: Mapped[list | None] = mapped_column(JSON, nullable=True)             # ["적재", "보안"]
    severity: Mapped[str | None] = mapped_column(String(20), nullable=True)    # required/recommended/reference
    applies_to: Mapped[str | None] = mapped_column(String(300), nullable=True)
    tldr: Mapped[str | None] = mapped_column(Text, nullable=True)
    action_items: Mapped[list | None] = mapped_column(JSON, nullable=True)     # ["라이선스 명시", "PII 확인"]
    examples: Mapped[str | None] = mapped_column(Text, nullable=True)

    attachments: Mapped[list["PostAttachment"]] = relationship(
        back_populates="post", cascade="all, delete-orphan"
    )


class PostAttachment(Base):
    __tablename__ = "post_attachments"

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"))
    filename: Mapped[str] = mapped_column(String(255))
    stored_path: Mapped[str] = mapped_column(String(500))
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)

    post: Mapped[Post] = relationship(back_populates="attachments")
