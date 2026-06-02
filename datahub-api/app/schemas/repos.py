"""Repo CRUD 스키마.

governance source-of-truth:
  docs/dev_docs/product-specs/repository-visibility-policy.md
  docs/dev_docs/api-specs/repository-api-spec.md
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, List, Literal, Optional

from pydantic import BaseModel, Field


VisibilityMode = Literal["public", "private", "fine_grained"]


class PublicAccess(BaseModel):
    """비멤버가 받을 수 있는 read-only access capability 6종 (governance 명세 그대로).

    의존:
      - file_read=True 면 file_list=True 필요
      - file_list=True 면 metadata_read=True 필요
      - lineage_read=True 면 metadata_read=True 필요
      - stats_read=True 면 metadata_read=True 필요
    """

    discoverable: bool = True
    metadata_read: bool = True
    file_list: bool = True
    file_read: bool = True
    lineage_read: bool = True
    stats_read: bool = True


def normalize_visibility(public_access: PublicAccess) -> VisibilityMode:
    """capability set → display visibility mode 파생 (governance §Formal Model).

    모두 true → 'public', 모두 false → 'private', 그 외 → 'fine_grained'.
    """
    values = (
        public_access.discoverable,
        public_access.metadata_read,
        public_access.file_list,
        public_access.file_read,
        public_access.lineage_read,
        public_access.stats_read,
    )
    if all(values):
        return "public"
    if not any(values):
        return "private"
    return "fine_grained"


def expand_preset(visibility: VisibilityMode) -> PublicAccess:
    """프리셋 enum → capability set 확장. 'fine_grained' 는 명시 public_access 가 필요하므로
    여기서는 default(public) 를 반환하지 않고 호출자가 명시 capability set 을 줘야 한다.
    """
    if visibility == "public":
        return PublicAccess(
            discoverable=True,
            metadata_read=True,
            file_list=True,
            file_read=True,
            lineage_read=True,
            stats_read=True,
        )
    if visibility == "private":
        return PublicAccess(
            discoverable=False,
            metadata_read=False,
            file_list=False,
            file_read=False,
            lineage_read=False,
            stats_read=False,
        )
    raise ValueError(
        "fine_grained visibility 는 명시적인 public_access capability set 을 요구합니다."
    )


def validate_dependencies(public_access: PublicAccess) -> None:
    """capability 의존을 위반하면 ValueError. 라우터/서비스 양쪽에서 재호출 안전.

    governance §Capability Dependency 그대로.
    """
    if public_access.file_read and not public_access.file_list:
        raise ValueError("file_read=true 는 file_list=true 를 요구합니다.")
    if public_access.file_list and not public_access.metadata_read:
        raise ValueError("file_list=true 는 metadata_read=true 를 요구합니다.")
    if public_access.lineage_read and not public_access.metadata_read:
        raise ValueError("lineage_read=true 는 metadata_read=true 를 요구합니다.")
    if public_access.stats_read and not public_access.metadata_read:
        raise ValueError("stats_read=true 는 metadata_read=true 를 요구합니다.")


class CreateRepoRequest(BaseModel):
    repo_name: str
    description: Optional[str] = None
    summary: Optional[str] = None
    repo_type: Optional[Literal["A", "B"]] = None  # A=dataset, B=model
    group: Optional[str] = None  # group namespace (organizations.group_name)
    visibility: VisibilityMode = "public"
    public_access: Optional[PublicAccess] = None  # fine_grained 일 때 명시 필수
    metadata: Optional["MetadataPatch"] = None
    ai_card: bool = False
    ai_metadata: bool = False


class CreateRepoResponse(BaseModel):
    repo_name: str
    bucket: str
    owner: str
    visibility: VisibilityMode
    public_access: PublicAccess


class RepoInfo(BaseModel):
    repo_name: str
    owner: str
    role: str
    visibility: VisibilityMode
    public_access: PublicAccess = Field(default_factory=PublicAccess)
    # PATCH /visibility 의 optimistic concurrency 토큰. 클라이언트는 이 값을 받아
    # PATCH 호출 시 그대로 돌려보내야 한다. 다르면 backend 가 409 conflict.
    public_access_version: int = 1
    description: Optional[str] = None
    repo_type: Optional[Literal["A", "B"]] = None
    member_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None
    file_count: Optional[int] = None
    total_size_bytes: Optional[int] = None
    group: Optional[str] = None  # organizations.group_name when repo belongs to a group
    # governance §repo-identity-spec — stable id 노출 (additive). 옛 클라이언트는
    # 무시 가능. rename / _resolve 흐름은 이 값을 source of truth 로 사용.
    repo_id: Optional[str] = None      # UUIDv7 stable id
    group_id: Optional[str] = None     # group UUIDv7 stable id (None for personal)
    bucket_name: Optional[str] = None  # opaque physical bucket (governance §architecture/storage-transfer)
    summary: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    metadata: Optional["RepositoryMetadata"] = None


class RepoListResponse(BaseModel):
    items: List[RepoInfo]
    has_more: bool = False
    next_page_token: Optional[str] = None
    # Transition alias for older CLI/SDK versions. Remove after one release window.
    repos: List[RepoInfo] = Field(default_factory=list)


class RenameRepoRequest(BaseModel):
    """PATCH /repos/{group}/{repo}/name 의 페이로드 (governance §repo-identity-spec).

    - new_name: 새 user-facing slug. group 내 unique 강제.
    - reason: 선택. audit 로 남김.
    bucket / repo_id / 종속 도메인 FK 는 무영향 (slug rename invariant).
    """

    new_name: str
    reason: Optional[str] = None


class RenameRepoResponse(BaseModel):
    """rename 후 새 canonical path 와 stable id 안내."""

    repo_id: str
    group_id: Optional[str]
    repo_name: str
    new_path: str  # "group/new_name"
    old_path: str  # "group/old_name"


class UpdateVisibilityRequest(BaseModel):
    """PATCH /repos/{owner}/{repo}/visibility 의 페이로드.

    `version` 은 optimistic concurrency. 클라이언트는 GET 으로 읽은 version 을
    그대로 돌려보내야 하며, DB 의 현재 version 과 다르면 409 conflict.
    """

    visibility: VisibilityMode
    public_access: Optional[PublicAccess] = None  # fine_grained 일 때 명시 필수
    version: int = Field(..., ge=1)


class RepoStatsResponse(BaseModel):
    repo_name: str
    owner: str
    visibility: VisibilityMode
    file_count: int = 0
    total_size_bytes: int = 0
    data_size: Optional[str] = None
    data_count: Optional[str] = None
    data_card_tier: Optional[str] = None


class RepositoryMetadata(BaseModel):
    repo: str
    summary: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    properties: dict[str, Any] = Field(default_factory=dict)
    updated_at: Optional[datetime] = None


class MetadataPatch(BaseModel):
    summary: Optional[str] = None
    tags: Optional[list[str]] = None
    properties: Optional[dict[str, Any]] = None


class MetadataValidationIssue(BaseModel):
    field: str
    message: str


class MetadataValidationResponse(BaseModel):
    status: Literal["valid", "warning", "error"]
    warnings: list[MetadataValidationIssue] = Field(default_factory=list)
    errors: list[MetadataValidationIssue] = Field(default_factory=list)


class TagsUpdateRequest(BaseModel):
    tags: list[str]


class SearchResult(BaseModel):
    repo: str
    name: str
    group: str
    type: Optional[Literal["dataset", "model"]] = None
    visibility: VisibilityMode
    role: str
    summary: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    updated_at: Optional[datetime] = None
    score: Optional[float] = None


class SearchResponse(BaseModel):
    items: list[SearchResult]
    has_more: bool = False
    next_page_token: Optional[str] = None
