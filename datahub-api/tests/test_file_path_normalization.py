"""File API path normalization contract tests."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.routers.files import _normalize_path


def test_normalize_path_preserves_prefix_trailing_slash() -> None:
    assert _normalize_path("data/prefix/") == "data/prefix/"


def test_normalize_path_strips_leading_slash() -> None:
    assert _normalize_path("/data/file.txt") == "data/file.txt"


@pytest.mark.parametrize("path", ["data//file.txt", "../file.txt", "data/../file.txt", "data/./file.txt"])
def test_normalize_path_rejects_unsafe_segments(path: str) -> None:
    with pytest.raises(HTTPException):
        _normalize_path(path)
