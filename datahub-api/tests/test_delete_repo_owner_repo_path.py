from __future__ import annotations

from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.models import Base, Organization, Repo, RepoLineage, User
from app.routers import repos as repos_mod
from app.routers.repos import delete_repo


_SQLITE_TABLES = [
    Base.metadata.tables[t]
    for t in (
        "users",
        "organizations",
        "repos",
        "repo_public_access_policies",
        "repo_lineage",
        "permissions",
    )
]


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine, tables=_SQLITE_TABLES)
    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
    session = SessionLocal()
    yield session
    session.close()
    engine.dispose()


def _request():
    return SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"))


def _patch_delete_side_effects(monkeypatch: pytest.MonkeyPatch) -> dict[str, str | None]:
    captured: dict[str, str | None] = {}

    def fake_deprovision(repo_name: str, gcs_key: str | None = None) -> None:
        captured["repo_name"] = repo_name
        captured["gcs_key"] = gcs_key

    monkeypatch.setattr(repos_mod._provisioning, "deprovision_repo", fake_deprovision)
    monkeypatch.setattr(repos_mod.audit, "log", lambda *args, **kwargs: None)
    monkeypatch.setattr("app.routers.repos.app_settings.gcp_bucket_prefix", "prefix")
    return captured


def _add_user(db: Session, email: str) -> User:
    user = User(email=email, is_active=True)
    db.add(user)
    db.flush()
    return user


def test_delete_personal_namespace_repo_succeeds(db: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    owner = _add_user(db, "karlo.lee@lgresearch.ai")
    repo = Repo(
        repo_name="e2e-delete",
        owner_id=owner.id,
        group_id=None,
        bucket_name="prefix-karlo-lee--e2e-delete",
        visibility="private",
    )
    db.add(repo)
    db.commit()
    captured = _patch_delete_side_effects(monkeypatch)

    result = delete_repo("karlo-lee/e2e-delete", _request(), owner, db)

    assert result == {"status": "deleted", "repo_name": "karlo-lee/e2e-delete"}
    assert captured == {"repo_name": "e2e-delete", "gcs_key": "karlo-lee--e2e-delete"}
    assert db.get(Repo, "e2e-delete") is None


def test_delete_group_namespace_repo_still_succeeds(db: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    owner = _add_user(db, "owner@example.com")
    org = Organization(group_name="ml-lab", owner_id=owner.id, visibility="private")
    db.add(org)
    db.flush()
    repo = Repo(
        repo_name="group-delete",
        owner_id=owner.id,
        group_id=org.id,
        bucket_name="prefix-ml-lab--group-delete",
        visibility="private",
    )
    db.add(repo)
    db.commit()
    captured = _patch_delete_side_effects(monkeypatch)

    result = delete_repo("ml-lab/group-delete", _request(), owner, db)

    assert result == {"status": "deleted", "repo_name": "ml-lab/group-delete"}
    assert captured == {"repo_name": "group-delete", "gcs_key": "ml-lab--group-delete"}
    assert db.get(Repo, "group-delete") is None


def test_delete_repo_removes_attached_lineage_rows(db: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    owner = _add_user(db, "owner@example.com")
    org = Organization(group_name="ml-lab", owner_id=owner.id, visibility="private")
    db.add(org)
    db.flush()
    source = Repo(
        repo_name="source-delete",
        owner_id=owner.id,
        group_id=org.id,
        bucket_name="prefix-ml-lab--source-delete",
        visibility="private",
    )
    derived = Repo(
        repo_name="derived-keep",
        owner_id=owner.id,
        group_id=org.id,
        bucket_name="prefix-ml-lab--derived-keep",
        visibility="private",
    )
    db.add_all([source, derived])
    db.flush()
    db.add(
        RepoLineage(
            source_repo=source.repo_name,
            derived_repo=derived.repo_name,
            relation_type="derived_from",
            created_by=owner.id,
        )
    )
    db.commit()
    _patch_delete_side_effects(monkeypatch)

    result = delete_repo("ml-lab/source-delete", _request(), owner, db)

    assert result == {"status": "deleted", "repo_name": "ml-lab/source-delete"}
    assert db.query(RepoLineage).count() == 0
    assert db.get(Repo, "derived-keep") is not None


def test_delete_personal_namespace_repo_requires_owner(db: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    owner = _add_user(db, "karlo.lee@lgresearch.ai")
    other = _add_user(db, "other@example.com")
    db.add(
        Repo(
            repo_name="private-delete",
            owner_id=owner.id,
            group_id=None,
            bucket_name="prefix-karlo-lee--private-delete",
            visibility="private",
        )
    )
    db.commit()
    captured = _patch_delete_side_effects(monkeypatch)

    with pytest.raises(repos_mod.HTTPException) as exc_info:
        delete_repo("karlo-lee/private-delete", _request(), other, db)

    assert exc_info.value.status_code == 403
    assert captured == {}
