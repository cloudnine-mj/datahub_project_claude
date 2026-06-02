"""Runtime build metadata exposed by health/version endpoints."""

from __future__ import annotations

import os
from dataclasses import asdict, dataclass


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


@dataclass(frozen=True)
class BuildInfo:
    app: str
    version: str
    git_sha: str
    git_short_sha: str
    build_ref: str
    build_pipeline: str
    build_time: str

    def public_dict(self) -> dict[str, str]:
        return asdict(self)


def load_build_info() -> BuildInfo:
    git_sha = _env("DATAHUB_GIT_SHA") or _env("CI_COMMIT_SHA")
    return BuildInfo(
        app="datahub-api",
        version=_env("DATAHUB_APP_VERSION", "0.1.0"),
        git_sha=git_sha,
        git_short_sha=git_sha[:8] if git_sha else "",
        build_ref=_env("DATAHUB_BUILD_REF") or _env("CI_COMMIT_REF_NAME"),
        build_pipeline=_env("DATAHUB_BUILD_PIPELINE") or _env("CI_PIPELINE_IID"),
        build_time=_env("DATAHUB_BUILD_TIME"),
    )


BUILD_INFO = load_build_info()
