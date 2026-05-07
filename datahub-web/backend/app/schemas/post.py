from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PostAttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    size_bytes: int


class PostCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    doc_no: str | None = Field(default=None, max_length=50)
    doc_type: str | None = Field(default=None, max_length=20)  # '가이드' / '공지' 등
    category: str | None = None
    content: str = ""

    # 정책 메타 (모두 선택)
    summary: str | None = None
    tags: list[str] | None = None
    severity: str | None = None  # required / recommended / reference
    applies_to: str | None = None
    tldr: str | None = None
    action_items: list[str] | None = None
    examples: str | None = None


class PostUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=300)
    doc_no: str | None = Field(default=None, max_length=50)
    doc_type: str | None = Field(default=None, max_length=20)
    category: str | None = None
    content: str | None = None
    summary: str | None = None
    tags: list[str] | None = None
    severity: str | None = None
    applies_to: str | None = None
    tldr: str | None = None
    action_items: list[str] | None = None
    examples: str | None = None


class PostListItem(BaseModel):
    """게시판 목록 row.

    정책 게시판은 표/카드형이라 메타필드도 함께 노출 — 단순 게시판은 None 들이 와서 무시됨.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    doc_no: str | None = None
    doc_type: str | None = None
    category: str | None = None
    created_at: datetime
    updated_at: datetime
    author_name: str
    summary: str | None = None
    tags: list[str] | None = None
    severity: str | None = None
    applies_to: str | None = None


class PostDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    board_type: str
    title: str
    doc_no: str | None = None
    doc_type: str | None = None
    category: str | None
    content: str
    author_name: str
    created_at: datetime
    updated_at: datetime
    attachments: list[PostAttachmentOut] = []

    # 정책 메타
    summary: str | None = None
    tags: list[str] | None = None
    severity: str | None = None
    applies_to: str | None = None
    tldr: str | None = None
    action_items: list[str] | None = None
    examples: str | None = None
