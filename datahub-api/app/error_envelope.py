"""HTTP error envelope and request-id helpers."""

from __future__ import annotations

from http import HTTPStatus
from typing import Any
from uuid import uuid4

from fastapi import Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse


REQUEST_ID_HEADER = "X-Request-ID"


def ensure_request_id(request: Request) -> str:
    request_id = getattr(request.state, "request_id", None)
    if isinstance(request_id, str) and request_id:
        return request_id

    incoming = request.headers.get(REQUEST_ID_HEADER)
    request_id = incoming.strip() if incoming else f"req_{uuid4().hex}"
    request.state.request_id = request_id
    return request_id


def _code_for_status(status_code: int, detail: Any = None) -> str:
    detail_text = str(detail or "").lower()
    if status_code == 400:
        return "usage_error"
    if status_code == 401:
        return "auth_required"
    if status_code == 403 and "insufficient scope" in detail_text:
        return "insufficient_scope"
    if status_code == 403:
        return "permission_denied"
    if status_code == 404:
        return "not_found"
    if status_code == 409:
        return "conflict"
    if status_code == 422:
        return "validation_error"
    if status_code == 429:
        return "rate_limited"
    if status_code == 503:
        return "service_unavailable"
    if status_code >= 500:
        return "internal_error"
    return "error"


def _message_for_status(status_code: int) -> str:
    try:
        return HTTPStatus(status_code).phrase
    except ValueError:
        return "Error"


def _detail_message(detail: Any, status_code: int) -> str:
    if isinstance(detail, dict):
        message = detail.get("message")
        if message:
            return str(message)
        if detail.get("detail"):
            return str(detail["detail"])
    if detail:
        return str(detail)
    return _message_for_status(status_code)


def _detail_field(detail: Any, field: str) -> Any:
    if isinstance(detail, dict):
        return detail.get(field)
    return None


def error_response(
    request: Request,
    status_code: int,
    detail: Any = None,
    *,
    code: str | None = None,
    message: str | None = None,
    target: str | None = None,
    retryable: bool | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    request_id = ensure_request_id(request)
    error = {
        "code": code or _detail_field(detail, "code") or _code_for_status(status_code, detail),
        "message": message or _detail_message(detail, status_code),
        "target": target if target is not None else _detail_field(detail, "target"),
        "retryable": (
            retryable
            if retryable is not None
            else (
                bool(_detail_field(detail, "retryable"))
                if _detail_field(detail, "retryable") is not None
                else status_code in {429, 500, 503}
            )
        ),
        "request_id": request_id,
    }
    response_headers = dict(headers or {})
    response_headers[REQUEST_ID_HEADER] = request_id
    return JSONResponse(
        status_code=status_code,
        content={"error": jsonable_encoder(error)},
        headers=response_headers,
    )
