"""Azure AD user linking (governance §auth-and-api-keys §1.2 — dual-IdP).

Azure 로그인 시 backend 가 호출하는 linking 로직. email 매칭으로 기존 user row
를 찾고 (Google 만 사용하던 user 포함), `azure_oid` / `azure_tid` / `linked_at`
를 backfill 또는 갱신.

linking 시나리오 (governance §database-model-spec 5종):
1. user.azure_oid IS NULL + claims.oid 신규 → 채움 + audit `user.azure_linked`
2. user.azure_oid == claims.oid → no-op (정상 재로그인)
3. user.azure_oid != claims.oid → oid 갱신 + audit `user.azure_oid_changed`
4. claims.oid 가 다른 user row 의 azure_oid 와 충돌 → 422 + audit `user.azure_oid_conflict`
5. 신규 user (email 매칭 실패) → caller (get_or_create_user) 가 row 생성 후
   본 helper 가 azure_oid 채움 + audit
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import User
from app.services.audit import AuditService


logger = logging.getLogger(__name__)


def link_azure_identity(
    db: Session,
    user: User,
    claims: dict[str, Any],
    *,
    audit: AuditService | None = None,
    request=None,
) -> User:
    """user.azure_oid / azure_tid / linked_at backfill + audit.

    Args:
        db: SQLAlchemy session.
        user: 이미 조회/생성된 user (email 매칭으로 get_or_create_user 결과).
        claims: Azure id_token 의 검증된 claims (oid, tid, ...).
        audit: AuditService 인스턴스 (선택, None 이면 audit 미기록).

    Returns:
        업데이트된 user (db.refresh 후).

    Raises:
        HTTPException(422): claims.oid 가 이미 다른 user 의 azure_oid 와 충돌.
    """
    oid = claims.get("oid")
    tid = claims.get("tid")
    if not oid:
        # oid 없으면 linking 불가능 — verify_azure_id_token 이 이미 통과시켰다는 가정 하에 정상이라야 함
        logger.warning("link_azure_identity: claims missing oid, skipping")
        return user

    # case 4: 충돌 검사 — 다른 user 가 같은 azure_oid 점유?
    other = (
        db.query(User)
        .filter(User.azure_oid == oid, User.id != user.id)
        .first()
    )
    if other is not None:
        if audit is not None:
            audit.log(
                db,
                user_id=user.id,
                user_email=user.email,
                action="user.azure_oid_conflict",
                details={
                    "incoming_oid": oid,
                    "incoming_tid": tid,
                    "conflicting_user_id": other.id,
                    "conflicting_user_email": other.email,
                },
                ip_address=_client_host(request),
            )
        raise HTTPException(
            status_code=422,
            detail=(
                f"Azure oid {oid!r} is already linked to another user "
                f"({other.email}). Contact administrator to resolve."
            ),
        )

    now = datetime.now(timezone.utc)
    if user.azure_oid is None:
        # case 1 또는 5: 첫 Azure linking
        user.azure_oid = oid
        user.azure_tid = tid
        user.linked_at = now
        db.commit()
        db.refresh(user)
        if audit is not None:
            audit.log(
                db,
                user_id=user.id,
                user_email=user.email,
                action="user.azure_linked",
                details={"azure_oid": oid, "azure_tid": tid},
                ip_address=_client_host(request),
            )
    elif user.azure_oid != oid:
        # case 3: oid 변경 — 예외 케이스. tenant 마이그레이션 등.
        old_oid = user.azure_oid
        user.azure_oid = oid
        user.azure_tid = tid
        user.linked_at = now
        db.commit()
        db.refresh(user)
        if audit is not None:
            audit.log(
                db,
                user_id=user.id,
                user_email=user.email,
                action="user.azure_oid_changed",
                details={"old_oid": old_oid, "new_oid": oid, "new_tid": tid},
                ip_address=_client_host(request),
            )
    else:
        # case 2: no-op. tid 가 변경됐다면 silent 갱신
        if tid and user.azure_tid != tid:
            user.azure_tid = tid
            db.commit()
            db.refresh(user)
    return user


def _client_host(request) -> str | None:
    if request is None:
        return None
    client = getattr(request, "client", None)
    return getattr(client, "host", None) if client else None
