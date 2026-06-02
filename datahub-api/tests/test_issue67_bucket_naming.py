"""Issue #67 — group-scoped repo GCS bucket naming unit tests.

엔드포인트 함수 직접 호출 + monkeypatch 패턴 (test_issue84_auth.py 준수).
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import app.services.audit as audit_module
from app.models import Organization, Repo
from app.routers import repos as repos_mod
from app.services.repo_naming import make_opaque_gcs_key

GROUP = "nlp-lab"
REPO = "ner-models"
PREFIX = "lgair-dgdh-dev"


def _mock_user():
    u = MagicMock()
    u.id = 1
    u.email = "tester@lgresearch.ai"
    return u


def _mock_request():
    r = MagicMock()
    r.client.host = "127.0.0.1"
    return r


def _patch_audit(monkeypatch):
    monkeypatch.setattr(audit_module.AuditService, "log", lambda self, *a, **kw: None)


def _patch_provisioning(monkeypatch, returned_bucket: str):
    """provision_repo 가 returned_bucket 을 반환하도록 패치."""
    monkeypatch.setattr(
        repos_mod._provisioning, "provision_repo",
        lambda repo_name, gcs_key=None, **_: returned_bucket,
    )
    # P1.D fix: create_repo 가 사전 GCS 충돌 검사를 호출하므로 stub.
    monkeypatch.setattr(
        repos_mod._gcs, "bucket_exists",
        lambda gcs_key: (False, f"prefix-{gcs_key}"),
    )


def _make_db(*, org=None, existing_repo=None):
    mock_db = MagicMock()

    def query_side(model):
        m = MagicMock()
        if model is Repo:
            m.filter.return_value.first.return_value = existing_repo
        elif model is Organization:
            m.filter.return_value.first.return_value = org
        return m

    mock_db.query.side_effect = query_side
    return mock_db


# ── create_repo: bucket suffix 검증 ──────────────────────────────────────────


class TestCreateRepoBucketNaming:
    def test_group_repo_uses_opaque_bucket_key(self, monkeypatch):
        """group 지정 시 physical gcs_key 는 user-facing group/repo 를 직접 노출하지 않는다."""
        from app.routers.repos import create_repo
        from app.schemas.repos import CreateRepoRequest

        _patch_audit(monkeypatch)
        # provision_repo 에 전달된 gcs_key 캡처
        captured: dict = {}

        def fake_provision(repo_name, gcs_key=None, **_):
            captured["repo_name"] = repo_name
            captured["gcs_key"] = gcs_key
            return f"{PREFIX}-{gcs_key or repo_name}"

        monkeypatch.setattr(repos_mod._provisioning, "provision_repo", fake_provision)
        monkeypatch.setattr(
            repos_mod._gcs, "bucket_exists",
            lambda gcs_key: (False, f"{PREFIX}-{gcs_key}"),
        )

        fake_org = SimpleNamespace(id=5, group_name=GROUP, owner_id=1)
        db = _make_db(org=fake_org)
        db.add.side_effect = lambda x: None

        body = CreateRepoRequest(repo_name=REPO, group=GROUP)
        create_repo(body, _mock_request(), _mock_user(), db)

        # rev.6: opaque key 가 repo_uuid 에서 파생되므로 GROUP/REPO 가 포함되지 않음.
        # 정확한 hash 매칭은 random uuid 라 불가, 형식만 검증.
        assert captured["repo_name"] == REPO
        assert captured["gcs_key"].startswith("r-")
        assert len(captured["gcs_key"]) == len("r-") + 24
        assert GROUP not in captured["gcs_key"]
        assert REPO not in captured["gcs_key"]

    def test_group_repo_bucket_stored_in_db(self, monkeypatch):
        """create_repo 후 Repo.bucket_name 에 opaque 물리 버킷명이 저장됨."""
        from app.routers.repos import create_repo
        from app.schemas.repos import CreateRepoRequest

        _patch_audit(monkeypatch)
        captured_bucket: dict = {}

        def fake_provision(repo_name, gcs_key=None, **_):
            captured_bucket["bucket"] = f"{PREFIX}-{gcs_key}"
            return captured_bucket["bucket"]

        monkeypatch.setattr(repos_mod._provisioning, "provision_repo", fake_provision)
        monkeypatch.setattr(
            repos_mod._gcs, "bucket_exists",
            lambda gcs_key: (False, f"{PREFIX}-{gcs_key}"),
        )

        fake_org = SimpleNamespace(id=5, group_name=GROUP, owner_id=1, uuid="01928f7c-1234-7abc-89de-aaaaaaaaaaaa")
        db = _make_db(org=fake_org)
        added_repos = []
        db.add.side_effect = added_repos.append

        body = CreateRepoRequest(repo_name=REPO, group=GROUP)
        create_repo(body, _mock_request(), _mock_user(), db)

        repo_rows = [r for r in added_repos if type(r).__name__ == "Repo"]
        assert len(repo_rows) == 1
        # provision 이 captured_bucket 을 그대로 bucket_name 으로 사용해야 함
        assert repo_rows[0].bucket_name == captured_bucket["bucket"]
        # opaque hash 형식 검증
        assert captured_bucket["bucket"].startswith(f"{PREFIX}-r-")

    def test_personal_repo_uses_opaque_bucket_key(self, monkeypatch):
        """group 없는 개인 레포도 물리 bucket 에 personal namespace 를 직접 노출하지 않는다."""
        from app.routers.repos import create_repo
        from app.schemas.repos import CreateRepoRequest

        _patch_audit(monkeypatch)
        captured: dict = {}

        def fake_provision(repo_name, gcs_key=None, **_):
            captured["gcs_key"] = gcs_key
            return f"{PREFIX}-{gcs_key or repo_name}"

        monkeypatch.setattr(repos_mod._provisioning, "provision_repo", fake_provision)
        monkeypatch.setattr(
            repos_mod._gcs, "bucket_exists",
            lambda gcs_key: (False, f"{PREFIX}-{gcs_key}"),
        )

        db = _make_db()
        db.add.side_effect = lambda x: None

        body = CreateRepoRequest(repo_name=REPO)
        create_repo(body, _mock_request(), _mock_user(), db)

        # rev.6: personal namespace 가 hash 입력에 들어가지 않음.
        assert captured["gcs_key"].startswith("r-")
        assert "tester" not in captured["gcs_key"]
        assert REPO not in captured["gcs_key"]


# ── delete_repo: bare name + gcs_key 검증 ────────────────────────────────────


class TestDeleteRepoBucketNaming:
    def _make_db_with_repo(self, bucket_name: str):
        fake_repo = MagicMock()
        fake_repo.owner_id = 1
        fake_repo.repo_name = REPO
        fake_repo.bucket_name = bucket_name

        db = MagicMock()
        db.query.return_value.join.return_value.filter.return_value.first.return_value = fake_repo
        db.query.return_value.filter.return_value.delete.return_value = 0
        return db, fake_repo

    def test_delete_group_repo_uses_correct_gcs_key(self, monkeypatch):
        """delete_repo — group 레포: deprovision_repo(bare_name, gcs_key='{group}--{repo}')."""
        from app.routers.repos import delete_repo

        captured: dict = {}

        def fake_deprovision(repo_name, gcs_key=None):
            captured["repo_name"] = repo_name
            captured["gcs_key"] = gcs_key

        monkeypatch.setattr(repos_mod._provisioning, "deprovision_repo", fake_deprovision)
        monkeypatch.setattr("app.routers.repos.app_settings.gcp_bucket_prefix", PREFIX)
        _patch_audit(monkeypatch)

        db, fake_repo = self._make_db_with_repo(bucket_name=f"{PREFIX}-{GROUP}--{REPO}")
        monkeypatch.setattr(repos_mod, "get_repo_by_name", lambda _db, repo_name: fake_repo)

        delete_repo(f"{GROUP}/{REPO}", _mock_request(), _mock_user(), db)

        assert captured["repo_name"] == REPO
        assert captured["gcs_key"] == f"{GROUP}--{REPO}"

    def test_delete_legacy_flat_repo_uses_repo_name_as_gcs_key(self, monkeypatch):
        """delete_repo — legacy flat 버킷은 저장된 bucket_name suffix 를 그대로 사용."""
        from app.routers.repos import delete_repo

        captured: dict = {}

        def fake_deprovision(repo_name, gcs_key=None):
            captured["repo_name"] = repo_name
            captured["gcs_key"] = gcs_key

        monkeypatch.setattr(repos_mod._provisioning, "deprovision_repo", fake_deprovision)
        monkeypatch.setattr("app.routers.repos.app_settings.gcp_bucket_prefix", PREFIX)
        _patch_audit(monkeypatch)

        db, _ = self._make_db_with_repo(bucket_name=f"{PREFIX}-{REPO}")
        # flat lookup: join chain returns None, filter chain returns repo
        db.query.return_value.join.return_value.filter.return_value.first.return_value = None
        flat_repo = MagicMock()
        flat_repo.owner_id = 1
        flat_repo.repo_name = REPO
        flat_repo.bucket_name = f"{PREFIX}-{REPO}"
        db.query.return_value.filter.return_value.first.return_value = flat_repo

        delete_repo(REPO, _mock_request(), _mock_user(), db)

        assert captured["repo_name"] == REPO
        assert captured["gcs_key"] == REPO


# ── files.py: repo_obj.bucket_name 우선 사용 검증 ────────────────────────────


class TestFilesBucketFromRepoObj:
    def _make_repo_obj(self, bucket_name: str):
        r = MagicMock()
        r.repo_name = REPO
        r.bucket_name = bucket_name
        return r

    def test_write_token_uses_repo_obj_bucket_name(self, monkeypatch):
        """prepare_upload — repo_obj.bucket_name 우선 사용."""
        from app.routers.files import prepare_upload
        from app.schemas.files import WriteTokenRequest

        expected_bucket = f"{PREFIX}-{GROUP}--{REPO}"
        repo_obj = self._make_repo_obj(bucket_name=expected_bucket)

        def fake_check_access(db, user, repo, min_role):
            return repo_obj

        monkeypatch.setattr("app.routers.files.check_access", fake_check_access)
        _patch_audit(monkeypatch)
        captured: dict = {}
        monkeypatch.setattr(
            "app.routers.files.generate_repo_upload_token",
            lambda bucket: captured.setdefault("bucket", bucket) and ("tok", "2099-01-01T00:00:00Z"),
        )

        req = MagicMock()
        req.client.host = "127.0.0.1"
        req.headers = {"Idempotency-Key": "test-write-token"}
        body = WriteTokenRequest(path="data/file.txt", size=1)
        result = prepare_upload(GROUP, REPO, body, req, _mock_user(), MagicMock())

        assert result.transfer.bucket == expected_bucket
        assert captured["bucket"] == expected_bucket
