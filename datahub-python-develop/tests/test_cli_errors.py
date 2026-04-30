from __future__ import annotations

import httpx
import pytest

from datahub.cli import handle_errors


def test_handle_errors_surfaces_structured_http_detail(monkeypatch) -> None:
    messages: list[str] = []

    monkeypatch.setattr("datahub.cli.error", lambda message: messages.append(f"error:{message}"))
    monkeypatch.setattr("datahub.cli.info", lambda message: messages.append(f"info:{message}"))

    @handle_errors
    def _boom() -> None:
        request = httpx.Request("POST", "https://example.test/api/v1/repos/koscom/download/stream/page")
        response = httpx.Response(
            409,
            request=request,
            json={
                "detail": {
                    "message": "Resolved backing object is missing from GCS",
                    "path": "koscom_2001-12-28.stock_m167_hist_info.parquet",
                    "physical_address": "gs://bucket/missing-object",
                }
            },
        )
        raise httpx.HTTPStatusError("boom", request=request, response=response)

    with pytest.raises(SystemExit):
        _boom()

    assert messages == [
        "error:Server error (HTTP 409)",
        "info:Resolved backing object is missing from GCS",
        "info:Logical path: koscom_2001-12-28.stock_m167_hist_info.parquet",
        "info:Physical address: gs://bucket/missing-object",
    ]
