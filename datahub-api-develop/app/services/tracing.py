from __future__ import annotations

from importlib import import_module
import logging

from app.config import settings

logger = logging.getLogger(__name__)


def configure_tracing(app) -> None:
    if not getattr(settings, "otel_enabled", False):
        return

    try:
        trace = import_module("opentelemetry.trace")
        OTLPSpanExporter = import_module("opentelemetry.exporter.otlp.proto.http.trace_exporter").OTLPSpanExporter
        FastAPIInstrumentor = import_module("opentelemetry.instrumentation.fastapi").FastAPIInstrumentor
        Resource = import_module("opentelemetry.sdk.resources").Resource
        TracerProvider = import_module("opentelemetry.sdk.trace").TracerProvider
        BatchSpanProcessor = import_module("opentelemetry.sdk.trace.export").BatchSpanProcessor
    except ImportError as exc:
        logger.warning("OpenTelemetry requested but dependencies are unavailable: %s", exc)
        return

    resource = Resource.create({"service.name": getattr(settings, "otel_service_name", "datahub-api")})
    provider = TracerProvider(resource=resource)

    otlp_endpoint = getattr(settings, "otel_exporter_otlp_endpoint", "")
    if otlp_endpoint:
        exporter = OTLPSpanExporter(endpoint=otlp_endpoint)
        provider.add_span_processor(BatchSpanProcessor(exporter))

    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(app)
