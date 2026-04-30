from __future__ import annotations

from datahub.config import DataHubConfig


def test_load_reads_ssl_environment_overrides(monkeypatch) -> None:
    monkeypatch.setenv("DATAHUB_AUTH_ENDPOINT", "https://example.com")
    monkeypatch.setenv("DATAHUB_VERIFY_SSL", "false")
    monkeypatch.setenv("DATAHUB_CA_BUNDLE", "/tmp/dev-ca.pem")

    config = DataHubConfig.load()

    assert config.auth.endpoint == "https://example.com"
    assert config.auth.verify_ssl is False
    assert config.auth.ca_bundle == "/tmp/dev-ca.pem"
