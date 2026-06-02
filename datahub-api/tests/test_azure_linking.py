"""Azure user linking — link_azure_identity (PR 6 azure-ad-sso).

governance §database-model-spec 의 5 linking 시나리오 검증.
"""

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException


def _mock_user(id=1, email="u@lgresearch.ai", azure_oid=None, azure_tid=None, linked_at=None):
    return SimpleNamespace(
        id=id, email=email, azure_oid=azure_oid, azure_tid=azure_tid, linked_at=linked_at,
        name=None,
    )


def _mock_audit():
    audit = MagicMock()
    audit.log = MagicMock()
    return audit


def _mock_db_no_conflict():
    """db.query(User).filter(...).first() → None (no other user has this oid)."""
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None
    return db


def _mock_db_with_conflict(other_user):
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = other_user
    return db


# Case 1: 첫 Azure linking (azure_oid IS NULL → 채움)
class TestCase1_FirstAzureLinking:
    def test_backfills_azure_fields_and_audits(self):
        from app.services.azure_linking import link_azure_identity
        user = _mock_user(azure_oid=None)
        audit = _mock_audit()
        db = _mock_db_no_conflict()

        result = link_azure_identity(
            db, user,
            claims={"oid": "oid-abc", "tid": "tid-xyz"},
            audit=audit,
        )
        assert result.azure_oid == "oid-abc"
        assert result.azure_tid == "tid-xyz"
        assert result.linked_at is not None
        # audit log: user.azure_linked
        audit.log.assert_called_once()
        kwargs = audit.log.call_args.kwargs
        assert kwargs["action"] == "user.azure_linked"
        assert kwargs["details"]["azure_oid"] == "oid-abc"


# Case 2: 정상 재로그인 (azure_oid 일치)
class TestCase2_NormalReLogin:
    def test_no_op_on_matching_oid(self):
        from app.services.azure_linking import link_azure_identity
        user = _mock_user(azure_oid="oid-abc", azure_tid="tid-old")
        audit = _mock_audit()
        db = _mock_db_no_conflict()

        link_azure_identity(
            db, user,
            claims={"oid": "oid-abc", "tid": "tid-old"},
            audit=audit,
        )
        # No audit event for case 2
        audit.log.assert_not_called()

    def test_tid_silent_update_on_match(self):
        from app.services.azure_linking import link_azure_identity
        user = _mock_user(azure_oid="oid-abc", azure_tid="tid-old")
        audit = _mock_audit()
        db = _mock_db_no_conflict()

        link_azure_identity(
            db, user,
            claims={"oid": "oid-abc", "tid": "tid-new"},
            audit=audit,
        )
        assert user.azure_tid == "tid-new"
        # case 2 - silent update, no audit
        audit.log.assert_not_called()


# Case 3: oid 변경 (예외 케이스)
class TestCase3_OidChanged:
    def test_updates_oid_and_audits(self):
        from app.services.azure_linking import link_azure_identity
        user = _mock_user(azure_oid="oid-old")
        audit = _mock_audit()
        db = _mock_db_no_conflict()

        link_azure_identity(
            db, user,
            claims={"oid": "oid-new", "tid": "tid-x"},
            audit=audit,
        )
        assert user.azure_oid == "oid-new"
        assert user.azure_tid == "tid-x"
        audit.log.assert_called_once()
        kwargs = audit.log.call_args.kwargs
        assert kwargs["action"] == "user.azure_oid_changed"
        assert kwargs["details"]["old_oid"] == "oid-old"
        assert kwargs["details"]["new_oid"] == "oid-new"


# Case 4: 충돌 — 다른 user 가 같은 oid 점유
class TestCase4_OidConflict:
    def test_raises_422_and_audits(self):
        from app.services.azure_linking import link_azure_identity
        user = _mock_user(id=1, email="u1@lgresearch.ai")
        other = SimpleNamespace(id=2, email="u2@lgresearch.ai", azure_oid="oid-shared")
        audit = _mock_audit()
        db = _mock_db_with_conflict(other)

        with pytest.raises(HTTPException) as exc:
            link_azure_identity(
                db, user,
                claims={"oid": "oid-shared", "tid": "tid-x"},
                audit=audit,
            )
        assert exc.value.status_code == 422
        # 충돌 audit 기록
        audit.log.assert_called_once()
        kwargs = audit.log.call_args.kwargs
        assert kwargs["action"] == "user.azure_oid_conflict"
        assert kwargs["details"]["conflicting_user_id"] == 2


# Case 5: 신규 user (caller 가 row 생성 후 본 helper 호출)
class TestCase5_NewUser:
    def test_backfills_azure_on_freshly_created_user(self):
        from app.services.azure_linking import link_azure_identity
        # freshly created — azure_oid is None
        user = _mock_user(id=99, email="new@lgresearch.ai", azure_oid=None)
        audit = _mock_audit()
        db = _mock_db_no_conflict()

        link_azure_identity(
            db, user,
            claims={"oid": "oid-new", "tid": "tid-x"},
            audit=audit,
        )
        assert user.azure_oid == "oid-new"
        audit.log.assert_called_once()
        assert audit.log.call_args.kwargs["action"] == "user.azure_linked"


class TestEdgeCases:
    def test_missing_oid_returns_user_no_change(self):
        from app.services.azure_linking import link_azure_identity
        user = _mock_user(azure_oid=None)
        audit = _mock_audit()
        db = _mock_db_no_conflict()

        result = link_azure_identity(
            db, user,
            claims={"tid": "tid-x"},  # oid 누락
            audit=audit,
        )
        assert result.azure_oid is None
        audit.log.assert_not_called()
