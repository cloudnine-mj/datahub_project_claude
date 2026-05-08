"""Health check 엔드포인트."""

from __future__ import annotations

import os
import socket
import time

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.dependencies import get_current_user
from app.models import User
from app.database import get_db
from app.services.authorization import check_access
from app.services.lakefs import LakeFSService

router = APIRouter()
_lakefs = LakeFSService()


@router.get("/health")
def health_check():
    """서버 상태 확인."""
    return {"status": "ok"}


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
        "server": {
            "hostname": socket.gethostname(),
            "pid": os.getpid(),
            "cpu_count": os.cpu_count(),
        },
        "limits": {
            "lakefs_staging_max_workers": settings.lakefs_staging_max_workers,
            "lakefs_link_max_workers": settings.lakefs_link_max_workers,
            "lakefs_download_resolve_max_workers": settings.lakefs_download_resolve_max_workers,
        },
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

    lakefs_start = time.perf_counter()
    try:
        if repo:
            branches = _lakefs.list_branches(repo)
            diagnostics["lakefs"] = {
                "ok": True,
                "repo": repo,
                "operation": "list_branches",
                "result_count": len(branches),
                "elapsed_ms": round((time.perf_counter() - lakefs_start) * 1000, 2),
            }
        else:
            diagnostics["lakefs"] = {
                "ok": True,
                "operation": "skipped",
                "elapsed_ms": 0.0,
            }
    except Exception as exc:
        diagnostics["status"] = "degraded"
        diagnostics["lakefs"] = {
            "ok": False,
            "repo": repo,
            "operation": "list_branches" if repo else "skipped",
            "elapsed_ms": round((time.perf_counter() - lakefs_start) * 1000, 2),
            "error": str(exc),
        }

    return diagnostics
