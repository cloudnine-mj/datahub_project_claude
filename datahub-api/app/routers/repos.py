"""Repository CRUD endpoints.

- POST /repos: repository registry + GCS bucket provisioning
- GET /repos: 접근 가능한 레포 목록
- DELETE /repos/{repo_name}: 레포 삭제 (owner only)
- PATCH /repos/{repo_name}/visibility: 공개 범위 변경 (owner/maintainer)
- GET /repos/{repo_name}/stats: repository storage stats
"""

from __future__ import annotations

import base64
import json
import unicodedata
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.auth.scopes import _grants_match
from app.config import settings as app_settings
from app.database import get_db
from app.dependencies import get_current_user, require_scope
from app.models import Organization, Permission, Repo, RepoLineage, RepoMetadata, RepoPublicAccessPolicy, User
from app.schemas.repos import (
    CreateRepoRequest,
    CreateRepoResponse,
    MetadataPatch,
    MetadataValidationIssue,
    MetadataValidationResponse,
    PublicAccess,
    RenameRepoRequest,
    RenameRepoResponse,
    RepoInfo,
    RepoListResponse,
    RepoStatsResponse,
    RepositoryMetadata,
    SearchResponse,
    SearchResult,
    TagsUpdateRequest,
    UpdateVisibilityRequest,
    expand_preset,
    normalize_visibility,
    validate_dependencies,
)
from app.services.audit import AuditService
from app.services.authorization import check_access, get_repo_by_name, require_admin, require_capability, resolve_role
from app.services.repository_discovery import (
    discovery_role,
    repo_identifier as discovery_repo_identifier,
    repo_namespace as discovery_repo_namespace,
    visible_repo_metadata_query,
)
from app.services.gcs import GCSService
from app.services.idempotency import run_idempotent
from app.services.provisioning import ProvisioningService
from app.services.repo_naming import make_gcs_key, make_opaque_gcs_key, validate_bucket_name
from app.services.repo_identity import personal_owner_from_email, validate_repo_segment
from app.services.metadata_vocabulary import VALIDATED_PROPERTY_KINDS, active_vocabulary_ids

router = APIRouter()
audit = AuditService()

# 서비스 인스턴스 (모듈 레벨 — lifespan에서 초기화해도 되지만 단순하게)
_gcs = GCSService()
_provisioning = ProvisioningService(_gcs)


def _normalize_tag(tag: str) -> str:
    value = unicodedata.normalize("NFC", tag.strip())
    if not value:
        raise HTTPException(status_code=400, detail="tag must not be empty")
    if any(ord(ch) < 32 or ord(ch) == 127 for ch in value):
        raise HTTPException(status_code=400, detail="tag must not contain control characters")
    value = "".join(ch.lower() if "A" <= ch <= "Z" else ch for ch in value)
    if any(ch.isspace() for ch in value):
        raise HTTPException(status_code=400, detail="tag must not contain whitespace")
    return value


def _normalize_tags(tags: list[str] | None) -> list[str]:
    if not tags:
        return []
    normalized: list[str] = []
    seen: set[str] = set()
    for tag in tags:
        value = _normalize_tag(str(tag))
        if value not in seen:
            normalized.append(value)
            seen.add(value)
    return normalized


def _coerce_properties(properties: dict[str, Any] | None) -> dict[str, Any]:
    if properties is None:
        return {}
    coerced: dict[str, Any] = {}
    for key, value in properties.items():
        if not isinstance(key, str) or not key.strip():
            raise HTTPException(status_code=400, detail="metadata property keys must be non-empty strings")
        if value is None:
            continue
        if isinstance(value, (str, int, float, bool)):
            coerced[key] = value
        else:
            raise HTTPException(status_code=400, detail=f"metadata property '{key}' must be scalar")
    return coerced


def _metadata_issues(
    summary: str | None,
    tags: list[str],
    properties: dict[str, Any],
    db: Session,
) -> MetadataValidationResponse:
    warnings: list[MetadataValidationIssue] = []
    errors: list[MetadataValidationIssue] = []
    if not summary:
        warnings.append(MetadataValidationIssue(field="summary", message="Summary is recommended."))
    for key, vocabulary_kind in VALIDATED_PROPERTY_KINDS.items():
        value = properties.get(key)
        if value is None:
            continue
        allowed = active_vocabulary_ids(db, vocabulary_kind)
        if str(value) not in allowed:
            errors.append(
                MetadataValidationIssue(
                    field=f"properties.{key}",
                    message=f"Value must be one of: {', '.join(sorted(allowed))}",
                )
            )
    if len(tags) > 100:
        errors.append(MetadataValidationIssue(field="tags", message="At most 100 tags are allowed."))
    status = "error" if errors else "warning" if warnings else "valid"
    return MetadataValidationResponse(status=status, warnings=warnings, errors=errors)


def _validate_metadata_or_raise(
    summary: str | None,
    tags: list[str],
    properties: dict[str, Any],
    db: Session,
) -> None:
    result = _metadata_issues(summary, tags, properties, db)
    if result.errors:
        raise HTTPException(status_code=422, detail=[item.model_dump() for item in result.errors])


def _require_repo_collection_read(
    request: Request,
    user: User = Depends(get_current_user),
) -> User:
    """Access-token scope gate for collection-level repo discovery.

    `require_scope("repo", "read")` needs a concrete repo path param. Search is
    collection-level and filters per-repo visibility inside the handler, so the
    route uses wildcard/read token grants while still appearing in scope matrix.
    """
    if getattr(request.state, "auth_method", None) != "access_token":
        return user
    grants = getattr(request.state, "token_grants", None) or []
    if not _grants_match(grants, "repo", "*", "read"):
        raise HTTPException(status_code=403, detail="insufficient scope")
    return user


_require_repo_collection_read.__scope__ = ("repo", "read")  # type: ignore[attr-defined]


def _dialect_name(db: Session) -> str:
    try:
        return db.get_bind().dialect.name
    except Exception:
        return ""


def _new_metadata_record(
    repo_name: str,
    *,
    summary: str | None,
    description: str | None,
    patch: MetadataPatch | None,
    db: Session,
) -> RepoMetadata:
    metadata_summary = summary if summary is not None else description
    tags: list[str] = []
    properties: dict[str, Any] = {}
    if patch is not None:
        if patch.summary is not None:
            metadata_summary = patch.summary
        tags = _normalize_tags(patch.tags)
        properties = _coerce_properties(patch.properties)
    _validate_metadata_or_raise(metadata_summary, tags, properties, db)
    return RepoMetadata(
        repo_name=repo_name,
        summary=metadata_summary,
        tags=tags,
        properties=properties,
    )


@router.post("/repos", response_model=CreateRepoResponse)
def create_repo(
    body: CreateRepoRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """레포지토리 생성."""
    repo_name = body.repo_name
    owner_namespace = body.group or personal_owner_from_email(user.email)

    def _create() -> CreateRepoResponse:
        return _create_repo(body, request, user, db, repo_name, owner_namespace)

    return run_idempotent(
        request,
        actor_id=user.id,
        scope=f"repo.create:{owner_namespace}/{repo_name}",
        body=body,
        response_factory=_create,
    )


def _create_repo(
    body: CreateRepoRequest,
    request: Request,
    user: User,
    db: Session,
    repo_name: str,
    owner_namespace: str,
) -> CreateRepoResponse:
    """레포지토리 생성."""

    try:
        validate_repo_segment(repo_name, "repo")
        if body.group:
            validate_repo_segment(body.group, "group")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    owner_group: Organization | None = None
    if body.group and body.group != personal_owner_from_email(user.email):
        owner_group = db.query(Organization).filter(Organization.group_name == body.group).first()
        if owner_group is None:
            raise HTTPException(
                status_code=404,
                detail=(
                    f"Group '{body.group}' 가 존재하지 않습니다. "
                    f"`dh group create {body.group}` 로 먼저 생성하세요."
                ),
            )
        # Governance §그룹 권한 기준 (docs/api/groups.md): "그룹 아래 저장소 생성"
        # 은 그룹의 contributor 이상. 비멤버 또는 guest 는 403.
        from app.routers.groups import _require_group_contributor
        _require_group_contributor(db, owner_group, user)

    # 중복 확인. Target 계약은 group namespace 안의 name uniqueness 지만,
    # 현 DB 는 repos.repo_name 단일 PK 라 cross-group duplicate 도 명확히 막는다.
    if owner_group is not None:
        existing = db.query(Repo).filter(
            Repo.repo_name == repo_name,
            Repo.group_id == owner_group.id,
        ).first()
    else:
        existing = db.query(Repo).filter(
            Repo.repo_name == repo_name,
            Repo.group_id.is_(None),
            Repo.owner_id == user.id,
        ).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Repository '{owner_namespace}/{repo_name}' already exists")

    legacy_conflict = db.query(Repo).filter(Repo.repo_name == repo_name).first()
    if legacy_conflict is not None:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Repository name '{repo_name}' already exists in the current storage model. "
                "Owner-scoped duplicate names require the owner-namespace DB migration."
            ),
        )

    # visibility / public_access normalize (governance §Formal Model)
    if body.visibility == "fine_grained":
        if body.public_access is None:
            raise HTTPException(
                status_code=400,
                detail="fine_grained visibility 는 public_access 를 명시해야 합니다.",
            )
        public_access = body.public_access
    else:
        public_access = body.public_access or expand_preset(body.visibility)
    try:
        validate_dependencies(public_access)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    effective_visibility = normalize_visibility(public_access)

    # 프로비저닝 — 신규 저장소는 사용자-facing group/repo 와 물리 bucket 이름을 분리한다.
    # governance §repo-identity-spec / §architecture/storage-transfer:
    # bucket 명은 repo_uuid (immutable stable id) 의 opaque hash. group/repo slug rename
    # 시에도 bucket 명 무변. user 입력에 비의존하므로 GCS 길이/금지단어 규칙 자동 충족.
    from app.services.repo_identity import new_uuid7

    repo_uuid_value = str(new_uuid7())
    try:
        gcs_key = make_opaque_gcs_key(repo_uuid_value)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # GCS 한도 (63 chars) 검증 — opaque hash 라 항상 통과하나 안전망으로 유지.
    full_bucket_pre = f"{app_settings.gcp_bucket_prefix}-{gcs_key}"
    if len(full_bucket_pre) > 63:
        raise HTTPException(
            status_code=422,
            detail=f"GCS bucket name unexpectedly exceeds 63 chars: {full_bucket_pre!r}",
        )

    # 사전 충돌 감지 — opaque hash 충돌 확률 ~0 이나 hard fail.
    bucket_existed, full_bucket = _gcs.bucket_exists(gcs_key)
    if bucket_existed:
        raise HTTPException(
            status_code=409,
            detail=(
                f"GCS bucket '{full_bucket}' already exists. "
                "Opaque hash collision detected — extremely rare. Retry create."
            ),
        )

    try:
        bucket_name = _provisioning.provision_repo(
            repo_name,
            gcs_key=gcs_key,
        )
    except Exception as e:
        audit.log(
            db,
            user_id=user.id,
            user_email=user.email,
            action="repo_create",
            resource_type="repo",
            resource_id=f"{owner_namespace}/{repo_name}",
            status="failure",
            error_message=str(e),
            ip_address=request.client.host if request.client else None,
        )
        raise HTTPException(status_code=500, detail=f"Provisioning failed: {e}")

    # DB 등록 — repos + repo_public_access_policies 동시 생성
    repo = Repo(
        repo_name=repo_name,
        uuid=repo_uuid_value,
        owner_id=user.id,
        bucket_name=bucket_name,
        description=body.description,
        repo_type=body.repo_type,
        visibility=effective_visibility,
    )
    if owner_group is not None:
        repo.group_id = owner_group.id
        # group_uuid 는 dual-write UUID FK. legacy 데이터에서는 alembic 021 backfill 이후 채워짐.
        repo.group_uuid = getattr(owner_group, "uuid", None)
    db.add(repo)

    policy = RepoPublicAccessPolicy(
        repo_name=repo_name,
        repo_uuid=repo_uuid_value,
        discoverable=public_access.discoverable,
        metadata_read=public_access.metadata_read,
        file_list=public_access.file_list,
        file_read=public_access.file_read,
        lineage_read=public_access.lineage_read,
        stats_read=public_access.stats_read,
    )
    db.add(policy)
    db.add(
        _new_metadata_record(
            repo_name,
            summary=body.summary,
            description=body.description,
            patch=body.metadata,
            db=db,
        )
    )
    db.commit()

    # governance §architecture/storage-transfer — `_manifest.json` create 동기 1회.
    # DB 가 truth, manifest 는 hint. 실패해도 create 흐름 차단 없음 (silent log + alert).
    from datetime import datetime, timezone as _tz
    from app.services.repo_manifest import write_create_manifest

    write_create_manifest(
        _gcs,
        bucket_name=bucket_name,
        repo_uuid=repo_uuid_value,
        group_uuid=getattr(owner_group, "uuid", None) if owner_group is not None else None,
        repo_full_name=f"{owner_namespace}/{repo_name}",
        group_slug=owner_namespace,
        repo_name=repo_name,
        repo_type=body.repo_type,
        created_at=datetime.now(_tz.utc),
        members=[{"user_id": user.id, "email": user.email, "role": "owner"}],
    )

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="repo_create",
        resource_type="repo",
        resource_id=f"{owner_namespace}/{repo_name}",
        details={
            "bucket": bucket_name,
            "repo_type": body.repo_type,
            "ai_card": body.ai_card,
            "ai_metadata": body.ai_metadata,
        },
        ip_address=request.client.host if request.client else None,
    )

    return CreateRepoResponse(
        repo_name=repo_name,
        bucket=bucket_name,
        owner=user.email,
        visibility=effective_visibility,
        public_access=public_access,
    )


@router.get(
    "/repos/search",
    response_model=SearchResponse,
)
def search_repos(
    q: str = "",
    group: str | None = None,
    type: str | None = Query(default=None),
    visibility: str | None = Query(default=None),
    tag: list[str] = Query(default_factory=list),
    modality: str | None = None,
    language: str | None = None,
    format: str | None = None,
    task: str | None = None,
    domain: str | None = None,
    limit: int = Query(100, ge=1, le=1000),
    page_token: str | None = None,
    user: User = Depends(_require_repo_collection_read),
    db: Session = Depends(get_db),
):
    """Repository-first search over visible repos and repo metadata."""
    wanted_tags = set(_normalize_tags(tag))
    wanted_type = {"dataset": "A", "model": "B"}.get((type or "").lower())
    property_filters = {
        key: value
        for key, value in {
            "modality": modality,
            "language": language,
            "format": format,
            "task": task,
            "domain": domain,
        }.items()
        if value is not None
    }
    query = q.strip().lower()
    start = _decode_page_token(page_token)
    dialect_name = _dialect_name(db)
    postgres_filters = dialect_name == "postgresql"
    needs_python_filter = bool(group) or (not postgres_filters and (wanted_tags or property_filters))

    search_query = visible_repo_metadata_query(db, user)
    if wanted_type:
        search_query = search_query.filter(Repo.repo_type == wanted_type)
    if visibility:
        search_query = search_query.filter(Repo.visibility == visibility)
    if group:
        search_query = search_query.filter(or_(Organization.group_name == group, Repo.group_id.is_(None)))
    if query:
        pattern = f"%{query}%"
        search_query = search_query.filter(
            or_(
                Repo.repo_name.ilike(pattern),
                Repo.description.ilike(pattern),
                RepoMetadata.summary.ilike(pattern),
                Organization.group_name.ilike(pattern),
            )
        )
    if postgres_filters:
        if wanted_tags:
            search_query = search_query.filter(RepoMetadata.tags.contains(sorted(wanted_tags)))
        for key, value in property_filters.items():
            search_query = search_query.filter(RepoMetadata.properties[key].astext == value)

    search_query = search_query.order_by(Organization.group_name, Repo.repo_name)
    if not needs_python_filter:
        rows = search_query.offset(start).limit(limit + 1).all()
    else:
        rows = search_query.all()

    results: list[SearchResult] = []
    for repo, metadata, permission in rows:
        repo_group = discovery_repo_namespace(repo)
        if group and repo_group != group:
            continue

        tags = list(metadata.tags or []) if metadata is not None else []
        properties = dict(metadata.properties or {}) if metadata is not None else {}
        if not postgres_filters:
            if wanted_tags and not wanted_tags.issubset(set(tags)):
                continue
            if any(str(properties.get(key)) != value for key, value in property_filters.items()):
                continue

        results.append(
            SearchResult(
                repo=discovery_repo_identifier(repo),
                name=repo.repo_name,
                group=repo_group,
                type={"A": "dataset", "B": "model"}.get(repo.repo_type),
                visibility=repo.visibility,
                role=discovery_role(user, repo, permission),
                summary=metadata.summary if metadata is not None else repo.description,
                tags=tags,
                updated_at=metadata.updated_at if metadata is not None else None,
                score=1.0 if query else None,
            )
        )

    if needs_python_filter:
        end = start + limit
        page = results[start:end]
        has_more = end < len(results)
        next_page_token = _encode_page_token(end) if has_more else None
    else:
        page = results[:limit]
        has_more = len(results) > limit
        next_page_token = _encode_page_token(start + limit) if has_more else None
    return SearchResponse(
        items=page,
        has_more=has_more,
        next_page_token=next_page_token,
    )


@router.get(
    "/repos/{repo_name}",
    response_model=RepoInfo,
    dependencies=[Depends(require_scope("repo", "read"))],
)
def get_repo(
    repo_name: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """단건 레포지토리 조회.

    governance §Permission Evaluation:
      - 멤버 (owner / maintainer / contributor / guest) 는 RBAC 우선 통과
      - 비멤버는 public_access.metadata_read 가 true 일 때만 통과
      - public_access.discoverable=false 인 비멤버 요청은 404 (존재 숨김)
      - 그 외 차단은 403
    """
    repo = require_capability(
        db, user, repo_name, "metadata_read", min_member_role="guest"
    )

    role = resolve_role(db, user, repo) or "normal"
    return _build_repo_info(db, repo, role, repo.owner.email)


def _policy_version(repo: Repo) -> int:
    """policy row 가 있으면 version, 없으면 1 (legacy 호환)."""
    p = getattr(repo, "public_access_policy", None)
    return getattr(p, "version", 1) if p is not None else 1


def _policy_to_public_access(repo: Repo) -> PublicAccess:
    """Repo 의 public_access_policy 를 응답 schema 로 변환. policy 누락 시 visibility 기준 fallback."""
    p = getattr(repo, "public_access_policy", None)
    if p is None:
        return expand_preset(repo.visibility) if repo.visibility != "fine_grained" else PublicAccess(
            discoverable=False,
            metadata_read=False,
            file_list=False,
            file_read=False,
            lineage_read=False,
            stats_read=False,
        )
    return PublicAccess(
        discoverable=p.discoverable,
        metadata_read=p.metadata_read,
        file_list=p.file_list,
        file_read=p.file_read,
        lineage_read=p.lineage_read,
        stats_read=p.stats_read,
    )


def _repo_updated_at(repo: Repo) -> datetime | None:
    updated_at = getattr(repo, "updated_at", None)
    if isinstance(updated_at, datetime):
        return updated_at
    try:
        return _repo_storage_updated_at(repo)
    except Exception:
        return None


def _repo_storage_bucket(repo: Repo) -> str:
    bucket_name = getattr(repo, "bucket_name", None)
    if isinstance(bucket_name, str) and bucket_name:
        return bucket_name
    return f"{app_settings.gcp_bucket_prefix}-{make_gcs_key(_repo_namespace(repo), repo.repo_name)}"


def _repo_namespace(repo: Repo, owner_email: str | None = None) -> str:
    if repo.organization is not None:
        return repo.organization.group_name
    email = owner_email or (repo.owner.email if repo.owner else "")
    return personal_owner_from_email(email)


def _repo_id(repo: Repo, owner_email: str | None = None) -> str:
    return f"{_repo_namespace(repo, owner_email)}/{repo.repo_name}"


def _get_metadata_record(db: Session, repo: Repo, *, create: bool = False) -> RepoMetadata:
    metadata = getattr(repo, "metadata_record", None)
    if isinstance(metadata, RepoMetadata):
        return metadata
    if not create:
        return RepoMetadata(
            repo_name=repo.repo_name,
            summary=repo.description,
            tags=[],
            properties={},
        )
    metadata = RepoMetadata(
        repo_name=repo.repo_name,
        summary=repo.description,
        tags=[],
        properties={},
    )
    db.add(metadata)
    db.flush()
    return metadata


def _metadata_response(repo: Repo, metadata: RepoMetadata, owner_email: str | None = None) -> RepositoryMetadata:
    updated_at = metadata.updated_at if isinstance(metadata.updated_at, datetime) else None
    return RepositoryMetadata(
        repo=_repo_id(repo, owner_email),
        summary=metadata.summary,
        tags=list(metadata.tags or []),
        properties=dict(metadata.properties or {}),
        updated_at=updated_at,
    )


def _calculate_repo_storage_stats(repo: Repo) -> tuple[int, int]:
    file_count = 0
    total_size_bytes = 0
    after = None
    while True:
        items, has_more, next_offset = _gcs.list_objects(
            _repo_storage_bucket(repo),
            prefix="",
            recursive=True,
            max_items=1000,
            page_token=after,
        )
        for item in items:
            if item["path_type"] == "object":
                file_count += 1
                total_size_bytes += item["size_bytes"] or 0
        if not has_more:
            break
        after = next_offset
    return file_count, total_size_bytes


def _coerce_storage_mtime(value) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc)
    return None


def _repo_storage_updated_at(repo: Repo) -> datetime | None:
    latest: datetime | None = None
    after = None
    while True:
        items, has_more, next_offset = _gcs.list_objects(
            _repo_storage_bucket(repo),
            prefix="",
            recursive=True,
            max_items=1000,
            page_token=after,
        )
        for item in items:
            if item["path_type"] != "object":
                continue
            candidate = _coerce_storage_mtime(item.get("mtime"))
            if candidate and (latest is None or candidate > latest):
                latest = candidate
        if not has_more:
            break
        after = next_offset
    return latest


def _repo_info_storage_stats(repo: Repo) -> tuple[int | None, int | None]:
    try:
        return _calculate_repo_storage_stats(repo)
    except Exception:
        return None, None


def _include_stats_in_repo_info(repo: Repo, role: str) -> bool:
    if role != "normal":
        return True
    return _policy_to_public_access(repo).stats_read


def _build_repo_info(db: Session, repo: Repo, role: str, owner_email: str) -> RepoInfo:
    member_count = db.query(Permission).filter(Permission.repo_name == repo.repo_name).count()
    file_count: int | None = None
    total_size_bytes: int | None = None
    if _include_stats_in_repo_info(repo, role):
        file_count, total_size_bytes = _repo_info_storage_stats(repo)
    metadata = _get_metadata_record(db, repo)
    metadata_payload = _metadata_response(repo, metadata, owner_email)
    return RepoInfo(
        repo_name=repo.repo_name,
        owner=owner_email,
        role=role,
        visibility=repo.visibility,
        public_access=_policy_to_public_access(repo),
        public_access_version=_policy_version(repo),
        description=repo.description,
        repo_type=repo.repo_type,
        member_count=member_count,
        created_at=repo.created_at,
        updated_at=_repo_updated_at(repo),
        file_count=file_count,
        total_size_bytes=total_size_bytes,
        group=repo.organization.group_name if repo.organization else None,
        repo_id=str(getattr(repo, "uuid", None)) if getattr(repo, "uuid", None) else None,
        group_id=str(getattr(repo, "group_uuid", None)) if getattr(repo, "group_uuid", None) else None,
        bucket_name=getattr(repo, "bucket_name", None),
        summary=metadata.summary,
        tags=list(metadata.tags or []),
        metadata=metadata_payload,
    )


@router.delete(
    "/repos/{repo_name}",
    dependencies=[Depends(require_scope("repo", "delete"))],
)
def delete_repo(
    repo_name: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """레포지토리 삭제.

    소유자만 삭제할 수 있습니다.
    GCS 버킷 + DB 레코드를 삭제합니다.
    """
    return run_idempotent(
        request,
        actor_id=user.id,
        scope=f"repo.delete:{repo_name}",
        body={},
        response_factory=lambda: _delete_repo(repo_name, request, user, db),
    )


def _delete_repo(
    repo_name: str,
    request: Request,
    user: User,
    db: Session,
) -> dict:
    repo = get_repo_by_name(db, repo_name)

    # DB에 없으면 404 — 고아 리소스는 GCS에서 직접 정리
    if repo is None:
        raise HTTPException(status_code=404, detail=f"Repository '{repo_name}' not found")

    # 소유자만 삭제 가능
    if repo.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Only the owner can delete a repository")

    # 외부 리소스 삭제 (GCS)
    # gcs_key: 버킷명에서 prefix 제거한 suffix (신규 "{namespace}--{repo}", legacy "{repo}")
    _gcs_prefix = f"{app_settings.gcp_bucket_prefix}-"
    gcs_key = (
        repo.bucket_name[len(_gcs_prefix):]
        if repo.bucket_name and repo.bucket_name.startswith(_gcs_prefix)
        else None
    )
    try:
        _provisioning.deprovision_repo(repo.repo_name, gcs_key=gcs_key)
    except Exception as e:
        audit.log(
            db,
            user_id=user.id,
            user_email=user.email,
            action="repo_delete",
            resource_type="repo",
            resource_id=repo_name,
            status="failure",
            error_message=str(e),
            ip_address=request.client.host if request.client else None,
        )
        raise HTTPException(status_code=500, detail=f"Deprovisioning failed: {e}")

    # DB 레코드 삭제
    db.query(Permission).filter(Permission.repo_name == repo.repo_name).delete()
    db.query(RepoLineage).filter(
        or_(RepoLineage.source_repo == repo.repo_name, RepoLineage.derived_repo == repo.repo_name)
    ).delete(synchronize_session=False)
    db.delete(repo)
    db.commit()

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="repo_delete",
        resource_type="repo",
        resource_id=repo_name,
        details={"orphan": repo is None},
        ip_address=request.client.host if request.client else None,
    )

    return {"status": "deleted", "repo_name": repo_name}


def _encode_page_token(offset: int) -> str:
    raw = json.dumps({"offset": offset}, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _decode_page_token(page_token: str | None) -> int:
    if not page_token:
        return 0
    try:
        padded = page_token + ("=" * (-len(page_token) % 4))
        payload = json.loads(base64.urlsafe_b64decode(padded.encode()).decode())
        offset = int(payload["offset"])
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid page_token") from exc
    if offset < 0:
        raise HTTPException(status_code=400, detail="Invalid page_token")
    return offset


def _paginate_repo_infos(
    repos: list[RepoInfo],
    *,
    limit: int,
    page_token: str | None,
) -> RepoListResponse:
    start = _decode_page_token(page_token)
    end = start + limit
    page = repos[start:end]
    has_more = end < len(repos)
    next_page_token = _encode_page_token(end) if has_more else None
    return RepoListResponse(
        items=page,
        repos=page,
        has_more=has_more,
        next_page_token=next_page_token,
    )


@router.get("/repos", response_model=RepoListResponse)
def list_repos(
    limit: int = Query(100, ge=1, le=1000),
    page_token: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """현재 사용자가 접근 가능한 레포지토리 목록.

    - 소유 레포: 항상 표시
    - 권한 부여받은 레포: 항상 표시
    - Public 레포: Normal User도 표시
    - Private 레포: 권한 없으면 숨김
    """
    repos: list[RepoInfo] = []
    seen: set[str] = set()

    # 소유 레포
    for repo in db.query(Repo).filter(Repo.owner_id == user.id).all():
        repos.append(_build_repo_info(db, repo, "owner", user.email))
        seen.add(repo.repo_name)

    # 권한 부여받은 레포
    for perm in db.query(Permission).filter(Permission.user_id == user.id).all():
        if perm.repo_name in seen:
            continue
        repo = perm.repo
        repos.append(_build_repo_info(db, repo, perm.role, repo.owner.email))
        seen.add(repo.repo_name)

    # 비멤버에게 노출 가능한 레포 (governance §Search Implication):
    # public_access.discoverable=true 인 레포만 검색·목록에 포함.
    # 'public' visibility 의 default 가 모두 true 이므로 backward-compat,
    # fine_grained 의 discoverable=false 는 비멤버 view 에서 자동 제외.
    discoverable_repos = (
        db.query(Repo)
        .outerjoin(Repo.public_access_policy)
        .filter(
            (Repo.visibility != "private")
            & (RepoPublicAccessPolicy.discoverable.is_(True))
        )
        .all()
    )
    for repo in discoverable_repos:
        if repo.repo_name in seen:
            continue
        repos.append(_build_repo_info(db, repo, "normal", repo.owner.email))
        seen.add(repo.repo_name)

    repos.sort(key=lambda item: ((item.group or item.owner or ""), item.repo_name))
    return _paginate_repo_infos(repos, limit=limit, page_token=page_token)


@router.patch(
    "/repos/{repo_name}/visibility",
    dependencies=[Depends(require_scope("repo", "admin"))],
)
def update_visibility(
    repo_name: str,
    body: UpdateVisibilityRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Repo 공개 범위 변경 (owner/maintainer).

    governance source-of-truth:
      docs/dev_docs/api-specs/repository-api-spec.md §Visibility update
      docs/dev_docs/product-specs/repository-visibility-policy.md

    동작:
      - visibility = public | private | fine_grained
      - fine_grained 면 public_access 6 capability 명시 필수
      - public / private 시 public_access 는 expand_preset 으로 자동 채움
      - capability 의존(file_read↔file_list 등) 위반 시 400
      - normalize: 모두 true → 'public', 모두 false → 'private', 그 외 'fine_grained'
      - version optimistic concurrency: 클라이언트가 GET 으로 읽은 version
        과 DB 의 현재 version 이 다르면 409
      - 성공 시 version += 1, updated_at = NOW, audit_log 기록
    """
    repo = require_admin(db, user, repo_name)

    # public_access 결정 (governance §Formal Model)
    if body.visibility == "fine_grained":
        if body.public_access is None:
            raise HTTPException(
                status_code=400,
                detail="fine_grained visibility 는 public_access 를 명시해야 합니다.",
            )
        target_pa = body.public_access
    elif body.visibility in ("public", "private"):
        # 명시 public_access 가 있으면 그것을 우선 (의존 검사용), 없으면 preset 확장
        target_pa = body.public_access or expand_preset(body.visibility)
    else:
        raise HTTPException(
            status_code=400,
            detail="visibility must be 'public', 'private', or 'fine_grained'",
        )

    try:
        validate_dependencies(target_pa)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    effective_visibility = normalize_visibility(target_pa)

    # version optimistic concurrency
    policy = repo.public_access_policy
    if policy is None:
        # backfill 누락 — 정책 row 없으면 새로 만들고 version=1 부여
        policy = RepoPublicAccessPolicy(repo_name=repo.repo_name)
        db.add(policy)
        db.flush()

    if policy.version != body.version:
        raise HTTPException(
            status_code=409,
            detail=(
                f"visibility version mismatch (expected {policy.version}, "
                f"got {body.version}) — fetch latest and retry"
            ),
        )

    old_visibility = repo.visibility
    old_snapshot = {
        "discoverable": policy.discoverable,
        "metadata_read": policy.metadata_read,
        "file_list": policy.file_list,
        "file_read": policy.file_read,
        "lineage_read": policy.lineage_read,
        "stats_read": policy.stats_read,
    }

    # 갱신
    repo.visibility = effective_visibility
    policy.discoverable = target_pa.discoverable
    policy.metadata_read = target_pa.metadata_read
    policy.file_list = target_pa.file_list
    policy.file_read = target_pa.file_read
    policy.lineage_read = target_pa.lineage_read
    policy.stats_read = target_pa.stats_read
    policy.version = policy.version + 1
    policy.updated_at = func.now()
    db.commit()
    db.refresh(policy)

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="repo_visibility_change",
        resource_type="repo",
        resource_id=repo_name,
        details={
            "old_visibility": old_visibility,
            "new_visibility": effective_visibility,
            "old_public_access": old_snapshot,
            "new_public_access": target_pa.model_dump(),
            "new_version": policy.version,
        },
        ip_address=request.client.host if request.client else None,
    )

    return {
        "status": "updated",
        "visibility": effective_visibility,
        "public_access": target_pa.model_dump(),
        "version": policy.version,
    }


@router.get(
    "/repos/{repo_name}/stats",
    response_model=RepoStatsResponse,
    dependencies=[Depends(require_scope("repo", "read"))],
)
def get_repo_stats(
    repo_name: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Repository storage stats.

    governance: 비멤버는 public_access.stats_read 가 true 일 때만 통과.
    """
    repo = require_capability(
        db, user, repo_name, "stats_read", min_member_role="guest"
    )

    try:
        file_count, total_size_bytes = _calculate_repo_storage_stats(repo)
    except Exception:
        file_count = 0
        total_size_bytes = 0

    return RepoStatsResponse(
        repo_name=repo_name,
        owner=repo.owner.email,
        visibility=repo.visibility,
        file_count=file_count,
        total_size_bytes=total_size_bytes,
    )


# ── Repo rename (governance §repo-identity-spec — slug rename invariant) ────


@router.patch(
    "/repos/{group}/{repo_name}/name",
    response_model=RenameRepoResponse,
    dependencies=[Depends(require_scope("repo", "admin"))],
)
def rename_repo(
    group: str,
    repo_name: str,
    body: RenameRepoRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Repository slug rename. governance §repo-identity-spec.

    동작:
    - repo_uuid / group_uuid / bucket_name / 종속 도메인 FK 모두 무변
    - `repos.repo_name` (legacy PK 일부) + repo_full_name 만 변경
    - `repo_renames` audit row insert (영구 — `_resolve` 301 source)
    - 단일 트랜잭션 (rename + audit)
    - 권한: maintainer 이상 (require_admin)
    - new_name 검증: `validate_repo_segment` + group 내 unique
    """
    from app.services.repo_identity import validate_repo_segment, new_uuid7

    repo_full = f"{group}/{repo_name}"
    repo = require_admin(db, user, repo_full)

    # 1. validate new_name
    try:
        new_name = validate_repo_segment(body.new_name, "repo")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if new_name == repo_name:
        raise HTTPException(status_code=400, detail="new_name must differ from current name")

    # 2. group 내 unique 검증 (group_uuid 우선, legacy group_id fallback)
    existing = (
        db.query(Repo)
        .filter(Repo.repo_name == new_name)
        .first()
    )
    # repo_name 자체가 legacy PK 라 글로벌 unique. group 내 unique 와 일치.
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail=f"Repository '{group}/{new_name}' already exists",
        )

    # 3. 단일 트랜잭션: rename + audit
    from app.models import RepoRename
    old_name = repo.repo_name
    old_path = f"{group}/{old_name}"
    new_path = f"{group}/{new_name}"

    rename_row = RepoRename(
        id=str(new_uuid7()),
        repo_uuid=repo.uuid,
        group_uuid=repo.group_uuid,
        old_name=old_name,
        new_name=new_name,
        renamed_by=user.id,
        reason=body.reason,
    )
    db.add(rename_row)

    # 종속 도메인의 legacy repo_name FK 도 dual-write 로 함께 변경
    # (UUID FK 는 무변 — repo_uuid 기준이라 자동 정합)
    repo.repo_name = new_name
    db.flush()  # apply rename before cascading legacy FK updates
    # 종속 테이블의 repo_name 컬럼은 FK ON UPDATE 가 없으면 수동 업데이트 필요.
    # 본 사이클에서는 UUID FK 가 truth — legacy repo_name FK 갱신은 별 cleanup PR.
    # 현재 dual write 의 의도: UUID FK 가 신규 작성/조회용, legacy FK 는 transitional.
    db.commit()
    db.refresh(repo)

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="repo_rename",
        resource_type="repo",
        resource_id=f"id:{repo.uuid}",
        details={
            "old_path": old_path,
            "new_path": new_path,
            "reason": body.reason,
        },
        ip_address=request.client.host if request.client else None,
    )

    return RenameRepoResponse(
        repo_id=repo.uuid,
        group_id=repo.group_uuid,
        repo_name=new_name,
        new_path=new_path,
        old_path=old_path,
    )


@router.get(
    "/repos/{group}/{repo_name}/metadata",
    response_model=RepositoryMetadata,
    dependencies=[Depends(require_scope("repo", "read"))],
)
def get_repo_metadata(
    group: str,
    repo_name: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = require_capability(
        db, user, f"{group}/{repo_name}", "metadata_read", min_member_role="guest"
    )
    return _metadata_response(repo, _get_metadata_record(db, repo), repo.owner.email)


@router.patch(
    "/repos/{group}/{repo_name}/metadata",
    response_model=RepositoryMetadata,
    dependencies=[Depends(require_scope("repo", "write"))],
)
def patch_repo_metadata(
    group: str,
    repo_name: str,
    body: MetadataPatch,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo_id = f"{group}/{repo_name}"
    repo = check_access(db, user, repo_id, min_role="contributor")
    metadata = _get_metadata_record(db, repo, create=True)
    summary = metadata.summary
    if "summary" in body.model_fields_set:
        summary = body.summary
    tags = list(metadata.tags or [])
    if "tags" in body.model_fields_set:
        tags = _normalize_tags(body.tags)
    properties = dict(metadata.properties or {})
    if "properties" in body.model_fields_set:
        incoming = body.properties or {}
        for key, value in _coerce_properties(incoming).items():
            properties[key] = value
        for key, value in incoming.items():
            if value is None:
                properties.pop(key, None)
    _validate_metadata_or_raise(summary, tags, properties, db)
    metadata.summary = summary
    metadata.tags = tags
    metadata.properties = properties
    metadata.updated_at = func.now()
    db.commit()
    db.refresh(metadata)
    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="repo_metadata_patch",
        resource_type="repo",
        resource_id=repo_id,
        details={"fields": sorted(body.model_fields_set)},
        ip_address=request.client.host if request.client else None,
    )
    return _metadata_response(repo, metadata, repo.owner.email)


@router.post(
    "/repos/{group}/{repo_name}/metadata/validate",
    response_model=MetadataValidationResponse,
    dependencies=[Depends(require_scope("repo", "write"))],
)
def validate_repo_metadata(
    group: str,
    repo_name: str,
    body: MetadataPatch,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = check_access(db, user, f"{group}/{repo_name}", min_role="contributor")
    current = _get_metadata_record(db, repo)
    summary = body.summary if "summary" in body.model_fields_set else current.summary
    tags = _normalize_tags(body.tags) if "tags" in body.model_fields_set else list(current.tags or [])
    properties = dict(current.properties or {})
    if "properties" in body.model_fields_set:
        incoming = body.properties or {}
        properties.update(_coerce_properties(incoming))
        for key, value in incoming.items():
            if value is None:
                properties.pop(key, None)
    return _metadata_issues(summary, tags, properties, db)


@router.get(
    "/repos/{group}/{repo_name}/metadata/tags",
    dependencies=[Depends(require_scope("repo", "read"))],
)
def list_repo_tags(
    group: str,
    repo_name: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    metadata = get_repo_metadata(group, repo_name, user, db)
    return {"tags": metadata.tags}


@router.post(
    "/repos/{group}/{repo_name}/metadata/tags",
    response_model=RepositoryMetadata,
    dependencies=[Depends(require_scope("repo", "write"))],
)
def add_repo_tags(
    group: str,
    repo_name: str,
    body: TagsUpdateRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo_id = f"{group}/{repo_name}"
    repo = check_access(db, user, repo_id, min_role="contributor")
    metadata = _get_metadata_record(db, repo, create=True)
    existing = list(metadata.tags or [])
    merged = _normalize_tags([*existing, *body.tags])
    _validate_metadata_or_raise(metadata.summary, merged, dict(metadata.properties or {}), db)
    metadata.tags = merged
    metadata.updated_at = func.now()
    db.commit()
    db.refresh(metadata)
    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="repo_tags_add",
        resource_type="repo",
        resource_id=repo_id,
        details={"tags": _normalize_tags(body.tags)},
        ip_address=request.client.host if request.client else None,
    )
    return _metadata_response(repo, metadata, repo.owner.email)


@router.delete(
    "/repos/{group}/{repo_name}/metadata/tags/{tag}",
    response_model=RepositoryMetadata,
    dependencies=[Depends(require_scope("repo", "write"))],
)
def remove_repo_tag(
    group: str,
    repo_name: str,
    tag: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo_id = f"{group}/{repo_name}"
    repo = check_access(db, user, repo_id, min_role="contributor")
    metadata = _get_metadata_record(db, repo, create=True)
    normalized = _normalize_tag(tag)
    metadata.tags = [value for value in (metadata.tags or []) if value != normalized]
    metadata.updated_at = func.now()
    db.commit()
    db.refresh(metadata)
    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="repo_tags_remove",
        resource_type="repo",
        resource_id=repo_id,
        details={"tag": normalized},
        ip_address=request.client.host if request.client else None,
    )
    return _metadata_response(repo, metadata, repo.owner.email)


# ── group-scoped aliases ─────────────────────────────────────────────────────

@router.get(
    "/repos/{group}/{repo_name}",
    response_model=RepoInfo,
    dependencies=[Depends(require_scope("repo", "read"))],
)
def get_repo_group(
    group: str,
    repo_name: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """group-scoped 레포 조회 alias — GET /repos/{group}/{repo_name}."""
    return get_repo(f"{group}/{repo_name}", user, db)


@router.delete(
    "/repos/{group}/{repo_name}",
    dependencies=[Depends(require_scope("repo", "delete"))],
)
def delete_repo_group(
    group: str,
    repo_name: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """group-scoped 레포 삭제 alias — DELETE /repos/{group}/{repo_name}."""
    return delete_repo(f"{group}/{repo_name}", request, user, db)


@router.patch(
    "/repos/{group}/{repo_name}/visibility",
    dependencies=[Depends(require_scope("repo", "admin"))],
)
def update_visibility_group(
    group: str,
    repo_name: str,
    body: UpdateVisibilityRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """group-scoped visibility 변경 — PATCH /repos/{group}/{repo}/visibility (governance §Visibility update)."""
    return update_visibility(f"{group}/{repo_name}", body, request, user, db)


@router.get(
    "/repos/{group}/{repo_name}/stats",
    response_model=RepoStatsResponse,
    dependencies=[Depends(require_scope("repo", "read"))],
)
def get_repo_stats_group(
    group: str,
    repo_name: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """group-scoped stats — GET /repos/{group}/{repo}/stats."""
    return get_repo_stats(f"{group}/{repo_name}", user, db)
