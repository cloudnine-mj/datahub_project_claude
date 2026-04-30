"""DataHub SDK 설정 관리.

v0.8: data-platform-service 전용 thin client.
LakeFS, Unity Catalog, LLM 설정 불필요.

설정 우선순위:
  1. 생성자 인자
  2. 환경변수 (DATAHUB_*)
  3. ~/.datahub/config.yaml
"""

from __future__ import annotations

import os
from pathlib import Path

import yaml
from pydantic import BaseModel, Field

from datahub._defaults import DEFAULT_ENDPOINT


class AuthConfig(BaseModel):
    """Data Platform Service 인증 설정."""

    endpoint: str = Field(default=DEFAULT_ENDPOINT)  # 빌드 시 환경별로 주입 (dev/stg/prd)
    api_key: str = Field(default="")       # 머신용 (선택, X-API-Key 헤더)
    verify_ssl: bool = Field(default=True)
    ca_bundle: str = Field(default="")


class DataHubConfig(BaseModel):
    auth: AuthConfig = Field(default_factory=AuthConfig)

    @classmethod
    def load(cls) -> DataHubConfig:
        """설정 파일 및 환경변수에서 자동 로드."""
        config_data: dict = {}

        # 1. 설정 파일 로드 (~/.datahub/config.yaml)
        config_path = Path.home() / ".datahub" / "config.yaml"
        if config_path.exists():
            with open(config_path) as f:
                config_data = yaml.safe_load(f) or {}

        # 2. 환경변수 오버라이드
        env_mapping = {
            "DATAHUB_AUTH_ENDPOINT": ("auth", "endpoint"),
            "DATAHUB_AUTH_API_KEY": ("auth", "api_key"),
            "DATAHUB_VERIFY_SSL": ("auth", "verify_ssl"),
            "DATAHUB_CA_BUNDLE": ("auth", "ca_bundle"),
        }

        for env_key, (section, field) in env_mapping.items():
            value = os.environ.get(env_key)
            if value:
                config_data.setdefault(section, {})[field] = value

        return cls(**config_data)
