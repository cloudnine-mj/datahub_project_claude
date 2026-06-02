"""DataHub API — FastAPI 진입점."""

from __future__ import annotations

from importlib import import_module
import logging
import time

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.build_info import BUILD_INFO
from app.config import settings
from app.error_envelope import REQUEST_ID_HEADER, ensure_request_id, error_response

observe_request = import_module("app.services.metrics").observe_request
enforce_rate_limit = import_module("app.services.rate_limit").enforce_rate_limit
configure_tracing = import_module("app.services.tracing").configure_tracing

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)

PREFIX = "/api/v1"

app = FastAPI(
    title="Data Platform Service",
    version=BUILD_INFO.version,
    description="DataHub control-plane API server",
    openapi_url=f"{PREFIX}/openapi.json",
    docs_url=f"{PREFIX}/docs",
    redoc_url=f"{PREFIX}/redoc",
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
async def organizations_deprecation_middleware(request: Request, call_next):
    """`/api/v1/organizations/*` 응답에 Deprecation/Sunset/Link 헤더 부착.

    governance: /organizations 는 /groups (docs/api/groups.md) 로 대체됨.
    RFC 8594 (Deprecation) + RFC 8594 의 Sunset + RFC 8288 의 Link.
    """
    response = await call_next(request)
    if request.url.path.startswith("/api/v1/organizations"):
        response.headers["Deprecation"] = "true"
        response.headers["Sunset"] = "Mon, 30 Jun 2026 00:00:00 GMT"
        response.headers["Link"] = (
            '<https://docs-datahub.lgair-pmt.com/docs/api/groups.html>; '
            'rel="successor-version"'
        )
    return response


def _static_service_tokens() -> dict[str, str]:
    """정적 X-Service-Token → caller 매핑.

    값이 비어 있는 secret 은 매핑에서 제외 — 운영 환경에서 secret 미발급 상태에도
    middleware 가 false-match 를 일으키지 않도록.

    DIA 등 JWT 기반 caller 는 별도 흐름(`verify_service_token`)으로 처리한다.
    """
    raw = {
        settings.web_service_token: "datahub-web",
    }
    return {token: caller for token, caller in raw.items() if token}


@app.middleware("http")
async def service_token_middleware(request: Request, call_next):
    """X-Service-Token 검증 미들웨어.

    분기 (governance §file-transfer X-Service-Token 분기):
    1. 헤더 부재: request.state.service_caller = None (graceful degradation)
    2. 정적 매핑 표(`_static_service_tokens`) 에 일치: caller 설정 (예: datahub-web)
    3. JWT 검증(`verify_service_token`) 성공: caller 설정 (예: dpa / dia)
    4. 둘 다 실패: 401 즉시 반환

    static-token 흐름은 first-party 서비스 (Web BFF) 에서 사전 발급된 시크릿을 사용.
    JWT 흐름은 단기 토큰을 발급하는 DPA→DIA 같은 internal 서비스에서 사용.
    """
    from app.services.service_auth import verify_service_token as _verify

    token = request.headers.get("X-Service-Token")
    if not token:
        request.state.service_caller = None
        return await call_next(request)

    static_map = _static_service_tokens()
    caller = static_map.get(token)
    if caller:
        request.state.service_caller = caller
        return await call_next(request)

    try:
        request.state.service_caller = _verify(token)
    except Exception:
        return error_response(
            request,
            401,
            "Invalid or expired X-Service-Token",
        )
    return await call_next(request)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """요청/응답 로깅 미들웨어."""
    request_id = ensure_request_id(request)
    start = time.time()
    status_code = 500
    try:
        enforce_rate_limit(request)
        response = await call_next(request)
        status_code = response.status_code
        response.headers[REQUEST_ID_HEADER] = request_id
        return response
    except HTTPException as exc:
        status_code = exc.status_code
        return error_response(
            request,
            exc.status_code,
            exc.detail,
            headers=exc.headers,
        )
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


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """HTTP 오류를 공통 envelope로 변환."""
    return error_response(
        request,
        exc.status_code,
        exc.detail,
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """요청 validation 오류를 공통 envelope로 변환."""
    errors = exc.errors()
    first = errors[0] if errors else {}
    loc = first.get("loc") or []
    target = ".".join(str(part) for part in loc if part not in {"body", "query", "path"}) or None
    return error_response(
        request,
        422,
        first.get("msg") or "Validation error",
        code="validation_error",
        target=target,
        retryable=False,
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """전역 예외 핸들러."""
    logging.getLogger("app").error("Unhandled exception: %s", exc, exc_info=True)
    return error_response(request, 500, "Internal server error")


# ── Router 등록 ────────────────────────────────────

from app.routers import auth, catalog, dashboard, files, groups, health, lineage, meta, metrics, organizations, permissions, repos, resolve, users  # noqa: E402

app.include_router(health.router, prefix=PREFIX, tags=["health"])
app.include_router(meta.router, prefix=PREFIX, tags=["meta"])
app.include_router(metrics.router, tags=["metrics"])
app.include_router(auth.router, prefix=PREFIX, tags=["auth"])
app.include_router(groups.router, prefix=PREFIX, tags=["groups"])
app.include_router(organizations.router, prefix=PREFIX, tags=["organizations"])
app.include_router(repos.router, prefix=PREFIX, tags=["repos"])
app.include_router(permissions.router, prefix=PREFIX, tags=["permissions"])
app.include_router(files.router, prefix=PREFIX, tags=["files"])
app.include_router(catalog.router, prefix=PREFIX, tags=["catalog"])
app.include_router(lineage.router, prefix=PREFIX, tags=["lineage"])
app.include_router(dashboard.router, prefix=PREFIX, tags=["dashboard"])
app.include_router(users.router, prefix=PREFIX, tags=["users"])
app.include_router(resolve.router, prefix=PREFIX, tags=["resolve"])


# ── MCP OAuth + StreamableHTTP ────────────────────────
# MCP is outside the launch-target single-domain /api/v1 ingress contract.
# MCP 스펙 2025-03-26: SSE deprecated → StreamableHTTP (/mcp) 사용
# stateless_http=True → 세션 서버 저장 없음, 수평 확장 지원
# MCP import 실패 시에도 기존 API는 정상 동작하도록 보호

if settings.mcp_enabled:
    try:
        from mcp_app.oauth import router as mcp_oauth_router
        from mcp_app.server import mcp as mcp_server

        app.include_router(mcp_oauth_router, tags=["mcp-oauth"])
        app.mount("/", mcp_server.http_app())
        logging.getLogger("app").info("MCP OAuth + StreamableHTTP endpoints enabled")
    except Exception as e:
        logging.getLogger("app").warning("MCP endpoints disabled: %s", e)
else:
    logging.getLogger("app").info("MCP endpoints disabled by configuration")
