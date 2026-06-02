"""데이터 리니지 엔드포인트.

- GET /repos/{repo}/lineage: upstream/downstream 조회
- POST /repos/{repo}/lineage: 파생 관계 등록
- DELETE /repos/{repo}/lineage/{lineage_id}: 파생 관계 삭제
- GET /lineage/graph: 전체 리니지 그래프
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_scope
from app.models import Repo, RepoLineage, User
from app.schemas.lineage import (
    CreateLineageRequest,
    LineageEntry,
    LineageGraphEdge,
    LineageGraphNode,
    LineageGraphResponse,
    LineageListResponse,
)
from app.services.audit import AuditService
from app.services.authorization import check_access, get_repo_by_name, require_capability, resolve_role
from app.services.repo_identity import personal_owner_from_email

router = APIRouter()
audit = AuditService()

VALID_RELATION_TYPES = ("derived_from", "augmented_from", "filtered_from", "merged_from")


def _lineage_public_id(lineage_id: int) -> str:
    return f"lin_{lineage_id}"


def _lineage_mutation_response(status: str, lineage_id: int) -> dict[str, object]:
    return {"status": status, "id": lineage_id, "lineage_id": _lineage_public_id(lineage_id)}


def _repo_id(repo: Repo | None, fallback: str) -> str:
    if repo is None:
        return fallback
    group = repo.organization.group_name if repo.organization else personal_owner_from_email(repo.owner.email)
    return f"{group}/{repo.repo_name}"


def _to_entry(lineage: RepoLineage) -> LineageEntry:
    return LineageEntry(
        id=lineage.id,
        lineage_id=_lineage_public_id(lineage.id),
        source_repo=_repo_id(lineage.source, lineage.source_repo),
        derived_repo=_repo_id(lineage.derived, lineage.derived_repo),
        relation_type=lineage.relation_type,
        description=lineage.description,
        created_by=lineage.creator.email,
        created_at=lineage.created_at,
    )


@router.get("/repos/{repo}/lineage", response_model=LineageListResponse,
    dependencies=[Depends(require_scope("repo", "read"))])
def get_lineage(
    repo: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """해당 repo의 upstream(원본)/downstream(파생) 관계 조회."""
    repo_obj = require_capability(db, user, repo, "lineage_read", min_member_role="guest")

    upstream = db.query(RepoLineage).filter(RepoLineage.derived_repo == repo_obj.repo_name).all()
    downstream = db.query(RepoLineage).filter(RepoLineage.source_repo == repo_obj.repo_name).all()

    return LineageListResponse(
        upstream=[_to_entry(lineage) for lineage in upstream],
        downstream=[_to_entry(lineage) for lineage in downstream],
    )


@router.post("/repos/{repo}/lineage",
    dependencies=[Depends(require_scope("repo", "write"))])
def create_lineage(
    repo: str,
    body: CreateLineageRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """파생 관계 등록. 현재 repo가 derived, body.source_repo가 source."""
    derived = check_access(db, user, repo, min_role="contributor")

    if body.relation_type not in VALID_RELATION_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"relation_type must be one of: {', '.join(VALID_RELATION_TYPES)}",
        )

    # source repo 존재 확인
    source = get_repo_by_name(db, body.source_repo)
    if source is None:
        raise HTTPException(status_code=404, detail=f"Source repository '{body.source_repo}' not found")
    require_capability(db, user, body.source_repo, "metadata_read", min_member_role="guest")

    # 자기 참조 방지
    if source.repo_name == derived.repo_name:
        raise HTTPException(status_code=422, detail="Cannot create lineage to self")

    # 중복 확인
    existing = db.query(RepoLineage).filter(
        RepoLineage.source_repo == source.repo_name,
        RepoLineage.derived_repo == derived.repo_name,
    ).first()
    if existing:
        return _lineage_mutation_response("exists", existing.id)

    lineage = RepoLineage(
        source_repo=source.repo_name,
        derived_repo=derived.repo_name,
        relation_type=body.relation_type,
        description=body.description,
        created_by=user.id,
    )
    db.add(lineage)
    db.commit()
    db.refresh(lineage)

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="lineage_create",
        resource_type="lineage",
        resource_id=f"{_repo_id(source, body.source_repo)} -> {_repo_id(derived, repo)}",
        details={"relation_type": body.relation_type},
        ip_address=request.client.host if request.client else None,
    )

    return _lineage_mutation_response("created", lineage.id)


@router.delete("/repos/{repo}/lineage/{lineage_id}",
    dependencies=[Depends(require_scope("repo", "write"))])
def delete_lineage(
    repo: str,
    lineage_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """파생 관계 삭제."""
    repo_obj = check_access(db, user, repo, min_role="contributor")

    lineage = db.query(RepoLineage).filter(
        RepoLineage.id == lineage_id,
        (RepoLineage.source_repo == repo_obj.repo_name) | (RepoLineage.derived_repo == repo_obj.repo_name),
    ).first()

    if lineage is None:
        raise HTTPException(status_code=404, detail="Lineage relationship not found")

    db.delete(lineage)
    db.commit()

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="lineage_delete",
        resource_type="lineage",
        resource_id=str(lineage_id),
        ip_address=request.client.host if request.client else None,
    )

    return {"status": "deleted"}


@router.get("/lineage/graph", response_model=LineageGraphResponse)
def get_lineage_graph(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """전체 리니지 그래프 (접근 가능한 repo만 포함)."""
    all_lineage = db.query(RepoLineage).all()

    # 관련 repo 이름 수집
    repo_names: set[str] = set()
    for lineage in all_lineage:
        repo_names.add(lineage.source_repo)
        repo_names.add(lineage.derived_repo)

    # repo 정보 조회 + 접근 권한 필터링
    nodes: list[LineageGraphNode] = []
    accessible_repos: set[str] = set()

    for name in repo_names:
        repo = db.query(Repo).filter(Repo.repo_name == name).first()
        if repo is None:
            continue
        role = resolve_role(db, user, repo)
        if role is None:
            policy = repo.public_access_policy
            if policy is None or not policy.discoverable or not policy.lineage_read:
                continue
        accessible_repos.add(name)
        nodes.append(LineageGraphNode(
            repo_name=_repo_id(repo, name),
            owner=repo.owner.email,
            visibility=repo.visibility,
        ))

    # 접근 가능한 repo 간 엣지만 포함
    edges: list[LineageGraphEdge] = []
    for lineage in all_lineage:
        if lineage.source_repo in accessible_repos and lineage.derived_repo in accessible_repos:
            edges.append(LineageGraphEdge(
                source=_repo_id(lineage.source, lineage.source_repo),
                target=_repo_id(lineage.derived, lineage.derived_repo),
                relation_type=lineage.relation_type,
            ))

    return LineageGraphResponse(nodes=nodes, edges=edges)


@router.get("/repos/{group}/{repo}/lineage", response_model=LineageListResponse,
    dependencies=[Depends(require_scope("repo", "read"))])
def get_lineage_group(
    group: str,
    repo: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_lineage(f"{group}/{repo}", user, db)


@router.post("/repos/{group}/{repo}/lineage",
    dependencies=[Depends(require_scope("repo", "write"))])
def create_lineage_group(
    group: str,
    repo: str,
    body: CreateLineageRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_lineage(f"{group}/{repo}", body, request, user, db)


@router.delete("/repos/{group}/{repo}/lineage/{lineage_id}",
    dependencies=[Depends(require_scope("repo", "write"))])
def delete_lineage_group(
    group: str,
    repo: str,
    lineage_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return delete_lineage(f"{group}/{repo}", lineage_id, request, user, db)
