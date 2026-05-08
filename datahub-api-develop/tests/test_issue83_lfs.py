"""Issue #83 — LFS batch + commits 엔드포인트 유닛 테스트.

엔드포인트 함수 직접 호출 + monkeypatch 패턴 (test_issue84_auth.py 준수).
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

import app.services.audit as audit_module


# ── 공통 픽스처 ──────────────────────────────────────────────────

REPO = "my-repo"
BUCKET = "datahub-test-my-repo"
HASH1 = "aa" + "b" * 62
HASH2 = "cc" + "d" * 62
FAKE_TOKEN = "fake-cab-token-xyz"
FAKE_EXPIRY = "2026-04-22T21:00:00Z"
FAKE_SIGNED_URL = "https://storage.googleapis.com/signed?X-Goog-Sig=xxx"


def _mock_user():
    u = MagicMock()
    u.id = 1
    u.email = "tester@lgresearch.ai"
    return u


def _mock_db():
    return MagicMock()


def _mock_request():
    r = MagicMock()
    r.client.host = "127.0.0.1"
    return r


def _patch_common(monkeypatch, *, exists_map: dict[str, bool] | None = None):
    """공통 의존성 패치 (check_access, audit, cab token)."""
    from app.routers import files as files_mod

    def _fake_check_access(db, user, repo, min_role):
        r = MagicMock()
        r.repo_name = repo.split("/")[-1] if "/" in repo else repo
        r.bucket_name = None  # ensure fallback formula is used
        return r
    monkeypatch.setattr("app.routers.files.check_access", _fake_check_access)
    monkeypatch.setattr(
        audit_module.AuditService, "log", lambda self, *a, **kw: None
    )
    monkeypatch.setattr(
        "app.services.cab.generate_repo_upload_token",
        lambda repo: (FAKE_TOKEN, FAKE_EXPIRY),
    )
    if exists_map is not None:
        monkeypatch.setattr(
            files_mod._gcs, "object_exists",
            lambda addr: exists_map.get(addr, False),
        )


# ── POST /repos/{repo}/lfs/objects/batch ─────────────────────────

class TestLfsBatch:
    def test_cas_miss_returns_signed_url(self, monkeypatch):
        from app.routers.files import lfs_objects_batch
        from app.schemas.files import LfsBatchRequest, LfsBatchObject

        cas_path = f"gs://{BUCKET}/_cas/{HASH1[:2]}/{HASH1}"
        _patch_common(monkeypatch, exists_map={cas_path: False})

        from app.routers import files as files_mod
        monkeypatch.setattr(
            files_mod._gcs, "generate_signed_url",
            lambda addr, method="GET": FAKE_SIGNED_URL,
        )
        monkeypatch.setattr("app.routers.files.settings", SimpleNamespace(gcp_bucket_prefix="datahub-test"))

        body = LfsBatchRequest(branch="main", objects=[LfsBatchObject(oid=HASH1, size=1024)])
        resp = lfs_objects_batch(REPO, body, _mock_request(), _mock_user(), _mock_db())

        assert len(resp.objects) == 1
        obj = resp.objects[0]
        assert obj.oid == HASH1
        assert len(obj.actions) == 1
        assert obj.actions[0].href == FAKE_SIGNED_URL
        assert resp.cab_token == FAKE_TOKEN

    def test_cas_hit_returns_empty_actions(self, monkeypatch):
        from app.routers.files import lfs_objects_batch
        from app.schemas.files import LfsBatchRequest, LfsBatchObject

        cas_path = f"gs://{BUCKET}/_cas/{HASH1[:2]}/{HASH1}"
        _patch_common(monkeypatch, exists_map={cas_path: True})
        monkeypatch.setattr("app.routers.files.settings", SimpleNamespace(gcp_bucket_prefix="datahub-test"))

        body = LfsBatchRequest(branch="main", objects=[LfsBatchObject(oid=HASH1, size=512)])
        resp = lfs_objects_batch(REPO, body, _mock_request(), _mock_user(), _mock_db())

        obj = resp.objects[0]
        assert obj.actions == []  # CAS hit — upload not required

    def test_mixed_objects_cas_hit_and_miss(self, monkeypatch):
        from app.routers.files import lfs_objects_batch
        from app.schemas.files import LfsBatchRequest, LfsBatchObject

        path1 = f"gs://{BUCKET}/_cas/{HASH1[:2]}/{HASH1}"
        path2 = f"gs://{BUCKET}/_cas/{HASH2[:2]}/{HASH2}"
        _patch_common(monkeypatch, exists_map={path1: True, path2: False})

        from app.routers import files as files_mod
        monkeypatch.setattr(
            files_mod._gcs, "generate_signed_url",
            lambda addr, method="GET": FAKE_SIGNED_URL,
        )
        monkeypatch.setattr("app.routers.files.settings", SimpleNamespace(gcp_bucket_prefix="datahub-test"))

        body = LfsBatchRequest(branch="main", objects=[
            LfsBatchObject(oid=HASH1, size=100),
            LfsBatchObject(oid=HASH2, size=200),
        ])
        resp = lfs_objects_batch(REPO, body, _mock_request(), _mock_user(), _mock_db())

        assert len(resp.objects) == 2
        hit = next(o for o in resp.objects if o.oid == HASH1)
        miss = next(o for o in resp.objects if o.oid == HASH2)
        assert hit.actions == []
        assert len(miss.actions) == 1

    def test_cab_token_and_bucket_in_response(self, monkeypatch):
        from app.routers.files import lfs_objects_batch
        from app.schemas.files import LfsBatchRequest, LfsBatchObject

        _patch_common(monkeypatch, exists_map={})
        from app.routers import files as files_mod
        monkeypatch.setattr(files_mod._gcs, "generate_signed_url", lambda addr, method="GET": FAKE_SIGNED_URL)
        monkeypatch.setattr("app.routers.files.settings", SimpleNamespace(gcp_bucket_prefix="datahub-test"))

        body = LfsBatchRequest(branch="main", objects=[LfsBatchObject(oid=HASH1, size=1)])
        resp = lfs_objects_batch(REPO, body, _mock_request(), _mock_user(), _mock_db())

        assert resp.cab_token == FAKE_TOKEN
        assert resp.bucket == BUCKET
        assert resp.token_expiry == FAKE_EXPIRY

    def test_audit_log_called(self, monkeypatch):
        from app.routers.files import lfs_objects_batch
        from app.schemas.files import LfsBatchRequest, LfsBatchObject

        _patch_common(monkeypatch, exists_map={})
        from app.routers import files as files_mod
        monkeypatch.setattr(files_mod._gcs, "generate_signed_url", lambda addr, method="GET": FAKE_SIGNED_URL)
        monkeypatch.setattr("app.routers.files.settings", SimpleNamespace(gcp_bucket_prefix="datahub-test"))

        audit_calls = []
        monkeypatch.setattr(audit_module.AuditService, "log", lambda self, *a, **kw: audit_calls.append(kw))

        body = LfsBatchRequest(branch="main", objects=[LfsBatchObject(oid=HASH1, size=10)])
        lfs_objects_batch(REPO, body, _mock_request(), _mock_user(), _mock_db())

        assert len(audit_calls) == 1
        assert audit_calls[0]["action"] == "lfs_batch"


# ── POST /repos/{repo}/lfs/commits ───────────────────────────────

class TestLfsCommit:
    def _fake_link(self, repo_name, branch, path, staging, size_bytes, checksum):
        pass  # no-op

    def _fake_commit(self, repo_name, branch_name, message, user_email=None):
        return SimpleNamespace(id="commit-abc123", message=message, committer="")

    def _patch_staging(self, monkeypatch):
        from app.routers import files as files_mod
        monkeypatch.setattr(files_mod._lakefs, "link_physical_address", self._fake_link)
        monkeypatch.setattr(files_mod._lakefs, "commit", self._fake_commit)

    def test_commit_calls_link_with_cas_paths(self, monkeypatch):
        from app.routers.files import lfs_commit
        from app.schemas.files import LfsCommitRequest, LfsCommitObject
        from app.services.lakefs import StagingLocation

        _patch_common(monkeypatch)
        monkeypatch.setattr("app.routers.files.settings", SimpleNamespace(gcp_bucket_prefix="datahub-test"))

        linked = []
        from app.routers import files as files_mod
        def fake_link(repo_name, branch, path, staging, size_bytes, checksum):
            linked.append({"path": path, "physical": staging.physical_address,
                           "size": size_bytes, "checksum": checksum})
        committed = {}
        def fake_commit(repo_name, branch_name, message, user_email=None):
            committed["message"] = message
            return SimpleNamespace(id="commit-abc123", message=message, committer="")
        monkeypatch.setattr(files_mod._lakefs, "link_physical_address", fake_link)
        monkeypatch.setattr(files_mod._lakefs, "commit", fake_commit)

        body = LfsCommitRequest(
            branch="main",
            message="my commit",
            objects=[LfsCommitObject(path="data/file.bin", oid=HASH1, size=1024)],
        )
        resp = lfs_commit(REPO, body, _mock_request(), _mock_user(), _mock_db())

        assert resp.commit_id == "commit-abc123"
        assert len(linked) == 1
        expected_physical = f"gs://{BUCKET}/_cas/{HASH1[:2]}/{HASH1}"
        assert linked[0]["physical"] == expected_physical
        assert linked[0]["path"] == "data/file.bin"
        assert linked[0]["size"] == 1024
        assert linked[0]["checksum"] == HASH1
        assert committed["message"] == "my commit"

    def test_commit_returns_commit_id(self, monkeypatch):
        from app.routers.files import lfs_commit
        from app.schemas.files import LfsCommitRequest, LfsCommitObject

        _patch_common(monkeypatch)
        monkeypatch.setattr("app.routers.files.settings", SimpleNamespace(gcp_bucket_prefix="datahub-test"))
        self._patch_staging(monkeypatch)

        body = LfsCommitRequest(branch="develop", message="", objects=[
            LfsCommitObject(path="a/b.csv", oid=HASH2, size=50),
        ])
        resp = lfs_commit(REPO, body, _mock_request(), _mock_user(), _mock_db())
        assert resp.commit_id == "commit-abc123"

    def test_empty_objects_raises_400(self, monkeypatch):
        from fastapi import HTTPException
        from app.routers.files import lfs_commit
        from app.schemas.files import LfsCommitRequest

        _patch_common(monkeypatch)
        monkeypatch.setattr("app.routers.files.settings", SimpleNamespace(gcp_bucket_prefix="datahub-test"))

        body = LfsCommitRequest(branch="main", message="", objects=[])
        with pytest.raises(HTTPException) as exc_info:
            lfs_commit(REPO, body, _mock_request(), _mock_user(), _mock_db())
        assert exc_info.value.status_code == 400

    def test_default_commit_message_used_when_empty(self, monkeypatch):
        from app.routers.files import lfs_commit
        from app.schemas.files import LfsCommitRequest, LfsCommitObject

        _patch_common(monkeypatch)
        monkeypatch.setattr("app.routers.files.settings", SimpleNamespace(gcp_bucket_prefix="datahub-test"))

        committed = {}
        from app.routers import files as files_mod
        monkeypatch.setattr(files_mod._lakefs, "link_physical_address", self._fake_link)
        def fake_commit(repo_name, branch_name, message, user_email=None):
            committed["message"] = message
            return SimpleNamespace(id="xyz", message=message, committer="")
        monkeypatch.setattr(files_mod._lakefs, "commit", fake_commit)

        body = LfsCommitRequest(branch="main", message="", objects=[
            LfsCommitObject(path="f.bin", oid=HASH1, size=1),
        ])
        lfs_commit(REPO, body, _mock_request(), _mock_user(), _mock_db())
        assert committed["message"] == "Upload via DataHub LFS"

    def test_audit_log_called_on_commit(self, monkeypatch):
        from app.routers.files import lfs_commit
        from app.schemas.files import LfsCommitRequest, LfsCommitObject

        _patch_common(monkeypatch)
        monkeypatch.setattr("app.routers.files.settings", SimpleNamespace(gcp_bucket_prefix="datahub-test"))
        self._patch_staging(monkeypatch)

        audit_calls = []
        monkeypatch.setattr(audit_module.AuditService, "log", lambda self, *a, **kw: audit_calls.append(kw))

        body = LfsCommitRequest(branch="main", message="test", objects=[
            LfsCommitObject(path="x.bin", oid=HASH1, size=10),
        ])
        lfs_commit(REPO, body, _mock_request(), _mock_user(), _mock_db())

        assert len(audit_calls) == 1
        assert audit_calls[0]["action"] == "lfs_commit"
        assert audit_calls[0]["details"]["commit_id"] == "commit-abc123"

    def test_multiple_objects_all_linked(self, monkeypatch):
        from app.routers.files import lfs_commit
        from app.schemas.files import LfsCommitRequest, LfsCommitObject

        _patch_common(monkeypatch)
        monkeypatch.setattr("app.routers.files.settings", SimpleNamespace(gcp_bucket_prefix="datahub-test"))

        linked = []
        from app.routers import files as files_mod
        def fake_link(repo_name, branch, path, staging, size_bytes, checksum):
            linked.append(path)
        monkeypatch.setattr(files_mod._lakefs, "link_physical_address", fake_link)
        monkeypatch.setattr(files_mod._lakefs, "commit",
            lambda *a, **kw: SimpleNamespace(id="multi-commit", message="", committer=""))

        body = LfsCommitRequest(branch="main", message="batch", objects=[
            LfsCommitObject(path="a.bin", oid=HASH1, size=100),
            LfsCommitObject(path="b.bin", oid=HASH2, size=200),
        ])
        resp = lfs_commit(REPO, body, _mock_request(), _mock_user(), _mock_db())

        assert resp.commit_id == "multi-commit"
        assert len(linked) == 2
        assert "a.bin" in linked
        assert "b.bin" in linked
