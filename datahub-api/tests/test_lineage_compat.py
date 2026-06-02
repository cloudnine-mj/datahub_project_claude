from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.routers import lineage as lineage_mod
from app.schemas.lineage import CreateLineageRequest


def test_lineage_entry_keeps_int_id_and_adds_string_lineage_id() -> None:
    entry = lineage_mod._to_entry(
        SimpleNamespace(
            id=123,
            source=None,
            source_repo="source",
            derived=None,
            derived_repo="derived",
            relation_type="derived_from",
            description=None,
            creator=SimpleNamespace(email="owner@example.com"),
            created_at=datetime(2026, 5, 13, tzinfo=timezone.utc),
        )
    )

    assert entry.id == 123
    assert entry.lineage_id == "lin_123"


def test_lineage_mutation_response_adds_string_lineage_id() -> None:
    assert lineage_mod._lineage_mutation_response("created", 123) == {
        "status": "created",
        "id": 123,
        "lineage_id": "lin_123",
    }


def test_create_lineage_self_link_returns_422(monkeypatch: pytest.MonkeyPatch) -> None:
    repo = SimpleNamespace(repo_name="ner")
    monkeypatch.setattr(lineage_mod, "check_access", lambda *args, **kwargs: repo)
    monkeypatch.setattr(lineage_mod, "get_repo_by_name", lambda *args, **kwargs: repo)
    monkeypatch.setattr(lineage_mod, "require_capability", lambda *args, **kwargs: repo)

    with pytest.raises(HTTPException) as exc:
        lineage_mod.create_lineage(
            "nlp-lab/ner",
            CreateLineageRequest(source_repo="nlp-lab/ner"),
            SimpleNamespace(client=SimpleNamespace(host="127.0.0.1")),
            SimpleNamespace(id=1, email="owner@example.com"),
            MagicMock(),
        )

    assert exc.value.status_code == 422
