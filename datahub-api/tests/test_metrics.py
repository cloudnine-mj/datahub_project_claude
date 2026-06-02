from __future__ import annotations

from importlib import import_module

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers.metrics import router as metrics_router

render_metrics = import_module("app.services.metrics").render_metrics


def test_metrics_endpoint_exposes_prometheus_text() -> None:
    app = FastAPI()
    app.include_router(metrics_router)

    @app.get("/ok")
    def ok():
        return {"status": "ok"}

    @app.middleware("http")
    async def metric_middleware(request, call_next):
        import time

        observe_request = import_module("app.services.metrics").observe_request
        start = time.time()
        response = await call_next(request)
        observe_request(request.method, request.url.path, response.status_code, time.time() - start)
        return response

    client = TestClient(app)
    client.get("/ok")
    response = client.get("/metrics")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain")
    assert "datahub_http_requests_total" in response.text
    assert 'path="/ok"' in response.text


def test_render_metrics_includes_uptime_metric() -> None:
    metrics_text = render_metrics()

    assert "datahub_process_uptime_seconds" in metrics_text
