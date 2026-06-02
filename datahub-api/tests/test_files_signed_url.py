"""Signed URL 채널 디테일 + CAB 발급 실패 시 명시 500.

governance §file-transfer:
- Web BFF prepare_upload → signed_url + Content-Type signed_headers + TTL 5분
- Web BFF prepare_download → signed_url (GET) + TTL 5분
- CAB 발급 실패 → 500 (silent null 금지)
"""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.routers import files as files_mod
from app.schemas.files import DownloadTokenRequest, TransferInstruction, WriteTokenRequest


# ── Fixtures ─────────────────────────────────────────────


def _request(service_caller: str | None = None):
    state = SimpleNamespace(service_caller=service_caller)
    return SimpleNamespace(
        state=state,
        client=SimpleNamespace(host="127.0.0.1"),
        headers={},
    )


def _user():
    return SimpleNamespace(id=1, email="user@example.com")


def _repo():
    return SimpleNamespace(repo_name="repo", bucket_name="lgair-dgdh-dev-r-cafebabe")


@pytest.fixture(autouse=True)
def _patch_common(monkeypatch):
    monkeypatch.setattr(files_mod, "check_access", lambda *a, **kw: _repo())
    monkeypatch.setattr(files_mod, "require_capability", lambda *a, **kw: _repo())
    monkeypatch.setattr(files_mod.audit, "log", lambda *a, **kw: None)
    monkeypatch.setattr(
        files_mod,
        "run_idempotent",
        lambda request, **kwargs: kwargs["response_factory"](),
    )
    monkeypatch.setattr(
        files_mod._gcs,
        "list_objects",
        lambda *a, **kw: ([], False, None),
    )
    monkeypatch.setattr(
        files_mod._gcs,
        "get_object_metadata",
        lambda *a, **kw: {"exists": True, "size": 10, "metadata": {}},
    )


# ── TransferInstruction schema 검증 ──────────────────────


def test_transfer_instruction_storage_client_requires_token():
    """schema-level: storage-client 인데 token 없으면 ValueError."""
    with pytest.raises(ValueError, match="storage-client method requires token"):
        TransferInstruction(method="storage-client", bucket="b", gcp_project="p", object_path="o")


def test_transfer_instruction_storage_client_requires_gcp_project():
    """schema-level: storage-client 인데 gcp_project 없으면 ValueError."""
    with pytest.raises(ValueError, match="storage-client method requires gcp_project"):
        TransferInstruction(method="storage-client", bucket="b", token="t", object_path="p")


def test_transfer_instruction_storage_client_ok():
    """token + gcp_project 채워진 정상 storage-client 케이스."""
    t = TransferInstruction(
        method="storage-client",
        bucket="b",
        gcp_project="my-project",
        object_path="p",
        token="ya29.x",
    )
    assert t.gcp_project == "my-project"
    assert t.token == "ya29.x"


def test_transfer_instruction_signed_url_requires_url():
    """schema-level: signed-url 인데 signed_url 없으면 ValueError."""
    with pytest.raises(ValueError, match="signed-url method requires signed_url"):
        TransferInstruction(method="signed-url", bucket="b", object_path="p")


def test_transfer_instruction_signed_url_ok():
    """signed_url 채워진 정상 케이스. gcp_project 는 signed-url 에서 선택."""
    t = TransferInstruction(
        method="signed-url",
        bucket="b",
        object_path="p",
        signed_url="https://example/sig",
    )
    assert t.token is None
    assert t.signed_url == "https://example/sig"
    assert t.gcp_project is None


# ── prepare_upload signed URL 디테일 ─────────────────────


def test_upload_signed_url_includes_content_type_header(monkeypatch):
    """Web BFF upload → signed_headers 에 Content-Type 포함."""
    monkeypatch.setattr(
        files_mod._gcs,
        "generate_signed_url",
        lambda *a, **kw: "https://storage/sig",
    )

    req = _request(service_caller="datahub-web")
    res = files_mod.prepare_upload(
        "owner",
        "repo",
        WriteTokenRequest(path="data/file.bin", size=1024, content_type="image/png"),
        req,
        _user(),
        object(),
    )

    assert res.transfer.method == "signed-url"
    assert res.transfer.signed_headers == {"Content-Type": "image/png"}
    assert res.transfer.signed_url == "https://storage/sig"


def test_upload_signed_url_default_content_type(monkeypatch):
    """content_type 미지정 → application/octet-stream default."""
    captured = {}

    def _fake(physical_address, method="GET", expiry_minutes=None, content_type=None):
        captured["content_type"] = content_type
        return "https://storage/sig"

    monkeypatch.setattr(files_mod._gcs, "generate_signed_url", _fake)

    req = _request(service_caller="datahub-web")
    res = files_mod.prepare_upload(
        "owner",
        "repo",
        WriteTokenRequest(path="data/file.bin", size=1024),
        req,
        _user(),
        object(),
    )
    assert captured["content_type"] == "application/octet-stream"
    assert res.transfer.signed_headers == {"Content-Type": "application/octet-stream"}


def test_upload_signed_url_ttl_is_5_minutes(monkeypatch):
    """expires_at 이 약 5분 뒤를 가리키는지."""
    captured = {}

    def _fake(physical_address, method="GET", expiry_minutes=None, content_type=None):
        captured["expiry_minutes"] = expiry_minutes
        return "https://storage/sig"

    monkeypatch.setattr(files_mod._gcs, "generate_signed_url", _fake)

    req = _request(service_caller="datahub-web")
    before = datetime.now(timezone.utc).timestamp()
    res = files_mod.prepare_upload(
        "owner",
        "repo",
        WriteTokenRequest(path="data/file.bin"),
        req,
        _user(),
        object(),
    )
    after = datetime.now(timezone.utc).timestamp()

    assert captured["expiry_minutes"] == 5
    assert res.transfer.expires_at is not None
    # 5분 = 300초 TTL ± 약간의 시간차
    assert before + 300 - 1 <= res.transfer.expires_at <= after + 300 + 1


# ── prepare_download signed URL 디테일 ───────────────────


def test_download_signed_url_uses_get_method(monkeypatch):
    """Web BFF download → method=GET (PUT 아님), signed_headers=None."""
    captured = {}

    def _fake(physical_address, method="GET", expiry_minutes=None, content_type=None):
        captured["method"] = method
        captured["content_type"] = content_type
        return "https://storage/sig-get"

    monkeypatch.setattr(files_mod._gcs, "generate_signed_url", _fake)

    req = _request(service_caller="datahub-web")
    res = files_mod.prepare_download(
        "owner",
        "repo",
        DownloadTokenRequest(path="data/file.bin", recursive=False),
        req,
        _user(),
        object(),
    )

    assert captured["method"] == "GET"
    assert captured["content_type"] is None
    assert res.transfer.method == "signed-url"
    assert res.transfer.signed_headers is None
    assert res.transfer.signed_url == "https://storage/sig-get"


# ── CAB 발급 실패 → 500 ──────────────────────────────────


def test_upload_cab_failure_returns_500(monkeypatch):
    """SDK 흐름에서 CAB 발급 실패 → 500 (silent null 금지)."""

    def _boom(bucket):
        raise RuntimeError("ADC missing")

    monkeypatch.setattr(files_mod, "generate_repo_upload_token", _boom)

    req = _request(service_caller=None)
    with pytest.raises(HTTPException) as exc:
        files_mod.prepare_upload(
            "owner",
            "repo",
            WriteTokenRequest(path="data/file.bin"),
            req,
            _user(),
            object(),
        )

    assert exc.value.status_code == 500
    assert "credentials" in str(exc.value.detail).lower()


def test_download_cab_failure_returns_500(monkeypatch):
    def _boom(bucket):
        raise RuntimeError("CAB downscoped download token is empty")

    monkeypatch.setattr(files_mod, "generate_repo_download_token", _boom)

    req = _request(service_caller=None)
    with pytest.raises(HTTPException) as exc:
        files_mod.prepare_download(
            "owner",
            "repo",
            DownloadTokenRequest(path="data/file.bin", recursive=False),
            req,
            _user(),
            object(),
        )

    assert exc.value.status_code == 500
    assert "credentials" in str(exc.value.detail).lower()
