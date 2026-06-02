"""Catalog & Enrichment 엔드포인트.

Unity Catalog 의존성 제거 완료 (issue #90).
카탈로그 조회 엔드포인트는 빈 결과를 반환합니다.

- GET /catalog/filters: 필터 옵션 (empty)
- GET /catalog/search: 테이블 검색 (empty)
- GET /catalog/tables/{full_name}: 테이블 상세 (404)
- GET /catalog/tables: 테이블 목록 (empty)
- PATCH /catalog/tables/{full_name}/metadata: 메타데이터 업데이트 (no-op)
- GET /catalog/catalogs: 카탈로그 목록 (empty)
- POST /repos/{repo}/enrich: Claude 메타데이터 생성
- GET /admin/audit-logs: 감사 로그 조회
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.schemas.catalog import (
    CatalogListResponse,
    EnrichRequest,
    EnrichResponse,
    FilterOptionsResponse,
    MetadataUpdateRequest,
    TableInfoResponse,
    TableListResponse,
)
from app.services.audit import AuditService
from app.services.authorization import check_access, require_admin
from app.services.enrichment import EnrichmentService
from app.services.repository_discovery import repo_namespace, visible_repo_metadata_query

logger = logging.getLogger(__name__)

router = APIRouter()
audit = AuditService()

_enrichment = EnrichmentService()


@router.get("/catalog/filters", response_model=FilterOptionsResponse)
def get_filter_options(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """검색 드롭다운용 필터 옵션.

    Unity Catalog 호환 endpoint는 유지하되, 값은 repository metadata에서 파생한다.
    """
    tags: set[str] = set()
    groups: set[str] = set()
    modalities: set[str] = set()
    tasks: set[str] = set()
    languages: set[str] = set()
    formats: set[str] = set()
    domains: set[str] = set()
    types: set[str] = set()
    rows = visible_repo_metadata_query(db, user).all()
    for repo, metadata, _permission in rows:
        groups.add(repo_namespace(repo))
        if repo.repo_type == "A":
            types.add("dataset")
        elif repo.repo_type == "B":
            types.add("model")
        if metadata is None:
            continue
        tags.update(str(tag) for tag in (metadata.tags or []))
        props = metadata.properties or {}
        if props.get("modality"):
            modalities.add(str(props["modality"]))
        if props.get("task"):
            tasks.add(str(props["task"]))
        if props.get("language"):
            languages.add(str(props["language"]))
        if props.get("format"):
            formats.add(str(props["format"]))
        if props.get("domain"):
            domains.add(str(props["domain"]))
    return FilterOptionsResponse(
        modalities=sorted(modalities),
        tasks=sorted(tasks),
        languages=sorted(languages),
        formats=sorted(formats),
        domains=sorted(domains),
        tags=sorted(tags),
        groups=sorted(groups),
        types=sorted(types),
        organizations=sorted(groups),
    )


@router.get("/catalog/search", response_model=TableListResponse)
def search_tables(
    keyword: str = "",
    catalog_name: Optional[str] = None,
    max_results: int = 50,
    modality: Optional[str] = None,
    task: Optional[str] = None,
    organization: Optional[str] = None,
    data_card_tier: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """테이블 검색 — UC 제거로 빈 결과 반환."""
    return TableListResponse(tables=[])


@router.get("/catalog/tables/{full_name:path}", response_model=TableInfoResponse)
def get_table(
    full_name: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """테이블 상세 조회 — UC 제거로 404 반환."""
    raise HTTPException(status_code=404, detail=f"Table not found: {full_name}")


@router.get("/catalog/tables", response_model=TableListResponse)
def list_tables(
    catalog: str = Query(...),
    schema: str = Query(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """테이블 목록 — UC 제거로 빈 결과 반환."""
    return TableListResponse(tables=[])


@router.patch("/catalog/tables/{full_name:path}/metadata")
def update_metadata(
    full_name: str,
    body: MetadataUpdateRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """테이블 메타데이터 업데이트 — UC 제거로 no-op."""
    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="catalog_update",
        resource_type="table",
        resource_id=full_name,
        details={},
        ip_address=request.client.host if request.client else None,
    )
    return {"status": "updated"}


@router.get("/catalog/catalogs", response_model=CatalogListResponse)
def list_catalogs(user: User = Depends(get_current_user)):
    """카탈로그 목록 — UC 제거로 빈 결과 반환."""
    return CatalogListResponse(catalogs=[])


@router.post("/repos/{repo}/enrich", response_model=EnrichResponse)
def enrich(
    repo: str,
    body: EnrichRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """파일 목록 기반 Claude 메타데이터 생성 (contributor 이상)."""
    check_access(db, user, repo, min_role="contributor")

    metadata = _enrichment.enrich_metadata(
        file_listing=body.file_listing,
        base_path=body.base_path,
        message=body.message,
    )

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="enrich",
        resource_type="repo",
        resource_id=repo,
        details={"has_result": metadata is not None},
        ip_address=request.client.host if request.client else None,
    )

    return EnrichResponse(metadata=metadata)


# ── Admin ───────────────────────────────────────────

@router.get("/admin/audit-logs")
def get_audit_logs(
    repo_name: Optional[str] = None,
    user_email: Optional[str] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """감사 로그 조회 (owner/maintainer — repo 지정 필수)."""
    if repo_name is None:
        raise HTTPException(status_code=400, detail="repo_name parameter is required")

    require_admin(db, user, repo_name)

    logs = audit.query(
        db,
        user_email=user_email,
        action=action,
        resource_type=resource_type,
        limit=limit,
        offset=offset,
    )

    # 해당 repo 관련 로그만 필터
    repo_logs = [log for log in logs if log.resource_id and repo_name in log.resource_id]

    return {
        "logs": [
            {
                "id": log.id,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "user_email": log.user_email,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "details": log.details,
                "ip_address": log.ip_address,
                "status": log.status,
                "error_message": log.error_message,
            }
            for log in repo_logs
        ]
    }
