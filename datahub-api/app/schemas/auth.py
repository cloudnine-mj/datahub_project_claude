"""Session, API key 스키마."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


# ── POST /auth/session ──────────────────────────────

class PermissionEntry(BaseModel):
    repo: str
    role: str


class SessionResponse(BaseModel):
    email: str
    # datahub-auth-redesign §16: 통합 프로필 필드 — Web 이 Prisma 없이 UI 렌더에 사용
    name: Optional[str] = None
    role: str = "USER"
    lab_id: Optional[str] = None
    tech_cell_id: Optional[str] = None
    permissions: List[PermissionEntry]


class RefreshTokenRequest(BaseModel):
    refresh_token: str = ""


class TokenRefreshResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    refresh_token: str


# ── POST/GET/DELETE/ROTATE /auth/access-tokens (v2) ─────────────────────

class GrantSpec(BaseModel):
    """fine_grained 토큰의 단일 grant — architecture §3.2.

    resource_type 은 'user' / 'repo' / 'group' / 'catalog' / 'snapshot_user'
    / 'snapshot' 중 하나. resource_id 는 와일드카드 '*' 또는 NULL 또는 식별자.
    """

    resource_type: str
    resource_id: Optional[str] = None
    action: str


class CreateAccessTokenRequest(BaseModel):
    name: str
    # 'read' | 'write' | 'fine_grained'
    token_type: str
    expires_in_days: Optional[int] = None
    # fine_grained 일 때만 필수 / 비어있으면 거부 (read/write 는 서버가 자동 부여)
    grants: Optional[List[GrantSpec]] = None


class CreateAccessTokenResponse(BaseModel):
    """발급 응답 — raw access_token 은 이 응답에서만 1회 노출."""

    id: int
    prefix: str
    access_token: str
    name: str
    token_type: str
    created_at: datetime
    expires_at: Optional[datetime] = None
    grants: List[GrantSpec]


class AccessTokenInfo(BaseModel):
    """list 응답 — raw 미노출. masked prefix 만."""

    id: int
    prefix: str
    name: str
    token_type: str
    created_at: datetime
    last_used: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    is_active: bool
    revoked_at: Optional[datetime] = None
    grants: List[GrantSpec]


class AccessTokenListResponse(BaseModel):
    access_tokens: List[AccessTokenInfo]


# ── 한시 호환 alias (구 ApiKey 명) ─────────────────────────────────────
# 외부 코드 / 통합 테스트가 아직 ApiKey 스키마를 import 할 수 있어 alias 만 노출.
# 새 코드는 AccessToken* 직접 사용. 0.13 에서 제거.
CreateApiKeyRequest = CreateAccessTokenRequest
CreateApiKeyResponse = CreateAccessTokenResponse
ApiKeyInfo = AccessTokenInfo
ApiKeyListResponse = AccessTokenListResponse


# ── GET /auth/whoami ────────────────────────────────

class WhoAmIResponse(BaseModel):
    email: str
    user_id: int


# ── Device Authorization Grant (원격 클라이언트용) ───

class DeviceInitResponse(BaseModel):
    """POST /auth/device/init 응답 — 클라가 verification_uri 를 사용자에게 출력."""
    device_code: str
    verification_uri: str
    expires_in: int   # seconds
    interval: int     # polling 권장 간격 (초)


class DeviceTokenRequest(BaseModel):
    device_code: str


class DeviceTokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    refresh_token: str
    email: str


# ── POST /auth/logout ────────────────────────────────

class LogoutRequest(BaseModel):
    refresh_token: str = ""
