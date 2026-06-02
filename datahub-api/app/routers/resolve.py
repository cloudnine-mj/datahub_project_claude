"""`_resolve` — rename history lookup for redirect (governance §repo-identity-spec).

옛 path (`group/repo`) 가 들어오면 group_renames + repo_renames 를 조회해서 현재
canonical path 로 매핑. Web/SDK 가 옛 URL 호출 시 redirect target 결정에 사용.

Lifetime: 영구 (audit history 유지하는 한). PR 6a 의 single source.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import GroupRename, Organization, Repo, RepoRename, User
from pydantic import BaseModel


router = APIRouter()


class ResolveResponse(BaseModel):
    """현재 canonical path + 추적 chain.

    - `canonical_group`, `canonical_repo`: 지금의 user-facing slug
    - `repo_id`, `group_id`: 불변 stable id (rename 무관)
    - `redirected`: True 면 입력이 옛 slug 라 변환됨
    - `chain`: 옛→새 변경 단계 (멀티-홉 rename 시 다단계 표시)
    """

    canonical_group: str
    canonical_repo: str | None  # None for group-only lookup
    repo_id: str | None
    group_id: str
    redirected: bool
    chain: list[dict[str, str]]


def _resolve_group_slug(db: Session, group_slug: str) -> tuple[Organization, list[dict[str, str]]]:
    """그룹 slug 가 현재 그룹인지, 아니면 옛 이름인지. 추적 chain 반환."""
    chain: list[dict[str, str]] = []
    current_slug = group_slug
    visited: set[str] = set()  # rename loop guard
    while current_slug not in visited:
        visited.add(current_slug)
        org = db.query(Organization).filter(Organization.group_name == current_slug).first()
        if org is not None:
            return org, chain
        # 옛 slug 였는지 group_renames 에서 lookup (가장 최근 rename)
        rename = (
            db.query(GroupRename)
            .filter(GroupRename.old_slug == current_slug)
            .order_by(GroupRename.renamed_at.desc())
            .first()
        )
        if rename is None:
            raise HTTPException(status_code=404, detail=f"Group '{group_slug}' not found")
        chain.append({"from": current_slug, "to": rename.new_slug})
        current_slug = rename.new_slug
    raise HTTPException(status_code=409, detail="Group rename loop detected")


@router.get(
    "/_resolve/groups/{group_slug}",
    response_model=ResolveResponse,
)
def resolve_group(
    group_slug: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Group slug → 현재 canonical slug + group_id (UUID). 옛 slug 면 301-ready 응답."""
    org, chain = _resolve_group_slug(db, group_slug)
    return ResolveResponse(
        canonical_group=org.group_name,
        canonical_repo=None,
        repo_id=None,
        group_id=org.uuid,
        redirected=len(chain) > 0,
        chain=chain,
    )


@router.get(
    "/_resolve/repos/{group_slug}/{repo_name}",
    response_model=ResolveResponse,
)
def resolve_repo(
    group_slug: str,
    repo_name: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """(group_slug, repo_name) → 현재 canonical (group, repo) + ids. 옛 slug 모두 처리.

    동작:
    1. group_slug 가 옛 이름이면 group_renames 따라가 현재 group_slug 추출
    2. 해당 group 의 repo_name 으로 lookup. 없으면 repo_renames 에서 (group_uuid, old_name) 매치
    3. 둘 다 실패 시 404

    chain 은 group + repo rename 단계 모두 포함.
    """
    chain: list[dict[str, str]] = []

    org, group_chain = _resolve_group_slug(db, group_slug)
    chain.extend(group_chain)

    current_repo_name = repo_name
    visited: set[str] = set()
    while current_repo_name not in visited:
        visited.add(current_repo_name)
        repo = (
            db.query(Repo)
            .filter(Repo.repo_name == current_repo_name, Repo.group_id == org.id)
            .first()
        )
        if repo is not None:
            return ResolveResponse(
                canonical_group=org.group_name,
                canonical_repo=repo.repo_name,
                repo_id=repo.uuid,
                group_id=org.uuid,
                redirected=len(chain) > 0,
                chain=chain,
            )
        # repo rename history 추적 — group_uuid + old_name
        rename = (
            db.query(RepoRename)
            .filter(RepoRename.group_uuid == org.uuid, RepoRename.old_name == current_repo_name)
            .order_by(RepoRename.renamed_at.desc())
            .first()
        )
        if rename is None:
            raise HTTPException(
                status_code=404,
                detail=f"Repository '{org.group_name}/{repo_name}' not found",
            )
        chain.append({"from": current_repo_name, "to": rename.new_name})
        current_repo_name = rename.new_name
    raise HTTPException(status_code=409, detail="Repo rename loop detected")
