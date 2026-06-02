"""TransferInstruction 채널 분기 — X-Service-Token 식별된 caller 기반.

governance §file-transfer (X-Service-Token 분기) 정합 검증:
- Web BFF (service_caller="datahub-web") → method="signed-url"
- SDK/CLI (service_caller=None) → method="storage-client"
- DIA (service_caller="data-intelligence-api") → method="storage-client"
- 잘못된 토큰으로 service_caller 가 채워지지 않으면 default = CAB
- Web BFF 50MB 초과 업로드 → 422
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.routers import files as files_mod
from app.schemas.files import DownloadTokenRequest, WriteTokenRequest


# ── Fixtures ─────────────────────────────────────────────


def _request(service_caller: str | None = None):
    """request.state.service_caller 만 채워진 stub request."""
    state = SimpleNamespace(service_caller=service_caller)
    return SimpleNamespace(
        state=state,
        client=SimpleNamespace(host="127.0.0.1"),
        headers={},
    )


def _user():
    return SimpleNamespace(id=1, email="user@example.com")


def _repo():
    # bucket_name 은 opaque key 가 채워진 형태 (codex 사이클 347e4f6 정합)
    return SimpleNamespace(repo_name="repo", bucket_name="lgair-dgdh-dev-r-deadbeef")


@pytest.fixture(autouse=True)
def _patch_common(monkeypatch):
    """모든 테스트 공통: ACL/audit/idempotency stub + GCS list_objects stub."""
    monkeypatch.setattr(files_mod, "check_access", lambda *a, **kw: _repo())
    monkeypatch.setattr(files_mod, "require_capability", lambda *a, **kw: _repo())
    monkeypatch.setattr(files_mod.audit, "log", lambda *a, **kw: None)
    # Idempotency: 곧바로 response_factory 실행 — header 없이도 통과.
    monkeypatch.setattr(
        files_mod,
        "run_idempotent",
        lambda request, **kwargs: kwargs["response_factory"](),
    )
    # GCS list/object stubs — download path 처리용
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


@pytest.fixture
def _cab_tokens(monkeypatch):
    """CAB 토큰 발급을 mock — 실제 GCP 호출 없이 정상 토큰 시뮬레이트."""
    monkeypatch.setattr(
        files_mod,
        "generate_repo_upload_token",
        lambda bucket: ("up-tok-xyz", "2026-01-01T00:00:00Z"),
    )
    monkeypatch.setattr(
        files_mod,
        "generate_repo_download_token",
        lambda bucket: ("dn-tok-xyz", "2026-01-01T00:00:00Z"),
    )


@pytest.fixture
def _signed_url(monkeypatch):
    """GCSService.generate_signed_url mock."""
    captured: dict = {}

    def _fake(physical_address, method="GET", expiry_minutes=None, content_type=None):
        captured["physical_address"] = physical_address
        captured["method"] = method
        captured["expiry_minutes"] = expiry_minutes
        captured["content_type"] = content_type
        return f"https://storage.googleapis.com/signed?m={method}"

    monkeypatch.setattr(files_mod._gcs, "generate_signed_url", _fake)
    return captured


# ── prepare_upload 분기 ──────────────────────────────────


def test_upload_web_bff_branches_to_signed_url(_cab_tokens, _signed_url):
    """Web BFF caller → signed-url 채널."""
    req = _request(service_caller="datahub-web")
    res = files_mod.prepare_upload(
        "owner",
        "repo",
        WriteTokenRequest(path="data/file.bin", size=1024, content_type="application/octet-stream"),
        req,
        _user(),
        object(),
    )
    assert res.transfer.method == "signed-url"
    assert res.transfer.signed_url and res.transfer.signed_url.startswith("https://")
    assert res.transfer.token is None
    assert res.transfer.signed_headers == {"Content-Type": "application/octet-stream"}
    assert _signed_url["method"] == "PUT"
    assert _signed_url["expiry_minutes"] == 5
    assert _signed_url["physical_address"].startswith("gs://lgair-dgdh-dev-r-")


def test_upload_sdk_default_uses_cab(_cab_tokens, _signed_url):
    """service_caller=None (SDK/CLI) → storage-client 채널."""
    req = _request(service_caller=None)
    res = files_mod.prepare_upload(
        "owner",
        "repo",
        WriteTokenRequest(path="data/file.bin", size=1024),
        req,
        _user(),
        object(),
    )
    assert res.transfer.method == "storage-client"
    assert res.transfer.token == "up-tok-xyz"
    assert res.transfer.signed_url is None
    # gcp_project 가 서버 설정값으로 채워져야 (SDK 가 storage.Client 명시 생성용)
    from app.config import settings
    assert res.transfer.gcp_project == settings.gcp_project
    assert res.transfer.gcp_project  # 비어 있으면 안 됨
    # signed_url 은 호출되지 않아야
    assert "method" not in _signed_url


def test_upload_dia_uses_cab(_cab_tokens, _signed_url):
    """DIA caller → storage-client 채널 (DIA 도 storage 클라이언트 가능)."""
    req = _request(service_caller="data-intelligence-api")
    res = files_mod.prepare_upload(
        "owner",
        "repo",
        WriteTokenRequest(path="data/file.bin", size=1024),
        req,
        _user(),
        object(),
    )
    assert res.transfer.method == "storage-client"
    assert res.transfer.token == "up-tok-xyz"


def test_upload_web_bff_over_50mb_rejected(_cab_tokens, _signed_url):
    """Web BFF 50MB 초과 → 422 (Web Client Limits)."""
    req = _request(service_caller="datahub-web")
    with pytest.raises(HTTPException) as exc:
        files_mod.prepare_upload(
            "owner",
            "repo",
            WriteTokenRequest(path="big/file.bin", size=50 * 1024 * 1024 + 1),
            req,
            _user(),
            object(),
        )
    assert exc.value.status_code == 422
    assert "exceeds" in str(exc.value.detail).lower()


def test_upload_unknown_caller_defaults_to_cab(_cab_tokens, _signed_url):
    """service_caller 가 우리가 모르는 값이면 default = CAB (잘못된 토큰 / mismatch 보호)."""
    req = _request(service_caller="some-unknown-caller")
    res = files_mod.prepare_upload(
        "owner",
        "repo",
        WriteTokenRequest(path="data/file.bin", size=1024),
        req,
        _user(),
        object(),
    )
    assert res.transfer.method == "storage-client"


def test_bulk_upload_sdk_returns_operation_prefix_manifest(_cab_tokens, _signed_url):
    """SDK/CLI bulk mode → 단일 CAB transfer + manifest upload 위치 반환."""
    req = _request(service_caller=None)
    res = files_mod.prepare_upload(
        "owner",
        "repo",
        WriteTokenRequest(
            mode="bulk",
            target_prefix="data/",
            files_count=3,
            bytes_total=30,
            manifest_digest="sha256:" + "0" * 64,
        ),
        req,
        _user(),
        object(),
    )
    assert res.mode == "bulk"
    assert res.target_prefix == "data/"
    assert res.transfer.method == "storage-client"
    assert res.transfer.scope == "operation-prefix"
    assert res.transfer.object_path == "data/"
    assert res.manifest is not None
    assert res.manifest.upload_path.startswith(".datahub/manifests/upl_")
    assert res.manifest.upload_path.endswith(".jsonl")
    assert "method" not in _signed_url


def test_bulk_upload_web_bff_rejected(_cab_tokens, _signed_url):
    """Web BFF 는 signed-url single-mode 예외만 허용한다."""
    req = _request(service_caller="datahub-web")
    with pytest.raises(HTTPException) as exc:
        files_mod.prepare_upload(
            "owner",
            "repo",
            WriteTokenRequest(
                mode="bulk",
                target_prefix="data/",
                files_count=2,
                bytes_total=20,
                manifest_digest="sha256:" + "0" * 64,
            ),
            req,
            _user(),
            object(),
        )
    assert exc.value.status_code == 422


# ── prepare_download 분기 ────────────────────────────────


def test_download_web_bff_branches_to_signed_url(_cab_tokens, _signed_url):
    """Web BFF caller + 단일 객체 → signed-url GET."""
    req = _request(service_caller="datahub-web")
    res = files_mod.prepare_download(
        "owner",
        "repo",
        DownloadTokenRequest(path="data/file.bin", recursive=False),
        req,
        _user(),
        object(),
    )
    assert res.transfer.method == "signed-url"
    assert res.transfer.signed_url
    assert _signed_url["method"] == "GET"
    # GET 은 content_type 불필요
    assert res.transfer.signed_headers is None


def test_download_sdk_default_uses_cab(_cab_tokens, _signed_url):
    req = _request(service_caller=None)
    res = files_mod.prepare_download(
        "owner",
        "repo",
        DownloadTokenRequest(path="data/file.bin", recursive=False),
        req,
        _user(),
        object(),
    )
    assert res.transfer.method == "storage-client"
    assert res.transfer.token == "dn-tok-xyz"


def test_download_dia_uses_cab(_cab_tokens, _signed_url):
    req = _request(service_caller="data-intelligence-api")
    res = files_mod.prepare_download(
        "owner",
        "repo",
        DownloadTokenRequest(path="data/file.bin", recursive=False),
        req,
        _user(),
        object(),
    )
    assert res.transfer.method == "storage-client"


def test_download_web_bff_recursive_rejected(_cab_tokens, _signed_url):
    """Web BFF + recursive → 422 (BFF 는 prefix 다운로드 지원 안 함)."""
    req = _request(service_caller="datahub-web")
    with pytest.raises(HTTPException) as exc:
        files_mod.prepare_download(
            "owner",
            "repo",
            DownloadTokenRequest(path="data/", recursive=True),
            req,
            _user(),
            object(),
        )
    assert exc.value.status_code == 422
