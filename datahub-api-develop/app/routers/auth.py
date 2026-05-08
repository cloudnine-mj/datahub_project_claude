"""Auth & Session 엔드포인트.

- GET /auth/login: Google OAuth 리디렉트
- GET /auth/callback: OAuth 콜백 → JWT 발급 → 프론트엔드 리디렉트
- POST /auth/session: 세션 생성 (user info + permissions)
- POST /auth/api-keys: API 키 생성
- GET /auth/api-keys: API 키 목록
- DELETE /auth/api-keys/{prefix}: API 키 삭제
- GET /auth/whoami: 현재 사용자 정보
- POST /auth/device/init: Device flow 시작 (원격 클라이언트용)
- GET /auth/device/authorize: 사용자 브라우저 진입점
- POST /auth/device/token: 클라이언트 polling 엔드포인트
"""

from __future__ import annotations

import base64
import json
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import jwt
import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, get_or_create_user
from app.auth import token_format
from app.auth.scopes import _expand_hierarchy, get_user_rbac_actions
from app.models import AccessToken, AccessTokenGrant, Permission, Repo, User
from app.schemas.auth import (
    AccessTokenInfo,
    AccessTokenListResponse,
    CreateAccessTokenRequest,
    CreateAccessTokenResponse,
    DeviceInitResponse,
    DeviceTokenRequest,
    DeviceTokenResponse,
    GrantSpec,
    LogoutRequest,
    PermissionEntry,
    RefreshTokenRequest,
    SessionResponse,
    TokenRefreshResponse,
    WhoAmIResponse,
)
from app.services.audit import AuditService
from app.services.google_oauth import exchange_authorization_code, get_user_info
from mcp_app.session_store import session_store

router = APIRouter()
audit = AuditService()

# ── Google OAuth (서버가 전담) ─────────────────────────

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"


def _create_jwt(email: str) -> str:
    """서비스 JWT 생성."""
    payload = {
        "email": email,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expiry_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def _issue_refresh_token(email: str) -> str:
    refresh_token = secrets.token_urlsafe(48)
    session_store.set_refresh_token(
        refresh_token,
        {"email": email, "scope": "platform"},
        ttl=settings.jwt_refresh_token_ttl_seconds,
    )
    return refresh_token


def _get_oauth_callback_url(request: Request) -> str:
    """Google에 등록된 redirect_uri 반환. 설정값 우선, 없으면 자동 생성."""
    if settings.oauth_redirect_uri:
        return settings.oauth_redirect_uri
    self_base = str(request.base_url).rstrip("/")
    return f"{self_base}/api/v1/auth/callback"


def _encode_paste_code(token: str, refresh_token: str, cli_state: str, email: str) -> str:
    """토큰 묶음을 base64url(JSON) 한 줄로 인코딩. 붙여넣기 편의."""
    payload = json.dumps(
        {"token": token, "refresh_token": refresh_token, "state": cli_state, "email": email},
        separators=(",", ":"),
    )
    return base64.urlsafe_b64encode(payload.encode()).rstrip(b"=").decode()


@router.get("/auth/login")
def login(
    request: Request,
    redirect_uri: str = "",
    cli_port: int = 0,
    cli_state: str = "",
    cli_paste: bool = False,
):
    """Google OAuth 로그인 시작. 브라우저를 Google 동의 화면으로 리디렉트.

    모드:
      - 웹: cli_port, cli_paste 미지정 → 프론트엔드 쿠키 세팅
      - CLI 콜백: cli_port 지정 → localhost:<cli_port>/callback 으로 리디렉트
      - Paste (원격 Jupyter): cli_paste=true → 콜백이 HTML 페이지로
        토큰 code 렌더 (사용자가 복사 → 터미널 붙여넣기)
    """
    if cli_port and not (1024 <= cli_port <= 65535):
        raise HTTPException(status_code=400, detail="cli_port must be between 1024 and 65535")

    callback_url = _get_oauth_callback_url(request)

    # CLI 로그인이면 state에 인코딩 (paste > port > web 우선순위)
    if cli_paste:
        state = f"paste:{cli_state}"
    elif cli_port:
        state = f"cli:{cli_port}:{cli_state}"
    else:
        state = redirect_uri or "/"

    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": callback_url,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
        "state": state,
    }
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@router.get("/auth/callback")
def callback(
    request: Request,
    code: str = "",
    state: str = "/",
    error: str = "",
    db: Session = Depends(get_db),
):
    """Google OAuth 콜백. authorization code → token → JWT 발급."""
    if error:
        return RedirectResponse(f"{settings.frontend_url}/signin?error={error}")

    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code")

    callback_url = _get_oauth_callback_url(request)

    # Authorization code → access token → user info
    access_token = exchange_authorization_code(
        code=code,
        redirect_uri=callback_url,
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
    )
    userinfo = get_user_info(access_token)
    email = userinfo.email

    # DB에 사용자 등록/조회 (Google display name 도 함께 저장/갱신)
    user = get_or_create_user(db, email, name=userinfo.name)

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="oauth_login",
    )

    # JWT 발급
    service_jwt = _create_jwt(email)
    refresh_token = _issue_refresh_token(email)

    # ── 통합 /auth/complete 리다이렉트 ─────────────────────
    # CLI/Paste/Device 는 여전히 /auth/complete 페이지를 거친다.
    # 웹 로그인은 §16 이후 /auth/complete 를 건너뛰고 state 로 직통.

    # Paste 모드 (legacy `--no-browser`) — code 를 /auth/complete 로 전달
    if state.startswith("paste:"):
        cli_state = state[len("paste:"):]
        code = _encode_paste_code(service_jwt, refresh_token, cli_state, email)
        return RedirectResponse(
            f"{settings.frontend_url}/auth/complete?"
            + urlencode({"mode": "cli", "code": code})
        )

    # Device Authorization Grant — device_code 에 토큰 바인딩 + 완료 페이지
    # (웹 /auth/device 페이지는 그대로 유지; 완료 후엔 /auth/complete 로)
    if state.startswith("device:"):
        device_code = state[len("device:"):]
        if not session_store.has_pending(_device_key(device_code)):
            return RedirectResponse(
                f"{settings.frontend_url}/auth/device?"
                + urlencode({"device_code": "expired_or_invalid"})
            )
        session_store.set_pending(
            _device_key(device_code),
            {
                "status": "granted",
                "token": service_jwt,
                "refresh_token": refresh_token,
                "email": email,
            },
            ttl=DEVICE_FLOW_TTL,
        )
        return RedirectResponse(
            f"{settings.frontend_url}/auth/complete?"
            + urlencode({"mode": "cli", "email": email})
        )

    # CLI 기본 (cli_port) — 웹 /auth/complete 로 redirect, 페이지가 localhost
    # fetch 시도 후 실패 시 code 복사 fallback UI 제공 (datahub-python SDK
    # Phase 3 의 CORS 지원 _CallbackHandler 와 호환)
    if state.startswith("cli:"):
        parts = state.split(":", 2)
        cli_port = parts[1]
        cli_state = parts[2] if len(parts) > 2 else ""
        code = _encode_paste_code(service_jwt, refresh_token, cli_state, email)
        return RedirectResponse(
            f"{settings.frontend_url}/auth/complete?"
            + urlencode({"mode": "cli", "code": code, "cli_port": cli_port})
        )

    # 웹 로그인 — platform_token 쿠키를 세팅한 뒤 state(= 원래 redirect_uri) 로
    # 곧바로 돌려보낸다. Web 은 NextAuth 없이 이 쿠키만 세션으로 사용한다
    # (datahub-auth-redesign §16).
    # state 가 절대 URL 이면 그대로, 상대 경로면 frontend_url 과 합성.
    target = state if state.startswith("http") else f"{settings.frontend_url}{state}"
    response = RedirectResponse(target)
    response.set_cookie(
        key="platform_token",
        value=service_jwt,
        httponly=True,
        secure=True,
        samesite="lax",
        domain=settings.cookie_domain or None,
        path="/",
    )
    response.set_cookie(
        key="platform_refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        domain=settings.cookie_domain or None,
        path="/",
    )
    return response


@router.post("/auth/refresh", response_model=TokenRefreshResponse)
def refresh_access_token(body: RefreshTokenRequest, request: Request):
    refresh_token = body.refresh_token or request.cookies.get("platform_refresh_token", "")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token required")

    stored = session_store.get_refresh_token(refresh_token)
    if stored is None or stored.get("scope") != "platform":
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    session_store.delete_refresh_token(refresh_token)
    new_refresh_token = _issue_refresh_token(stored["email"])
    access_token = _create_jwt(stored["email"])
    return TokenRefreshResponse(
        access_token=access_token,
        expires_in=settings.jwt_expiry_minutes * 60,
        refresh_token=new_refresh_token,
    )


@router.post("/auth/logout")
def logout(
    body: LogoutRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """로그아웃. Refresh token 즉시 삭제 + 쿠키 클리어.

    refresh_token 은 body 또는 platform_refresh_token 쿠키에서 읽음.
    토큰이 없거나 이미 만료된 경우에도 200 반환 (idempotent).
    """
    from fastapi.responses import JSONResponse as _JSONResponse

    refresh_token = body.refresh_token or request.cookies.get("platform_refresh_token", "")
    if refresh_token:
        session_store.delete_refresh_token(refresh_token)

    audit.log(
        db,
        user_id=None,
        user_email=None,
        action="logout",
        resource_type="session",
        resource_id=None,
        details={"token_present": bool(refresh_token)},
        ip_address=request.client.host if request.client else None,
    )

    response = _JSONResponse(content={"status": "logged_out"})
    # 쿠키 삭제는 set 시와 동일한 (name, domain, path) 로 매칭돼야 한다.
    # settings.cookie_domain 이 ".datahub.lgair-data.com" 이면 Domain 을 그대로
    # 넘겨 브라우저가 실제 쿠키를 지우도록 한다.
    cookie_domain = settings.cookie_domain or None
    response.delete_cookie(key="platform_token", path="/", domain=cookie_domain)
    response.delete_cookie(
        key="platform_refresh_token", path="/", domain=cookie_domain
    )
    return response


# ── 기존 엔드포인트 ───────────────────────────────────


def _get_user_permissions(db: Session, user: User) -> list[PermissionEntry]:
    """사용자의 전체 권한 목록 (소유 + 부여받은 권한)."""
    permissions: list[PermissionEntry] = []

    # 소유 레포
    for repo in db.query(Repo).filter(Repo.owner_id == user.id).all():
        permissions.append(PermissionEntry(repo=repo.repo_name, role="owner"))

    # 부여받은 권한
    for perm in db.query(Permission).filter(Permission.user_id == user.id).all():
        permissions.append(PermissionEntry(repo=perm.repo_name, role=perm.role))

    return permissions


@router.post("/auth/session", response_model=SessionResponse)
def create_session(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """세션 생성. user info + permissions 반환."""
    permissions = _get_user_permissions(db, user)

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="session_create",
        ip_address=request.client.host if request.client else None,
    )

    return SessionResponse(
        email=user.email,
        name=user.name,
        role=user.role or "USER",
        lab_id=user.lab_id,
        tech_cell_id=user.tech_cell_id,
        permissions=permissions,
    )


# ── Access Tokens v2 (architecture/access-tokens.md) ──────────────────────

_ALLOWED_TOKEN_TYPES = {"read", "write", "fine_grained"}
_MAX_EXPIRES_DAYS = 365 * 5
_MAX_NAME_LEN = 100
_DEPRECATION_SUNSET = "2026-07-30"  # api-keys 호환 cut-off


def _validate_create_body(body: CreateAccessTokenRequest) -> None:
    if not body.name or not body.name.strip():
        raise HTTPException(status_code=400, detail="name is required")
    if len(body.name) > _MAX_NAME_LEN:
        raise HTTPException(status_code=400, detail=f"name too long (max {_MAX_NAME_LEN})")
    if body.token_type not in _ALLOWED_TOKEN_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"invalid token_type: must be one of {sorted(_ALLOWED_TOKEN_TYPES)}",
        )
    if body.expires_in_days is not None:
        if body.expires_in_days <= 0 or body.expires_in_days > _MAX_EXPIRES_DAYS:
            raise HTTPException(status_code=400, detail="expires_in_days must be 1..1825")
    if body.token_type == "fine_grained":
        if not body.grants:
            raise HTTPException(
                status_code=400, detail="fine_grained token requires non-empty grants"
            )


def _resolve_access_token(db: Session, user: User, ref: str) -> AccessToken:
    """id 또는 prefix 로 본인 토큰 조회. 없으면 404."""
    q = db.query(AccessToken).filter(AccessToken.user_id == user.id)
    if ref.isdigit():
        token = q.filter(AccessToken.id == int(ref)).first()
    else:
        token = q.filter(AccessToken.token_prefix == ref).first()
    if token is None:
        raise HTTPException(status_code=404, detail="access token not found")
    return token


def _grants_to_specs(grants: list[AccessTokenGrant]) -> list[GrantSpec]:
    return [
        GrantSpec(
            resource_type=g.resource_type,
            resource_id=g.resource_id,
            action=g.action,
        )
        for g in grants
    ]


def _to_token_info(t: AccessToken) -> AccessTokenInfo:
    return AccessTokenInfo(
        id=t.id,
        prefix=t.token_prefix,
        name=t.name or "",
        token_type=t.token_type,
        created_at=t.created_at,
        last_used=t.last_used,
        expires_at=t.expires_at,
        is_active=t.is_active,
        revoked_at=t.revoked_at,
        grants=_grants_to_specs(list(t.grants)),
    )


def _build_grants_for_type(
    db: Session,
    user: User,
    body: CreateAccessTokenRequest,
) -> list[AccessTokenGrant]:
    """token_type 별 grants list 구성.

    - read       → [(user, '*', read)] 1건만
    - write      → [(user, '*', write)] 1건만
    - fine_grained → body.grants 그대로 (단, 사용자 RBAC 으로 검증)
    """
    if body.token_type == "read":
        return [AccessTokenGrant(resource_type="user", resource_id="*", action="read")]
    if body.token_type == "write":
        return [AccessTokenGrant(resource_type="user", resource_id="*", action="write")]

    # fine_grained — RBAC 게이트로 사용자 권한 검증
    out: list[AccessTokenGrant] = []
    for grant in body.grants or []:
        # RBAC: 발급자가 그 자원/액션에 대해 권한이 있는지 확인 (architecture §3.7 시나리오 4)
        if grant.resource_type == "repo":
            rbac = get_user_rbac_actions(db, user, grant.resource_id) or set()
            if grant.action not in _expand_hierarchy(rbac):
                audit.log(
                    db,
                    user_id=user.id,
                    user_email=user.email,
                    action="token_create_denied",
                    resource_type=grant.resource_type,
                    resource_id=grant.resource_id,
                    details={"action": grant.action, "rbac_actions": list(rbac)},
                    status="failure",
                )
                raise HTTPException(
                    status_code=403,
                    detail=(
                        f"you do not have '{grant.action}' on "
                        f"{grant.resource_type}/{grant.resource_id}"
                    ),
                )
        # group / catalog / snapshot* / user 자원의 RBAC 검증은 follow-up PR 에서.
        out.append(
            AccessTokenGrant(
                resource_type=grant.resource_type,
                resource_id=grant.resource_id,
                action=grant.action,
            )
        )
    return out


@router.post("/auth/access-tokens", response_model=CreateAccessTokenResponse)
def create_access_token(
    body: CreateAccessTokenRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """access token 발급. 응답의 ``access_token`` 은 이 호출에서만 1회 노출."""
    _validate_create_body(body)

    raw, prefix, token_hash = token_format.generate_access_token()
    expires_at = (
        datetime.now(timezone.utc) + timedelta(days=body.expires_in_days)
        if body.expires_in_days
        else None
    )

    token = AccessToken(
        user_id=user.id,
        token_prefix=prefix,
        token_hash=token_hash,
        name=body.name.strip(),
        token_type=body.token_type,
        expires_at=expires_at,
        created_ip=request.client.host if request.client else None,
    )
    token.grants = _build_grants_for_type(db, user, body)
    db.add(token)
    db.commit()
    db.refresh(token)

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="token_create",
        resource_type="access_token",
        resource_id=str(token.id),
        details={
            "prefix": prefix,
            "name": token.name,
            "token_type": token.token_type,
            "expires_at": (
                token.expires_at.isoformat() if token.expires_at else None
            ),
            "grants": [
                {"r": g.resource_type, "id": g.resource_id, "a": g.action}
                for g in token.grants
            ],
        },
        ip_address=request.client.host if request.client else None,
    )

    return CreateAccessTokenResponse(
        access_token=raw,
        id=token.id,
        prefix=prefix,
        name=token.name,
        token_type=token.token_type,
        created_at=token.created_at,
        expires_at=token.expires_at,
        grants=_grants_to_specs(list(token.grants)),
    )


@router.get("/auth/access-tokens", response_model=AccessTokenListResponse)
def list_access_tokens(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    include_revoked: bool = False,
):
    """사용자의 access token 목록. raw 는 미노출 (prefix 만)."""
    q = db.query(AccessToken).filter(AccessToken.user_id == user.id)
    if not include_revoked:
        q = q.filter(AccessToken.is_active == True)  # noqa: E712
    tokens = q.order_by(AccessToken.created_at.desc()).all()
    return AccessTokenListResponse(
        access_tokens=[_to_token_info(t) for t in tokens]
    )


@router.delete("/auth/access-tokens/{ref}")
def delete_access_token(
    ref: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """access token revoke. ``ref`` 는 숫자 id 또는 ``dh_...``/``dl_...`` prefix. 멱등."""
    token = _resolve_access_token(db, user, ref)

    if not token.is_active:
        return {"status": "already_revoked", "id": token.id}

    token.is_active = False
    token.revoked_at = datetime.now(timezone.utc)
    db.commit()

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="token_revoke",
        resource_type="access_token",
        resource_id=str(token.id),
        details={"prefix": token.token_prefix, "name": token.name},
        ip_address=request.client.host if request.client else None,
    )

    return {"status": "revoked", "id": token.id}


@router.post(
    "/auth/access-tokens/{ref}/rotate",
    response_model=CreateAccessTokenResponse,
)
def rotate_access_token(
    ref: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """기존 토큰을 revoke 하고 같은 name/type/grants/expires_at 로 새 토큰 발급. atomic."""
    old = _resolve_access_token(db, user, ref)
    if not old.is_active:
        raise HTTPException(status_code=400, detail="cannot rotate revoked token")

    raw, prefix, token_hash = token_format.generate_access_token()
    new = AccessToken(
        user_id=user.id,
        token_prefix=prefix,
        token_hash=token_hash,
        name=old.name,
        token_type=old.token_type,
        expires_at=old.expires_at,
        created_ip=request.client.host if request.client else None,
    )
    # grants 복제 (orphan-cascade 충돌 방지를 위해 detach 후 신규 row)
    new.grants = [
        AccessTokenGrant(
            resource_type=g.resource_type,
            resource_id=g.resource_id,
            action=g.action,
        )
        for g in old.grants
    ]
    old.is_active = False
    old.revoked_at = datetime.now(timezone.utc)
    db.add(new)
    db.commit()
    db.refresh(new)

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="token_rotate",
        resource_type="access_token",
        resource_id=str(new.id),
        details={
            "old_prefix": old.token_prefix,
            "old_id": old.id,
            "new_prefix": prefix,
            "token_type": new.token_type,
        },
        ip_address=request.client.host if request.client else None,
    )

    return CreateAccessTokenResponse(
        access_token=raw,
        id=new.id,
        prefix=prefix,
        name=new.name,
        token_type=new.token_type,
        created_at=new.created_at,
        expires_at=new.expires_at,
        grants=_grants_to_specs(list(new.grants)),
    )


# ── 한시 호환 — /auth/api-keys → /auth/access-tokens 308 redirect ──────
# architecture §5.5: 3 개월 grace 기간. Deprecation / Sunset 헤더 부착.

def _deprecation_redirect(target_path: str) -> RedirectResponse:
    headers = {
        "Deprecation": "true",
        "Sunset": _DEPRECATION_SUNSET,
        "Link": '</docs/api/access-tokens>; rel="deprecation"',
    }
    return RedirectResponse(
        url=target_path, status_code=308, headers=headers
    )


@router.api_route(
    "/auth/api-keys",
    methods=["GET", "POST"],
    include_in_schema=False,
)
def _api_keys_redirect_root(request: Request):
    return _deprecation_redirect("/api/v1/auth/access-tokens")


@router.api_route(
    "/auth/api-keys/{ref}",
    methods=["GET", "DELETE"],
    include_in_schema=False,
)
def _api_keys_redirect_item(ref: str):
    return _deprecation_redirect(f"/api/v1/auth/access-tokens/{ref}")


@router.api_route(
    "/auth/api-keys/{ref}/rotate",
    methods=["POST"],
    include_in_schema=False,
)
def _api_keys_redirect_rotate(ref: str):
    return _deprecation_redirect(f"/api/v1/auth/access-tokens/{ref}/rotate")


@router.get("/auth/whoami", response_model=WhoAmIResponse)
def whoami(user: User = Depends(get_current_user)):
    """현재 사용자 정보."""
    return WhoAmIResponse(email=user.email, user_id=user.id)


# ── Device Authorization Grant (원격 Jupyter/CLI용) ──────
# 로컬 브라우저에서 인증, 원격 서버가 polling 으로 토큰 수신. 포트 포워딩 불필요.

DEVICE_FLOW_TTL = 600          # device_code 유효 시간 (초)
DEVICE_FLOW_INTERVAL = 5       # 클라이언트 권장 polling 간격 (초)


def _device_key(device_code: str) -> str:
    """session_store.pending 네임스페이스 내 'device:' 접두사."""
    return f"device:{device_code}"


@router.post("/auth/device/init", response_model=DeviceInitResponse)
def device_init(request: Request):
    """Device flow 시작 — verification_uri 를 반환. 클라가 이 URL 을 사용자에게 출력.

    verification_uri 는 웹의 /auth/device 페이지를 가리키며, 해당 페이지에서
    사용자가 '승인' 버튼을 누르면 API `/auth/device/authorize` 로 이동해
    Google OAuth 가 시작된다 (RFC 8628 의 user intent confirmation 단계).
    """
    device_code = secrets.token_urlsafe(32)
    session_store.set_pending(
        _device_key(device_code),
        {"status": "pending"},
        ttl=DEVICE_FLOW_TTL,
    )
    verification_uri = (
        f"{settings.frontend_url}/auth/device?"
        + urlencode({"device_code": device_code})
    )
    return DeviceInitResponse(
        device_code=device_code,
        verification_uri=verification_uri,
        expires_in=DEVICE_FLOW_TTL,
        interval=DEVICE_FLOW_INTERVAL,
    )


@router.get("/auth/device/authorize")
def device_authorize(device_code: str, request: Request):
    """브라우저 진입점 — device_code 검증 후 Google OAuth 로 리디렉트.

    웹 /auth/device 페이지가 '승인' 버튼 클릭 시 이 엔드포인트로 이동. 무효
    device_code 면 웹 쪽 에러 페이지로 되돌려보내 UI 일관성 유지.
    """
    if not session_store.has_pending(_device_key(device_code)):
        return RedirectResponse(
            f"{settings.frontend_url}/auth/device?"
            + urlencode({"device_code": "expired_or_invalid"})
        )

    callback_url = _get_oauth_callback_url(request)
    state = f"device:{device_code}"
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": callback_url,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
        "state": state,
    }
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@router.post("/auth/device/token", response_model=DeviceTokenResponse)
def device_token(body: DeviceTokenRequest):
    """클라이언트 polling.

    응답:
      200  — 인증 완료, 토큰 반환 후 device_code 파기 (일회용)
      400  — expired_token (device_code 없음/만료)
      428  — authorization_pending (브라우저 인증 미완료, interval 대기 후 재시도)
    """
    rec = session_store.get_pending(_device_key(body.device_code))
    if rec is None:
        raise HTTPException(status_code=400, detail="expired_token")

    status = rec.get("status")
    if status == "pending":
        raise HTTPException(status_code=428, detail="authorization_pending")
    if status != "granted":
        raise HTTPException(status_code=400, detail=f"invalid_state:{status}")

    # 토큰 인도 완료 → 즉시 파기
    session_store.pop_pending(_device_key(body.device_code))
    return DeviceTokenResponse(
        access_token=rec["token"],
        refresh_token=rec["refresh_token"],
        expires_in=settings.jwt_expiry_minutes * 60,
        email=rec["email"],
    )
