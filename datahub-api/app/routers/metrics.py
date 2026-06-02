from __future__ import annotations

from importlib import import_module

from fastapi import APIRouter, Response

router = APIRouter()


render_metrics = import_module("app.services.metrics").render_metrics


@router.get("/metrics")
def metrics() -> Response:
    return Response(content=render_metrics(), media_type="text/plain; version=0.0.4; charset=utf-8")
