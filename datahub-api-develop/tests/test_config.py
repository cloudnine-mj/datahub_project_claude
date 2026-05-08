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
