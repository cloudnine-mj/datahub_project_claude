"""Repo 프로비저닝 오케스트레이션.

GCS 버킷 + LakeFS 레포 생성을 조율합니다.
"""

from __future__ import annotations

import logging
from typing import Optional

from app.services.gcs import GCSService
from app.services.lakefs import LakeFSService

logger = logging.getLogger(__name__)


_README_TEMPLATE = """# {repo_id}

{summary}

## Repository

- Type: {repo_type}
- Owner: {owner}
- License: {license}

## Description

{description}

## Usage

```bash
dh repo {repo_id} view
dh download {repo_id}/<file> ./local
dh upload   {repo_id}/<path> ./local
```

> 자동 생성된 README. 자유롭게 갱신하세요.
"""


def _render_readme(
    repo_id: str,
    repo_type: Optional[str],
    owner: str,
    license_: Optional[str],
    summary: Optional[str],
    description: Optional[str],
) -> bytes:
    type_label = {"A": "dataset", "B": "model"}.get(repo_type or "", repo_type or "—")
    return _README_TEMPLATE.format(
        repo_id=repo_id,
        repo_type=type_label,
        owner=owner,
        license=license_ or "—",
        summary=summary or "_저장소 한 줄 요약을 작성하세요._",
        description=description or "_저장소 상세 설명을 작성하세요._",
    ).encode("utf-8")


class ProvisioningService:
    """레포지토리 프로비저닝 서비스."""

    def __init__(
        self,
        gcs: GCSService,
        lakefs: LakeFSService,
    ) -> None:
        self._gcs = gcs
        self._lakefs = lakefs

    def provision_repo(
        self,
        repo_name: str,
        gcs_key: str | None = None,
        *,
        owner: str = "",
        repo_type: Optional[str] = None,
        license_: Optional[str] = None,
        summary: Optional[str] = None,
        description: Optional[str] = None,
        user_email: Optional[str] = None,
    ) -> str:
        """레포지토리 전체 프로비저닝 (GCS + LakeFS + 초기 README).

        Args:
            repo_name: LakeFS 레포 이름 (bare, 예: "ner-models")
            gcs_key: GCS 버킷 suffix — group 지정 시 "{group}-{repo}" 형태.
                     None이면 repo_name 그대로 사용.
            owner / repo_type / license_ / summary / description: README 템플릿 변수.
                값이 없으면 placeholder 로 대체.
            user_email: 초기 commit 의 author metadata.

        Returns:
            생성된 버킷 이름
        """
        effective_gcs = gcs_key or repo_name

        # 1. GCS 버킷 생성
        bucket_name = self._gcs.create_bucket(effective_gcs)

        # 2. LakeFS 레포지토리 생성
        storage_namespace = f"gs://{bucket_name}/"
        self._lakefs.create_repository(repo_name, storage_namespace)

        # 3. 초기 README.md 자동 커밋 (governance dev plan P1.5)
        try:
            display_id = f"{owner}/{repo_name}" if owner else repo_name
            readme_bytes = _render_readme(
                repo_id=display_id,
                repo_type=repo_type,
                owner=owner or "—",
                license_=license_,
                summary=summary,
                description=description,
            )
            self._lakefs.upload_object(
                repo_name=repo_name,
                branch="main",
                path="README.md",
                content=readme_bytes,
            )
            self._lakefs.commit(
                repo_name=repo_name,
                branch_name="main",
                message="chore: initial README",
                user_email=user_email,
            )
        except Exception as e:
            # README 커밋이 실패해도 레포 자체는 사용 가능 — 경고만 남기고 진행.
            logger.warning("README 자동 커밋 실패 (%s): %s", repo_name, e)

        logger.info("레포지토리 프로비저닝 완료: %s (bucket=%s)", repo_name, bucket_name)
        return bucket_name

    def deprovision_repo(self, repo_name: str, gcs_key: str | None = None) -> None:
        """레포지토리 전체 삭제 (LakeFS 레포 + GCS 버킷).

        Args:
            repo_name: LakeFS 레포 이름 (bare)
            gcs_key: GCS 버킷 suffix. None이면 repo_name 그대로 사용.

        각 단계는 독립적으로 실행하여, 일부 실패해도 나머지를 계속 삭제합니다.
        """
        effective_gcs = gcs_key or repo_name
        errors: list[str] = []

        # 1. LakeFS 레포지토리 삭제
        try:
            self._lakefs.delete_repository(repo_name)
        except Exception as e:
            logger.warning("LakeFS 레포 삭제 실패: %s", e)
            errors.append(f"LakeFS: {e}")

        # 2. GCS 버킷 삭제 (오브젝트 포함)
        try:
            self._gcs.delete_bucket(effective_gcs)
        except Exception as e:
            logger.warning("GCS 버킷 삭제 실패: %s", e)
            errors.append(f"GCS: {e}")

        if errors:
            logger.warning("레포지토리 삭제 부분 실패: %s — %s", repo_name, "; ".join(errors))
        else:
            logger.info("레포지토리 삭제 완료: %s", repo_name)
