"""Health check 엔드포인트."""

from __future__ import annotations

import os
import socket
import time

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.build_info import BUILD_INFO
from app.dependencies import get_current_user
from app.models import User
from app.database import get_db
from app.services.authorization import check_access

router = APIRouter()


@router.get("/health")
def health_check():
    """서버 상태 확인."""
    return {
        "status": "ok",
        "version": BUILD_INFO.version,
        "git_sha": BUILD_INFO.git_short_sha,
        "build_ref": BUILD_INFO.build_ref,
    }


@router.get("/version")
def version_info():
    """현재 배포된 API 산출물 식별 정보."""
    return BUILD_INFO.public_dict()


@router.get("/health/control-plane")
def control_plane_health(
    repo: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if repo:
        check_access(db, user, repo, min_role="guest")

    diagnostics: dict[str, object] = {
        "status": "ok",
        "version": BUILD_INFO.public_dict(),
        "server": {
            "hostname": socket.gethostname(),
            "pid": os.getpid(),
            "cpu_count": os.cpu_count(),
        },
    }

    if repo:
        diagnostics["repository"] = {
            "repo": repo,
            "access_checked": True,
        }

    db_start = time.perf_counter()
    try:
        db.execute(text("SELECT 1"))
        diagnostics["database"] = {
            "ok": True,
            "elapsed_ms": round((time.perf_counter() - db_start) * 1000, 2),
        }
    except Exception as exc:
        diagnostics["status"] = "degraded"
        diagnostics["database"] = {
            "ok": False,
            "elapsed_ms": round((time.perf_counter() - db_start) * 1000, 2),
            "error": str(exc),
        }

    return diagnostics
