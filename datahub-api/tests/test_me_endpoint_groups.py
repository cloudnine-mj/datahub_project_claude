"""GET /users/me 응답에 personal_namespace + groups 노출 (G3).

governance §그룹 / §개인 owner: 사용자가 본인 owner namespace 와 가입 group 들을
한 응답으로 받을 수 있어야 한다.
"""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

from app.routers.users import get_me


def _user(email="alice.lee@lgresearch.ai"):
    u = MagicMock()
    u.id = 1
    u.email = email
    u.is_active = True
    u.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return u


def _make_db(owned=None, memberships=None):
    db = MagicMock()
    owned = owned or []
    memberships = memberships or []

    from app.models import Organization, OrganizationMembership

    def _query(*models):
        # single-arg call: db.query(Organization).filter(...).all()
        if len(models) == 1 and models[0] is Organization:
            q = MagicMock()
            q.filter.return_value.all.return_value = owned
            return q
        # multi-arg call: db.query(OrganizationMembership, Organization).join(...)
        if models == (OrganizationMembership, Organization):
            q = MagicMock()
            q.join.return_value.filter.return_value.all.return_value = memberships
            return q
        return MagicMock()

    db.query.side_effect = _query
    return db


def test_personal_namespace_derived_from_email(monkeypatch):
    u = _user("Bob.Lee@lgresearch.ai")
    db = _make_db()
    resp = get_me(current_user=u, db=db)
    assert resp.personal_namespace == "bob-lee"  # lowercase + dot→hyphen
    assert resp.groups == []


def test_owned_group_role_owner():
    u = _user()
    org = SimpleNamespace(id=10, group_name="nlp-lab", owner_id=1)
    db = _make_db(owned=[org])
    resp = get_me(current_user=u, db=db)
    assert any(g.name == "nlp-lab" and g.role == "owner" for g in resp.groups)


def test_membership_role_appears():
    u = _user()
    org = SimpleNamespace(id=20, group_name="vision-lab", owner_id=99)  # 다른 사람 owner
    membership = SimpleNamespace(role="contributor")
    db = _make_db(memberships=[(membership, org)])
    resp = get_me(current_user=u, db=db)
    assert any(g.name == "vision-lab" and g.role == "contributor" for g in resp.groups)


def test_owner_membership_takes_precedence():
    """본인이 owner 인 group 이 동시에 membership row 에도 있으면 owner 우선."""
    u = _user()
    org = SimpleNamespace(id=30, group_name="dual", owner_id=1)
    membership = SimpleNamespace(role="maintainer")  # 이상 케이스
    db = _make_db(owned=[org], memberships=[(membership, org)])
    resp = get_me(current_user=u, db=db)
    dual_entries = [g for g in resp.groups if g.name == "dual"]
    assert len(dual_entries) == 1
    assert dual_entries[0].role == "owner"
