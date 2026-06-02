from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.models import (
    Base,
    Organization,
    Permission,
    Repo,
    RepoMetadata,
    RepoPublicAccessPolicy,
    User,
)
from app.routers import catalog as catalog_mod
from app.routers import repos as repos_mod


_SQLITE_TABLES = [
    Base.metadata.tables[t]
    for t in (
        "users",
        "organizations",
        "repos",
        "repo_public_access_policies",
        "permissions",
        "repo_metadata",
    )
]


def _session() -> Session:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine, tables=_SQLITE_TABLES)
    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
    session = SessionLocal()
    session._engine_for_test = engine  # type: ignore[attr-defined]
    return session


def _close(session: Session) -> None:
    engine = session._engine_for_test  # type: ignore[attr-defined]
    session.close()
    engine.dispose()


def _add_user(db: Session, email: str) -> User:
    user = User(email=email, is_active=True)
    db.add(user)
    db.flush()
    return user


def _add_repo(
    db: Session,
    *,
    owner: User,
    group: Organization,
    name: str,
    discoverable: bool,
    tags: list[str],
    properties: dict,
    summary: str = "",
    repo_type: str = "A",
) -> Repo:
    repo = Repo(
        repo_name=name,
        owner_id=owner.id,
        group_id=group.id,
        visibility="fine_grained" if discoverable else "private",
        repo_type=repo_type,
    )
    db.add(repo)
    db.flush()
    db.add(
        RepoPublicAccessPolicy(
            repo_name=name,
            discoverable=discoverable,
            metadata_read=discoverable,
            file_list=False,
            file_read=False,
            lineage_read=False,
            stats_read=False,
        )
    )
    db.add(RepoMetadata(repo_name=name, summary=summary, tags=tags, properties=properties))
    return repo


def test_catalog_filters_only_uses_discoverable_or_member_repos():
    db = _session()
    try:
        owner = _add_user(db, "owner@example.com")
        viewer = _add_user(db, "viewer@example.com")
        org = Organization(group_name="ml-lab", owner_id=owner.id, visibility="private")
        db.add(org)
        db.flush()
        _add_repo(
            db,
            owner=owner,
            group=org,
            name="hidden",
            discoverable=False,
            tags=["secret"],
            properties={"task": "hidden-task"},
        )
        _add_repo(
            db,
            owner=owner,
            group=org,
            name="public",
            discoverable=True,
            tags=["public"],
            properties={"task": "ner", "language": "ko"},
        )
        _add_repo(
            db,
            owner=owner,
            group=org,
            name="member",
            discoverable=False,
            tags=["member-only"],
            properties={"task": "classification"},
        )
        db.add(Permission(repo_name="member", user_id=viewer.id, role="guest", granted_by=owner.id))
        db.commit()

        result = catalog_mod.get_filter_options(viewer, db)

        assert result.tags == ["member-only", "public"]
        assert "secret" not in result.tags
        assert result.tasks == ["classification", "ner"]
    finally:
        _close(db)


def test_repo_search_filters_and_paginates_without_list_repos(monkeypatch):
    db = _session()
    try:
        owner = _add_user(db, "owner@example.com")
        viewer = _add_user(db, "viewer@example.com")
        org = Organization(group_name="ml-lab", owner_id=owner.id, visibility="private")
        db.add(org)
        db.flush()
        _add_repo(
            db,
            owner=owner,
            group=org,
            name="ner-a",
            discoverable=True,
            tags=["korean", "ner"],
            properties={"task": "ner", "language": "ko"},
            summary="Korean NER A",
        )
        _add_repo(
            db,
            owner=owner,
            group=org,
            name="ner-b",
            discoverable=True,
            tags=["korean", "ner"],
            properties={"task": "ner", "language": "ko"},
            summary="Korean NER B",
        )
        _add_repo(
            db,
            owner=owner,
            group=org,
            name="hidden-ner",
            discoverable=False,
            tags=["korean", "ner"],
            properties={"task": "ner", "language": "ko"},
            summary="Hidden NER",
        )
        db.commit()
        monkeypatch.setattr(
            repos_mod,
            "list_repos",
            lambda **kwargs: (_ for _ in ()).throw(AssertionError("search must not call list_repos")),
        )

        first = repos_mod.search_repos(
            q="NER",
            group="ml-lab",
            type="dataset",
            visibility=None,
            tag=["korean"],
            task="ner",
            language="ko",
            limit=1,
            page_token=None,
            user=viewer,
            db=db,
        )
        second = repos_mod.search_repos(
            q="NER",
            group="ml-lab",
            type="dataset",
            visibility=None,
            tag=["korean"],
            task="ner",
            language="ko",
            limit=1,
            page_token=first.next_page_token,
            user=viewer,
            db=db,
        )

        assert [item.repo for item in first.items] == ["ml-lab/ner-a"]
        assert first.has_more is True
        assert [item.repo for item in second.items] == ["ml-lab/ner-b"]
        assert second.has_more is False
    finally:
        _close(db)
