"""중앙 권한 판별 서비스.

역할 계층: owner > maintainer > contributor > guest > (normal user)
- Owner: repos.owner_id 로 판별 (RBAC role 의 진실 source — alembic 017 namespace
  rename 에서도 보존)
- maintainer/contributor/guest: permissions 테이블
- Normal User: permissions 레코드 없는 인증된 사용자 (public repo 읽기만 가능)
"""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models import Organization, Permission, Repo, User
from app.services.repo_identity import parse_repo_id, personal_owner_from_email

# 역할 계층 (숫자가 높을수록 상위)
ROLE_HIERARCHY: dict[str, int] = {
    "owner": 40,
    "maintainer": 30,
    "contributor": 20,
    "guest": 10,
}

# permissions 테이블에 저장 가능한 역할
ASSIGNABLE_ROLES = ("maintainer", "contributor", "guest")


def get_repo_by_name(db: Session, repo_name: str) -> Repo | None:
    """Repo 식별자를 DB row로 해석한다.

    Canonical API/CLI는 `group/repo` 를 쓰지만 DB 계약은 repos.repo_name 이
    bare repo name 이고 group namespace 는 repos.group_id -> organizations 로 표현한다.
    Legacy 테스트/데이터의 composite repo_name row 도 마지막 fallback 으로 허용한다.
    """
    if "/" in repo_name:
        try:
            group_name, bare_name = parse_repo_id(repo_name)
        except ValueError:
            return None
        try:
            repo = (
                db.query(Repo)
                .join(Repo.organization)
                .filter(
                    Organization.group_name == group_name,
                    Repo.repo_name == bare_name,
                )
                .first()
            )
        except SQLAlchemyError:
            repo = None
        if isinstance(repo, Repo):
            return repo

        try:
            personal_candidates = (
                db.query(Repo)
                .join(Repo.owner)
                .filter(
                    Repo.repo_name == bare_name,
                    Repo.group_id.is_(None),
                )
                .all()
            )
            for candidate in personal_candidates:
                if (
                    isinstance(candidate, Repo)
                    and candidate.owner is not None
                    and personal_owner_from_email(candidate.owner.email) == group_name
                ):
                    return candidate
        except (SQLAlchemyError, TypeError):
            pass

    return db.query(Repo).filter(Repo.repo_name == repo_name).first()


def resolve_role(db: Session, user: User, repo: Repo) -> str | None:
    """사용자의 Repo 내 역할을 반환.

    Returns:
        'owner' | 'maintainer' | 'contributor' | 'guest' | None
        None = Normal User (DB에 권한 레코드 없음)
    """
    if repo.owner_id == user.id:
        return "owner"

    perm = db.query(Permission).filter(
        Permission.repo_name == repo.repo_name,
    ).filter(Permission.user_id == user.id).first()
    if perm:
        return perm.role

    return None


def check_access(
    db: Session,
    user: User,
    repo_name: str,
    min_role: str = "guest",
) -> Repo:
    """최소 역할 요구. 미달 시 403.

    - min_role='guest': 읽기 작업 (public repo에서는 Normal User도 통과)
    - min_role='contributor': 쓰기 작업
    - min_role='maintainer': 관리 작업
    - min_role='owner': 소유자 전용 작업
    """
    repo = get_repo_by_name(db, repo_name)
    if repo is None:
        raise HTTPException(status_code=404, detail=f"Repository '{repo_name}' not found")

    role = resolve_role(db, user, repo)
    min_level = ROLE_HIERARCHY.get(min_role, 0)

    if role is not None:
        # 명시적 역할이 있는 사용자
        user_level = ROLE_HIERARCHY.get(role, 0)
        if user_level >= min_level:
            return repo
        raise HTTPException(
            status_code=403,
            detail=f"Requires '{min_role}' role or above (current: '{role}')",
        )

    # Normal User (역할 없음)
    if repo.visibility == "public" and min_role == "guest":
        return repo

    if repo.visibility == "private":
        raise HTTPException(status_code=403, detail="This is a private repository. Request access from the owner.")

    raise HTTPException(
        status_code=403,
        detail=f"Requires '{min_role}' role or above",
    )


def require_admin(db: Session, user: User, repo_name: str) -> Repo:
    """Owner 또는 Maintainer만 통과."""
    return check_access(db, user, repo_name, min_role="maintainer")


CAPABILITY_NAMES = (
    "discoverable",
    "metadata_read",
    "file_list",
    "file_read",
    "lineage_read",
    "stats_read",
)


def require_capability(
    db: Session,
    user: User,
    repo_name: str,
    capability: str,
    min_member_role: str = "guest",
) -> Repo:
    """capability 기반 접근 평가 (governance §Permission Evaluation 6단계).

    멤버는 RBAC role 우선 — `min_member_role` 이상이면 capability 무시하고 통과.
    비멤버는 repo_public_access_policies 의 해당 capability 가 true 일 때만 통과.

    discoverable=false 인 경우 비멤버에게 **404** (존재 숨김),
    discoverable=true 이지만 다른 capability 가 차단되면 **403**.

    Args:
        capability: CAPABILITY_NAMES 중 하나
        min_member_role: 멤버 RBAC 으로 자동 통과시키는 최소 role
    """
    if capability not in CAPABILITY_NAMES:
        raise ValueError(f"Unknown capability: {capability}")

    repo = get_repo_by_name(db, repo_name)

    role = None if repo is None else resolve_role(db, user, repo)

    if repo is None:
        raise HTTPException(status_code=404, detail=f"Repository '{repo_name}' not found")

    # 멤버 (role != None) 는 RBAC 우선
    if role is not None:
        user_level = ROLE_HIERARCHY.get(role, 0)
        min_level = ROLE_HIERARCHY.get(min_member_role, 0)
        if user_level >= min_level:
            return repo
        raise HTTPException(
            status_code=403,
            detail=f"Requires '{min_member_role}' role or above (current: '{role}')",
        )

    # 비멤버 — capability 평가
    policy = repo.public_access_policy
    if policy is None:
        # backfill 누락 — 안전하게 차단 (private 동등)
        raise HTTPException(status_code=404, detail=f"Repository '{repo_name}' not found")

    # discoverable=false 면 존재 자체를 숨김 (비멤버 view 에서 404)
    if not policy.discoverable:
        raise HTTPException(status_code=404, detail=f"Repository '{repo_name}' not found")

    if not getattr(policy, capability):
        raise HTTPException(
            status_code=403,
            detail=f"This repository does not allow '{capability}' to non-members.",
        )
    return repo


def can_assign_role(actor_role: str, target_role: str) -> bool:
    """actor가 target_role을 부여/회수할 수 있는지 확인.

    - Owner: 모든 assignable role 부여 가능 (owner grant/revoke는 별도 계약)
    - Maintainer: maintainer, contributor, guest 부여 가능
    - 그 외: 부여 불가
    """
    if target_role not in ASSIGNABLE_ROLES:
        return False

    target_level = ROLE_HIERARCHY.get(target_role, 0)

    # Owner는 모든 assignable role 부여 가능
    if actor_role == "owner":
        return True

    # Maintainer는 자기 레벨 이하 부여 가능
    if actor_role == "maintainer":
        return target_level <= ROLE_HIERARCHY["maintainer"]

    return False
