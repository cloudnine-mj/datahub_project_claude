"""Data Platform MCP Server (OAuth 인증 기반).

기존 data-platform-api의 서비스 레이어를 직접 사용하며,
Bearer 토큰(JWT / Google OAuth / API Key)으로 인증합니다.
도구에 api_key 파라미터가 없고, 인증된 사용자 컨텍스트에서 동작합니다.

Claude Desktop, Claude Code 등 MCP 클라이언트에서 StreamableHTTP(/mcp)로 연결합니다.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastmcp import FastMCP, Context

from app.database import SessionLocal
from app.dependencies import get_or_create_user
from app.models import Permission, Repo
from app.services.gcs import GCSService
from app.services.lakefs import LakeFSService
from app.services.unity_catalog import UnityCatalogService

from mcp_app.auth import authenticate_token

logger = logging.getLogger(__name__)

mcp = FastMCP(
    "Data Platform",
    instructions=(
        "데이터 플랫폼 도구 모음입니다. "
        "데이터셋 레포지토리 조회, 파일 탐색/다운로드, 버전 관리, "
        "카탈로그 검색, 데이터셋 활용 가이드 등을 수행할 수 있습니다."
    ),
    stateless_http=True,
)

_gcs = GCSService()
_lakefs = LakeFSService()
_uc = UnityCatalogService()


# ── Auth helper ──────────────────────────────────────

def _get_user_email(ctx: Context) -> str:
    """MCP 컨텍스트에서 인증된 사용자 이메일 추출."""
    # fastmcp 3.x: get_http_request()로 HTTP 요청 객체에 접근
    headers = {}
    try:
        from fastmcp.server.dependencies import get_http_request
        req = get_http_request()
        if req and hasattr(req, "headers"):
            headers = dict(req.headers)
    except Exception:
        pass

    # Authorization: Bearer <token>
    auth_header = headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        email = authenticate_token(token)
        if email:
            return email

    # X-API-Key: dl_...
    api_key = headers.get("x-api-key", "")
    if api_key:
        db = SessionLocal()
        try:
            from mcp_app.auth import _authenticate_api_key
            email = _authenticate_api_key(db, api_key)
            if email:
                return email
        finally:
            db.close()

    raise ValueError("인증 실패: Bearer 토큰 또는 API 키가 필요합니다")


def _get_user_db(email: str):
    """인증된 이메일로 DB 세션 + User 객체 반환."""
    db = SessionLocal()
    user = get_or_create_user(db, email)
    return db, user


def _check_repo_access(db, user, repo_name: str):
    """레포 접근 권한 확인."""
    repo = db.query(Repo).filter(Repo.repo_name == repo_name).first()
    if repo is None:
        raise ValueError(f"레포지토리 '{repo_name}'를 찾을 수 없습니다")
    if repo.owner_id == user.id:
        return repo
    perm = db.query(Permission).filter(
        Permission.repo_name == repo_name,
        Permission.user_id == user.id,
    ).first()
    if perm is None:
        raise ValueError(f"'{repo_name}'에 대한 접근 권한이 없습니다")
    return repo


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Auth
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@mcp.tool()
def get_session(ctx: Context) -> dict:
    """현재 인증된 사용자 정보와 접근 가능한 레포 목록을 반환합니다."""
    email = _get_user_email(ctx)
    db, user = _get_user_db(email)
    try:
        repos = []
        for repo in db.query(Repo).filter(Repo.owner_id == user.id).all():
            repos.append({"repo_name": repo.repo_name, "role": "owner"})
        for perm in db.query(Permission).filter(Permission.user_id == user.id).all():
            repos.append({"repo_name": perm.repo_name, "role": perm.role})
        return {"email": user.email, "repos": repos}
    finally:
        db.close()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Repos
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@mcp.tool()
def list_repos(ctx: Context) -> dict:
    """현재 사용자가 접근 가능한 레포지토리 목록을 조회합니다."""
    email = _get_user_email(ctx)
    db, user = _get_user_db(email)
    try:
        repos = []
        for repo in db.query(Repo).filter(Repo.owner_id == user.id).all():
            repos.append({"repo_name": repo.repo_name, "owner": user.email, "role": "owner"})
        for perm in db.query(Permission).filter(Permission.user_id == user.id).all():
            repos.append({"repo_name": perm.repo_name, "owner": perm.repo.owner.email, "role": perm.role})
        return {"repos": repos}
    finally:
        db.close()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Files
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@mcp.tool()
def list_files(
    repo: str,
    ctx: Context,
    branch: str = "main",
    prefix: str = "",
    recursive: bool = False,
    amount: int = 100,
) -> dict:
    """레포지토리의 파일/디렉터리 목록을 조회합니다.

    Args:
        repo: 레포지토리 이름
        branch: 브랜치 이름 (기본값: main)
        prefix: 경로 접두사 필터 (예: "data/train/")
        recursive: 하위 디렉터리까지 재귀 탐색 여부
        amount: 한 페이지당 최대 항목 수
    """
    email = _get_user_email(ctx)
    db, user = _get_user_db(email)
    try:
        _check_repo_access(db, user, repo)
        entries, has_more, next_offset = _lakefs.list_objects(
            repo, branch, prefix=prefix, recursive=recursive, max_items=amount,
        )
        return {
            "items": [
                {"path": e.path, "path_type": e.path_type, "size_bytes": e.size_bytes, "mtime": e.mtime}
                for e in entries
            ],
            "has_more": has_more,
        }
    finally:
        db.close()


@mcp.tool()
def preview_content(
    repo: str,
    path: str,
    ctx: Context,
    ref: str = "main",
    max_bytes: int = 10240,
) -> dict:
    """파일 내용을 미리보기합니다 (최대 10KB).

    Args:
        repo: 레포지토리 이름
        path: 파일 경로
        ref: 브랜치 또는 커밋 ref
        max_bytes: 최대 바이트 수 (기본 10240)
    """
    email = _get_user_email(ctx)
    db, user = _get_user_db(email)
    try:
        _check_repo_access(db, user, repo)
        content, total_size, truncated = _lakefs.get_object_content(repo, ref, path, max_bytes=max_bytes)
        return {"content": content, "total_size": total_size, "truncated": truncated}
    finally:
        db.close()


@mcp.tool()
def download(
    repo: str,
    branch: str,
    paths: list[str],
    ctx: Context,
) -> dict:
    """파일 다운로드용 Signed URL을 발급합니다. 브라우저에서 클릭하여 직접 다운로드할 수 있는 링크를 반환합니다.

    먼저 list_files로 파일 경로를 확인한 뒤, 해당 경로를 paths에 전달하세요.

    Args:
        repo: 레포지토리 이름
        branch: 브랜치 이름 (기본: main)
        paths: 다운로드할 파일/디렉터리 경로 목록 (예: ["data/train.csv"])
    """
    email = _get_user_email(ctx)
    db, user = _get_user_db(email)
    try:
        _check_repo_access(db, user, repo)
        files = []
        for path in paths:
            if path.endswith("/") or path == "":
                for logical_path, physical_addr, _size_bytes in _lakefs.iter_physical_paths(repo, branch, path):
                    signed_url = _gcs.generate_signed_url(physical_addr, method="GET")
                    files.append({"path": logical_path, "signed_url": signed_url})
            else:
                physical_addr, _size_bytes = _lakefs.resolve_physical_path(repo, branch, path)
                signed_url = _gcs.generate_signed_url(physical_addr, method="GET")
                files.append({"path": path, "signed_url": signed_url})
        return {"files": files}
    finally:
        db.close()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Permissions
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@mcp.tool()
def list_permissions(repo: str, ctx: Context) -> dict:
    """레포지토리에 부여된 권한 목록을 조회합니다. 소유자만 조회 가능합니다.

    Args:
        repo: 레포지토리 이름
    """
    email = _get_user_email(ctx)
    db, user = _get_user_db(email)
    try:
        repo_obj = db.query(Repo).filter(Repo.repo_name == repo).first()
        if repo_obj is None:
            return {"error": f"레포지토리 '{repo}'를 찾을 수 없습니다"}
        if repo_obj.owner_id != user.id:
            return {"error": "소유자만 권한을 조회할 수 있습니다"}
        perms = db.query(Permission).filter(Permission.repo_name == repo).all()
        return {
            "permissions": [
                {"email": p.user.email, "role": p.role, "granted_at": str(p.created_at)}
                for p in perms
            ]
        }
    finally:
        db.close()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Versioning
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@mcp.tool()
def list_branches(repo: str, ctx: Context) -> dict:
    """레포지토리의 모든 브랜치를 조회합니다.

    Args:
        repo: 레포지토리 이름
    """
    email = _get_user_email(ctx)
    db, user = _get_user_db(email)
    try:
        _check_repo_access(db, user, repo)
        branches = _lakefs.list_branches(repo)
        return {"branches": branches}
    finally:
        db.close()


@mcp.tool()
def get_commits(
    repo: str,
    ctx: Context,
    ref: str = "main",
    amount: int = 30,
) -> dict:
    """커밋 이력을 조회합니다.

    Args:
        repo: 레포지토리 이름
        ref: 브랜치 또는 커밋 ref
        amount: 조회할 커밋 수
    """
    email = _get_user_email(ctx)
    db, user = _get_user_db(email)
    try:
        _check_repo_access(db, user, repo)
        commits = _lakefs.get_commit_log(repo, ref, amount=amount)
        return {
            "commits": [
                {"id": c.id, "message": c.message, "committer": c.committer, "creation_date": c.creation_date}
                for c in commits
            ]
        }
    finally:
        db.close()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Catalog
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@mcp.tool()
def search_catalog(
    ctx: Context,
    keyword: str = "",
    catalog_name: str | None = None,
    max_results: int = 50,
    modality: str | None = None,
    task: str | None = None,
    organization: str | None = None,
    data_card_tier: str | None = None,
) -> dict:
    """데이터셋 카탈로그를 키워드와 필터로 검색합니다.

    Args:
        keyword: 검색 키워드
        catalog_name: 카탈로그 이름 필터
        max_results: 최대 결과 수
        modality: 모달리티 필터 (Text/Image/Audio/Video/Tabular/Mixed)
        task: 태스크 필터 (QA/Summarization/Classification 등)
        organization: 조직 필터
        data_card_tier: 데이터카드 티어 필터
    """
    _get_user_email(ctx)  # 인증 확인
    filters = {}
    for k, v in [("modality", modality), ("task", task), ("organization", organization), ("data_card_tier", data_card_tier)]:
        if v is not None:
            filters[k] = v

    tables = _uc.search(
        keyword=keyword,
        catalog_name=catalog_name,
        max_results=max_results,
        filters=filters if filters else None,
    )
    return {
        "tables": [
            {
                "full_name": t.full_name,
                "catalog_name": t.catalog_name,
                "table_name": t.table_name,
                "comment": t.comment,
                "properties": t.properties,
            }
            for t in tables
        ]
    }


@mcp.tool()
def get_table(full_name: str, ctx: Context) -> dict:
    """데이터셋 테이블의 상세 정보를 조회합니다.

    Args:
        full_name: 전체 테이블 이름 (예: "datasets.default.my_dataset")
    """
    _get_user_email(ctx)  # 인증 확인
    try:
        t = _uc.get_table(full_name)
    except Exception:
        return {"error": f"테이블을 찾을 수 없습니다: {full_name}"}
    return {
        "full_name": t.full_name,
        "catalog_name": t.catalog_name,
        "schema_name": t.schema_name,
        "table_name": t.table_name,
        "storage_location": t.storage_location,
        "comment": t.comment,
        "table_type": t.table_type,
        "data_source_format": t.data_source_format,
        "properties": t.properties,
    }


@mcp.tool()
def list_tables(catalog: str, schema: str, ctx: Context) -> dict:
    """카탈로그.스키마 내 모든 테이블을 조회합니다.

    Args:
        catalog: 카탈로그 이름 (예: "datasets")
        schema: 스키마 이름 (예: "default")
    """
    _get_user_email(ctx)  # 인증 확인
    tables = _uc.list_tables(catalog, schema)
    return {
        "tables": [
            {"full_name": t.full_name, "table_name": t.table_name, "comment": t.comment, "properties": t.properties}
            for t in tables
        ]
    }


@mcp.tool()
def list_catalogs(ctx: Context) -> dict:
    """등록된 모든 카탈로그 목록을 조회합니다."""
    _get_user_email(ctx)  # 인증 확인
    catalogs = _uc.list_catalogs()
    return {"catalogs": catalogs}


@mcp.tool()
def get_filter_options(ctx: Context) -> dict:
    """카탈로그 검색에 사용할 수 있는 필터 옵션을 조회합니다."""
    _get_user_email(ctx)  # 인증 확인
    return _uc.get_filter_options()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Usage Guide
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@mcp.tool()
def get_usage_guide(repo: str, ctx: Context) -> dict:
    """데이터셋의 다운로드, 업로드, 탐색, 메타데이터 조회, HuggingFace 연동, 버전 관리 등 활용 방법을 안내합니다.

    사용자가 데이터를 어떻게 사용하는지, 다운로드/업로드 방법, SDK/CLI 사용법 등을 물어볼 때 이 도구를 호출하세요.

    Args:
        repo: 레포지토리 이름 (예: "my-dataset")
    """
    _get_user_email(ctx)  # 인증 확인
    table_name = repo.replace("-", "_")
    full_name = f"datasets.default.{table_name}"

    return {
        "repo": repo,
        "table_name": table_name,
        "full_name": full_name,
        "install": {
            "description": "data-layer SDK 설치 (GCP 인증 필요: gcloud auth login)",
            "command": (
                "uv pip install data-layer --upgrade"
                " --extra-index-url https://oauth2accesstoken:$(gcloud auth print-access-token)"
                "@us-central1-python.pkg.dev/lgair-futurecast/python-packages/simple/"
                " --native-tls"
            ),
        },
        "python_sdk": {
            "download": f'from data_layer import DataClient\n\nclient = DataClient()\nclient.download("{repo}", "/", "./data/{table_name}/")',
            "upload": f'from data_layer import DataClient\n\nclient = DataClient()\nclient.upload("{repo}", "./output/", branch="main", message="Add processed data")',
            "explore": f'from data_layer import DataClient\n\nclient = DataClient()\nresult = client.ls("{repo}", recursive=True)\nfor path in result.items:\n    print(path)',
            "metadata": f'from data_layer import DataClient\n\nclient = DataClient()\ntable = client.get_table("{full_name}")\nprint(table.properties)',
            "huggingface": f'from data_layer import DataClient\n\nclient = DataClient()\nds = client.load("{table_name}")',
            "versioning": f'from data_layer import DataClient\n\nclient = DataClient()\nclient.create_branch("{repo}", "exp-v2", source="main")\nclient.upload("{repo}", "./data/", branch="exp-v2", message="Experimental data")\nclient.merge("{repo}", "exp-v2", into="main")',
        },
        "cli": {
            "download": f"datalayer cp lakefs://{repo}/main/ ./data/{table_name}/",
            "upload": f'datalayer cp ./output/ lakefs://{repo}/main/ -m "Add processed data"',
            "explore": f"datalayer ls lakefs://{repo}/main/ -r",
            "metadata": f"datalayer catalog get {full_name}",
            "versioning": f"datalayer branch create {repo} exp-v2\ndatalayer cp ./data/ lakefs://{repo}/exp-v2/ -m \"Experimental data\"\ndatalayer merge {repo} exp-v2 --into main",
        },
    }
