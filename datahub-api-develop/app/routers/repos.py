"""Repository CRUD 엔드포인트.

- POST /repos: 레포 생성 (GCS + LakeFS + UC 프로비저닝)
- GET /repos: 접근 가능한 레포 목록
- DELETE /repos/{repo_name}: 레포 삭제 (owner only)
- PATCH /repos/{repo_name}/visibility: 공개 범위 변경 (owner/maintainer)
- GET /repos/{repo_name}/stats: 레포 통계 (LakeFS + UC 실시간 조회)
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request

logger = logging.getLogger(__name__)
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_scope
from app.models import Organization, Permission, Repo, RepoPublicAccessPolicy, User
from app.schemas.repos import (
    CreateRepoRequest,
    CreateRepoResponse,
    LastCommitInfo,
    PublicAccess,
    RepoInfo,
    RepoListResponse,
    RepoStatsResponse,
    UpdateVisibilityRequest,
    expand_preset,
    normalize_visibility,
    validate_dependencies,
)
from app.services.audit import AuditService
from app.config import settings as app_settings
from app.services.authorization import check_access, require_admin, require_capability, resolve_role
from app.services.gcs import GCSService
from app.services.lakefs import LakeFSService
from app.services.provisioning import ProvisioningService
router = APIRouter()
audit = AuditService()

# 서비스 인스턴스 (모듈 레벨 — lifespan에서 초기화해도 되지만 단순하게)
_gcs = GCSService()
_lakefs = LakeFSService()
_provisioning = ProvisioningService(_gcs, _lakefs)


@router.post("/repos", response_model=CreateRepoResponse)
def create_repo(
    body: CreateRepoRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """레포지토리 생성.

    GCS 버킷 + LakeFS 레포 + UC 카탈로그를 함께 생성합니다.
    """
    repo_name = body.repo_name

    # 중복 확인
    existing = db.query(Repo).filter(Repo.repo_name == repo_name).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Repository '{repo_name}' already exists")

    # visibility / public_access normalize (governance §Formal Model)
    if body.visibility == "fine_grained":
        if body.public_access is None:
            raise HTTPException(
                status_code=400,
                detail="fine_grained visibility 는 public_access 를 명시해야 합니다.",
            )
        public_access = body.public_access
    else:
        public_access = body.public_access or expand_preset(body.visibility)
    try:
        validate_dependencies(public_access)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    effective_visibility = normalize_visibility(public_access)

    # 프로비저닝 — group 지정 시 GCS 버킷 suffix = "{group}-{repo}"
    gcs_key = f"{body.group}-{repo_name}" if body.group else None
    try:
        bucket_name = _provisioning.provision_repo(
            repo_name,
            gcs_key=gcs_key,
            owner=body.group or user.email,
            repo_type=body.repo_type,
            description=body.description,
            user_email=user.email,
        )
    except Exception as e:
        audit.log(
            db,
            user_id=user.id,
            user_email=user.email,
            action="repo_create",
            resource_type="repo",
            resource_id=repo_name,
            status="failure",
            error_message=str(e),
            ip_address=request.client.host if request.client else None,
        )
        raise HTTPException(status_code=500, detail=f"Provisioning failed: {e}")

    # 빈 DATACARD.md 템플릿 커밋
    try:
        _datacard_template = f"""# {repo_name}

## 샘플 데이터

<!-- 대표적인 데이터 샘플을 첨부하거나 예시를 작성하세요 -->

## 데이터셋 개요

### 데이터 소개

<!-- 어떤 데이터인지 설명하세요 -->

#### 포함하고 있는 데이터 내용

<!-- 데이터에 포함된 주요 내용을 기술하세요 -->

#### 범위/커버리지 (Scope/Coverage)

<!-- 데이터가 다루는 도메인, 언어, 기간 등의 범위를 작성하세요 -->

#### Modality

<!-- Text / Image / Audio / Video / Tabular / Code / Mixed -->

### 구축 배경 및 목적

#### 구축 목적

<!-- 이 데이터셋을 만든 이유와 배경을 작성하세요 -->

#### 활용 가능 태스크

<!-- 예: QA, Summarization, Classification 등 -->

#### 대상 사용자

<!-- 이 데이터를 사용할 주요 대상을 작성하세요 -->

## 데이터 구성 및 구조

### 크기

<!-- 전체 데이터 크기 (예: 2.5 GB) -->

### 수량

<!-- 전체 데이터 건수 (예: 150,000건) -->

### 필드/스키마 설명 (Field/Schema Description)

<!-- 주요 필드와 각 필드의 설명을 표 형태로 작성하세요 -->

| 필드명 | 타입 | 설명 |
|--------|------|------|
|        |      |      |

### Split / Directory 구조

<!-- 데이터 디렉토리 구조를 작성하세요 -->

```
/
├── train/
├── validation/
└── test/
```

## 데이터 수집 및 제작 방식

### 데이터 수집/확보 방법

<!-- 크롤링, API, 수작업 등 데이터 확보 방법을 작성하세요 -->

### 제작 과정

<!-- 전처리, 라벨링, 검수 등 제작 파이프라인을 작성하세요 -->

## 사용 가이드

### 데이터 로드/활용 방법

<!-- 코드 예시와 함께 데이터 로드 방법을 작성하세요 -->

```python
# 예시
```

## 유지보수 및 이력 정보

### License

<!-- 데이터 라이선스 정보를 작성하세요 -->

### Citation Info

<!-- 인용 정보를 작성하세요 -->

```bibtex

```

### Contact Point

<!-- 데이터 관련 문의 담당자 정보를 작성하세요 -->
"""
        _lakefs.upload_object(repo_name, "main", "DATACARD.md", _datacard_template.encode("utf-8"))
        _lakefs.commit(repo_name, "main", "Initialize DATACARD.md", user_email=user.email)
    except Exception as e:
        logger.warning("DATACARD.md 초기화 실패 (레포는 생성됨): %s", e)

    # DB 등록 — repos + repo_public_access_policies 동시 생성
    repo = Repo(
        repo_name=repo_name,
        owner_id=user.id,
        bucket_name=bucket_name,
        description=body.description,
        repo_type=body.repo_type,
        visibility=effective_visibility,
    )
    if body.group:
        org = db.query(Organization).filter(Organization.org_name == body.group).first()
        if org is None:
            raise HTTPException(status_code=404, detail=f"Organization '{body.group}' not found")
        repo.org_id = org.id
    db.add(repo)

    policy = RepoPublicAccessPolicy(
        repo_name=repo_name,
        discoverable=public_access.discoverable,
        metadata_read=public_access.metadata_read,
        file_list=public_access.file_list,
        file_read=public_access.file_read,
        lineage_read=public_access.lineage_read,
        stats_read=public_access.stats_read,
    )
    db.add(policy)
    db.commit()

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="repo_create",
        resource_type="repo",
        resource_id=repo_name,
        details={
            "bucket": bucket_name,
            "repo_type": body.repo_type,
            "ai_card": body.ai_card,
            "ai_metadata": body.ai_metadata,
        },
        ip_address=request.client.host if request.client else None,
    )

    return CreateRepoResponse(
        repo_name=repo_name,
        bucket=bucket_name,
        owner=user.email,
        visibility=effective_visibility,
        public_access=public_access,
    )


@router.get(
    "/repos/{repo_name}",
    response_model=RepoInfo,
    dependencies=[Depends(require_scope("repo", "read"))],
)
def get_repo(
    repo_name: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """단건 레포지토리 조회.

    governance §Permission Evaluation:
      - 멤버 (owner / maintainer / developer / guest) 는 RBAC 우선 통과
      - 비멤버는 public_access.metadata_read 가 true 일 때만 통과
      - public_access.discoverable=false 인 비멤버 요청은 404 (존재 숨김)
      - 그 외 차단은 403
    """
    repo = require_capability(
        db, user, repo_name, "metadata_read", min_member_role="guest"
    )

    role = resolve_role(db, user, repo) or "normal"
    owner_email = repo.owner.email

    member_count = db.query(Permission).filter(Permission.repo_name == repo_name).count()
    last_commit: LastCommitInfo | None = None
    try:
        commits = _lakefs.get_commit_log(repo_name, "main", amount=1)
        if commits:
            c = commits[0]
            last_commit = LastCommitInfo(
                hash=c.id,
                message=c.message,
                author=c.committer,
                created_at=c.creation_date,
            )
    except Exception:
        pass

    return RepoInfo(
        repo_name=repo.repo_name,
        owner=owner_email,
        role=role,
        visibility=repo.visibility,
        public_access=_policy_to_public_access(repo),
        description=repo.description,
        repo_type=repo.repo_type,
        member_count=member_count,
        last_commit=last_commit,
        created_at=repo.created_at,
        group=repo.organization.org_name if repo.organization else None,
    )


def _policy_to_public_access(repo: Repo) -> PublicAccess:
    """Repo 의 public_access_policy 를 응답 schema 로 변환. policy 누락 시 visibility 기준 fallback."""
    p = getattr(repo, "public_access_policy", None)
    if p is None:
        return expand_preset(repo.visibility) if repo.visibility != "fine_grained" else PublicAccess(
            discoverable=False,
            metadata_read=False,
            file_list=False,
            file_read=False,
            lineage_read=False,
            stats_read=False,
        )
    return PublicAccess(
        discoverable=p.discoverable,
        metadata_read=p.metadata_read,
        file_list=p.file_list,
        file_read=p.file_read,
        lineage_read=p.lineage_read,
        stats_read=p.stats_read,
    )


@router.delete(
    "/repos/{repo_name}",
    dependencies=[Depends(require_scope("repo", "delete"))],
)
def delete_repo(
    repo_name: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """레포지토리 삭제.

    소유자만 삭제할 수 있습니다.
    UC 테이블 + LakeFS 레포 + GCS 버킷 + DB 레코드를 모두 삭제합니다.
    DB에 레코드가 없어도 외부 리소스(UC/LakeFS/GCS)는 정리합니다.
    """
    if "/" in repo_name:
        group_name, bare_name = repo_name.split("/", 1)
        repo = (
            db.query(Repo)
            .join(Repo.organization)
            .filter(Organization.org_name == group_name, Repo.repo_name == bare_name)
            .first()
        )
    else:
        repo = db.query(Repo).filter(Repo.repo_name == repo_name).first()

    # DB에 없으면 404 — 고아 리소스는 GCS에서 직접 정리
    if repo is None:
        raise HTTPException(status_code=404, detail=f"Repository '{repo_name}' not found")

    # 소유자만 삭제 가능
    if repo.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Only the owner can delete a repository")

    # 외부 리소스 삭제 (UC + LakeFS + GCS)
    # gcs_key: 버킷명에서 prefix 제거한 suffix (group 포함 시 "{group}-{repo}")
    _gcs_prefix = f"{app_settings.gcp_bucket_prefix}-"
    gcs_key = (
        repo.bucket_name[len(_gcs_prefix):]
        if repo.bucket_name and repo.bucket_name.startswith(_gcs_prefix)
        else None
    )
    try:
        _provisioning.deprovision_repo(repo.repo_name, gcs_key=gcs_key)
    except Exception as e:
        audit.log(
            db,
            user_id=user.id,
            user_email=user.email,
            action="repo_delete",
            resource_type="repo",
            resource_id=repo_name,
            status="failure",
            error_message=str(e),
            ip_address=request.client.host if request.client else None,
        )
        raise HTTPException(status_code=500, detail=f"Deprovisioning failed: {e}")

    # DB 레코드 삭제
    db.query(Permission).filter(Permission.repo_name == repo_name).delete()
    db.delete(repo)
    db.commit()

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="repo_delete",
        resource_type="repo",
        resource_id=repo_name,
        details={"orphan": repo is None},
        ip_address=request.client.host if request.client else None,
    )

    return {"status": "deleted", "repo_name": repo_name}


@router.get("/repos", response_model=RepoListResponse)
def list_repos(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """현재 사용자가 접근 가능한 레포지토리 목록.

    - 소유 레포: 항상 표시
    - 권한 부여받은 레포: 항상 표시
    - Public 레포: Normal User도 표시
    - Private 레포: 권한 없으면 숨김
    """
    repos: list[RepoInfo] = []
    seen: set[str] = set()

    def _build_repo_info(repo: Repo, role: str, owner_email: str) -> RepoInfo:
        member_count = db.query(Permission).filter(Permission.repo_name == repo.repo_name).count()
        last_commit: LastCommitInfo | None = None
        try:
            commits = _lakefs.get_commit_log(repo.repo_name, "main", amount=1)
            if commits:
                c = commits[0]
                last_commit = LastCommitInfo(
                    hash=c.id,
                    message=c.message,
                    author=c.committer,
                    created_at=c.creation_date,
                )
        except Exception:
            pass
        return RepoInfo(
            repo_name=repo.repo_name,
            owner=owner_email,
            role=role,
            visibility=repo.visibility,
            public_access=_policy_to_public_access(repo),
            description=repo.description,
            repo_type=repo.repo_type,
            member_count=member_count,
            last_commit=last_commit,
            created_at=repo.created_at,
            group=repo.organization.org_name if repo.organization else None,
        )

    # 소유 레포
    for repo in db.query(Repo).filter(Repo.owner_id == user.id).all():
        repos.append(_build_repo_info(repo, "owner", user.email))
        seen.add(repo.repo_name)

    # 권한 부여받은 레포
    for perm in db.query(Permission).filter(Permission.user_id == user.id).all():
        if perm.repo_name in seen:
            continue
        repo = perm.repo
        repos.append(_build_repo_info(repo, perm.role, repo.owner.email))
        seen.add(repo.repo_name)

    # 비멤버에게 노출 가능한 레포 (governance §Search Implication):
    # public_access.discoverable=true 인 레포만 검색·목록에 포함.
    # 'public' visibility 의 default 가 모두 true 이므로 backward-compat,
    # fine_grained 의 discoverable=false 는 비멤버 view 에서 자동 제외.
    discoverable_repos = (
        db.query(Repo)
        .outerjoin(Repo.public_access_policy)
        .filter(
            (Repo.visibility != "private")
            & (RepoPublicAccessPolicy.discoverable.is_(True))
        )
        .all()
    )
    for repo in discoverable_repos:
        if repo.repo_name in seen:
            continue
        repos.append(_build_repo_info(repo, "normal", repo.owner.email))
        seen.add(repo.repo_name)

    return RepoListResponse(repos=repos)


@router.patch(
    "/repos/{repo_name}/visibility",
    dependencies=[Depends(require_scope("repo", "admin"))],
)
def update_visibility(
    repo_name: str,
    body: UpdateVisibilityRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Repo 공개 범위 변경 (owner/maintainer).

    governance source-of-truth:
      docs/dev_docs/api-specs/repository-api-spec.md §Visibility update
      docs/dev_docs/product-specs/repository-visibility-policy.md

    동작:
      - visibility = public | private | fine_grained
      - fine_grained 면 public_access 6 capability 명시 필수
      - public / private 시 public_access 는 expand_preset 으로 자동 채움
      - capability 의존(file_read↔file_list 등) 위반 시 400
      - normalize: 모두 true → 'public', 모두 false → 'private', 그 외 'fine_grained'
      - version optimistic concurrency: 클라이언트가 GET 으로 읽은 version
        과 DB 의 현재 version 이 다르면 409
      - 성공 시 version += 1, updated_at = NOW, audit_log 기록
    """
    repo = require_admin(db, user, repo_name)

    # public_access 결정 (governance §Formal Model)
    if body.visibility == "fine_grained":
        if body.public_access is None:
            raise HTTPException(
                status_code=400,
                detail="fine_grained visibility 는 public_access 를 명시해야 합니다.",
            )
        target_pa = body.public_access
    elif body.visibility in ("public", "private"):
        # 명시 public_access 가 있으면 그것을 우선 (의존 검사용), 없으면 preset 확장
        target_pa = body.public_access or expand_preset(body.visibility)
    else:
        raise HTTPException(
            status_code=400,
            detail="visibility must be 'public', 'private', or 'fine_grained'",
        )

    try:
        validate_dependencies(target_pa)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    effective_visibility = normalize_visibility(target_pa)

    # version optimistic concurrency
    policy = repo.public_access_policy
    if policy is None:
        # backfill 누락 — 정책 row 없으면 새로 만들고 version=1 부여
        policy = RepoPublicAccessPolicy(repo_name=repo.repo_name)
        db.add(policy)
        db.flush()

    if policy.version != body.version:
        raise HTTPException(
            status_code=409,
            detail=(
                f"visibility version mismatch (expected {policy.version}, "
                f"got {body.version}) — fetch latest and retry"
            ),
        )

    old_visibility = repo.visibility
    old_snapshot = {
        "discoverable": policy.discoverable,
        "metadata_read": policy.metadata_read,
        "file_list": policy.file_list,
        "file_read": policy.file_read,
        "lineage_read": policy.lineage_read,
        "stats_read": policy.stats_read,
    }

    # 갱신
    repo.visibility = effective_visibility
    policy.discoverable = target_pa.discoverable
    policy.metadata_read = target_pa.metadata_read
    policy.file_list = target_pa.file_list
    policy.file_read = target_pa.file_read
    policy.lineage_read = target_pa.lineage_read
    policy.stats_read = target_pa.stats_read
    policy.version = policy.version + 1
    policy.updated_at = func.now()
    db.commit()
    db.refresh(policy)

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="repo_visibility_change",
        resource_type="repo",
        resource_id=repo_name,
        details={
            "old_visibility": old_visibility,
            "new_visibility": effective_visibility,
            "old_public_access": old_snapshot,
            "new_public_access": target_pa.model_dump(),
            "new_version": policy.version,
        },
        ip_address=request.client.host if request.client else None,
    )

    return {
        "status": "updated",
        "visibility": effective_visibility,
        "public_access": target_pa.model_dump(),
        "version": policy.version,
    }


@router.get(
    "/repos/{repo_name}/stats",
    response_model=RepoStatsResponse,
    dependencies=[Depends(require_scope("repo", "read"))],
)
def get_repo_stats(
    repo_name: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """레포 통계 (LakeFS + UC에서 실시간 조회).

    governance: 비멤버는 public_access.stats_read 가 true 일 때만 통과.
    """
    repo = require_capability(
        db, user, repo_name, "stats_read", min_member_role="guest"
    )

    # LakeFS에서 브랜치/커밋 정보 조회
    branches = _lakefs.list_branches(repo_name)
    branch_count = len(branches)

    # main 브랜치 최신 커밋
    last_commit_id = None
    last_commit_message = None
    last_commit_date = None
    commit_count = 0

    commits = _lakefs.get_commit_log(repo_name, "main", amount=1)
    if commits:
        last_commit_id = commits[0].id
        last_commit_message = commits[0].message
        last_commit_date = commits[0].creation_date

    # 전체 커밋 수 (main 기준, 최대 1000)
    all_commits = _lakefs.get_commit_log(repo_name, "main", amount=1000)
    commit_count = len(all_commits)

    # 파일 수/크기 (main 브랜치 루트, recursive)
    file_count = 0
    total_size_bytes = 0
    try:
        after = None
        while True:
            items, has_more, next_offset = _lakefs.list_objects(
                repo_name, "main", prefix="", recursive=True, max_items=1000, after=after,
            )
            for item in items:
                if item.path_type == "object":
                    file_count += 1
                    total_size_bytes += item.size_bytes or 0
            if not has_more:
                break
            after = next_offset
    except Exception:
        pass

    return RepoStatsResponse(
        repo_name=repo_name,
        owner=repo.owner.email,
        visibility=repo.visibility,
        branch_count=branch_count,
        commit_count=commit_count,
        file_count=file_count,
        total_size_bytes=total_size_bytes,
        last_commit_id=last_commit_id,
        last_commit_message=last_commit_message,
        last_commit_date=last_commit_date,
    )


# ── group-scoped aliases ─────────────────────────────────────────────────────

@router.get(
    "/repos/{group}/{repo_name}",
    response_model=RepoInfo,
    dependencies=[Depends(require_scope("repo", "read"))],
)
def get_repo_group(
    group: str,
    repo_name: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """group-scoped 레포 조회 alias — GET /repos/{group}/{repo_name}."""
    return get_repo(f"{group}/{repo_name}", user, db)


@router.delete(
    "/repos/{group}/{repo_name}",
    dependencies=[Depends(require_scope("repo", "delete"))],
)
def delete_repo_group(
    group: str,
    repo_name: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """group-scoped 레포 삭제 alias — DELETE /repos/{group}/{repo_name}."""
    return delete_repo(f"{group}/{repo_name}", request, user, db)


@router.patch(
    "/repos/{group}/{repo_name}/visibility",
    dependencies=[Depends(require_scope("repo", "admin"))],
)
def update_visibility_group(
    group: str,
    repo_name: str,
    body: UpdateVisibilityRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """group-scoped visibility 변경 — PATCH /repos/{owner}/{repo}/visibility (governance §Visibility update)."""
    return update_visibility(f"{group}/{repo_name}", body, request, user, db)


@router.get(
    "/repos/{group}/{repo_name}/stats",
    response_model=RepoStatsResponse,
    dependencies=[Depends(require_scope("repo", "read"))],
)
def get_repo_stats_group(
    group: str,
    repo_name: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """group-scoped stats — GET /repos/{owner}/{repo}/stats."""
    return get_repo_stats(f"{group}/{repo_name}", user, db)
