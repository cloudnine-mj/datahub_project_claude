from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.services.idempotency import clear_idempotency, run_idempotent


def _request(key: str | None):
    return SimpleNamespace(headers={"Idempotency-Key": key} if key else {})


def test_idempotency_replays_same_request_without_rerun():
    clear_idempotency()
    calls = 0

    def _factory():
        nonlocal calls
        calls += 1
        return {"calls": calls}

    first = run_idempotent(
        _request("same-key"),
        actor_id=1,
        scope="test.scope",
        body={"value": 1},
        response_factory=_factory,
        required=True,
    )
    second = run_idempotent(
        _request("same-key"),
        actor_id=1,
        scope="test.scope",
        body={"value": 1},
        response_factory=_factory,
        required=True,
    )

    assert first == {"calls": 1}
    assert second == {"calls": 1}
    assert calls == 1


def test_idempotency_conflicts_on_same_key_different_body():
    clear_idempotency()
    run_idempotent(
        _request("same-key"),
        actor_id=1,
        scope="test.scope",
        body={"value": 1},
        response_factory=lambda: {"ok": True},
        required=True,
    )

    with pytest.raises(HTTPException) as exc:
        run_idempotent(
            _request("same-key"),
            actor_id=1,
            scope="test.scope",
            body={"value": 2},
            response_factory=lambda: {"ok": True},
            required=True,
        )

    assert exc.value.status_code == 409


def test_required_idempotency_key_missing_returns_400():
    clear_idempotency()
    with pytest.raises(HTTPException) as exc:
        run_idempotent(
            _request(None),
            actor_id=1,
            scope="test.scope",
            body={},
            response_factory=lambda: {"ok": True},
            required=True,
        )

    assert exc.value.status_code == 400
