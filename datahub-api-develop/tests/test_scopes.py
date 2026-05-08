"""auth/scopes.py 단위 테스트.

architecture/access-tokens.md §1.4 RBAC 매트릭스 / §3.3 가상 grant fan-out / 액션 계층.
"""

from __future__ import annotations

from unittest.mock import MagicMock

from app.auth.scopes import _expand_hierarchy, _grants_match, get_user_rbac_actions


# ── _expand_hierarchy ─────────────────────────────────


class TestExpandHierarchy:
    def test_read_alone(self):
        assert _expand_hierarchy({"read"}) == {"read"}

    def test_write_includes_read(self):
        assert _expand_hierarchy({"write"}) == {"read", "write"}

    def test_admin_includes_write_and_read(self):
        assert _expand_hierarchy({"admin"}) == {"read", "write", "admin"}

    def test_delete_includes_all(self):
        assert _expand_hierarchy({"delete"}) == {
            "read",
            "write",
            "admin",
            "delete",
        }

    def test_separate_actions_preserved(self):
        # discussion / settings_* 같은 별개 액션은 hierarchy 외 — 그대로
        out = _expand_hierarchy({"discussion", "read"})
        assert "discussion" in out and "read" in out


# ── _grants_match ─────────────────────────────────────


def _grant(rtype, rid, action):
    g = MagicMock()
    g.resource_type = rtype
    g.resource_id = rid
    g.action = action
    return g


class TestGrantsMatch:
    def test_virtual_user_read_token_passes_repo_read(self):
        """Read 토큰 (user, '*', read) → repo read 호출 통과."""
        grants = [_grant("user", "*", "read")]
        assert _grants_match(grants, "repo", "any/repo", "read") is True

    def test_virtual_user_write_token_passes_repo_read_and_write(self):
        grants = [_grant("user", "*", "write")]
        assert _grants_match(grants, "repo", "any/repo", "read") is True
        assert _grants_match(grants, "repo", "any/repo", "write") is True

    def test_virtual_user_write_token_blocks_admin(self):
        """Write 토큰은 admin 호출 차단 (architecture §3.7 시나리오 2)."""
        grants = [_grant("user", "*", "write")]
        assert _grants_match(grants, "repo", "any/repo", "admin") is False

    def test_explicit_repo_grant_exact_match(self):
        grants = [_grant("repo", "lab/r1", "write")]
        assert _grants_match(grants, "repo", "lab/r1", "read") is True
        assert _grants_match(grants, "repo", "lab/r1", "write") is True
        assert _grants_match(grants, "repo", "lab/r2", "read") is False

    def test_explicit_repo_grant_wildcard(self):
        grants = [_grant("repo", "*", "read")]
        assert _grants_match(grants, "repo", "lab/r1", "read") is True
        assert _grants_match(grants, "repo", "anywhere/x", "read") is True

    def test_admin_grant_blocks_delete(self):
        """admin 은 delete 미포함 (architecture §3.7 시나리오 3)."""
        grants = [_grant("repo", "lab/r1", "admin")]
        assert _grants_match(grants, "repo", "lab/r1", "admin") is True
        assert _grants_match(grants, "repo", "lab/r1", "delete") is False


# ── get_user_rbac_actions ─────────────────────────────


class TestGetUserRbacActions:
    def _setup(self, *, owner_id=10, visibility="private", allow_anon=False):
        from app.models import Repo, User

        repo = Repo(
            repo_name="lab/r1",
            owner_id=owner_id,
            visibility=visibility,
            allow_anonymous_download=allow_anon,
        )
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = repo
        return db, repo

    def test_owner_gets_full_set(self):
        from app.models import User
        db, _ = self._setup(owner_id=10)
        user = User(id=10, email="alice@x")
        # 두 번째 query (Permission) 도 None 반환
        db.query.return_value.filter.return_value.first.side_effect = [
            db.query.return_value.filter.return_value.first.return_value,
            None,
        ]
        # owner 분기는 첫 query 직후 끝남 (Permission lookup 미수행) — side_effect 한 번이면 충분
        actions = get_user_rbac_actions(db, user, "lab/r1")
        assert actions == {"read", "write", "admin", "delete"}

    def test_private_non_member_returns_none(self):
        """private 비멤버 → None (404 매핑 트리거).

        이 테스트는 Repo / Permission 두 모델을 별개 query 로 mock — 호출 순서에
        따라 다른 결과를 돌려주도록 side_effect 사용.
        """
        from app.models import Permission, Repo, User

        repo = Repo(
            repo_name="lab/r1",
            owner_id=99,
            visibility="private",
            allow_anonymous_download=False,
        )
        # query(Repo).filter(...).first() → repo / query(Permission).filter().filter().first() → None
        # 가장 안전: db.query side_effect 로 model 별 분기
        repo_chain = MagicMock()
        repo_chain.filter.return_value.first.return_value = repo

        perm_chain = MagicMock()
        perm_chain.filter.return_value.filter.return_value.first.return_value = None

        db = MagicMock()

        def _query(model):
            if model is Repo:
                return repo_chain
            if model is Permission:
                return perm_chain
            return MagicMock()

        db.query.side_effect = _query

        user = User(id=10, email="alice@x")
        assert get_user_rbac_actions(db, user, "lab/r1") is None

    def test_repo_not_found_returns_none(self):
        """자원 자체 미노출 → None (호출 측 404 매핑)."""
        from app.models import User
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        user = User(id=10, email="alice@x")
        assert get_user_rbac_actions(db, user, "nope") is None

    def test_none_repo_returns_none(self):
        from app.models import User
        db = MagicMock()
        user = User(id=10, email="alice@x")
        assert get_user_rbac_actions(db, user, None) is None
