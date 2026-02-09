"""
OpenTelemetry Distributed Tracing
Provides end-to-end request tracing across services

Features:
- Automatic instrumentation for FastAPI, SQLAlchemy, Redis, Celery, httpx
- Span context propagation
- Trace ID in logs
- Export to Jaeger/OTLP/Zipkin

Usage:
    from app.core.tracing import setup_tracing, get_tracer

    # In main.py
    setup_tracing(app, service_name="eli-maor-backend")

    # In any module
    tracer = get_tracer(__name__)
    with tracer.start_as_current_span("my-operation") as span:
        span.set_attribute("key", "value")
        # ... do work
"""
import os
import logging
from typing import Optional
from contextlib import contextmanager

from fastapi import FastAPI

logger = logging.getLogger(__name__)

# Global tracer reference
_tracer = None


def setup_tracing(
    app: FastAPI,
    service_name: str = "eli-maor-backend",
    service_version: str = "1.0.0",
    environment: str = None,
    otlp_endpoint: str = None,
    jaeger_endpoint: str = None,
    sample_rate: float = 1.0,
) -> bool:
    """
    Setup OpenTelemetry distributed tracing.
    
    Returns False if opentelemetry is not installed (optional dependency).

    Args:
        app: FastAPI application instance
        service_name: Name of the service for traces
        service_version: Version of the service
        environment: Environment name (production, staging, etc.)
        otlp_endpoint: OTLP exporter endpoint (e.g., "http://otel-collector:4317")
        jaeger_endpoint: Jaeger endpoint (e.g., "http://jaeger:14268/api/traces")
        sample_rate: Sampling rate (0.0 to 1.0, default 1.0 = all traces)

    Returns:
        True if tracing was set up successfully, False otherwise
    """
    global _tracer

    # Get configuration from environment
    environment = environment or os.getenv("ENVIRONMENT", "development")
    otlp_endpoint = otlp_endpoint or os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    jaeger_endpoint = jaeger_endpoint or os.getenv("JAEGER_ENDPOINT")

    # Check if tracing is enabled
    tracing_enabled = os.getenv("OTEL_TRACING_ENABLED", "true").lower() == "true"
    if not tracing_enabled:
        logger.info("OpenTelemetry tracing is disabled")
        return False

    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.sampling import TraceIdRatioBased
        from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION
        from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
        from opentelemetry.instrumentation.redis import RedisInstrumentor
        from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
        from opentelemetry.instrumentation.celery import CeleryInstrumentor
        from opentelemetry.instrumentation.logging import LoggingInstrumentor

    except ImportError as e:
        logger.warning(f"OpenTelemetry packages not installed: {e}. Tracing disabled.")
        return False

    try:
        # Create resource with service info
        resource = Resource.create({
            SERVICE_NAME: service_name,
            SERVICE_VERSION: service_version,
            "deployment.environment": environment,
            "telemetry.sdk.language": "python",
        })

        # Create sampler
        sampler = TraceIdRatioBased(sample_rate)

        # Create tracer provider
        provider = TracerProvider(
            resource=resource,
            sampler=sampler,
        )

        # Add exporters
        exporters_configured = False

        # OTLP Exporter (preferred - works with most backends)
        if otlp_endpoint:
            try:
                from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

                otlp_exporter = OTLPSpanExporter(
                    endpoint=otlp_endpoint,
                    insecure=True,  # Set to False in production with TLS
                )
                provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
                exporters_configured = True
                logger.info(f"OTLP exporter configured: {otlp_endpoint}")
            except ImportError:
                logger.warning("OTLP exporter not installed")

        # Jaeger Exporter (legacy)
        if jaeger_endpoint and not exporters_configured:
            try:
                from opentelemetry.exporter.jaeger.thrift import JaegerExporter

                jaeger_exporter = JaegerExporter(
                    collector_endpoint=jaeger_endpoint,
                )
                provider.add_span_processor(BatchSpanProcessor(jaeger_exporter))
                exporters_configured = True
                logger.info(f"Jaeger exporter configured: {jaeger_endpoint}")
            except ImportError:
                logger.warning("Jaeger exporter not installed")

        # Console exporter for development
        if environment == "development" and not exporters_configured:
            console_exporter = ConsoleSpanExporter()
            provider.add_span_processor(BatchSpanProcessor(console_exporter))
            logger.info("Console span exporter configured (development mode)")
            exporters_configured = True

        # Set the tracer provider
        trace.set_tracer_provider(provider)
        _tracer = trace.get_tracer(service_name, service_version)

        # Instrument FastAPI
        FastAPIInstrumentor.instrument_app(
            app,
            excluded_urls="health,metrics,docs,openapi.json,redoc",
        )
        logger.info("FastAPI instrumented")

        # Instrument SQLAlchemy
        try:
            SQLAlchemyInstrumentor().instrument(
                enable_commenter=True,
                commenter_options={
                    "db_driver": True,
                    "db_framework": True,
                    "opentelemetry_values": True,
                }
            )
            logger.info("SQLAlchemy instrumented")
        except Exception as e:
            logger.warning(f"Failed to instrument SQLAlchemy: {e}")

        # Instrument Redis
        try:
            RedisInstrumentor().instrument()
            logger.info("Redis instrumented")
        except Exception as e:
            logger.warning(f"Failed to instrument Redis: {e}")

        # Instrument HTTPX
        try:
            HTTPXClientInstrumentor().instrument()
            logger.info("HTTPX instrumented")
        except Exception as e:
            logger.warning(f"Failed to instrument HTTPX: {e}")

        # Instrument Celery
        try:
            CeleryInstrumentor().instrument()
            logger.info("Celery instrumented")
        except Exception as e:
            logger.warning(f"Failed to instrument Celery: {e}")

        # Instrument logging (adds trace_id to logs)
        try:
            LoggingInstrumentor().instrument(
                set_logging_format=True,
                log_level=logging.INFO,
            )
            logger.info("Logging instrumented with trace context")
        except Exception as e:
            logger.warning(f"Failed to instrument logging: {e}")

        logger.info(f"OpenTelemetry tracing initialized for {service_name}")
        return True

    except Exception as e:
        logger.error(f"Failed to setup OpenTelemetry tracing: {e}")
        return False


def get_tracer(name: str = __name__):
    """
    Get a tracer instance for creating spans.

    Args:
        name: Name of the tracer (usually __name__)

    Returns:
        Tracer instance or a no-op tracer if tracing is not configured
    """
    global _tracer

    if _tracer is not None:
        return _tracer

    try:
        from opentelemetry import trace
        return trace.get_tracer(name)
    except ImportError:
        # Return a no-op tracer
        return NoOpTracer()


def get_current_span():
    """Get the current active span."""
    try:
        from opentelemetry import trace
        return trace.get_current_span()
    except ImportError:
        return None


def get_trace_id() -> Optional[str]:
    """
    Get the current trace ID as a hex string.
    Useful for logging and debugging.
    """
    try:
        from opentelemetry import trace
        span = trace.get_current_span()
        if span:
            trace_id = span.get_span_context().trace_id
            if trace_id:
                return format(trace_id, '032x')
    except Exception:
        pass
    return None


def get_span_id() -> Optional[str]:
    """Get the current span ID as a hex string."""
    try:
        from opentelemetry import trace
        span = trace.get_current_span()
        if span:
            span_id = span.get_span_context().span_id
            if span_id:
                return format(span_id, '016x')
    except Exception:
        pass
    return None


@contextmanager
def create_span(name: str, attributes: dict = None):
    """
    Context manager for creating a span.

    Usage:
        with create_span("my-operation", {"key": "value"}) as span:
            # ... do work
            span.set_attribute("result", "success")
    """
    tracer = get_tracer()
    with tracer.start_as_current_span(name) as span:
        if attributes:
            for key, value in attributes.items():
                span.set_attribute(key, value)
        yield span


def add_span_attributes(**attributes):
    """Add attributes to the current span."""
    span = get_current_span()
    if span:
        for key, value in attributes.items():
            span.set_attribute(key, value)


def add_span_event(name: str, attributes: dict = None):
    """Add an event to the current span."""
    span = get_current_span()
    if span:
        span.add_event(name, attributes or {})


def set_span_status(status: str, description: str = None):
    """Set the status of the current span."""
    try:
        from opentelemetry.trace import StatusCode

        span = get_current_span()
        if span:
            if status.lower() == "error":
                span.set_status(StatusCode.ERROR, description)
            elif status.lower() == "ok":
                span.set_status(StatusCode.OK, description)
    except Exception:
        pass


def record_exception(exception: Exception, attributes: dict = None):
    """Record an exception in the current span."""
    span = get_current_span()
    if span:
        span.record_exception(exception, attributes=attributes or {})


class NoOpTracer:
    """No-op tracer for when OpenTelemetry is not installed."""

    def start_as_current_span(self, name, **kwargs):
        return NoOpSpan()

    def start_span(self, name, **kwargs):
        return NoOpSpan()


class NoOpSpan:
    """No-op span for when OpenTelemetry is not installed."""

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def set_attribute(self, key, value):
        pass

    def set_attributes(self, attributes):
        pass

    def add_event(self, name, attributes=None):
        pass

    def set_status(self, status, description=None):
        pass

    def record_exception(self, exception, attributes=None):
        pass

    def end(self):
        pass

    def get_span_context(self):
        return None
