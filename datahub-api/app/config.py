"""Data Platform Service 설정.

환경변수에서 읽어옵니다. pydantic-settings 기반.
"""

from __future__ import annotations

from pydantic import field_validator
from pydantic_settings import BaseSettings

_PLACEHOLDER = "change-me-in-production"


class Settings(BaseSettings):
    """환경변수 기반 설정."""

    # 데이터베이스
    database_url: str = "postgresql://platform:password@localhost:5432/platform_db"
    database_pool_size: int = 20
    database_max_overflow: int = 30
    database_pool_timeout: int = 30
    database_pool_recycle: int = 1800

    # Unity Catalog
    uc_endpoint: str = "http://unity-catalog.lgair-data-layer.svc:8080"
    uc_catalog_name: str = "datasets"
    uc_schema_name: str = "default"
    uc_verify_ssl: bool = True
    uc_ca_bundle: str = ""

    # GCP
    gcp_project: str = ""
    # Runtime stage values must be environment-scoped because dev/stg/prd share
    # the same GCP project and therefore the same global GCS bucket namespace.
    # Helm values set lgair-dgdh-dev / lgair-dgdh-stg / lgair-dgdh-prd.
    gcp_bucket_prefix: str = "lgair-dgdh-local"
    gcp_bucket_location: str = "asia-northeast3"
    gcp_system_sa_email: str = ""

    # Google OAuth (transition 동안 dual run, Azure SSO 완료 + 2주 후 제거)
    google_client_id: str = ""
    google_client_secret: str = ""
    oauth_redirect_uri: str = ""  # 비어있으면 자동 생성, 설정하면 Google Console에 등록된 URI 사용

    # Azure AD SSO (governance §auth-and-api-keys §1.2 / api-specs/auth-api-spec.md §Azure AD OIDC).
    # 환경별 활성화는 GitLab CI Variables 의 env scope 로 관리. callback URL 은
    # Google OAuth 와 동일 helper `_get_oauth_callback_url` 가 `oauth_redirect_uri`
    # 를 재사용 — 별 azure_ad_redirect_uri 는 두지 않음 (path
    # /api/v1/auth/callback 동일, state prefix `ms:` 로 IdP 구분).
    azure_ad_tenant_id: str = ""
    azure_ad_client_id: str = ""
    azure_ad_client_secret: str = ""
    azure_sso_enabled: bool = False           # GitLab CI Variable AZURE_SSO_ENABLED 로 env-별 활성화
    azure_allowed_email_domain: str = "lgresearch.ai"  # 추가 1차 안전망 (tid 검증 보완)
    azure_allowed_tenants: str = ""           # comma-separated tid 리스트. 비면 tenant_id 만 허용

    # JWT
    jwt_secret: str = "change-me-in-production"
    jwt_expiry_minutes: int = 30
    jwt_refresh_token_ttl_seconds: int = 86400 * 7

    # Frontend (OAuth redirect)
    frontend_url: str = "http://localhost:3179"

    # 세션 쿠키의 도메인 스코프. 환경별 values에서 지정한다.
    #   dev : .datahub.lgair-data.com
    #   stg : .datahub.lgair-data.com
    #   prd : .lgresearch.ai
    # 비어있으면 호스트 쿠키 (도메인 속성 미설정) — 로컬 개발 기본값.
    cookie_domain: str = ""

    # Signed URL
    signed_url_expiry_minutes: int = 60

    # Redis (MCP OAuth 세션 저장소)
    # 비어있으면 in-memory fallback 사용 (단일 파드 개발 환경)
    redis_url: str = ""

    # MCP endpoints are outside the launch-target API contract.
    mcp_enabled: bool = False

    rate_limit_window_seconds: int = 60
    rate_limit_session_requests: int = 60
    rate_limit_transfer_requests: int = 120
    idempotency_ttl_seconds: int = 86400

    # 서비스 간 인증 (DPA → DIA)
    internal_service_secret: str = _PLACEHOLDER
    internal_service_token_ttl_seconds: int = 300  # 5분

    # X-Service-Token 정적 매핑 — Web BFF 등 SDK 가 아닌 first-party 서비스가
    # 자신을 식별하기 위해 사용하는 사전 발급 시크릿. 값이 비어 있으면 매핑 비활성.
    # governance §file-transfer (X-Service-Token 분기) 참고.
    web_service_token: str = ""

    @field_validator("internal_service_secret")
    @classmethod
    def internal_service_secret_must_not_be_placeholder(cls, v: str) -> str:
        if v == _PLACEHOLDER or len(v) < 32:
            raise ValueError(
                "INTERNAL_SERVICE_SECRET must be set to a strong secret (min 32 chars). "
                "Set the INTERNAL_SERVICE_SECRET environment variable."
            )
        return v

    @field_validator("jwt_secret")
    @classmethod
    def jwt_secret_must_not_be_placeholder(cls, v: str) -> str:
        if v == _PLACEHOLDER or len(v) < 32:
            raise ValueError(
                "JWT_SECRET must be set to a strong secret (min 32 chars). "
                "Set the JWT_SECRET environment variable."
            )
        return v

    @field_validator("database_pool_size", "database_max_overflow", "database_pool_timeout", "database_pool_recycle")
    @classmethod
    def positive_database_pool_settings(cls, v: int) -> int:
        if v < 0:
            raise ValueError("Database pool settings must be zero or greater.")
        return v

    # LLM (Enrichment)
    llm_api_key: str = ""
    llm_model: str = "claude-haiku-4-5-20251001"
    otel_enabled: bool = False
    otel_service_name: str = "datahub-api"
    otel_exporter_otlp_endpoint: str = ""


settings = Settings()
