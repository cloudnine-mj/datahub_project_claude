"""File transfer schemas.

The launch-target file API is a control plane for object-storage transfers.
It does not expose branch, commit, or versioning concepts.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class FileEntry(BaseModel):
    path: str
    kind: Literal["file", "prefix"] = "file"
    size: int | None = None
    updated_at: str | None = None
    checksum: str | None = None


class FileListResponse(BaseModel):
    items: list[FileEntry]
    has_more: bool = False
    next_page_token: str | None = None


class TransferInstruction(BaseModel):
    """파일 전송 채널 명세.

    governance §file-transfer 정합. SDK/CLI 는 method 에 따라 다른 코드 경로를 탄다.

    - method="storage-client": CAB downscoped 토큰을 google-cloud-storage 클라이언트에
      주입해서 사용. SDK/CLI/DIA 등 storage 클라이언트가 가능한 호출자 default.
    - method="signed-url": GCS V4 signed URL 단발 HTTP 호출. Web 브라우저처럼
      storage 클라이언트를 못 들고 다니는 호출자(BFF 경유) 전용.
    """

    method: Literal["storage-client", "signed-url"]
    bucket: str
    object_path: str | None = None
    # storage host GCP project — governance !129 으로 신규 추가. storage-client
    # 분기에서 SDK 가 `storage.Client(project=..., credentials=...)` 를 명시 생성하기
    # 위해 필요. SDK 에 환경별 project 하드코드를 두지 않게 하기 위함.
    gcp_project: str | None = None
    # method="storage-client"
    token: str | None = None
    token_expiry: str | None = None
    # method="signed-url" — governance !127 으로 신규 추가
    signed_url: str | None = None
    signed_headers: dict[str, str] | None = None
    # 공통
    expires_at: float | None = None
    scope: str | None = None
    extra: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _validate_method(self):
        if self.method == "storage-client":
            if not self.token:
                raise ValueError("storage-client method requires token")
            if not self.gcp_project:
                raise ValueError("storage-client method requires gcp_project")
        if self.method == "signed-url" and not self.signed_url:
            raise ValueError("signed-url method requires signed_url")
        return self


class DownloadTokenRequest(BaseModel):
    path: str = ""
    recursive: bool = False


class DownloadTokenResponse(BaseModel):
    operation_id: str
    path: str
    transfer: TransferInstruction
    files: list[FileEntry] = Field(default_factory=list)


class BulkManifestInstruction(BaseModel):
    upload_path: str


class WriteTokenRequest(BaseModel):
    mode: Literal["single", "bulk"] = "single"
    path: str | None = None
    size: int | None = None
    content_type: str | None = None
    target_prefix: str | None = None
    files_count: int | None = None
    bytes_total: int | None = None
    manifest_digest: str | None = None

    @model_validator(mode="after")
    def _validate_mode(self):
        if self.mode == "single":
            if not self.path:
                raise ValueError("single upload requires path")
            return self
        if self.files_count is None or self.files_count < 0:
            raise ValueError("bulk upload requires non-negative files_count")
        if self.bytes_total is None or self.bytes_total < 0:
            raise ValueError("bulk upload requires non-negative bytes_total")
        if not self.manifest_digest:
            raise ValueError("bulk upload requires manifest_digest")
        return self


class WriteTokenResponse(BaseModel):
    operation_id: str
    upload_id: str
    mode: Literal["single", "bulk"] = "single"
    path: str = ""
    target_prefix: str | None = None
    manifest: BulkManifestInstruction | None = None
    transfer: TransferInstruction


class UploadConfirmRequest(BaseModel):
    mode: Literal["single", "bulk"] = "single"
    upload_id: str | None = None
    path: str | None = None
    size: int | None = None
    checksum: str | None = None
    manifest_ref: str | None = None
    manifest_digest: str | None = None
    files_count: int | None = None
    bytes_total: int | None = None


class UploadConfirmResponse(BaseModel):
    operation_id: str
    status: Literal["completed", "accepted"] = "completed"
    path: str = ""
    files_total: int = 0
    bytes_total: int = 0
    status_url: str | None = None


class OperationStatusResponse(BaseModel):
    operation_id: str
    status: str
    files_total: int = 0
    bytes_total: int = 0
    failures: list[dict[str, Any]] = Field(default_factory=list)


class CopyRequest(BaseModel):
    source_repo: str
    source_path: str
    target_path: str


class CopyResponse(BaseModel):
    operation_id: str
    status: Literal["completed", "accepted"] = "completed"
    files_done: int = 0
    bytes_done: int = 0
    failures: list[dict[str, Any]] = Field(default_factory=list)


class DeleteFileResponse(BaseModel):
    status: Literal["deleted"] = "deleted"
    path: str


class ContentResponse(BaseModel):
    content: str
    total_size: int
    truncated: bool


# Compatibility response for existing `dh ls` callers until the SDK moves fully
# to GET /repos/{owner}/{repo}/files.
class LsItem(BaseModel):
    path: str
    path_type: Literal["object", "prefix"] = "object"
    size_bytes: int | None = None
    mtime: int | None = None


class LsResponse(BaseModel):
    items: list[LsItem]
    has_more: bool = False
    next_offset: str | None = None
