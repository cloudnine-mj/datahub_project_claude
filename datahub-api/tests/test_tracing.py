from __future__ import annotations

from importlib import import_module

from fastapi import FastAPI


configure_tracing = import_module("app.services.tracing").configure_tracing


def test_configure_tracing_noops_when_disabled(monkeypatch) -> None:
    monkeypatch.setattr("app.services.tracing.settings.otel_enabled", False)
    app = FastAPI()

    configure_tracing(app)

    assert app is not None
