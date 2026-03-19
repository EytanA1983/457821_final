"""
Logging Middleware for FastAPI
Handles:
- Correlation ID generation and propagation
- Request/response logging
- Performance tracking
"""
import time
import uuid
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.logging import (
    logger,
    set_correlation_id,
    set_request_context,
    clear_request_context,
    log_request,
)


class LoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware for structured request logging with correlation IDs.
    
    Features:
    - Generates or propagates correlation IDs (X-Correlation-ID header)
    - Logs all requests with timing
    - Adds request context to all logs during the request
    - Handles errors gracefully
    """
    
    # Paths to skip detailed logging (health checks, etc.)
    SKIP_PATHS = {"/health", "/metrics", "/favicon.ico"}
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip logging for OPTIONS (CORS preflight) and health checks
        # CRITICAL: OPTIONS requests must pass through without logging to avoid 500 errors
        if request.method == "OPTIONS":
            return await call_next(request)
        
        if request.url.path in self.SKIP_PATHS:
            return await call_next(request)
        
        # Get or generate correlation ID
        correlation_id = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
        set_correlation_id(correlation_id)
        
        # Set request context for all logs during this request
        request_context = {
            "method": request.method,
            "path": str(request.url.path),
            "client_ip": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
        }
        set_request_context(request_context)
        
        # Start timing
        start_time = time.time()
        
        # Log request start (debug level to reduce noise)
        logger.debug(
            f"Request started: {request.method} {request.url.path}",
            extra={
                "event_type": "request_start",
                **request_context,
            }
        )
        
        try:
            # Process request
            response = await call_next(request)
            
            # Calculate duration
            duration_ms = (time.time() - start_time) * 1000
            
            # Log request completion
            log_request(request, response, duration_ms)
            
            # Add correlation ID to response headers
            response.headers["X-Correlation-ID"] = correlation_id
            response.headers["X-Response-Time"] = f"{duration_ms:.2f}ms"
            
            return response
            
        except Exception as e:
            # Calculate duration
            duration_ms = (time.time() - start_time) * 1000
            
            # Log error
            logger.error(
                f"Request failed: {request.method} {request.url.path}",
                extra={
                    "event_type": "request_error",
                    "duration_ms": round(duration_ms, 2),
                    "error_type": type(e).__name__,
                    "error_message": str(e),
                    **request_context,
                },
                exc_info=True,
            )
            raise
            
        finally:
            # Clear request context
            clear_request_context()


class SQLAlchemyQueryLogger:
    """
    SQLAlchemy event listener for logging slow queries.
    
    Usage:
        from sqlalchemy import event
        from app.api.logging_middleware import SQLAlchemyQueryLogger
        
        query_logger = SQLAlchemyQueryLogger(slow_query_threshold_ms=500)
        event.listen(engine, "before_cursor_execute", query_logger.before_execute)
        event.listen(engine, "after_cursor_execute", query_logger.after_execute)
    """
    
    def __init__(self, slow_query_threshold_ms: float = 500):
        self.slow_query_threshold_ms = slow_query_threshold_ms
        self._query_start_times = {}
    
    def before_execute(self, conn, cursor, statement, parameters, context, executemany):
        """Record query start time"""
        self._query_start_times[id(cursor)] = time.time()
    
    def after_execute(self, conn, cursor, statement, parameters, context, executemany):
        """Log query after execution"""
        start_time = self._query_start_times.pop(id(cursor), None)
        if start_time is None:
            return
        
        duration_ms = (time.time() - start_time) * 1000
        
        # Only log slow queries
        if duration_ms > self.slow_query_threshold_ms:
            # Truncate long queries for logging
            truncated_statement = statement[:500] + "..." if len(statement) > 500 else statement
            
            logger.warning(
                "Slow SQL query detected",
                extra={
                    "event_type": "slow_query",
                    "duration_ms": round(duration_ms, 2),
                    "threshold_ms": self.slow_query_threshold_ms,
                    "statement": truncated_statement,
                }
            )


def get_request_id(request: Request) -> str:
    """Get correlation ID from request headers or generate new one"""
    return request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
