"""DataClient.{create,list,revoke,rotate}_api_key + CLI `datahub key` 서브커맨드 테스트.

실제 서버를 띄우지 않고 httpx mock transport 를 주입해 응답을 스텁.
CLI 는 Click CliRunner 로 호출하고, 네트워크는 DataClient 레벨에서 mock 한다.
"""

from __future__ import annotations

import json

import httpx
import pytest
from click.testing import CliRunner

from datahub.client import DataClient
from datahub.config import AuthConfig, DataHubConfig


def _mock_transport(routes: dict):
    """routes = {(method, path): response_dict or callable(request)->response_dict}"""

    def handler(request: httpx.Request) -> httpx.Response:
        key = (request.method, request.url.path)
        payload = routes.get(key)
        if payload is None:
            return httpx.Response(404, json={"detail": f"no route for {key}"})
        if callable(payload):
            payload = payload(request)
        status = payload.pop("_status", 200) if isinstance(payload, dict) else 200
        return httpx.Response(status, json=payload)

    return httpx.MockTransport(handler)


def _client_with(routes):
    cfg = DataHubConfig(auth=AuthConfig(endpoint="https://api-dev.example.com",
                                        api_key="dl_12345678aaaaaaaa"))
    # __init__ 이 세션 POST 를 호출하므로 "/api/v1/auth/session" 도 라우트에 포함.
    routes.setdefault(("POST", "/api/v1/auth/session"), {"email": "u@e"})
    client = object.__new__(DataClient)
    client._config = cfg
    client._endpoint = cfg.auth.endpoint.rstrip("/")
    client._http = httpx.Client(transport=_mock_transport(routes), base_url=cfg.auth.endpoint)
    from datahub.types import UserIdentity
    client._identity = UserIdentity(email="u@e")
    return client


# ── client 메서드 ─────────────────────────────────────


def test_create_api_key_roundtrip():
    client = _client_with({
        ("POST", "/api/v1/auth/api-keys"): {
            "api_key": "dl_ABC123DEFghi", "id": 1, "prefix": "dl_ABC123DE",
            "name": "CI", "scope": "full",
            "created_at": "2026-04-24T09:00:00", "expires_at": None,
        },
    })
    k = client.create_api_key("CI")
    assert k.api_key.startswith("dl_")
    assert k.id == 1
    assert k.name == "CI"
    assert k.expires_at is None


def test_list_api_keys_parses_entries():
    client = _client_with({
        ("GET", "/api/v1/auth/api-keys"): {"api_keys": [
            {"id": 1, "prefix": "dl_1", "name": "a", "scope": "full",
             "created_at": "2026-04-24T09:00:00", "is_active": True,
             "last_used": None, "expires_at": None, "revoked_at": None},
        ]},
    })
    keys = client.list_api_keys()
    assert len(keys) == 1
    assert keys[0].name == "a"


def test_revoke_by_id_and_prefix():
    seen = []
    def h(req):
        seen.append(req.url.path)
        return {"status": "revoked"}
    client = _client_with({
        ("DELETE", "/api/v1/auth/api-keys/5"): h,
        ("DELETE", "/api/v1/auth/api-keys/dl_12345678"): h,
    })
    client.revoke_api_key(5)
    client.revoke_api_key("dl_12345678")
    assert seen == ["/api/v1/auth/api-keys/5", "/api/v1/auth/api-keys/dl_12345678"]


def test_rotate_returns_new_created_key():
    client = _client_with({
        ("POST", "/api/v1/auth/api-keys/5/rotate"): {
            "api_key": "dl_NEWkey", "id": 7, "prefix": "dl_NEWkey.",
            "name": "CI", "scope": "full",
            "created_at": "2026-04-24T10:00:00", "expires_at": None,
        },
    })
    k = client.rotate_api_key(5)
    assert k.id == 7
    assert k.api_key == "dl_NEWkey"


# ── CLI 서브커맨드 ────────────────────────────────────


@pytest.fixture
def patched_client(monkeypatch):
    """`_get_client(ctx)` 가 mock DataClient 를 반환하도록 cli 모듈을 패치."""
    from datahub import cli as cli_module

    created_log = {}
    list_log = {}
    revoked = []
    rotated = []

    class _Fake:
        def create_api_key(self, name, *, scope="full", expires_in_days=None):
            created_log.update(dict(name=name, scope=scope, expires_in_days=expires_in_days))
            from datahub.types import CreatedApiKey
            return CreatedApiKey(api_key="dl_VISIBLE_ONCE_secret", id=42, prefix="dl_VISIBLE_",
                                 name=name, scope=scope, created_at="2026-04-24T09:00:00",
                                 expires_at=None)

        def list_api_keys(self, include_revoked=False):
            list_log["include_revoked"] = include_revoked
            from datahub.types import ApiKeyInfo
            return [ApiKeyInfo(id=1, prefix="dl_a1b2c3d4", name="CI", scope="full",
                               created_at="2026-04-24T09:00:00", is_active=True,
                               last_used=None, expires_at=None, revoked_at=None)]

        def revoke_api_key(self, key_ref):
            revoked.append(str(key_ref))

        def rotate_api_key(self, key_ref):
            rotated.append(str(key_ref))
            from datahub.types import CreatedApiKey
            return CreatedApiKey(api_key="dl_NEW_secret", id=99, prefix="dl_NEW_",
                                 name="CI", scope="full",
                                 created_at="2026-04-24T10:00:00", expires_at=None)

    fake = _Fake()
    monkeypatch.setattr(cli_module, "_get_client", lambda ctx: fake)
    return cli_module, created_log, list_log, revoked, rotated


def test_cli_create_shows_raw_key_once_warning(patched_client):
    cli_module, created_log, *_ = patched_client
    runner = CliRunner()
    res = runner.invoke(cli_module.cli, ["key", "create", "-n", "CI", "--expires-days", "30"])
    assert res.exit_code == 0, res.output
    assert "dl_VISIBLE_ONCE_secret" in res.output
    assert "shown only once" in res.output.lower()
    assert created_log == {"name": "CI", "scope": "full", "expires_in_days": 30}


def test_cli_create_json_output_has_api_key(patched_client):
    cli_module, *_ = patched_client
    runner = CliRunner()
    res = runner.invoke(cli_module.cli, ["key", "create", "-n", "CI", "--json"])
    assert res.exit_code == 0
    # stdout 마지막 line 이 JSON
    out = res.output.strip().splitlines()[-1]
    data = json.loads(out)
    assert data["api_key"].startswith("dl_")
    assert data["id"] == 42


def test_cli_list_never_emits_api_key(patched_client):
    cli_module, _, list_log, *_ = patched_client
    runner = CliRunner()
    res = runner.invoke(cli_module.cli, ["key", "list"])
    assert res.exit_code == 0
    assert "dl_VISIBLE_ONCE_secret" not in res.output   # raw key 는 표시 금지
    assert "dl_a1b2c3d4" in res.output                  # prefix 는 표시됨
    assert list_log["include_revoked"] is False


def test_cli_list_include_revoked_flag_propagates(patched_client):
    cli_module, _, list_log, *_ = patched_client
    runner = CliRunner()
    runner.invoke(cli_module.cli, ["key", "list", "--include-revoked"])
    assert list_log["include_revoked"] is True


def test_cli_revoke_calls_client(patched_client):
    cli_module, _, _, revoked, _ = patched_client
    runner = CliRunner()
    res = runner.invoke(cli_module.cli, ["key", "revoke", "42"])
    assert res.exit_code == 0
    assert revoked == ["42"]
    assert "Revoked" in res.output


def test_cli_rotate_shows_new_key_with_warning(patched_client):
    cli_module, *_, rotated = patched_client
    runner = CliRunner()
    res = runner.invoke(cli_module.cli, ["key", "rotate", "42"])
    assert res.exit_code == 0
    assert rotated == ["42"]
    assert "dl_NEW_secret" in res.output
    assert "shown only once" in res.output.lower()
