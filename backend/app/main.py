from fastapi import FastAPI, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from app.config import settings
from app.db.base import Base
from app.db.session import engine
from app.api import auth, categories, rooms, tasks, todos, google_calendar, notifications, ws, audit, recurring_tasks, statistics, progress, sharing, email, ai, drag_drop, ml, health, csp_report, shopping, content, inventory, emotional_journal, daily_focus, blueprint_aliases
from app.api.routes import daily_reset
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
import sys
# GraphQL disabled - not compatible with Python 3.13
# from strawberry.fastapi import GraphQLRouter
# from app.graphql.schema import schema
# from app.graphql.context import get_graphql_context

# CRITICAL: Remove all existing Loguru handlers at the very start
# This ensures we start with a clean slate before any other code runs
from loguru import logger
logger.remove()

# Setup logging first
setup_logging()

# Create database tables (only if not using Alembic)
# Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown events"""
    # Startup
    # Logger is already configured in setup_logging() at module level
    # No need to reconfigure here - setup_logging() was called before app creation
    logger.info("Starting application...")
    # Debug/verification: show CORS origins loaded from settings (.env / env vars / defaults)
    # Safe to log (non-sensitive); helps diagnose dev CORS issues.
    logger.info("CORS_ORIGINS loaded", extra={"cors_origins": settings.CORS_ORIGINS})
    
    # Check if critical database tables exist
    try:
        from sqlalchemy import inspect, text
        from app.db.session import engine
        
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        critical_tables = ['users', 'tasks', 'rooms', 'categories']
        missing_tables = [t for t in critical_tables if t not in tables]
        
        if missing_tables:
            error_msg = (
                f"Critical database tables are missing: {missing_tables}. "
                "Please run database migrations: 'alembic upgrade head'"
            )
            logger.critical(error_msg)
            print(f"[STARTUP] ❌ {error_msg}")
            print(f"[STARTUP]    Available tables: {tables}")
            print(f"[STARTUP]    Missing tables: {missing_tables}")
            # Don't raise here - let the app start but log the error
            # Individual endpoints will handle the error gracefully
        else:
            logger.info("✅ All critical database tables exist", extra={"tables": tables})
            print(f"[STARTUP] ✅ Database check passed - {len(tables)} tables found")

        # DEV SAFETY NET (SQLite only):
        # Keep local SQLite schema compatible when migrations were skipped.
        try:
            if engine.url.get_backend_name() == "sqlite" and "tasks" in tables:
                task_columns = {col["name"] for col in inspector.get_columns("tasks")}
                required_task_columns_sql = {
                    "completed_at": "ALTER TABLE tasks ADD COLUMN completed_at DATETIME",
                    "before_image_url": "ALTER TABLE tasks ADD COLUMN before_image_url VARCHAR(500)",
                    "after_image_url": "ALTER TABLE tasks ADD COLUMN after_image_url VARCHAR(500)",
                    "before_image_at": "ALTER TABLE tasks ADD COLUMN before_image_at DATETIME",
                    "after_image_at": "ALTER TABLE tasks ADD COLUMN after_image_at DATETIME",
                    "assignee_user_id": "ALTER TABLE tasks ADD COLUMN assignee_user_id INTEGER",
                    "assignee_name": "ALTER TABLE tasks ADD COLUMN assignee_name VARCHAR(120)",
                    "assignee_age": "ALTER TABLE tasks ADD COLUMN assignee_age INTEGER",
                    "is_kid_task": "ALTER TABLE tasks ADD COLUMN is_kid_task BOOLEAN DEFAULT 0",
                }
                missing_columns = [name for name in required_task_columns_sql if name not in task_columns]
                if missing_columns:
                    logger.warning(
                        "SQLite tasks schema is missing columns. Applying compatibility patch.",
                        extra={"missing_columns": missing_columns},
                    )
                    with engine.begin() as conn:
                        for col_name in missing_columns:
                            conn.execute(text(required_task_columns_sql[col_name]))
                    logger.info("SQLite compatibility patch applied", extra={"added_columns": missing_columns})
                    print(f"[STARTUP] ✅ Added missing SQLite tasks columns: {missing_columns}")

            # SQLite: create feature tables if migrations / patch script were never run (idempotent).
            if engine.url.get_backend_name() == "sqlite" and "users" in tables:
                inspector_sqlite = inspect(engine)
                present = set(inspector_sqlite.get_table_names())
                from app.db.models.emotional_journal import EmotionalJournalEntry
                from app.db.models.daily_focus import DailyFocus

                for model, tbl in (
                    (EmotionalJournalEntry, "emotional_journal_entries"),
                    (DailyFocus, "daily_focus"),
                ):
                    if tbl not in present:
                        model.__table__.create(bind=engine, checkfirst=True)
                        logger.info("SQLite: created missing table", extra={"table": tbl})
                        print(f"[STARTUP] ✅ Created missing SQLite table: {tbl}")
                        present.add(tbl)
        except Exception as schema_fix_error:
            logger.warning(
                f"SQLite compatibility patch failed: {schema_fix_error}. "
                "Run 'alembic upgrade head' manually."
            )
            print(f"[STARTUP] ⚠️  SQLite compatibility patch failed: {schema_fix_error}")
    except Exception as e:
        logger.warning(f"Could not verify database tables: {e}. This may cause errors if migrations haven't run.")
        print(f"[STARTUP] ⚠️  Could not verify database tables: {e}")

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

    # Initialize Sentry (error tracking) - optional
    if settings.SENTRY_DSN:
        try:
            import sentry_sdk
            from sentry_sdk.integrations.fastapi import FastApiIntegration
            from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
            from sentry_sdk.integrations.celery import CeleryIntegration
            from sentry_sdk.integrations.redis import RedisIntegration
            
            sentry_sdk.init(
                dsn=settings.SENTRY_DSN,
                integrations=[
                    FastApiIntegration(),
                    SqlalchemyIntegration(),
                    CeleryIntegration(),
                    RedisIntegration(),
                ],
                traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
                environment=settings.SENTRY_ENVIRONMENT,
                release=f"eli-maor-backend@1.0.0",
                # Capture unhandled exceptions
                attach_stacktrace=True,
                # Send user context
                send_default_pii=False,  # Set to True if you want to send user emails/IPs
            )
            logger.info(f"Sentry initialized for environment: {settings.SENTRY_ENVIRONMENT}")
        except ImportError:
            logger.warning("Sentry SDK not installed - install with: pip install sentry-sdk[fastapi]")
        except Exception as e:
            logger.warning(f"Failed to initialize Sentry: {e}")
    else:
        logger.debug("Sentry DSN not set - error tracking disabled")

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
# IMPORTANT: 
# - allow_credentials=True requires explicit origins (cannot use "*")
# - FastAPI's CORSMiddleware automatically handles both OPTIONS (preflight) and actual requests
# - Using settings.CORS_ORIGINS directly (already includes all needed origins)
# - allow_origins must be a detailed list - NOT ["*"] with allow_credentials=True (CORS spec requirement)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,  # List[str] from config.py (includes localhost:5179, localhost:5173, etc.)
    allow_credentials=True,  # Required for cookies (SameSite=Strict, Secure, HttpOnly) or Authorization headers
    allow_methods=["*"],  # Allow all HTTP methods (GET, POST, PUT, DELETE, OPTIONS, PATCH, etc.)
    allow_headers=["*"],  # Allow all headers (Content-Type, Authorization, etc.)
    expose_headers=["*"],  # Expose all headers for CORS
    max_age=3600,  # Cache preflight requests for 1 hour
)

# Middleware to add CORS headers to redirect responses
# FastAPI/Starlette redirects don't automatically include CORS headers, causing CORS errors
class CORSRedirectMiddleware(BaseHTTPMiddleware):
    """Add CORS headers to redirect responses"""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # If response is a redirect (3xx status), add CORS headers
        if isinstance(response, RedirectResponse) or (300 <= response.status_code < 400):
            origin = request.headers.get("origin")
            if origin and origin in settings.CORS_ORIGINS:
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Credentials"] = "true"
                response.headers["Access-Control-Allow-Methods"] = "*"
                response.headers["Access-Control-Allow-Headers"] = "*"
        
        return response

# Add CORS redirect middleware AFTER CORS middleware
app.add_middleware(CORSRedirectMiddleware)

# Trusted Host Middleware - Protects against Host header attacks
# Must be after CORS to allow preflight requests
# DISABLED in development to avoid blocking CORS preflight requests
if settings.SECURITY_HEADERS_ENABLED and settings.TRUSTED_HOSTS != ["*"] and not settings.DEBUG:
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
# This handler preserves error details for debugging while ensuring CORS headers are present
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Global exception handler that ensures CORS headers are always present,
    even when unhandled exceptions occur.
    Preserves error details for debugging in development mode.
    Note: HTTPException is handled by FastAPI automatically with CORS headers.
    """
    from fastapi.exceptions import HTTPException
    import traceback
    from datetime import datetime
    
    # Don't handle HTTPException - FastAPI handles it automatically with CORS
    if isinstance(exc, HTTPException):
        raise exc
    
    # Get full traceback with all details
    exc_type = type(exc).__name__
    exc_msg = str(exc)
    exc_traceback = traceback.format_exc()
    
    # Log the exception with full traceback - this will show in console
    logger.exception(
        f"Unhandled exception ({exc_type}): {exc_msg}",
        exc_info=True,
        extra={
            "path": request.url.path,
            "method": request.method,
            "query_params": dict(request.query_params),
            "client_ip": request.client.host if request.client else None,
            "timestamp": datetime.utcnow().isoformat(),
        }
    )
    
    # Print full traceback to console for immediate visibility
    print("\n" + "=" * 70)
    print(f"  ❌ UNHANDLED EXCEPTION - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)
    print(f"Exception Type: {exc_type}")
    print(f"Exception Message: {exc_msg}")
    print(f"Path: {request.method} {request.url.path}")
    print(f"Client IP: {request.client.host if request.client else 'Unknown'}")
    print("\nFull Traceback:")
    print("-" * 70)
    print(exc_traceback)
    print("-" * 70)
    print("=" * 70)
    print()
    
    # In development, return detailed error message with traceback
    # In production, return generic message for security
    if settings.DEBUG:
        error_detail = f"{exc_type}: {exc_msg}"
        # Include traceback in response for debugging (only in DEBUG mode)
        error_detail += f"\n\nTraceback:\n{exc_traceback}"
    else:
        error_detail = "Internal server error"
    
    # Return error response - CORS middleware will add headers automatically
    # For OPTIONS requests, return 200 (not 500) to allow CORS preflight
    status_code = 200 if request.method == "OPTIONS" else 500
    
    response = JSONResponse(
        status_code=status_code,
        content={"detail": error_detail} if status_code != 200 else {},
    )
    
    # Ensure CORS headers are present (especially for OPTIONS preflight)
    # FastAPI's CORSMiddleware should handle this, but we add them explicitly for safety
    origin = request.headers.get("origin")
    if origin and origin in settings.CORS_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        if request.method == "OPTIONS":
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    
    return response

# Global rate limiting middleware (optional - can be disabled if using decorators only)
if settings.RATE_LIMIT_ENABLED:
    @app.middleware("http")
    async def global_rate_limit_middleware(request: Request, call_next):
        """Apply global rate limiting to all requests"""
        # Skip rate limiting for OPTIONS (CORS preflight), health check and docs
        # CRITICAL: OPTIONS requests must pass through without rate limiting for CORS to work
        if request.method == "OPTIONS":
            return await call_next(request)
        if request.url.path in ["/health", "/docs", "/redoc", "/openapi.json", "/openapi.yaml"]:
            return await call_next(request)

        # IMPORTANT (Production stability):
        # Do NOT call non-stable slowapi internal APIs (like limiter.check_request) here.
        # That can convert normal 401/403 flows into 500 errors depending on slowapi version.
        #
        # For global limiting, use our stable Redis-based rate limiter service.
        # slowapi remains available for per-route decorators.
        try:
            allowed, error_message = rate_limiter.check_rate_limit(
                request,
                limit_per_minute=settings.RATE_LIMIT_PER_MINUTE,
                limit_per_hour=settings.RATE_LIMIT_PER_HOUR,
            )
            if not allowed:
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={"detail": error_message or "Rate limit exceeded"},
                )
        except Exception as e:
            # Fail open: rate limiting must never break the API (especially auth flows).
            logger.warning(f"Global rate limiter failed open: {e}")

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
app.include_router(progress.router, prefix="/api", tags=["progress"])
app.include_router(sharing.router, prefix="/api", tags=["sharing"])
app.include_router(email.router, prefix="/api", tags=["email"])
app.include_router(ai.router, prefix="/api", tags=["ai"])
app.include_router(ml.router, prefix="/api", tags=["ml"])
app.include_router(drag_drop.router, prefix="/api", tags=["drag-drop"])
app.include_router(shopping.router)  # Already has /api/shopping prefix
app.include_router(health.router, tags=["health"])  # Health checks at root level
app.include_router(csp_report.router, prefix="/api", tags=["security"])  # CSP violation reporting
app.include_router(content.router, prefix="/api", tags=["content"])
app.include_router(inventory.router)  # Already has /api/inventory prefix
app.include_router(emotional_journal.router)
app.include_router(daily_focus.router)
app.include_router(daily_reset.router)  # Simple daily reset router
app.include_router(blueprint_aliases.router)

# GraphQL endpoint - disabled (not compatible with Python 3.13)
# graphql_app = GraphQLRouter(schema, context_getter=get_graphql_context)
# app.include_router(graphql_app, prefix="/graphql", tags=["graphql"])

# Setup Prometheus metrics (after all routers)
setup_prometheus_metrics(app)

# Static files serving (optional - for backend static assets like uploads, images, etc.)
# NOTE: Frontend static files (including manifest.webmanifest) are served by Vite (dev) or NGINX (prod)
# This is only needed if you want to serve static files directly from the FastAPI backend
#
# If you need to serve manifest.webmanifest from FastAPI backend:
# 1. Create a public directory: backend/public/
# 2. Copy manifest.webmanifest to backend/public/
# 3. Uncomment and use:
#    from fastapi.staticfiles import StaticFiles
#    app.mount("/", StaticFiles(directory="public"), name="public")
#    This will serve files from public/* with correct MIME types (application/manifest+json for .webmanifest)
#
# Current setup:
# - Development: Vite serves manifest.webmanifest from frontend/public/ with correct MIME type
# - Production: NGINX serves manifest.webmanifest with Content-Type: application/manifest+json
static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
    logger.info(f"Static files directory mounted at /static: {static_dir}")
else:
    logger.debug(f"Static files directory not found: {static_dir} (this is OK if not needed)")


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
