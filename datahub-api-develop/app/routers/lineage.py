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
from app.services.authorization import check_access

router = APIRouter()
audit = AuditService()

VALID_RELATION_TYPES = ("derived_from", "augmented_from", "filtered_from", "merged_from")


def _to_entry(l: RepoLineage) -> LineageEntry:
    return LineageEntry(
        id=l.id,
        source_repo=l.source_repo,
        derived_repo=l.derived_repo,
        relation_type=l.relation_type,
        description=l.description,
        created_by=l.creator.email,
        created_at=l.created_at,
    )


@router.get("/repos/{repo}/lineage", response_model=LineageListResponse,
    dependencies=[Depends(require_scope("repo", "read"))])
def get_lineage(
    repo: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """해당 repo의 upstream(원본)/downstream(파생) 관계 조회."""
    check_access(db, user, repo, min_role="guest")

    upstream = db.query(RepoLineage).filter(RepoLineage.derived_repo == repo).all()
    downstream = db.query(RepoLineage).filter(RepoLineage.source_repo == repo).all()

    return LineageListResponse(
        upstream=[_to_entry(l) for l in upstream],
        downstream=[_to_entry(l) for l in downstream],
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
    check_access(db, user, repo, min_role="developer")

    if body.relation_type not in VALID_RELATION_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"relation_type must be one of: {', '.join(VALID_RELATION_TYPES)}",
        )

    # source repo 존재 확인
    source = db.query(Repo).filter(Repo.repo_name == body.source_repo).first()
    if source is None:
        raise HTTPException(status_code=404, detail=f"Source repository '{body.source_repo}' not found")

    # 자기 참조 방지
    if body.source_repo == repo:
        raise HTTPException(status_code=400, detail="Cannot create lineage to self")

    # 중복 확인
    existing = db.query(RepoLineage).filter(
        RepoLineage.source_repo == body.source_repo,
        RepoLineage.derived_repo == repo,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Lineage relationship already exists")

    lineage = RepoLineage(
        source_repo=body.source_repo,
        derived_repo=repo,
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
        resource_id=f"{body.source_repo} -> {repo}",
        details={"relation_type": body.relation_type},
        ip_address=request.client.host if request.client else None,
    )

    return {"status": "created", "id": lineage.id}


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
    check_access(db, user, repo, min_role="developer")

    lineage = db.query(RepoLineage).filter(
        RepoLineage.id == lineage_id,
        (RepoLineage.source_repo == repo) | (RepoLineage.derived_repo == repo),
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
    for l in all_lineage:
        repo_names.add(l.source_repo)
        repo_names.add(l.derived_repo)

    # repo 정보 조회 + 접근 권한 필터링
    nodes: list[LineageGraphNode] = []
    accessible_repos: set[str] = set()

    for name in repo_names:
        repo = db.query(Repo).filter(Repo.repo_name == name).first()
        if repo is None:
            continue
        # private repo는 권한 있는 사용자만
        if repo.visibility == "private":
            from app.services.authorization import resolve_role
            role = resolve_role(db, user, repo)
            if role is None:
                continue
        accessible_repos.add(name)
        nodes.append(LineageGraphNode(
            repo_name=name,
            owner=repo.owner.email,
            visibility=repo.visibility,
        ))

    # 접근 가능한 repo 간 엣지만 포함
    edges: list[LineageGraphEdge] = []
    for l in all_lineage:
        if l.source_repo in accessible_repos and l.derived_repo in accessible_repos:
            edges.append(LineageGraphEdge(
                source=l.source_repo,
                target=l.derived_repo,
                relation_type=l.relation_type,
            ))

    return LineageGraphResponse(nodes=nodes, edges=edges)
