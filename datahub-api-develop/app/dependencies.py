"""FastAPI 의존성 주입.

헤더 기반 인증:
  Authorization: Bearer <service_jwt>            (프론트엔드)
  Authorization: Bearer <google_access_token>    (SDK 등 외부)
  Authorization: Bearer dh_... / dl_...          (access token, v2/v1)
  X-API-Key: dh_... / dl_...                     (한시 호환 — 헤더 별칭)

architecture/access-tokens.md §1.4 (RBAC) + §4 (토큰 형식) 구현.
"""

from __future__ import annotations

import jwt
import bcrypt
from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import token_format
from app.auth.scopes import _expand_hierarchy, _grants_match, get_user_rbac_actions
from app.config import settings
from app.database import get_db
from app.models import AccessToken, AccessTokenGrant, User
from app.services.google_auth import verify_google_token
from app.services.service_auth import verify_service_token


def get_or_create_user(db: Session, email: str, name: str | None = None) -> User:
    """이메일로 사용자 조회, 없으면 자동 등록."""
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        user = User(email=email, name=name)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    if name and user.name != name:
        user.name = name
        db.commit()
        db.refresh(user)
    return user


def _authenticate_access_token(
    db: Session, raw: str, request: Optional[Request] = None
) -> User:
    """access token (dh_ / dl_) 으로 사용자 인증.

    실패 경로는 audit log 에 기록. 성공 시 request.state 에 다음을 부착:
      - request.state.auth_method = 'access_token'
      - request.state.token_grants = list[AccessTokenGrant]
      - request.state.token_id     = AccessToken.id

    require_scope dependency 가 위 정보를 읽어 RBAC + grants 2 게이트 검증.
    """
    from app.services.audit import audit  # 지연 import (circular 회피)

    ip = request.client.host if (request and request.client) else None
    ua = request.headers.get("user-agent") if request else None

    def _fail(detail: str, *, prefix: Optional[str] = None, reason: str) -> None:
        audit.log(
            db,
            user_id=None,
            user_email=None,
            action="token_auth_failed",
            resource_type="access_token",
            resource_id=prefix,
            details={"reason": reason, "user_agent": ua},
            ip_address=ip,
            status="failure",
        )
        raise HTTPException(status_code=401, detail=detail)

    # 1) 1차 게이트 — prefix + checksum 형식 검증
    if not token_format.verify_format(raw):
        _fail("Invalid access token format", reason="bad_format")

    # 2) DB 조회 — prefix 로 단일 행 lookup
    prefix = token_format.extract_prefix(raw)
    token: Optional[AccessToken] = (
        db.query(AccessToken).filter(AccessToken.token_prefix == prefix).first()
    )
    if token is None or not token.is_active:
        _fail("Invalid access token", prefix=prefix, reason="not_found_or_inactive")

    # 3) bcrypt verify
    if not bcrypt.checkpw(raw.encode(), token.token_hash.encode()):
        _fail("Invalid access token", prefix=prefix, reason="hash_mismatch")

    # 4) 만료 검사
    if token.expires_at and token.expires_at < datetime.now(timezone.utc).replace(
        tzinfo=None
    ):
        _fail("Access token expired", prefix=prefix, reason="expired")

    # 5) last_used 갱신 + grants 미리 로딩 (commit 전 attach)
    token.last_used = func.now()
    grants = list(token.grants)  # eager fetch
    db.commit()

    if request is not None:
        request.state.auth_method = "access_token"
        request.state.token_id = token.id
        request.state.token_prefix = token.token_prefix
        request.state.token_grants = grants

    return token.user


def _try_verify_jwt(token: str) -> Optional[str]:
    """서비스 JWT 검증, 이메일 반환. 실패 시 None."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        return payload.get("email")
    except (jwt.InvalidTokenError, jwt.ExpiredSignatureError):
        return None


def _set_user_auth_state(request: Request, method: str) -> None:
    """JWT / Google 인증 시 호출 — token_grants 는 None (require_scope 가 통과 처리)."""
    request.state.auth_method = method
    request.state.token_id = None
    request.state.token_prefix = None
    request.state.token_grants = None


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """헤더 기반 인증으로 현재 사용자 반환.

    우선순위:
      1) Authorization: Bearer <service_jwt | google_access_token | dh_ | dl_>
      2) X-API-Key: <dh_ | dl_>

    Bearer 가 'dh_' / 'dl_' prefix 를 가지면 access token 경로로 분기.
    """
    auth_header = request.headers.get("authorization")
    if auth_header:
        parts = auth_header.split(" ", 1)
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1].strip()

            # access token (v2/v1)
            if token.startswith(("dh_", "dl_")):
                return _authenticate_access_token(db, token, request)

            # 서비스 JWT 먼저
            email = _try_verify_jwt(token)
            if email:
                _set_user_auth_state(request, "service_jwt")
                return get_or_create_user(db, email)

            # Google access token
            email = verify_google_token(token)
            _set_user_auth_state(request, "google_oauth")
            return get_or_create_user(db, email)

        raise HTTPException(status_code=401, detail="Invalid Authorization header format")

    # X-API-Key 헤더 (한시 호환 — Bearer 와 동일하게 처리)
    api_key = request.headers.get("x-api-key")
    if api_key:
        return _authenticate_access_token(db, api_key, request)

    raise HTTPException(
        status_code=401,
        detail="Authorization header (Bearer token) or X-API-Key header required",
    )


def get_service_caller(request: Request) -> str:
    """내부 서비스 요청 인증 의존성. X-Service-Token 헤더로 검증된 caller 식별자 반환."""
    token = request.headers.get("x-service-token")
    if not token:
        raise HTTPException(status_code=401, detail="X-Service-Token header required")
    return verify_service_token(token)


# ── 토큰 scope 게이트 (architecture §1.4 — 2 단계 검증) ──────────────────


def require_scope(resource_type: str, min_action: str):
    """라우터 dependency — RBAC + 토큰 grants 2 단계 검증.

    사용 예:
        @router.get("/repos/{repo_name}/download",
                    dependencies=[Depends(require_scope("repo", "read"))])

    동작:
      - JWT / Google 인증 (사용자 본인 행위) → grants 게이트 skip, RBAC 만 검사.
      - Access token 인증 → RBAC 1차 게이트 + token grants 2차 게이트 모두 통과해야.

    응답 코드 (architecture §1.4.3):
      - 토큰 무효 / 만료              → 401  (이미 _authenticate_access_token 에서 발생)
      - private + 비멤버              → 404
      - RBAC 매트릭스 결과 부족       → 403 ``insufficient permission``
      - RBAC OK, grants 부족          → 403 ``insufficient scope``

    Note: 본 phase 의 첫 PR 은 dependency 함수 자체만 정의한다. 모든 라우터에
    부착하는 작업은 scope-matrix dump CI 와 묶어 follow-up PR 에서 진행
    (architecture §2.5).

    `_check.__scope__ = (resource_type, min_action)` — `app.scripts.dump_scope_matrix`
    가 closure 를 식별하기 위해 metadata 부착.
    """

    def _check(
        request: Request,
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        # 1) resource_id 추출 — path / query 에서 자원 식별자를 뽑아낸다
        resource_id = _extract_resource_id(request, resource_type)

        # 2) RBAC 1차 게이트
        rbac_actions = get_user_rbac_actions(db, user, resource_id)

        # 자원 자체 미노출 (None) → 404 — private 비멤버 / 존재하지 않는 repo
        if rbac_actions is None and resource_type == "repo":
            from app.services.audit import audit
            audit.log(
                db,
                user_id=user.id,
                user_email=user.email,
                action="token_scope_denied",
                resource_type=resource_type,
                resource_id=resource_id,
                details={"reason": "resource_hidden"},
                status="failure",
            )
            raise HTTPException(status_code=404, detail="Not found")

        # 자원은 노출되나 액션 없음 (set() 또는 액션 hierarchy 밖) → 403 insufficient permission
        rbac_set = rbac_actions or set()
        if min_action not in _expand_hierarchy(rbac_set):
            from app.services.audit import audit
            audit.log(
                db,
                user_id=user.id,
                user_email=user.email,
                action="token_scope_denied",
                resource_type=resource_type,
                resource_id=resource_id,
                details={"required": min_action, "rbac_actions": list(rbac_set)},
                status="failure",
            )
            raise HTTPException(status_code=403, detail="insufficient permission")

        # 3) 토큰 grants 2차 게이트 — JWT/Google 인증은 skip
        auth_method = getattr(request.state, "auth_method", None)
        if auth_method != "access_token":
            return user

        grants = getattr(request.state, "token_grants", None) or []
        if not _grants_match(grants, resource_type, resource_id, min_action):
            from app.services.audit import audit
            audit.log(
                db,
                user_id=user.id,
                user_email=user.email,
                action="token_scope_denied",
                resource_type=resource_type,
                resource_id=resource_id,
                details={
                    "required": min_action,
                    "token_prefix": getattr(request.state, "token_prefix", None),
                    "rbac_actions": list(rbac_actions),
                },
                status="failure",
            )
            raise HTTPException(status_code=403, detail="insufficient scope")

        return user

    # scope-matrix dump 가 dependency 인스턴스를 식별하기 위한 metadata
    _check.__scope__ = (resource_type, min_action)  # type: ignore[attr-defined]
    return _check


def _extract_resource_id(request: Request, resource_type: str) -> Optional[str]:
    """path params 에서 resource_type 에 대응하는 식별자를 꺼낸다.

    repo_name 은 spec 상 `<group>/<repo>` (단일 슬래시 포함) 컬럼으로 저장된다.
    하지만 라우터의 path 표기는 두 종류로 공존한다:

      - 단일 segment   `/repos/{repo}` 또는 `/repos/{repo_name}`  (legacy alias)
        path_param 'repo' 또는 'repo_name' 에 이미 합쳐진 값 — 그대로 사용
      - group-scoped   `/repos/{group}/{repo_name}`              (v2 권장)
        두 segment 를 '/' 로 합쳐 spec 형식으로 정규화

    매핑:
      - 'repo'  → '{group}/{repo_name}' 또는 path_param ['repo' | 'repo_name']
      - 'group' → 'org_name' / 'org' / 'group'
      - 그 외   → None
    """
    p = request.path_params
    if resource_type == "repo":
        # group + repo_name 양쪽이 분리되어 있으면 합침
        if "group" in p and "repo_name" in p:
            return f"{p['group']}/{p['repo_name']}"
        # 단일 segment — 이미 합쳐진 값
        return p.get("repo_name") or p.get("repo")
    if resource_type == "group":
        return p.get("org_name") or p.get("org") or p.get("group")
    return None
