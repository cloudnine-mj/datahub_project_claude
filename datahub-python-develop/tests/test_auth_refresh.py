from __future__ import annotations

from unittest.mock import patch

import httpx

from datahub.auth import CredentialStore
from datahub.client import DataClient
from datahub.config import AuthConfig, DataHubConfig


class _Router:
    def __call__(self, request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/v1/auth/refresh":
            return httpx.Response(
                200,
                json={
                    "access_token": "new-token",
                    "refresh_token": "new-refresh",
                    "expires_in": 1800,
                    "token_type": "Bearer",
                },
            )
        if request.url.path == "/api/v1/auth/session":
            auth = request.headers.get("Authorization", "")
            if auth == "Bearer new-token":
                return httpx.Response(200, json={"email": "user@example.com"})
            return httpx.Response(401, json={"detail": "expired"})
        return httpx.Response(404)


def test_client_refreshes_cli_token_on_401() -> None:
    config = DataHubConfig(auth=AuthConfig(endpoint="http://mock-api:8000", api_key=""))
    transport = httpx.MockTransport(_Router())
    real_client = httpx.Client(base_url="http://mock-api:8000", transport=transport)

    with patch.object(CredentialStore, "load", return_value={"token": "old-token", "refresh_token": "old-refresh"}), patch.object(CredentialStore, "save") as save_mock, patch("httpx.Client", return_value=real_client):
        client = DataClient(config)

    assert client.identity.email == "user@example.com"
    save_mock.assert_called_once()
    saved = save_mock.call_args.args[0]
    assert saved["token"] == "new-token"
    assert saved["refresh_token"] == "new-refresh"
