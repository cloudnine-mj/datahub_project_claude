"""그룹/조직 멤버 추가 시 존재하지 않는 사용자를 거절 (regression).

이전 (2026-05-08 보고): `PUT /groups/{name}/members/{principal}` 가 미존재 user 를
자동 생성 (User row append). 오타로 ghost user 양산 문제.

수정: 404 + 안내 (사전 가입 필요 + lookup 안내 메시지).
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

import app.routers.groups as groups_mod
from app.routers.groups import _upsert_group_member
from app.schemas.groups import GroupMemberGrant


def _user():
    u = MagicMock()
    u.id = 1
    u.email = "owner@example.com"
    return u


def _request():
    req = MagicMock()
    req.client = SimpleNamespace(host="127.0.0.1")
    return req


def _patch_resolve_owner(monkeypatch):
    """`_require_group_maintainer` 가 통과되도록 group_role 을 'owner' 로 stub."""
    monkeypatch.setattr(groups_mod, "_group_role", lambda db, group, user: "owner")


def _make_db(target_exists: bool):
    """target_exists=False 면 query(User).filter().first() 가 None 반환."""
    db = MagicMock()

    def query_side(model):
        from app.models import OrganizationMembership, User

        q = MagicMock()
        if model is User:
            q.filter.return_value.first.return_value = (
                MagicMock(id=99, email="exists@example.com")
                if target_exists
                else None
            )
        elif model is OrganizationMembership:
            q.filter.return_value.first.return_value = None
        return q

    db.query.side_effect = query_side
    return db


def test_unknown_user_returns_404_with_helpful_detail(monkeypatch):
    _patch_resolve_owner(monkeypatch)
    monkeypatch.setattr(groups_mod.audit, "log", lambda *a, **kw: None)

    group = SimpleNamespace(id=10, group_name="nlp-lab", owner_id=1)
    monkeypatch.setattr(groups_mod, "_get_group_or_404", lambda db, owner: group)

    db = _make_db(target_exists=False)
    body = GroupMemberGrant(role="contributor")

    with pytest.raises(HTTPException) as exc:
        _upsert_group_member("nlp-lab", "typo@example.com", body, _request(), _user(), db)

    assert exc.value.status_code == 404
    assert "typo@example.com" in exc.value.detail
    assert "users/search" in exc.value.detail or "dh user lookup" in exc.value.detail
    # User 객체가 db.add 로 들어가지 않았는지 (ghost user 생성 안 됨)
    add_calls = [c for c in db.add.call_args_list if type(c.args[0]).__name__ == "User"]
    assert add_calls == []


def test_existing_user_proceeds(monkeypatch):
    """대조군 — 존재하는 사용자는 정상 처리 (404 안 남)."""
    _patch_resolve_owner(monkeypatch)
    monkeypatch.setattr(groups_mod.audit, "log", lambda *a, **kw: None)

    group = SimpleNamespace(id=10, group_name="nlp-lab", owner_id=1)
    monkeypatch.setattr(groups_mod, "_get_group_or_404", lambda db, owner: group)

    db = _make_db(target_exists=True)
    body = GroupMemberGrant(role="contributor")

    # 정상 처리 — HTTPException(404) 가 raise 되지 않으면 통과
    try:
        _upsert_group_member("nlp-lab", "exists@example.com", body, _request(), _user(), db)
    except HTTPException as e:
        # 404 만 회귀 차단 대상. 다른 status (예: 400 with owner=self) 는 별개.
        assert e.status_code != 404, e.detail
