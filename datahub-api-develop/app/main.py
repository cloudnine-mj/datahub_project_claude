"""Data Platform Service — FastAPI 진입점.

LakeFS, Unity Catalog, GCS를 통합하는 API 서버.
SDK는 이 서버의 API만 호출하는 thin client가 됩니다.
"""

from __future__ import annotations

from importlib import import_module
import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings

observe_request = import_module("app.services.metrics").observe_request
enforce_rate_limit = import_module("app.services.rate_limit").enforce_rate_limit
configure_tracing = import_module("app.services.tracing").configure_tracing

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)

app = FastAPI(
    title="Data Platform Service",
    version="0.1.0",
    description="LakeFS, Unity Catalog, GCS 통합 API 서버",
)
configure_tracing(app)


# ── CORS ──────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Middleware ──────────────────────────────────────


@app.middleware("http")
async def service_token_middleware(request: Request, call_next):
    """X-Service-Token 검증 미들웨어.

    - 헤더 존재 + 유효: request.state.service_caller = caller 설정
    - 헤더 부재: request.state.service_caller = None (graceful degradation)
    - 헤더 존재 + 유효하지 않음: 401 즉시 반환
    """
    from app.services.service_auth import verify_service_token as _verify

    token = request.headers.get("X-Service-Token")
    if token:
        try:
            request.state.service_caller = _verify(token)
        except Exception:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or expired X-Service-Token"},
            )
    else:
        request.state.service_caller = None
    return await call_next(request)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """요청/응답 로깅 미들웨어."""
    start = time.time()
    status_code = 500
    try:
        enforce_rate_limit(request)
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        duration = time.time() - start
        observe_request(request.method, request.url.path, status_code, duration)
        logging.getLogger("app.access").info(
            "%s %s %d %.3fs",
            request.method,
            request.url.path,
            status_code,
            duration,
        )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """전역 예외 핸들러."""
    logging.getLogger("app").error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# ── Router 등록 ────────────────────────────────────

from app.routers import auth, catalog, dashboard, files, health, lineage, meta, metrics, organizations, permissions, repos, users, versioning

PREFIX = "/api/v1"

app.include_router(health.router, prefix=PREFIX, tags=["health"])
app.include_router(meta.router, prefix=PREFIX, tags=["meta"])
app.include_router(metrics.router, tags=["metrics"])
app.include_router(auth.router, prefix=PREFIX, tags=["auth"])
app.include_router(organizations.router, prefix=PREFIX, tags=["organizations"])
app.include_router(repos.router, prefix=PREFIX, tags=["repos"])
app.include_router(permissions.router, prefix=PREFIX, tags=["permissions"])
app.include_router(files.router, prefix=PREFIX, tags=["files"])
app.include_router(versioning.router, prefix=PREFIX, tags=["versioning"])
app.include_router(catalog.router, prefix=PREFIX, tags=["catalog"])
app.include_router(lineage.router, prefix=PREFIX, tags=["lineage"])
app.include_router(dashboard.router, prefix=PREFIX, tags=["dashboard"])
app.include_router(users.router, prefix=PREFIX, tags=["users"])


# ── MCP OAuth + StreamableHTTP ────────────────────────
# Claude Desktop / Claude Code에서 api.datahub.lgair-data.com/mcp (환경별 도메인) 로 연결
# MCP 스펙 2025-03-26: SSE deprecated → StreamableHTTP (/mcp) 사용
# stateless_http=True → 세션 서버 저장 없음, 수평 확장 지원
# MCP import 실패 시에도 기존 API는 정상 동작하도록 보호

try:
    from mcp_app.oauth import router as mcp_oauth_router
    from mcp_app.server import mcp as mcp_server

    app.include_router(mcp_oauth_router, tags=["mcp-oauth"])
    app.mount("/", mcp_server.http_app())
    logging.getLogger("app").info("MCP OAuth + StreamableHTTP endpoints enabled")
except Exception as e:
    logging.getLogger("app").warning("MCP endpoints disabled: %s", e)
