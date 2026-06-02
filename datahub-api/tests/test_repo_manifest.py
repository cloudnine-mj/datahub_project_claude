"""`_manifest.json` write/read + create 흐름 (governance §architecture/storage-transfer)."""

import json
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest

from app.services.repo_manifest import (
    HASH_VERSION,
    MANIFEST_PATH,
    SCHEMA_VERSION,
    build_manifest,
    read_manifest,
    write_create_manifest,
    write_manifest,
)


FIXED_TS = datetime(2026, 5, 19, 12, 34, 56, tzinfo=timezone.utc)


class TestBuildManifest:
    def test_includes_all_required_fields(self):
        m = build_manifest(
            repo_uuid="01928f7c-1234-7abc-89de-fedcba012345",
            group_uuid="01928f6b-1111-7abc-89de-fedcba000001",
            repo_full_name="lab-foo/ner-v4",
            group_slug="lab-foo",
            repo_name="ner-v4",
            repo_type="A",
            created_at=FIXED_TS,
            members=[{"user_id": 1, "email": "a@x", "role": "owner"}],
        )
        assert m["schema_version"] == SCHEMA_VERSION
        assert m["hash_version"] == HASH_VERSION
        assert m["repo_id"] == "01928f7c-1234-7abc-89de-fedcba012345"
        assert m["group_id"] == "01928f6b-1111-7abc-89de-fedcba000001"
        assert m["repo_full_name"] == "lab-foo/ner-v4"
        assert m["repo_name"] == "ner-v4"
        assert m["group_slug"] == "lab-foo"
        assert m["repo_type"] == "A"
        assert m["created_at"] == "2026-05-19T12:34:56Z"
        assert m["members"] == [{"user_id": 1, "email": "a@x", "role": "owner"}]
        assert "last_updated_at" in m

    def test_iso_appends_z_suffix(self):
        m = build_manifest(
            repo_uuid="u", group_uuid=None, repo_full_name="g/r",
            group_slug="g", repo_name="r", repo_type=None,
            created_at=FIXED_TS,
        )
        assert m["created_at"].endswith("Z")
        assert m["last_updated_at"].endswith("Z")


class TestWriteManifest:
    def test_writes_json_to_bucket_root(self):
        gcs = MagicMock()
        m = build_manifest(
            repo_uuid="u", group_uuid=None, repo_full_name="g/r",
            group_slug="g", repo_name="r", repo_type=None,
            created_at=FIXED_TS,
        )
        write_manifest(gcs, "my-bucket", m)
        gcs.write_text_object.assert_called_once()
        args, kwargs = gcs.write_text_object.call_args
        assert args[0] == "my-bucket"
        assert args[1] == MANIFEST_PATH
        assert kwargs.get("content_type") == "application/json"
        # 본문이 valid JSON 이고 schema_version 포함
        body = args[2]
        parsed = json.loads(body)
        assert parsed["schema_version"] == SCHEMA_VERSION


class TestWriteCreateManifest:
    def test_silent_on_gcs_failure(self, caplog):
        """create 시 manifest write 실패해도 raise 하지 않음 (truth=DB)."""
        gcs = MagicMock()
        gcs.write_text_object.side_effect = RuntimeError("boom")
        # 예외 raise 안 됨
        write_create_manifest(
            gcs,
            bucket_name="b",
            repo_uuid="u",
            group_uuid=None,
            repo_full_name="g/r",
            group_slug="g",
            repo_name="r",
            repo_type=None,
            created_at=FIXED_TS,
        )
        # error log 는 남음
        assert any("manifest.create_write_fail" in r.getMessage() for r in caplog.records)


class TestReadManifest:
    def test_returns_parsed_dict_on_success(self):
        gcs = MagicMock()
        manifest_text = '{"schema_version": 1, "repo_id": "u"}'
        gcs.read_text_object.return_value = (manifest_text, len(manifest_text), False)
        result = read_manifest(gcs, "b")
        assert result == {"schema_version": 1, "repo_id": "u"}

    def test_returns_none_on_read_error(self):
        gcs = MagicMock()
        gcs.read_text_object.side_effect = RuntimeError("404")
        assert read_manifest(gcs, "b") is None

    def test_returns_none_on_parse_error(self):
        gcs = MagicMock()
        gcs.read_text_object.return_value = ("not-json-{{", 11, False)
        assert read_manifest(gcs, "b") is None
