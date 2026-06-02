from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.models import RepoMetadata
from app.schemas.repos import MetadataPatch


def _user():
    return SimpleNamespace(id=1, email="owner@lgresearch.ai")


def _repo(metadata: RepoMetadata | None = None):
    repo = SimpleNamespace()
    repo.repo_name = "ner"
    repo.description = "desc"
    repo.owner = SimpleNamespace(email="owner@lgresearch.ai")
    repo.organization = SimpleNamespace(group_name="nlp-lab")
    repo.metadata_record = metadata
    return repo


def test_normalize_tags_deduplicates_and_lowercases_ascii():
    from app.routers.repos import _normalize_tags

    assert _normalize_tags([" NER ", "ner", "Korean"]) == ["ner", "korean"]


def test_normalize_tags_rejects_whitespace():
    from app.routers.repos import _normalize_tags

    with pytest.raises(HTTPException) as exc:
        _normalize_tags(["bad tag"])
    assert exc.value.status_code == 400


def test_patch_repo_metadata_preserves_unknown_properties(monkeypatch):
    from app.routers import repos as repos_mod

    metadata = RepoMetadata(
        repo_name="ner",
        summary="old",
        tags=["old"],
        properties={"custom": "keep", "task": "ner"},
    )
    repo = _repo(metadata)
    db = MagicMock()
    monkeypatch.setattr(repos_mod, "check_access", lambda db, user, repo_id, min_role: repo)
    monkeypatch.setattr(
        repos_mod,
        "active_vocabulary_ids",
        lambda db, kind: {
            "tasks": {"ner"},
            "languages": {"ko"},
            "modalities": {"text"},
            "formats": {"json"},
            "domains": {"nlp"},
        }.get(kind, {"other"}),
    )
    monkeypatch.setattr(repos_mod.audit, "log", lambda *args, **kwargs: None)

    result = repos_mod.patch_repo_metadata(
        "nlp-lab",
        "ner",
        MetadataPatch(summary="new", tags=["smoke"], properties={"language": "ko"}),
        SimpleNamespace(client=SimpleNamespace(host="127.0.0.1")),
        _user(),
        db,
    )

    assert result.repo == "nlp-lab/ner"
    assert result.summary == "new"
    assert result.tags == ["smoke"]
    assert result.properties == {"custom": "keep", "task": "ner", "language": "ko"}
    db.commit.assert_called_once()


def test_search_repos_filters_tags_and_properties(monkeypatch):
    from app.routers import repos as repos_mod

    repo = SimpleNamespace(
        repo_name="ner",
        owner_id=1,
        owner=SimpleNamespace(email="owner@lgresearch.ai"),
        organization=SimpleNamespace(group_name="nlp-lab"),
        visibility="public",
        description="desc",
        repo_type="A",
    )
    metadata = SimpleNamespace(
        summary="Korean NER benchmark",
        tags=["ner", "korean"],
        properties={"task": "ner", "language": "ko"},
        updated_at=datetime(2026, 5, 13, tzinfo=timezone.utc),
    )

    class FakeQuery:
        def filter(self, *args, **kwargs):
            return self

        def order_by(self, *args, **kwargs):
            return self

        def all(self):
            return [(repo, metadata, None)]

    monkeypatch.setattr(repos_mod, "visible_repo_metadata_query", lambda db, user: FakeQuery())

    result = repos_mod.search_repos(
        q="benchmark",
        group="nlp-lab",
        type="dataset",
        visibility=None,
        tag=["ner"],
        task="ner",
        language="ko",
        limit=100,
        user=_user(),
        db=MagicMock(),
    )

    assert [r.repo for r in result.items] == ["nlp-lab/ner"]


def test_repo_collection_read_scope_rejects_access_token_without_read():
    from app.routers.repos import _require_repo_collection_read

    request = SimpleNamespace(state=SimpleNamespace(auth_method="access_token", token_grants=[]))
    with pytest.raises(HTTPException) as exc:
        _require_repo_collection_read(request, _user())
    assert exc.value.status_code == 403


def test_repo_collection_read_scope_accepts_access_token_wildcard_read():
    from app.routers.repos import _require_repo_collection_read

    grant = SimpleNamespace(resource_type="repo", resource_id="*", action="read")
    request = SimpleNamespace(state=SimpleNamespace(auth_method="access_token", token_grants=[grant]))
    assert _require_repo_collection_read(request, _user()) == _user()
