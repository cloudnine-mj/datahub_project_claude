"""Tests for datahub-api#58.

Covers:
  - Group-scoped alias routes (Type A/B/General)
  - /commits with fastcdc chunks[] payload
  - copy/stream 3-stage (open / page / commit)
  - _enrich_with_chunks DB lookup
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, call, patch

import pytest

import app.services.audit as audit_module


# ── helpers ───────────────────────────────────────────────────────────────────

GROUP = "nlp-lab"
REPO_NAME = "my-ds"
FLAT_REPO = "my-repo"
GROUP_REPO = f"{GROUP}/{REPO_NAME}"
BUCKET_FLAT = "datahub-test-my-repo"
BUCKET_GROUP = f"datahub-test-{GROUP_REPO}"

HASH1 = "aa" + "b" * 62
HASH2 = "cc" + "d" * 62
FAKE_TOKEN = "fake-cab-xyz"
FAKE_EXPIRY = "2026-04-22T21:00:00Z"
FAKE_URL = "https://storage.googleapis.com/signed"


def _mock_user(id=1, email="tester@lgresearch.ai"):
    u = MagicMock()
    u.id = id
    u.email = email
    return u


def _mock_request():
    r = MagicMock()
    r.client.host = "127.0.0.1"
    return r


def _fake_settings():
    return SimpleNamespace(
        gcp_bucket_prefix="datahub-test",
        lakefs_download_resolve_max_workers=4,
    )


def _patch_common(monkeypatch):
    """Patch check_access, audit, CAB tokens, settings."""
    def _fake_check_access(db, user, repo, min_role):
        r = MagicMock()
        r.repo_name = repo.split("/")[-1] if "/" in repo else repo
        r.bucket_name = None  # prevent MagicMock truthy from shadowing fallback formula
        return r
    monkeypatch.setattr("app.routers.files.check_access", _fake_check_access)
    monkeypatch.setattr(audit_module.AuditService, "log", lambda self, *a, **kw: None)
    monkeypatch.setattr(
        "app.services.cab.generate_repo_upload_token",
        lambda repo: (FAKE_TOKEN, FAKE_EXPIRY),
    )
    monkeypatch.setattr(
        "app.services.cab.generate_repo_download_token",
        lambda repo: (FAKE_TOKEN, FAKE_EXPIRY),
    )
    monkeypatch.setattr("app.routers.files.settings", _fake_settings())
    monkeypatch.setattr("app.routers.files.pg_insert", MagicMock(return_value=MagicMock()))


def _patch_lakefs_staging(monkeypatch, commit_id="commit-xyz"):
    from app.routers import files as files_mod
    linked: list[dict] = []

    def _link(repo_name, branch, path, staging, size_bytes, checksum):
        linked.append({"path": path, "phys": staging.physical_address})

    monkeypatch.setattr(files_mod._lakefs, "link_physical_address", _link)
    monkeypatch.setattr(
        files_mod._lakefs, "commit",
        lambda repo_name, branch_name, message, user_email=None: SimpleNamespace(id=commit_id),
    )
    return linked


# ══════════════════════════════════════════════════════════════════════════════
# Group-scoped aliases
# ══════════════════════════════════════════════════════════════════════════════

class TestGroupAliases:
    """Verify group-scoped routes delegate with composite repo key."""

    def test_lfs_batch_group_builds_composite_repo(self, monkeypatch):
        from app.routers.files import lfs_objects_batch_group
        from app.schemas.files import LfsBatchRequest, LfsBatchObject

        _patch_common(monkeypatch)
        from app.routers import files as files_mod
        monkeypatch.setattr(files_mod._gcs, "object_exists", lambda addr: False)
        monkeypatch.setattr(files_mod._gcs, "generate_signed_url", lambda addr, method="GET": FAKE_URL)

        body = LfsBatchRequest(branch="main", objects=[LfsBatchObject(oid=HASH1, size=100)])
        resp = lfs_objects_batch_group(GROUP, REPO_NAME, body, _mock_request(), _mock_user(), MagicMock())

        # Bucket should use bare repo name (group is stripped for LakeFS/GCS operations)
        assert resp.bucket == f"datahub-test-{REPO_NAME}"

    def test_token_group_post_returns_token(self, monkeypatch):
        from app.routers.files import get_upload_token_group

        _patch_common(monkeypatch)
        resp = get_upload_token_group(GROUP, REPO_NAME, _mock_request(), _mock_user(), MagicMock())
        assert resp.cab_token == FAKE_TOKEN

    def test_token_group_get_returns_token(self, monkeypatch):
        from app.routers.files import get_download_token_group

        _patch_common(monkeypatch)
        resp = get_download_token_group(GROUP, REPO_NAME, _mock_request(), _mock_user(), MagicMock())
        assert resp.cab_token == FAKE_TOKEN

    def test_commits_group_delegates_correctly(self, monkeypatch):
        from app.routers.files import lfs_commit_group
        from app.schemas.files import LfsCommitRequest, LfsCommitObject

        _patch_common(monkeypatch)
        linked = _patch_lakefs_staging(monkeypatch)

        body = LfsCommitRequest(
            branch="main",
            message="x",
            objects=[LfsCommitObject(path="file.bin", oid=HASH1, size=128)],
        )
        db = MagicMock()
        resp = lfs_commit_group(GROUP, REPO_NAME, body, _mock_request(), _mock_user(), db)

        assert resp.commit_id == "commit-xyz"
        assert linked[0]["path"] == "file.bin"


# ══════════════════════════════════════════════════════════════════════════════
# /commits — fastcdc chunks[] support
# ══════════════════════════════════════════════════════════════════════════════

class TestLfsCommitChunks:

    def test_chunks_format_links_first_chunk_as_physical(self, monkeypatch):
        from app.routers.files import lfs_commit
        from app.schemas.files import LfsCommitRequest, LfsCommitObject, LfsCommitChunk

        _patch_common(monkeypatch)
        linked = _patch_lakefs_staging(monkeypatch)

        body = LfsCommitRequest(
            branch="main",
            message="chunked",
            objects=[
                LfsCommitObject(
                    path="data/big.bin",
                    chunks=[
                        LfsCommitChunk(oid=HASH1, size=1024 * 1024, offset=0),
                        LfsCommitChunk(oid=HASH2, size=512 * 1024, offset=1024 * 1024),
                    ],
                )
            ],
        )
        db = MagicMock()
        resp = lfs_commit(FLAT_REPO, body, _mock_request(), _mock_user(), db)

        assert resp.commit_id == "commit-xyz"
        # Physical address must be the first chunk (lowest offset)
        assert HASH1[:2] in linked[0]["phys"]
        assert HASH1 in linked[0]["phys"]

    def test_chunks_format_adds_manifest_to_db(self, monkeypatch):
        from app.routers.files import lfs_commit
        from app.schemas.files import LfsCommitRequest, LfsCommitObject, LfsCommitChunk

        _patch_common(monkeypatch)
        _patch_lakefs_staging(monkeypatch)

        body = LfsCommitRequest(
            branch="main",
            message="m",
            objects=[
                LfsCommitObject(
                    path="train.jsonl",
                    chunks=[LfsCommitChunk(oid=HASH1, size=256, offset=0)],
                )
            ],
        )
        db = MagicMock()
        lfs_commit(FLAT_REPO, body, _mock_request(), _mock_user(), db)

        # db.add must have been called at least twice (Manifest + ManifestChunk)
        assert db.add.call_count >= 2

    def test_legacy_single_oid_still_works(self, monkeypatch):
        from app.routers.files import lfs_commit
        from app.schemas.files import LfsCommitRequest, LfsCommitObject

        _patch_common(monkeypatch)
        linked = _patch_lakefs_staging(monkeypatch)

        body = LfsCommitRequest(
            branch="main",
            message="legacy",
            objects=[LfsCommitObject(path="old.bin", oid=HASH1, size=512)],
        )
        resp = lfs_commit(FLAT_REPO, body, _mock_request(), _mock_user(), MagicMock())

        assert resp.commit_id == "commit-xyz"
        assert HASH1 in linked[0]["phys"]

    def test_missing_oid_and_chunks_raises_400(self, monkeypatch):
        from fastapi import HTTPException
        from app.routers.files import lfs_commit
        from app.schemas.files import LfsCommitRequest, LfsCommitObject

        _patch_common(monkeypatch)
        _patch_lakefs_staging(monkeypatch)

        body = LfsCommitRequest(
            branch="main",
            message="bad",
            objects=[LfsCommitObject(path="bad.bin")],  # no oid, no chunks
        )
        with pytest.raises(HTTPException) as exc_info:
            lfs_commit(FLAT_REPO, body, _mock_request(), _mock_user(), MagicMock())
        assert exc_info.value.status_code == 400

    def test_empty_objects_raises_400(self, monkeypatch):
        from fastapi import HTTPException
        from app.routers.files import lfs_commit
        from app.schemas.files import LfsCommitRequest

        _patch_common(monkeypatch)
        body = LfsCommitRequest(branch="main", message="empty", objects=[])
        with pytest.raises(HTTPException) as exc_info:
            lfs_commit(FLAT_REPO, body, _mock_request(), _mock_user(), MagicMock())
        assert exc_info.value.status_code == 400

    def test_total_size_is_sum_of_chunks(self, monkeypatch):
        """LakeFS link receives total size = sum of all chunk sizes."""
        from app.routers.files import lfs_commit
        from app.schemas.files import LfsCommitRequest, LfsCommitObject, LfsCommitChunk

        _patch_common(monkeypatch)
        linked_args: list[dict] = []

        from app.routers import files as files_mod
        def _link(repo_name, branch, path, staging, size_bytes, checksum):
            linked_args.append({"size_bytes": size_bytes})

        monkeypatch.setattr(files_mod._lakefs, "link_physical_address", _link)
        monkeypatch.setattr(
            files_mod._lakefs, "commit",
            lambda **kw: SimpleNamespace(id="c"),
        )

        body = LfsCommitRequest(
            branch="main",
            message="sz",
            objects=[
                LfsCommitObject(
                    path="f.bin",
                    chunks=[
                        LfsCommitChunk(oid=HASH1, size=300_000, offset=0),
                        LfsCommitChunk(oid=HASH2, size=500_000, offset=300_000),
                    ],
                )
            ],
        )
        lfs_commit(FLAT_REPO, body, _mock_request(), _mock_user(), MagicMock())
        assert linked_args[0]["size_bytes"] == 800_000


# ══════════════════════════════════════════════════════════════════════════════
# copy/stream — open / page / commit
# ══════════════════════════════════════════════════════════════════════════════

def _make_fake_session(
    *,
    session_id="sess-abc",
    src_repo="src-group/src-ds",
    src_branch="main",
    dest_repo=GROUP_REPO,
    dest_branch="main",
    commit_message="copy test",
    user_id=1,
    status="active",
    files_count=0,
):
    return SimpleNamespace(
        id=session_id,
        src_repo=src_repo,
        src_branch=src_branch,
        dest_repo=dest_repo,
        dest_branch=dest_branch,
        commit_message=commit_message,
        user_id=user_id,
        status=status,
        files_count=files_count,
    )


def _make_fake_manifest(
    *,
    manifest_id="man-1",
    repo_name="src-group/src-ds",
    branch="main",
    file_path="data/file.bin",
    total_size=1024,
    chunk_oid=HASH1,
    chunk_size=1024,
    chunk_offset=0,
):
    mc = SimpleNamespace(
        chunk_oid=chunk_oid,
        offset=chunk_offset,
        physical_address=f"gs://src-bucket/_cas/{chunk_oid[:2]}/{chunk_oid}",
        chunk=SimpleNamespace(oid=chunk_oid, size=chunk_size),
    )
    return SimpleNamespace(
        id=manifest_id,
        repo_name=repo_name,
        branch=branch,
        file_path=file_path,
        total_size=total_size,
        manifest_chunks=[mc],
    )


class TestCopyStreamOpen:
    def test_creates_session_and_returns_id(self, monkeypatch):
        from app.routers.files import copy_stream_open
        from app.schemas.files import CopyStreamOpenRequest

        _patch_common(monkeypatch)
        db = MagicMock()

        body = CopyStreamOpenRequest(
            src_repo="src-group/src-ds",
            src_branch="main",
            dest_branch="main",
        )
        resp = copy_stream_open(GROUP, REPO_NAME, body, _mock_request(), _mock_user(), db)

        assert resp.session_id  # non-empty UUID
        assert resp.expires_at is not None
        db.add.assert_called_once()
        db.commit.assert_called_once()

    def test_session_id_is_valid_uuid(self, monkeypatch):
        import uuid
        from app.routers.files import copy_stream_open
        from app.schemas.files import CopyStreamOpenRequest

        _patch_common(monkeypatch)
        body = CopyStreamOpenRequest(src_repo="src/repo", src_branch="main", dest_branch="develop")
        resp = copy_stream_open(GROUP, REPO_NAME, body, _mock_request(), _mock_user(), MagicMock())
        uuid.UUID(resp.session_id)  # raises ValueError if not valid UUID


class TestCopyStreamPage:
    def _make_db(self, session, manifest_map: dict[str, object]):
        """Mock DB that returns specific session and manifests per path."""
        from app.models import CopySession, Manifest

        db = MagicMock()

        def _query(model):
            q = MagicMock()
            if model is CopySession:
                q.filter.return_value.first.return_value = session
            elif model is Manifest:
                inner = MagicMock()

                def _filter_side_effect(*args, **kwargs):
                    # Last filter's .order_by().first() returns manifest for matching path
                    inner2 = MagicMock()
                    inner2.order_by.return_value = inner2
                    inner2.first.return_value = None  # default
                    return inner2

                q.filter.side_effect = _filter_side_effect
            return q

        db.query.side_effect = _query
        return db

    def test_missing_session_raises_404(self, monkeypatch):
        from fastapi import HTTPException
        from app.routers.files import copy_stream_page
        from app.schemas.files import CopyStreamPageRequest

        _patch_common(monkeypatch)
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None

        body = CopyStreamPageRequest(session_id="no-such-session", paths=["f.bin"])
        with pytest.raises(HTTPException) as exc:
            copy_stream_page(GROUP, REPO_NAME, body, _mock_request(), _mock_user(), db)
        assert exc.value.status_code == 404

    def test_paths_without_manifest_are_skipped(self, monkeypatch):
        from app.routers.files import copy_stream_page
        from app.schemas.files import CopyStreamPageRequest
        from app.models import CopySession, Manifest

        _patch_common(monkeypatch)
        session = _make_fake_session()

        db = MagicMock()
        call_count = [0]

        def _query(model):
            q = MagicMock()
            if model is CopySession:
                q.filter.return_value.first.return_value = session
            elif model is Manifest:
                # All manifests return None (not found)
                q.filter.return_value.is_.return_value = q
                q.filter.return_value.order_by.return_value.first.return_value = None
                q.filter.return_value.filter.return_value.order_by.return_value.first.return_value = None
            return q

        db.query.side_effect = _query

        body = CopyStreamPageRequest(session_id=session.id, paths=["missing.bin"])
        resp = copy_stream_page(GROUP, REPO_NAME, body, _mock_request(), _mock_user(), db)

        assert resp.files_accepted == 0
        assert resp.files_skipped == 1

    def test_db_rollback_on_commit_failure(self, monkeypatch):
        from fastapi import HTTPException
        from app.routers.files import copy_stream_page
        from app.schemas.files import CopyStreamPageRequest
        from app.models import CopySession, Manifest

        _patch_common(monkeypatch)
        session = _make_fake_session()
        manifest = _make_fake_manifest()

        db = MagicMock()

        def _query(model):
            q = MagicMock()
            if model is CopySession:
                q.filter.return_value.first.return_value = session
            elif model is Manifest:
                q.filter.return_value.is_.return_value = q
                q.filter.return_value.filter.return_value.order_by.return_value.first.return_value = manifest
            return q

        db.query.side_effect = _query
        db.commit.side_effect = Exception("DB down")

        body = CopyStreamPageRequest(session_id=session.id, paths=["data/file.bin"])
        with pytest.raises(HTTPException) as exc:
            copy_stream_page(GROUP, REPO_NAME, body, _mock_request(), _mock_user(), db)

        assert exc.value.status_code == 500
        db.rollback.assert_called_once()


class TestCopyStreamCommit:
    def _db_with_session_and_manifests(self, session, manifests):
        from app.models import CopySession, Manifest

        db = MagicMock()

        def _query(model):
            q = MagicMock()
            if model is CopySession:
                q.filter.return_value.first.return_value = session
            elif model is Manifest:
                q.filter.return_value.all.return_value = manifests
            return q

        db.query.side_effect = _query
        return db

    def test_commit_links_and_commits_all_manifests(self, monkeypatch):
        from app.routers.files import copy_stream_commit
        from app.schemas.files import CopyStreamCommitRequest

        _patch_common(monkeypatch)
        linked = _patch_lakefs_staging(monkeypatch, commit_id="copy-commit-1")

        session = _make_fake_session()
        manifests = [
            _make_fake_manifest(file_path="a.bin", chunk_oid=HASH1),
            _make_fake_manifest(manifest_id="man-2", file_path="b.bin", chunk_oid=HASH2),
        ]
        db = self._db_with_session_and_manifests(session, manifests)

        body = CopyStreamCommitRequest(session_id=session.id)
        resp = copy_stream_commit(GROUP, REPO_NAME, body, _mock_request(), _mock_user(), db)

        assert resp.commit_id == "copy-commit-1"
        assert resp.files_committed == 2
        assert {l["path"] for l in linked} == {"a.bin", "b.bin"}

    def test_empty_manifests_raises_400(self, monkeypatch):
        from fastapi import HTTPException
        from app.routers.files import copy_stream_commit
        from app.schemas.files import CopyStreamCommitRequest

        _patch_common(monkeypatch)
        _patch_lakefs_staging(monkeypatch)

        session = _make_fake_session()
        db = self._db_with_session_and_manifests(session, [])  # no files

        body = CopyStreamCommitRequest(session_id=session.id)
        with pytest.raises(HTTPException) as exc:
            copy_stream_commit(GROUP, REPO_NAME, body, _mock_request(), _mock_user(), db)
        assert exc.value.status_code == 400

    def test_missing_session_raises_404(self, monkeypatch):
        from fastapi import HTTPException
        from app.routers.files import copy_stream_commit
        from app.schemas.files import CopyStreamCommitRequest

        _patch_common(monkeypatch)
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None

        body = CopyStreamCommitRequest(session_id="not-exists")
        with pytest.raises(HTTPException) as exc:
            copy_stream_commit(GROUP, REPO_NAME, body, _mock_request(), _mock_user(), db)
        assert exc.value.status_code == 404

    def test_lakefs_failure_sets_session_failed(self, monkeypatch):
        from fastapi import HTTPException
        from app.routers.files import copy_stream_commit
        from app.schemas.files import CopyStreamCommitRequest

        _patch_common(monkeypatch)
        from app.routers import files as files_mod
        monkeypatch.setattr(
            files_mod._lakefs, "link_physical_address",
            lambda **kw: (_ for _ in ()).throw(RuntimeError("LakeFS down")),
        )
        reset_calls: list[str] = []
        monkeypatch.setattr(
            files_mod._lakefs, "reset_branch_object",
            lambda repo_name, branch, path: reset_calls.append(path),
        )

        session = _make_fake_session()
        manifests = [_make_fake_manifest()]
        db = self._db_with_session_and_manifests(session, manifests)

        body = CopyStreamCommitRequest(session_id=session.id)
        with pytest.raises(HTTPException) as exc:
            copy_stream_commit(GROUP, REPO_NAME, body, _mock_request(), _mock_user(), db)

        assert exc.value.status_code == 500
        assert session.status == "failed"

    def test_partial_link_failure_rolls_back_linked_paths(self, monkeypatch):
        """link 도중 실패 시 이미 link된 파일은 reset_branch_object 로 롤백된다."""
        from fastapi import HTTPException
        from app.routers.files import copy_stream_commit
        from app.schemas.files import CopyStreamCommitRequest

        _patch_common(monkeypatch)
        from app.routers import files as files_mod

        linked_calls: list[str] = []
        reset_calls: list[str] = []
        call_count = [0]

        def _link_side_effect(repo_name, branch, path, staging, size_bytes, checksum):
            call_count[0] += 1
            if call_count[0] == 1:
                linked_calls.append(path)   # 첫 번째는 성공
            else:
                raise RuntimeError("LakeFS link error on 2nd file")

        monkeypatch.setattr(files_mod._lakefs, "link_physical_address", _link_side_effect)
        monkeypatch.setattr(
            files_mod._lakefs, "reset_branch_object",
            lambda repo_name, branch, path: reset_calls.append(path),
        )

        session = _make_fake_session()
        manifests = [
            _make_fake_manifest(file_path="a.bin", chunk_oid=HASH1),
            _make_fake_manifest(manifest_id="man-2", file_path="b.bin", chunk_oid=HASH2),
        ]
        db = self._db_with_session_and_manifests(session, manifests)

        body = CopyStreamCommitRequest(session_id=session.id)
        with pytest.raises(HTTPException) as exc:
            copy_stream_commit(GROUP, REPO_NAME, body, _mock_request(), _mock_user(), db)

        assert exc.value.status_code == 500
        assert session.status == "failed"
        # 첫 번째 성공 파일(a.bin)이 롤백되어야 한다
        assert linked_calls == ["a.bin"]
        assert reset_calls == ["a.bin"]


# ══════════════════════════════════════════════════════════════════════════════
# _enrich_with_chunks
# ══════════════════════════════════════════════════════════════════════════════

class TestEnrichWithChunks:
    def test_manifest_found_returns_chunks(self, monkeypatch):
        from app.routers.files import _enrich_with_chunks
        from app.schemas.files import DownloadFileMapping
        from app.models import Manifest

        manifest = _make_fake_manifest(
            repo_name="my-repo", branch="main", file_path="data/f.bin",
            chunk_oid=HASH1, chunk_size=512, chunk_offset=0,
        )

        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.first.return_value = manifest

        files = [DownloadFileMapping(path="data/f.bin", physical_address="gs://old", size_bytes=512)]
        result = _enrich_with_chunks(db, "my-repo", "main", "datahub-test-my-repo", files)

        assert len(result) == 1
        assert result[0].chunks is not None
        assert len(result[0].chunks) == 1
        assert result[0].chunks[0].oid == HASH1

    def test_no_manifest_returns_original(self, monkeypatch):
        from app.routers.files import _enrich_with_chunks
        from app.schemas.files import DownloadFileMapping

        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None

        files = [DownloadFileMapping(path="old.bin", physical_address="gs://x", size_bytes=100)]
        result = _enrich_with_chunks(db, "my-repo", "main", "bucket", files)

        assert result[0].chunks is None
        assert result[0].physical_address == "gs://x"
