"""Issue #67 — group-scoped repo GCS bucket naming unit tests.

엔드포인트 함수 직접 호출 + monkeypatch 패턴 (test_issue84_auth.py 준수).
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

import app.services.audit as audit_module
from app.models import Organization, Repo
from app.routers import repos as repos_mod

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
    monkeypatch.setattr(repos_mod._lakefs, "upload_object", lambda *a, **kw: None)
    monkeypatch.setattr(
        repos_mod._lakefs, "commit",
        lambda *a, **kw: SimpleNamespace(id="init", message="", committer=""),
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
    def test_group_repo_uses_group_prefix_in_bucket(self, monkeypatch):
        """group 지정 시 gcs_key = '{group}-{repo}' 로 provision_repo 호출."""
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
        monkeypatch.setattr(repos_mod._lakefs, "upload_object", lambda *a, **kw: None)
        monkeypatch.setattr(
            repos_mod._lakefs, "commit",
            lambda *a, **kw: SimpleNamespace(id="init", message="", committer=""),
        )

        fake_org = SimpleNamespace(id=5, org_name=GROUP)
        db = _make_db(org=fake_org)
        db.add.side_effect = lambda x: None

        body = CreateRepoRequest(repo_name=REPO, group=GROUP)
        create_repo(body, _mock_request(), _mock_user(), db)

        assert captured["repo_name"] == REPO
        assert captured["gcs_key"] == f"{GROUP}-{REPO}"

    def test_group_repo_bucket_stored_in_db(self, monkeypatch):
        """create_repo 후 Repo.bucket_name 에 group-prefix 버킷명이 저장됨."""
        from app.routers.repos import create_repo
        from app.schemas.repos import CreateRepoRequest

        _patch_audit(monkeypatch)
        expected_bucket = f"{PREFIX}-{GROUP}-{REPO}"
        _patch_provisioning(monkeypatch, returned_bucket=expected_bucket)

        fake_org = SimpleNamespace(id=5, org_name=GROUP)
        db = _make_db(org=fake_org)
        added_repos = []
        db.add.side_effect = added_repos.append

        body = CreateRepoRequest(repo_name=REPO, group=GROUP)
        create_repo(body, _mock_request(), _mock_user(), db)

        repo_rows = [r for r in added_repos if type(r).__name__ == "Repo"]
        assert len(repo_rows) == 1
        assert repo_rows[0].bucket_name == expected_bucket

    def test_flat_repo_bucket_unchanged(self, monkeypatch):
        """group 없는 레포는 기존 '{prefix}-{repo}' 버킷명 유지."""
        from app.routers.repos import create_repo
        from app.schemas.repos import CreateRepoRequest

        _patch_audit(monkeypatch)
        captured: dict = {}

        def fake_provision(repo_name, gcs_key=None, **_):
            captured["gcs_key"] = gcs_key
            return f"{PREFIX}-{repo_name}"

        monkeypatch.setattr(repos_mod._provisioning, "provision_repo", fake_provision)
        monkeypatch.setattr(repos_mod._lakefs, "upload_object", lambda *a, **kw: None)
        monkeypatch.setattr(
            repos_mod._lakefs, "commit",
            lambda *a, **kw: SimpleNamespace(id="init", message="", committer=""),
        )

        db = _make_db()
        db.add.side_effect = lambda x: None

        body = CreateRepoRequest(repo_name=REPO)
        create_repo(body, _mock_request(), _mock_user(), db)

        assert captured["gcs_key"] is None  # gcs_key 미전달 → provision_repo 내부서 repo_name 사용


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
        """delete_repo — group 레포: deprovision_repo(bare_name, gcs_key='{group}-{repo}')."""
        from app.routers.repos import delete_repo

        captured: dict = {}

        def fake_deprovision(repo_name, gcs_key=None):
            captured["repo_name"] = repo_name
            captured["gcs_key"] = gcs_key

        monkeypatch.setattr(repos_mod._provisioning, "deprovision_repo", fake_deprovision)
        monkeypatch.setattr("app.routers.repos.app_settings.gcp_bucket_prefix", PREFIX)
        _patch_audit(monkeypatch)

        db, _ = self._make_db_with_repo(bucket_name=f"{PREFIX}-{GROUP}-{REPO}")

        delete_repo(f"{GROUP}/{REPO}", _mock_request(), _mock_user(), db)

        assert captured["repo_name"] == REPO
        assert captured["gcs_key"] == f"{GROUP}-{REPO}"

    def test_delete_flat_repo_uses_repo_name_as_gcs_key(self, monkeypatch):
        """delete_repo — flat 레포: deprovision_repo(bare_name, gcs_key='{repo}')."""
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

    def test_lfs_batch_uses_repo_obj_bucket_name(self, monkeypatch):
        """lfs_objects_batch — repo_obj.bucket_name 우선 사용."""
        from app.routers.files import lfs_objects_batch
        from app.schemas.files import LfsBatchRequest, LfsBatchObject

        expected_bucket = f"{PREFIX}-{GROUP}-{REPO}"
        repo_obj = self._make_repo_obj(bucket_name=expected_bucket)

        def fake_check_access(db, user, repo, min_role):
            return repo_obj

        monkeypatch.setattr("app.routers.files.check_access", fake_check_access)
        _patch_audit(monkeypatch)
        monkeypatch.setattr(
            "app.services.cab.generate_repo_upload_token",
            lambda repo: ("tok", "2099-01-01T00:00:00Z"),
        )

        from app.routers import files as files_mod
        cas_checked: list[str] = []
        monkeypatch.setattr(
            files_mod._gcs, "object_exists",
            lambda addr: cas_checked.append(addr) or False,
        )
        monkeypatch.setattr(
            files_mod._gcs, "generate_signed_url",
            lambda addr, method="GET": "https://signed.url/fake",
        )

        req = MagicMock()
        req.client.host = "127.0.0.1"
        body = LfsBatchRequest(branch="main", objects=[LfsBatchObject(oid="a" * 64, size=1)])
        lfs_objects_batch(f"{GROUP}/{REPO}", body, req, _mock_user(), MagicMock())

        # CAS path should use the group-scoped bucket
        assert len(cas_checked) == 1
        assert cas_checked[0].startswith(f"gs://{expected_bucket}/")
