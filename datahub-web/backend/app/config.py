"""Application settings.

Local dev defaults — override via env (e.g. DATAHUB_DATABASE_URL).
"""

from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="DATAHUB_", env_file=".env", extra="ignore")

    database_url: str = f"sqlite:///{Path(__file__).resolve().parent.parent}/governance.db"
    upload_dir: Path = Path(__file__).resolve().parent.parent / "uploads"
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # Bootstrapped admin (seed). 실제 인증 도입 전까지는 헤더 X-User-Email 로 가장.
    default_admin_email: str = "karlo.lee@example.com"
    default_admin_name: str = "Karlo Lee"


settings = Settings()
settings.upload_dir.mkdir(parents=True, exist_ok=True)
