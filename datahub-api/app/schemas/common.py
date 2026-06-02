"""공통 Pagination, Error 스키마."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class PaginationParams(BaseModel):
    after: Optional[str] = None
    amount: int = 100


class PaginatedResponse(BaseModel):
    has_more: bool = False
    next_offset: Optional[str] = None


class ErrorResponse(BaseModel):
    detail: str
