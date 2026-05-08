"""Data Platform Service 설정.

환경변수에서 읽어옵니다. pydantic-settings 기반.
"""

from __future__ import annotations

from os import cpu_count

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

    # LakeFS
    lakefs_endpoint: str = "http://lakefs.lgair-data-layer.svc:8000"
    lakefs_access_key_id: str = ""
    lakefs_secret_access_key: str = ""
    lakefs_verify_ssl: bool = True  # False는 개발 환경에서만 사용 (이슈 #9)
    lakefs_ca_bundle: str = ""  # CA 인증서 경로 (gabia-dns-secret 등록 후 설정)
    lakefs_staging_max_workers: int = min((cpu_count() or 4) * 2, 16)
    lakefs_link_max_workers: int = min((cpu_count() or 4) * 2, 16)
    lakefs_download_resolve_max_workers: int = min((cpu_count() or 4) * 2, 16)

    # Unity Catalog
    uc_endpoint: str = "http://unity-catalog.lgair-data-layer.svc:8080"
    uc_catalog_name: str = "datasets"
    uc_schema_name: str = "default"
    uc_verify_ssl: bool = True
    uc_ca_bundle: str = ""

    # GCP
    gcp_project: str = ""
    gcp_bucket_prefix: str = "lgair-data-hub"
    gcp_bucket_location: str = "asia-northeast3"
    gcp_system_sa_email: str = ""

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    oauth_redirect_uri: str = ""  # 비어있으면 자동 생성, 설정하면 Google Console에 등록된 URI 사용

    # JWT
    jwt_secret: str = "change-me-in-production"
    jwt_expiry_minutes: int = 30
    jwt_refresh_token_ttl_seconds: int = 86400 * 7

    # Frontend (OAuth redirect)
    frontend_url: str = "http://localhost:3179"

    # 세션 쿠키의 도메인 스코프. 환경별 values에서 지정한다.
    #   dev : .datahub.lgair-data.com
    #   stg : .datahub.lgair-data.com
    #   prd : .datahub.lgair-data.com
    # 비어있으면 호스트 쿠키 (도메인 속성 미설정) — 로컬 개발 기본값.
    cookie_domain: str = ""

    # Signed URL
    signed_url_expiry_minutes: int = 60

    # Redis (MCP OAuth 세션 저장소)
    # 비어있으면 in-memory fallback 사용 (단일 파드 개발 환경)
    redis_url: str = ""

    rate_limit_window_seconds: int = 60
    rate_limit_session_requests: int = 60
    rate_limit_transfer_requests: int = 120

    # 서비스 간 인증 (DPA → DIA)
    internal_service_secret: str = _PLACEHOLDER
    internal_service_token_ttl_seconds: int = 300  # 5분

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
