"""RBAC 매트릭스 + 토큰 grants 매칭 헬퍼.

architecture/access-tokens.md §1.4 (RBAC 매트릭스) 와 §3.3 (Read/Write 가상
grant) 구현.

검증 흐름 (require_scope dependency 가 호출):
    1) get_user_rbac_actions(user, repo) → {read, write, admin, delete} ⊂ ?
    2) min_action ∈ _expand_hierarchy(rbac) ?
    3) _grants_match(token_grants, resource_type, resource_id, min_action) ?
"""

from __future__ import annotations

from typing import Iterable, List, Optional, Set

from sqlalchemy.orm import Session

from app.models import AccessTokenGrant, Permission, Repo, User
from app.services.authorization import get_repo_by_name

# ── 액션 계층 확장 ────────────────────────────────────────────────────────
# read ⊂ write ⊂ admin ⊂ delete
_HIERARCHY = ("read", "write", "admin", "delete")


def _expand_hierarchy(actions: Iterable[str]) -> Set[str]:
    """`read ⊂ write ⊂ admin ⊂ delete` 계층 확장.

    예: {'admin'} → {'read', 'write', 'admin'}
    delete 는 admin 을, admin 은 write 를, write 는 read 를 포함.
    discussion / settings_* 등 별개 액션은 hierarchy 외 — 그대로 유지.
    """
    out: Set[str] = set(actions)
    for i, level in enumerate(_HIERARCHY):
        if level in out:
            # level 보다 낮은 레벨 모두 포함
            for lower in _HIERARCHY[: i + 1]:
                out.add(lower)
    return out


# ── RBAC 매트릭스 (1차 게이트) ──────────────────────────────────────────


def _public_read_actions(repo: Repo) -> Optional[Set[str]]:
    """비멤버 read fallback.

    `repo_public_access_policies`가 public access source of truth다. 정책 row가
    없는 legacy row는 visibility preset으로만 해석하고, 더 이상
    `allow_anonymous_download` 컬럼을 RBAC fallback으로 사용하지 않는다.
    """
    policy = getattr(repo, "public_access_policy", None)
    if policy is None:
        if repo.visibility == "public":
            return {"read"}
        if repo.visibility == "private":
            return None
        return set()

    if not policy.discoverable:
        return None
    if policy.metadata_read:
        return {"read"}
    return set()


def get_user_rbac_actions(
    db: Session, user: User, repo_name: Optional[str]
) -> Optional[Set[str]]:
    """사용자가 자원에 대해 RBAC 매트릭스상 가능한 액션 set.

    Returns:
        None       → 자원 자체 미노출. 호출 측에서 404 로 매핑 (자원 누설 방지).
                     - repo_name=None / 존재하지 않는 repo
                     - private + 비멤버
        set()      → 자원은 노출되나 user 가 가진 액션 없음. 호출 측에서 403
                     'insufficient permission' 매핑.
                     - discoverable=true + metadata_read=false + 비멤버
        non-empty  → 가진 액션 (owner / maintainer / contributor / guest / public-read)
    """
    if repo_name is None:
        return None

    repo: Optional[Repo] = get_repo_by_name(db, repo_name)
    if repo is None:
        return None

    # owner 단일 — repos.owner_id 가 진실 source. owner 면 모든 액션.
    if repo.owner_id == user.id:
        return {"read", "write", "admin", "delete"}

    # 멤버십 (permissions row)
    perm: Optional[Permission] = (
        db.query(Permission)
        .filter(Permission.repo_name == repo.repo_name)
        .filter(Permission.user_id == user.id)
        .first()
    )
    if perm is not None:
        if perm.role == "maintainer":
            return {"read", "write", "admin"}
        if perm.role == "contributor":
            return {"read", "write"}
        if perm.role == "guest":
            return {"read"}

    # 비멤버 — public_access capability 기준
    if repo.visibility == "private":
        # private 비멤버 → 자원 자체 미노출 → 404
        return None

    return _public_read_actions(repo)


# ── 2차 게이트 — 토큰 grants 매칭 ───────────────────────────────────────


def _grants_match(
    grants: List[AccessTokenGrant],
    resource_type: str,
    resource_id: Optional[str],
    min_action: str,
) -> bool:
    """토큰 grants 가 (resource_type, resource_id, min_action) 을 만족하는지.

    매칭 규칙
    --------
    1. **가상 fan-out** (Read/Write 토큰의 (user, '*', read|write)):
       resource_type 가 'repo' / 'group' / 'snapshot' 등 user-scoped 자원이면
       grant 의 액션이 min_action 의 hierarchy 에 포함되는지로 판정.
       (RBAC 1차 게이트가 이미 사용자 권한을 검증했으므로 grant 는 액션만 확인.)

    2. **명시적 grant** — (resource_type, resource_id, action) 정확 매칭 또는
       resource_id == '*' wildcard 매칭.

    3. action hierarchy — grant 의 액션이 min_action 의 상위면 통과.

    Returns:
        True  — 통과
        False — insufficient scope
    """
    # 1) 가상 fan-out — Read/Write 토큰의 (user, '*', read|write)
    for g in grants:
        if g.resource_type == "user" and g.resource_id == "*":
            if min_action in _expand_hierarchy({g.action}):
                return True

    # 2) 명시적 grant — wildcard 또는 정확 매칭
    for g in grants:
        if g.resource_type != resource_type:
            continue
        # wildcard
        if g.resource_id == "*" or g.resource_id is None:
            if min_action in _expand_hierarchy({g.action}):
                return True
            continue
        # 정확 매칭
        if g.resource_id == resource_id:
            if min_action in _expand_hierarchy({g.action}):
                return True

    return False


__all__ = [
    "_expand_hierarchy",
    "get_user_rbac_actions",
    "_grants_match",
]
