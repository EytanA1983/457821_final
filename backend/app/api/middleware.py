"""
Middleware for metrics and observability
"""
import time
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.metrics import (
    REQUEST_COUNT,
    REQUEST_LATENCY,
    ERROR_COUNT,
    ACTIVE_REQUESTS,
    record_database_query,
)
from app.core.logging import logger


class MetricsMiddleware(BaseHTTPMiddleware):
    """
    Middleware to record custom metrics
    """

    async def dispatch(self, request: Request, call_next):
        # Skip metrics for OPTIONS (CORS preflight) to avoid 500 errors
        # CRITICAL: OPTIONS requests must pass through without metrics
        if request.method == "OPTIONS":
            return await call_next(request)
        
        # Get endpoint path (without query params)
        path = request.url.path
        method = request.method
        
        # Normalize path for Prometheus labels (replace special chars and IDs)
        endpoint = self._normalize_path(path)

        # Increment active requests
        ACTIVE_REQUESTS.labels(method=method, endpoint=endpoint).inc()

        # Start timer
        start_time = time.time()

        try:
            # Process request
            response = await call_next(request)
            status_code = response.status_code

            # Calculate duration
            duration = time.time() - start_time

            # Record metrics
            REQUEST_COUNT.labels(
                method=method, endpoint=endpoint, status_code=str(status_code)
            ).inc()

            REQUEST_LATENCY.labels(method=method, endpoint=endpoint).observe(duration)

            # Record errors
            if status_code >= 400:
                ERROR_COUNT.labels(
                    method=method, endpoint=endpoint, status_code=str(status_code), error_type="http_error"
                ).inc()

            return response

        except Exception as e:
            # Record error
            ERROR_COUNT.labels(
                method=method, endpoint=endpoint, status_code="500", error_type=type(e).__name__
            ).inc()
            logger.error(f"Request failed: {e}", exc_info=True)
            raise

        finally:
            # Decrement active requests
            ACTIVE_REQUESTS.labels(method=method, endpoint=endpoint).dec()
    
    @staticmethod
    def _normalize_path(path: str) -> str:
        """Normalize path for Prometheus labels by replacing IDs and special chars."""
        import re
        # Replace numeric IDs
        normalized = re.sub(r'/\d+', '/{id}', path)
        # Replace UUIDs
        normalized = re.sub(
            r'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
            '/{uuid}',
            normalized,
            flags=re.IGNORECASE,
        )
        # Replace slashes and special chars with underscores for Prometheus labels
        # Prometheus labels can contain: [a-zA-Z0-9_]
        normalized = normalized.replace('/', '_').replace('-', '_').replace('.', '_')
        # Remove leading underscore if exists
        normalized = normalized.lstrip('_')
        return normalized or 'root'