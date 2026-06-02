"""`/organizations/*` 응답에 Deprecation/Sunset/Link 헤더 부착 (G7).

governance: /organizations 는 /groups 로 대체됨. RFC 8594 / 9111 헤더로
호출자에게 자동 안내.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def _assert_deprecation_headers(headers) -> None:
    assert headers.get("deprecation") == "true"
    assert "30 Jun 2026" in headers.get("sunset", "")
    link = headers.get("link", "")
    assert "groups" in link
    assert 'rel="successor-version"' in link


def test_organizations_get_carries_deprecation_headers():
    # 인증 미통과여도 미들웨어는 헤더 부착 — 어떤 status 든 OK
    resp = client.get("/api/v1/organizations")
    _assert_deprecation_headers(resp.headers)


def test_organization_detail_carries_deprecation_headers():
    resp = client.get("/api/v1/organizations/some-org")
    _assert_deprecation_headers(resp.headers)


def test_groups_endpoint_does_not_carry_deprecation():
    """대조군 — /groups 는 deprecation 헤더 없어야."""
    resp = client.get("/api/v1/groups")
    assert resp.headers.get("deprecation") is None
    assert resp.headers.get("sunset") is None


def test_non_organizations_path_unaffected():
    """대조군 — /health 등 다른 path 도 deprecation 없어야."""
    resp = client.get("/api/v1/health")
    assert resp.headers.get("deprecation") is None
