from __future__ import annotations

from fastapi import FastAPI, HTTPException, Request
from fastapi.testclient import TestClient
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.error_envelope import error_response
from app.main import app


def test_http_errors_use_error_envelope_and_request_id_header():
    client = TestClient(app)

    response = client.get(
        "/api/v1/does-not-exist",
        headers={"X-Request-ID": "req_test"},
    )

    assert response.status_code == 404
    assert response.headers["X-Request-ID"] == "req_test"
    assert response.json() == {
        "error": {
            "code": "not_found",
            "message": "Not Found",
            "target": None,
            "retryable": False,
            "request_id": "req_test",
        }
    }


def test_http_error_detail_dict_preserves_typed_fields():
    typed_app = FastAPI()

    @typed_app.exception_handler(StarletteHTTPException)
    async def _handler(request: Request, exc: StarletteHTTPException):
        return error_response(request, exc.status_code, exc.detail, headers=getattr(exc, "headers", None))

    @typed_app.get("/boom")
    def _boom():
        raise HTTPException(
            status_code=409,
            detail={
                "code": "checksum_mismatch",
                "message": "checksum mismatch",
                "target": "data/file.txt",
                "retryable": False,
            },
        )

    client = TestClient(typed_app)
    response = client.get("/boom", headers={"X-Request-ID": "req_typed"})

    assert response.status_code == 409
    assert response.headers["X-Request-ID"] == "req_typed"
    assert response.json() == {
        "error": {
            "code": "checksum_mismatch",
            "message": "checksum mismatch",
            "target": "data/file.txt",
            "retryable": False,
            "request_id": "req_typed",
        }
    }
