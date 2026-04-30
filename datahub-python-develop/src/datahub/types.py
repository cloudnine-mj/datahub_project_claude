"""공유 데이터 타입.

SDK 전체에서 사용되는 공통 dataclass 정의.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class UserIdentity:
    """현재 사용자 정보."""

    email: str
    user_id: int = 0


@dataclass
class ListResult:
    """페이지네이션을 지원하는 목록 조회 결과."""

    items: list[str] = field(default_factory=list)
    has_more: bool = False
    next_offset: Optional[str] = None

    def __iter__(self):
        return iter(self.items)

    def __len__(self):
        return len(self.items)


@dataclass
class CommitInfo:
    """커밋 정보."""

    id: str
    message: str
    committer: str = ""
    metadata: Optional[dict[str, str]] = None


@dataclass
class TableInfo:
    """테이블 메타데이터."""

    full_name: str
    catalog_name: str
    schema_name: str
    table_name: str
    storage_location: str
    comment: Optional[str] = None
    table_type: Optional[str] = None
    data_source_format: Optional[str] = None
    properties: Optional[dict[str, str]] = None


@dataclass
class DatasetMetadata:
    """데이터셋 메타데이터 스키마.

    non-None 필드만 서버에 전송하여 부분 업데이트.
    """

    dataset_description: Optional[str] = None
    modality: Optional[str] = None
    language: Optional[str] = None
    format: Optional[str] = None
    task: Optional[str] = None
    domain: Optional[str] = None
    license: Optional[str] = None
    source: Optional[str] = None
    version: Optional[str] = None
    owner: Optional[str] = None
    created_at: Optional[str] = None
    size_info: Optional[str] = None
    scan_tier: Optional[str] = None
    tags: Optional[str] = None

    _PROPERTY_FIELDS = (
        "modality", "language", "format", "task", "domain", "license",
        "source", "version", "owner", "created_at", "size_info",
        "scan_tier", "tags",
    )

    def to_dict(self) -> dict[str, str]:
        """non-None 필드만 dict로 변환."""
        d: dict[str, str] = {}
        if self.dataset_description is not None:
            d["dataset_description"] = self.dataset_description
        for f in self._PROPERTY_FIELDS:
            v = getattr(self, f)
            if v is not None:
                d[f] = v
        return d


@dataclass
class ApiKeyInfo:
    """서버의 GET /auth/api-keys 응답 entry.

    `api_key` 필드는 여기 없다 — raw key 는 생성 시점(CreatedApiKey) 에만 1회 노출.
    """

    id: int
    prefix: str
    name: str
    scope: str
    created_at: str
    is_active: bool
    last_used: Optional[str] = None
    expires_at: Optional[str] = None
    revoked_at: Optional[str] = None


@dataclass
class CreatedApiKey:
    """POST /auth/api-keys 응답. `api_key` 는 이 객체에서만 노출된다."""

    api_key: str
    id: int
    prefix: str
    name: str
    scope: str
    created_at: str
    expires_at: Optional[str] = None
