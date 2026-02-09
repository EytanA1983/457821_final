from fastapi import FastAPI, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.db.base import Base
from app.db.session import engine
from app.api import auth, categories, rooms, tasks, todos, google_calendar, notifications, ws, audit, recurring_tasks, statistics, sharing, email, ai, drag_drop, ml, health, csp_report, shopping
from app.services.rate_limiter import rate_limiter
from app.core.logging import setup_logging, logger, log_request
from app.core.metrics import setup_prometheus_metrics
from app.core.cache import init_cache
from app.core.tracing import setup_tracing
from app.api.middleware import MetricsMiddleware
from app.api.logging_middleware import LoggingMiddleware
from app.api.cookie_middleware import SecureCookieMiddleware
from app.api.security_headers import (
    SecureHeadersMiddleware,
    create_secure_headers_middleware,
    create_trusted_host_middleware
)
from app.core.limiter import limiter
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from contextlib import asynccontextmanager
import os
# GraphQL disabled - not compatible with Python 3.13
# from strawberry.fastapi import GraphQLRouter
# from app.graphql.schema import schema
# from app.graphql.context import get_graphql_context

# Setup logging first
setup_logging()

# Create database tables (only if not using Alembic)
# Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown events"""
    # Startup
    logger.info("Starting application...")

    # Initialize cache
    cache_initialized = await init_cache()
    if cache_initialized:
        logger.info("Cache initialized successfully")
    else:
        logger.warning("Running without cache (Redis not available)")

    # Setup distributed tracing (OpenTelemetry)
    tracing_enabled = setup_tracing(
        app,
        service_name=os.getenv("OTEL_SERVICE_NAME", "eli-maor-backend"),
        service_version="1.0.0",
        environment=os.getenv("ENVIRONMENT", "development"),
    )
    if tracing_enabled:
        logger.info("OpenTelemetry tracing initialized")
    else:
        logger.info("Tracing disabled or not configured")

    yield

    # Shutdown
    logger.info("Shutting down application...")


app = FastAPI(
    title="אלי מאור – סידור וארגון הבית API",
    description="API for home organization and task management",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS middleware - MUST be FIRST to handle preflight requests
# IMPORTANT: allow_credentials=True is required for cookies to work
# FastAPI's CORSMiddleware automatically handles both OPTIONS (preflight) and actual requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",  # Vite default port
        "http://localhost:5178",   # Custom Vite port
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",   # Vite default port
        "http://127.0.0.1:5178",    # Custom Vite port
        *settings.CORS_ORIGINS,  # Include production origins from settings
    ],
    allow_credentials=True,  # Required for cookies (SameSite=Strict, Secure, HttpOnly)
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],  # Explicit methods including OPTIONS
    allow_headers=["*"],  # Allow all headers
    expose_headers=["*"],  # Expose headers for CORS
    max_age=3600,  # Cache preflight requests for 1 hour
)

# Trusted Host Middleware - Protects against Host header attacks
# Must be after CORS to allow preflight requests
if settings.SECURITY_HEADERS_ENABLED and settings.TRUSTED_HOSTS != ["*"]:
    app.add_middleware(
        create_trusted_host_middleware(settings.TRUSTED_HOSTS)
    )

# Security Headers Middleware (Helmet-style)
# Adds X-Content-Type-Options, X-Frame-Options, HSTS, CSP, etc.
# Must be after CORS middleware
if settings.SECURITY_HEADERS_ENABLED:
    app.add_middleware(
        SecureHeadersMiddleware,
        content_type_nosniff=settings.SECURITY_HEADERS_CONTENT_TYPE_NOSNIFF,
        frame_options=settings.SECURITY_HEADERS_FRAME_OPTIONS,
        xss_protection=settings.SECURITY_HEADERS_XSS_PROTECTION,
        hsts_enabled=settings.SECURITY_HEADERS_HSTS_ENABLED,
        hsts_max_age=settings.SECURITY_HEADERS_HSTS_MAX_AGE,
        hsts_include_subdomains=settings.SECURITY_HEADERS_HSTS_INCLUDE_SUBDOMAINS,
        hsts_preload=settings.SECURITY_HEADERS_HSTS_PRELOAD,
        content_security_policy=settings.CSP_POLICY,
        referrer_policy=settings.SECURITY_HEADERS_REFERRER_POLICY,
        permissions_policy=settings.PERMISSIONS_POLICY,
        dns_prefetch_control=settings.SECURITY_HEADERS_DNS_PREFETCH_CONTROL,
        download_options=settings.SECURITY_HEADERS_DOWNLOAD_OPTIONS,
        permitted_cross_domain_policies=settings.SECURITY_HEADERS_PERMITTED_CROSS_DOMAIN,
    )

# Secure Cookie Middleware - Enforces SameSite=Strict, Secure, HttpOnly
# Must be after CORS middleware
app.add_middleware(SecureCookieMiddleware)

# Metrics middleware (must be after CORS)
app.add_middleware(MetricsMiddleware)

# Logging middleware with correlation IDs
app.add_middleware(LoggingMiddleware)

# Rate limiting middleware (slowapi)
# Add slowapi limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Global exception handler to ensure CORS headers are always present, even on errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Global exception handler that ensures CORS headers are always present,
    even when unhandled exceptions occur.
    Note: HTTPException is handled by FastAPI automatically with CORS headers.
    """
    from fastapi.exceptions import HTTPException
    
    # Don't handle HTTPException - FastAPI handles it automatically with CORS
    if isinstance(exc, HTTPException):
        raise exc
    
    # Log the exception
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    
    # Return error response - CORS middleware will add headers automatically
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )

# Global rate limiting middleware (optional - can be disabled if using decorators only)
if settings.RATE_LIMIT_ENABLED:
    @app.middleware("http")
    async def global_rate_limit_middleware(request: Request, call_next):
        """Apply global rate limiting to all requests"""
        # Skip rate limiting for OPTIONS (CORS preflight), health check and docs
        if request.method == "OPTIONS" or request.url.path in ["/health", "/docs", "/redoc", "/openapi.json", "/openapi.yaml"]:
            return await call_next(request)

        # Apply global rate limit if configured
        if settings.RATE_LIMIT_PER_MINUTE > 0:
            try:
                # Use slowapi's limiter
                limiter.check_request(request)
            except RateLimitExceeded as e:
                logger.warning(
                    "Global rate limit exceeded",
                    extra={
                        "path": request.url.path,
                        "client_ip": limiter.key_func(request),
                        "limit": getattr(e, 'limit', 'unknown'),
                        "retry_after": getattr(e, 'retry_after', 60),
                    }
                )
                return _rate_limit_exceeded_handler(request, e)

        return await call_next(request)

# Include routers
app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(categories.router, prefix="/api", tags=["categories"])
app.include_router(rooms.router, prefix="/api", tags=["rooms"])
app.include_router(tasks.router)  # Already has /api/tasks prefix
app.include_router(todos.router)  # Already has /api/todos prefix
app.include_router(google_calendar.router, prefix="/api", tags=["google-calendar"])
app.include_router(notifications.router)  # Already has /api/notifications prefix
app.include_router(ws.router)
app.include_router(audit.router, prefix="/api", tags=["audit"])
app.include_router(recurring_tasks.router, prefix="/api", tags=["recurring-tasks"])
app.include_router(statistics.router, prefix="/api", tags=["statistics"])
app.include_router(sharing.router, prefix="/api", tags=["sharing"])
app.include_router(email.router, prefix="/api", tags=["email"])
app.include_router(ai.router, prefix="/api", tags=["ai"])
app.include_router(ml.router, prefix="/api", tags=["ml"])
app.include_router(drag_drop.router, prefix="/api", tags=["drag-drop"])
app.include_router(shopping.router)  # Already has /api/shopping prefix
app.include_router(health.router, tags=["health"])  # Health checks at root level
app.include_router(csp_report.router, prefix="/api", tags=["security"])  # CSP violation reporting

# GraphQL endpoint - disabled (not compatible with Python 3.13)
# graphql_app = GraphQLRouter(schema, context_getter=get_graphql_context)
# app.include_router(graphql_app, prefix="/graphql", tags=["graphql"])

# Setup Prometheus metrics (after all routers)
setup_prometheus_metrics(app)


@app.get("/")
def root():
    logger.info("Root endpoint accessed")
    return {
        "message": "אלי מאור – סידור וארגון הבית API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/api/vapid-public-key")
def get_vapid_public_key():
    """Get VAPID public key for Web Push"""
    return {
        "public_key": settings.VAPID_PUBLIC_KEY
    }
