from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.config import Settings


def test_jwt_secret_requires_strong_non_placeholder_value() -> None:
    with pytest.raises(ValidationError):
        Settings(
            jwt_secret="change-me-in-production",
            internal_service_secret="x" * 32,
        )


def test_database_pool_settings_accept_explicit_values() -> None:
    settings = Settings(
        jwt_secret="y" * 32,
        internal_service_secret="x" * 32,
        database_pool_size=25,
        database_max_overflow=35,
        database_pool_timeout=45,
        database_pool_recycle=900,
    )

    assert settings.database_pool_size == 25
    assert settings.database_max_overflow == 35
    assert settings.database_pool_timeout == 45
    assert settings.database_pool_recycle == 900


# ───────────────────────────────────────────────
# Azure AD SSO settings (plan 2026-05-22-azure-sso-activation)
# ───────────────────────────────────────────────


def test_azure_sso_defaults_to_disabled() -> None:
    """기본 상태 — 미설정 환경에서 활성화되면 안 된다."""
    settings = Settings(jwt_secret="y" * 32, internal_service_secret="x" * 32)

    assert settings.azure_sso_enabled is False
    assert settings.azure_ad_tenant_id == ""
    assert settings.azure_ad_client_id == ""
    assert settings.azure_ad_client_secret == ""
    assert settings.azure_allowed_tenants == ""
    assert settings.azure_allowed_email_domain == "lgresearch.ai"


def test_azure_sso_enabled_with_full_credentials() -> None:
    """activation cycle — flag + tenant/client/secret 모두 채워진 정상 케이스."""
    settings = Settings(
        jwt_secret="y" * 32,
        internal_service_secret="x" * 32,
        azure_sso_enabled=True,
        azure_ad_tenant_id="11111111-2222-3333-4444-555555555555",
        azure_ad_client_id="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        azure_ad_client_secret="z" * 40,
        azure_allowed_email_domain="lgresearch.ai",
    )

    assert settings.azure_sso_enabled is True
    assert settings.azure_ad_tenant_id == "11111111-2222-3333-4444-555555555555"
    assert settings.azure_allowed_tenants == ""  # single-tenant 정책


def test_azure_sso_enabled_string_true_coerced_to_bool() -> None:
    """GitLab CI Variable 은 string 으로 inject — pydantic 이 bool 로 coerce."""
    settings = Settings(
        jwt_secret="y" * 32,
        internal_service_secret="x" * 32,
        azure_sso_enabled="true",  # type: ignore[arg-type]
    )

    assert settings.azure_sso_enabled is True


def test_azure_sso_multi_tenant_allowlist() -> None:
    """후속 cycle 대비 — AZURE_ALLOWED_TENANTS comma-separated 도 받는다."""
    settings = Settings(
        jwt_secret="y" * 32,
        internal_service_secret="x" * 32,
        azure_sso_enabled=True,
        azure_ad_tenant_id="tid-primary",
        azure_allowed_tenants="tid-primary,tid-partner-a,tid-partner-b",
    )

    assert "tid-partner-a" in settings.azure_allowed_tenants
