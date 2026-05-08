"""LakeFS 전체 연동 서비스.

token-service/services/lakefs.py + sdk/versioning.py 흡수.
서버 admin 자격증명으로 모든 LakeFS 작업 수행.
사용자 식별은 commit metadata에 기록.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Optional

import lakefs
import lakefs_sdk
from lakefs.client import Client
from lakefs_sdk.api.objects_api import ObjectsApi
from lakefs_sdk.api.repositories_api import RepositoriesApi
from lakefs_sdk.api.staging_api import StagingApi
from lakefs_sdk.exceptions import ApiException

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class CommitInfo:
    """LakeFS 커밋 정보."""
    id: str
    message: str
    committer: str
    creation_date: Optional[int] = None
    parents: Optional[list[str]] = None
    metadata: Optional[dict[str, str]] = None


@dataclass
class BranchInfo:
    """LakeFS 브랜치 정보."""
    name: str
    commit_id: str
    commit_message: str = ""
    commit_date: Optional[int] = None


@dataclass
class DiffEntry:
    """LakeFS diff 항목."""
    path: str
    change_type: str  # "added", "removed", "changed"
    path_type: str = "object"  # "object" or "common_prefix"
    size_bytes: Optional[int] = None


@dataclass
class StagingLocation:
    """LakeFS Staging 물리 주소 정보."""
    physical_address: str


class LakeFSService:
    """LakeFS 서비스 (서버 내부 전용).

    서버의 admin 자격증명으로 모든 작업을 수행합니다.
    사용자 식별은 commit metadata에 기록합니다.
    """

    def __init__(self) -> None:
        self._client = Client(
            host=settings.lakefs_endpoint,
            username=settings.lakefs_access_key_id,
            password=settings.lakefs_secret_access_key,
            verify_ssl=settings.lakefs_verify_ssl,
        )

        sdk_config = lakefs_sdk.Configuration(
            host=settings.lakefs_endpoint + "/api/v1",
            username=settings.lakefs_access_key_id,
            password=settings.lakefs_secret_access_key,
        )
        sdk_config.verify_ssl = settings.lakefs_verify_ssl
        if settings.lakefs_ca_bundle:
            sdk_config.ssl_ca_cert = settings.lakefs_ca_bundle
        self._sdk_api_client = lakefs_sdk.ApiClient(sdk_config)

        self._repos_api = RepositoriesApi(self._sdk_api_client)
        self._objects_api = ObjectsApi(self._sdk_api_client)

    # ── Repository ──────────────────────────────────

    def create_repository(self, name: str, storage_namespace: str, default_branch: str = "main") -> None:
        """LakeFS 레포지토리 생성."""
        try:
            self._repos_api.create_repository(
                lakefs_sdk.RepositoryCreation(
                    name=name,
                    storage_namespace=storage_namespace,
                    default_branch=default_branch,
                )
            )
        except ApiException as e:
            if e.status == 409:
                logger.info("LakeFS 레포가 이미 존재합니다: %s", name)
                return
            raise
        logger.info("LakeFS 레포 생성 완료: %s", name)

    def get_repository_storage_namespace(self, repo_name: str) -> str:
        """레포지토리의 storage_namespace 조회."""
        repo = self._repos_api.get_repository(repo_name)
        return repo.storage_namespace

    def delete_repository(self, name: str) -> None:
        """LakeFS 레포지토리 삭제."""
        try:
            self._repos_api.delete_repository(name)
        except ApiException as e:
            if e.status == 404:
                logger.info("LakeFS 레포가 존재하지 않습니다: %s", name)
                return
            raise
        logger.info("LakeFS 레포 삭제 완료: %s", name)

    # ── Branch ──────────────────────────────────────

    def create_branch(self, repo_name: str, branch_name: str, source: str = "main") -> None:
        """브랜치 생성."""
        repo = lakefs.Repository(repo_name, client=self._client)
        repo.branch(branch_name).create(source_reference=source)

    def delete_branch(self, repo_name: str, branch_name: str) -> None:
        """브랜치 삭제."""
        repo = lakefs.Repository(repo_name, client=self._client)
        repo.branch(branch_name).delete()

    def list_branches(self, repo_name: str) -> list[BranchInfo]:
        """브랜치 목록 조회 (HEAD 커밋 정보 포함)."""
        from lakefs_sdk.api.branches_api import BranchesApi
        from lakefs_sdk.api.commits_api import CommitsApi

        branches_api = BranchesApi(self._sdk_api_client)
        commits_api = CommitsApi(self._sdk_api_client)
        result: list[BranchInfo] = []

        resp = branches_api.list_branches(repo_name, amount=1000)
        for b in resp.results or []:
            info = BranchInfo(name=b.id, commit_id=b.commit_id)
            try:
                commit = commits_api.get_commit(repo_name, b.commit_id)
                info.commit_message = commit.message or ""
                info.commit_date = commit.creation_date
            except Exception:
                pass
            result.append(info)

        return result

    # ── Upload Object ─────────────────────────────────

    def upload_object(
        self,
        repo_name: str,
        branch: str,
        path: str,
        content: bytes,
    ) -> None:
        """LakeFS Objects API로 파일을 직접 업로드."""
        self._objects_api.upload_object(repo_name, branch, path, content=content)

    # ── Commit & Merge ──────────────────────────────

    def commit(
        self,
        repo_name: str,
        branch_name: str,
        message: str,
        user_email: Optional[str] = None,
    ) -> CommitInfo:
        """브랜치에 커밋. metadata에 사용자 이메일을 포함."""
        metadata: dict[str, str] = {}
        if user_email:
            metadata["user_email"] = user_email

        repo = lakefs.Repository(repo_name, client=self._client)
        ref = repo.branch(branch_name).commit(
            message=message,
            metadata=metadata or None,
        )
        return CommitInfo(
            id=ref.id,
            message=message,
            committer="",
            metadata=metadata or None,
        )

    def merge(
        self, repo_name: str, source_branch: str, into: str = "main", message: str = ""
    ) -> None:
        """브랜치 머지."""
        repo = lakefs.Repository(repo_name, client=self._client)
        source = repo.branch(source_branch)
        dest = repo.branch(into)
        source.merge_into(dest, message=message or f"Merge {source_branch} into {into}")

    # ── Diff ────────────────────────────────────────

    def diff_branch(self, repo_name: str, source_branch: str, target_branch: str) -> list[DiffEntry]:
        """두 브랜치 간 변경 목록 (change type 포함)."""
        from lakefs_sdk.api.refs_api import RefsApi

        refs_api = RefsApi(self._sdk_api_client)
        entries: list[DiffEntry] = []
        after = ""

        # LakeFS diff type 매핑
        _type_map = {1: "added", 2: "removed", 3: "changed"}

        while True:
            kwargs: dict = {"amount": 1000}
            if after:
                kwargs["after"] = after
            result = refs_api.diff_refs(repo_name, source_branch, target_branch, **kwargs)
            for d in result.results or []:
                change_type = _type_map.get(d.type, str(d.type))
                entries.append(DiffEntry(
                    path=d.path,
                    change_type=change_type,
                    path_type=getattr(d, "path_type", "object"),
                    size_bytes=getattr(d, "size_bytes", None),
                ))

            if result.pagination and result.pagination.has_more:
                after = result.pagination.next_offset
            else:
                break

        return entries

    # ── Objects ─────────────────────────────────────

    @dataclass
    class ObjectEntry:
        """오브젝트 목록 항목."""
        path: str
        path_type: str = "object"
        size_bytes: Optional[int] = None
        mtime: Optional[int] = None

    def list_objects(
        self,
        repo_name: str,
        ref: str,
        prefix: str = "",
        recursive: bool = False,
        max_items: int = 100,
        after: Optional[str] = None,
    ) -> tuple[list["LakeFSService.ObjectEntry"], bool, Optional[str]]:
        """레포 내 오브젝트 목록 조회 (상세 정보 포함).

        Returns:
            (items, has_more, next_offset) 튜플
        """
        from lakefs_sdk.api.objects_api import ObjectsApi

        objects_api = ObjectsApi(self._sdk_api_client)

        kwargs: dict = {
            "prefix": prefix.lstrip("/") if prefix else "",
            "delimiter": "" if recursive else "/",
            "amount": max_items,
        }
        if after:
            kwargs["after"] = after

        result = objects_api.list_objects(repo_name, ref, **kwargs)
        items: list[LakeFSService.ObjectEntry] = []
        for entry in result.results or []:
            path_type = "common_prefix" if entry.path.endswith("/") else "object"
            items.append(LakeFSService.ObjectEntry(
                path=entry.path,
                path_type=path_type,
                size_bytes=getattr(entry, "size_bytes", None),
                mtime=getattr(entry, "mtime", None),
            ))

        has_more = result.pagination.has_more if result.pagination else False
        next_offset = result.pagination.next_offset if result.pagination and result.pagination.has_more else None

        return items, has_more, next_offset

    # ── Commit Log ─────────────────────────────────

    def get_commit_log(
        self,
        repo_name: str,
        ref: str,
        amount: int = 30,
    ) -> list[CommitInfo]:
        """ref의 커밋 이력 조회."""
        from lakefs_sdk.api.refs_api import RefsApi

        refs_api = RefsApi(self._sdk_api_client)
        result = refs_api.log_commits(repo_name, ref, amount=amount)
        commits: list[CommitInfo] = []
        for c in result.results or []:
            commits.append(CommitInfo(
                id=c.id,
                message=c.message,
                committer=c.committer,
                creation_date=c.creation_date,
                parents=list(c.parents) if c.parents else [],
                metadata=dict(c.metadata) if c.metadata else None,
            ))
        return commits

    # ── Object Content ─────────────────────────────

    def get_object_content(
        self,
        repo_name: str,
        ref: str,
        path: str,
        max_bytes: int = 10240,
    ) -> tuple[str, int, bool]:
        """오브젝트 내용을 텍스트로 반환.

        Returns:
            (content, total_size, truncated) 튜플
        """
        from lakefs_sdk.api.objects_api import ObjectsApi

        objects_api = ObjectsApi(self._sdk_api_client)
        # stat으로 전체 크기 확인
        stat = objects_api.stat_object(repo_name, ref, path=path)
        total_size = stat.size_bytes or 0

        # 오브젝트 내용 가져오기
        content_bytes = objects_api.get_object(
            repo_name, ref, path=path, range=f"bytes=0-{max_bytes - 1}",
        )
        if isinstance(content_bytes, bytes):
            content = content_bytes.decode("utf-8", errors="replace")
        else:
            content = str(content_bytes)

        truncated = total_size > max_bytes
        return content, total_size, truncated

    # ── Physical Path Resolution ────────────────────

    def resolve_physical_path(self, repo_name: str, ref: str, path: str) -> tuple[str, Optional[int]]:
        """논리 경로 → GCS 물리 주소 및 크기 해석."""
        repo = lakefs.Repository(repo_name, client=self._client)
        obj = repo.ref(ref).object(path)
        stats = obj.stat()
        return stats.physical_address, getattr(stats, "size_bytes", None)

    def iter_physical_paths(
        self, repo_name: str, ref: str, prefix: str
    ) -> Iterator[tuple[str, str, Optional[int]]]:
        """디렉토리 내 오브젝트의 물리 주소와 크기를 스트리밍으로 yield."""
        repo = lakefs.Repository(repo_name, client=self._client)
        branch_ref = repo.ref(ref)
        for obj in branch_ref.objects(prefix=prefix.lstrip("/")):
            yield obj.path, obj.physical_address, getattr(obj, "size_bytes", None)

    # ── Staging API ─────────────────────────────────

    def get_staging_location(self, repo_name: str, branch: str, path: str) -> StagingLocation:
        """Staging 업로드를 위한 물리 GCS 주소 할당."""
        staging_api = StagingApi(self._sdk_api_client)
        result = staging_api.get_physical_address(
            repo_name, branch, path=path, presign=False
        )
        return StagingLocation(physical_address=result.physical_address)

    def link_physical_address(
        self,
        repo_name: str,
        branch: str,
        path: str,
        staging: StagingLocation,
        size_bytes: int,
        checksum: str,
    ) -> None:
        """GCS 직접 업로드 완료 후 LakeFS에 오브젝트 등록."""
        staging_api = StagingApi(self._sdk_api_client)
        metadata = lakefs_sdk.StagingMetadata(
            staging=lakefs_sdk.StagingLocation(
                physical_address=staging.physical_address,
            ),
            size_bytes=size_bytes,
            checksum=checksum,
        )
        staging_api.link_physical_address(
            repo_name, branch,
            staging_metadata=metadata,
            path=path,
        )

    def reset_branch_object(self, repo_name: str, branch: str, path: str) -> None:
        """LakeFS 브랜치에서 특정 staged 오브젝트를 마지막 커밋 상태로 초기화(롤백)."""
        from lakefs_sdk.api.branches_api import BranchesApi
        branches_api = BranchesApi(self._sdk_api_client)
        branches_api.reset_branch(
            repo_name,
            branch,
            reset_creation=lakefs_sdk.ResetCreation(type="object", path=path),
        )

    # ── Import API ──────────────────────────────────

    def import_objects(
        self,
        repo_name: str,
        branch: str,
        objects: list[dict],
        message: str = "",
        user_email: Optional[str] = None,
        poll_interval: float = 0.5,
        max_retries: int = 60,
    ) -> CommitInfo:
        """LakeFS Import API 배치 호출 — CAS GCS 오브젝트를 LakeFS에 등록 + 커밋.

        Args:
            repo_name: LakeFS 레포 이름
            branch: 대상 브랜치
            objects: [{"source_uri": "gs://bucket/_cas/...", "destination": "logical/path"}]
            message: 커밋 메시지
            user_email: 커밋 메타데이터에 포함할 이메일
            poll_interval: 폴링 간격 (초)
            max_retries: 최대 폴링 횟수

        Returns:
            CommitInfo
        """
        import time

        from lakefs_sdk.api.import_api import ImportApi

        import_api = ImportApi(self._sdk_api_client)

        paths = []
        for obj in objects:
            source_uri = obj["source_uri"]
            destination = obj["destination"]
            # LakeFS Import API type="object" requires the full gs:// URI as path.
            # Passing a bare relative path (stripped of storage namespace) causes
            # "invalid storage scheme : invalid address" in lakeFS ingest.
            paths.append(lakefs_sdk.ImportLocation(
                type="object",
                path=source_uri,
                destination=destination,
            ))

        metadata: dict[str, str] = {}
        if user_email:
            metadata["user_email"] = user_email

        resp = import_api.import_start(
            repo_name,
            branch,
            lakefs_sdk.ImportCreation(
                paths=paths,
                commit=lakefs_sdk.CommitCreation(
                    message=message or "Import via DataHub LFS",
                    metadata=metadata or None,
                ),
            ),
        )

        import_id = resp.id

        for _ in range(max_retries):
            status = import_api.import_status(repo_name, branch, id=import_id)
            if status.completed:
                if status.error:
                    raise RuntimeError(f"LakeFS import failed: {status.error.message}")
                c = status.commit
                return CommitInfo(
                    id=c.id,
                    message=c.message,
                    committer=c.committer,
                    creation_date=c.creation_date,
                )
            time.sleep(poll_interval)

        raise TimeoutError(
            f"LakeFS import job {import_id} did not complete within "
            f"{max_retries * poll_interval:.0f}s"
        )
