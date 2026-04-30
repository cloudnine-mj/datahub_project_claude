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
    category: str | None = None
    content: str = ""


class PostUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=300)
    category: str | None = None
    content: str | None = None


class PostListItem(BaseModel):
    """게시판 목록 row — 화면 3,4 의 (번호 / 제목 / 작성일)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    created_at: datetime
    author_name: str


class PostDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    board_type: str
    title: str
    category: str | None
    content: str
    author_name: str
    created_at: datetime
    updated_at: datetime
    attachments: list[PostAttachmentOut] = []
