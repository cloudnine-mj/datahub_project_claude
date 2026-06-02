"""Shared repository discovery query helpers."""

from __future__ import annotations

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, aliased, joinedload
from sqlalchemy.orm.query import Query

from app.models import Organization, Permission, Repo, RepoMetadata, RepoPublicAccessPolicy, User
from app.services.repo_identity import personal_owner_from_email


def repo_namespace(repo: Repo, owner_email: str | None = None) -> str:
    if repo.organization is not None:
        return repo.organization.group_name
    email = owner_email or (repo.owner.email if repo.owner else "")
    return personal_owner_from_email(email)


def repo_identifier(repo: Repo, owner_email: str | None = None) -> str:
    return f"{repo_namespace(repo, owner_email)}/{repo.repo_name}"


def visible_repo_metadata_query(db: Session, user: User) -> Query:
    """Return repo + metadata rows visible in discovery surfaces.

    A row is discoverable when the actor owns it, has an explicit repository
    permission, or the public access policy exposes `discoverable`.
    """
    current_permission = aliased(Permission)
    return (
        db.query(Repo, RepoMetadata, current_permission)
        .outerjoin(RepoMetadata, RepoMetadata.repo_name == Repo.repo_name)
        .outerjoin(RepoPublicAccessPolicy, RepoPublicAccessPolicy.repo_name == Repo.repo_name)
        .outerjoin(
            current_permission,
            and_(
                current_permission.repo_name == Repo.repo_name,
                current_permission.user_id == user.id,
            ),
        )
        .outerjoin(Organization, Repo.group_id == Organization.id)
        .options(
            joinedload(Repo.owner),
            joinedload(Repo.organization),
            joinedload(Repo.public_access_policy),
        )
        .filter(
            or_(
                Repo.owner_id == user.id,
                current_permission.user_id.isnot(None),
                RepoPublicAccessPolicy.discoverable.is_(True),
            )
        )
    )


def discovery_role(user: User, repo: Repo, permission: Permission | None) -> str:
    if repo.owner_id == user.id:
        return "owner"
    if permission is not None:
        return permission.role
    return "normal"
