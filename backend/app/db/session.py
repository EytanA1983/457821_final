from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException, status
from app.config import settings
from app.core.logging import logger
import os

# CRITICAL: Validate DATABASE_URL before creating engine
if not settings.DATABASE_URL:
    error_msg = (
        "DATABASE_URL is not set! "
        "Please set DATABASE_URL in your .env file or environment variable. "
        "Example: DATABASE_URL=sqlite:///./app.db"
    )
    logger.critical(error_msg)
    raise ValueError(error_msg)

print(f"[DB] 🔍 Initializing database connection...")
print(f"[DB]    DATABASE_URL: {settings.DATABASE_URL[:50] + '...' if len(settings.DATABASE_URL) > 50 else settings.DATABASE_URL}")
print(f"[DB]    Database type: {'SQLite' if settings.DATABASE_URL.startswith('sqlite') else 'PostgreSQL' if settings.DATABASE_URL.startswith('postgresql') else 'Unknown'}")

# Sync engine (for Alembic and legacy code)
# Support both SQLite and PostgreSQL
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    # For SQLite, ensure the directory exists
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    if db_path and not db_path.startswith(":memory:"):
        from pathlib import Path
        db_file = Path(db_path)
        db_file.parent.mkdir(parents=True, exist_ok=True)
        print(f"[DB]    SQLite database file: {db_file.absolute()}")

try:
    engine = create_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,      # רק במצב פיתוח
        future=True,
        connect_args=connect_args,
    )
    
    # Test the connection immediately
    print(f"[DB]    Testing database connection...")
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        result.fetchone()
    print(f"[DB] ✅ Database connection successful")
    
except SQLAlchemyError as e:
    error_msg = f"Failed to create database engine: {type(e).__name__}: {str(e)}"
    logger.critical(error_msg)
    print(f"[DB] ❌ ERROR: {error_msg}")
    raise ValueError(f"Database connection failed: {error_msg}") from e
except Exception as e:
    error_msg = f"Unexpected error creating database engine: {type(e).__name__}: {str(e)}"
    logger.critical(error_msg)
    print(f"[DB] ❌ ERROR: {error_msg}")
    raise ValueError(f"Database initialization failed: {error_msg}") from e

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """
    Get database session.
    
    This function is used as a FastAPI dependency to provide database sessions.
    It handles session creation and cleanup automatically.
    
    CRITICAL: HTTPException must be re-raised directly without wrapping.
    In production, HTTPException (401/403/404/etc.) should NOT become 500 errors.
    
    Raises:
        HTTPException: Re-raised directly from route/dependency logic (401/403/404/etc.)
        HTTPException: 500 for actual database errors
    """
    db = SessionLocal()
    try:
        yield db
    except HTTPException:
        # CRITICAL: Preserve HTTP semantics from route/dependency logic (401/403/404/etc.)
        # Do not wrap these into 500, otherwise auth errors become server errors.
        # Re-raise HTTPException directly - FastAPI will handle it correctly.
        raise
    except SQLAlchemyError as e:
        error_msg = f"Database connection error: {type(e).__name__}: {str(e)}"
        logger.exception(error_msg)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database connection failed: {error_msg}"
        ) from e
    except Exception as e:
        # Only catch non-HTTPException exceptions here
        # HTTPException should have been caught above
        error_msg = f"Unexpected database error: {type(e).__name__}: {str(e)}"
        logger.exception(error_msg)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {error_msg}"
        ) from e
    finally:
        db.close()


# Async engine for FastAPI Users
def get_async_database_url():
    """Convert sync database URL to async-compatible URL"""
    if not settings.DATABASE_URL:
        raise ValueError("DATABASE_URL is not set")
    
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgresql://"):
        return db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif db_url.startswith("sqlite:///"):
        return db_url.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
    return db_url

try:
    async_db_url = get_async_database_url()
    async_engine = create_async_engine(
        async_db_url,
        echo=settings.DEBUG,
    )
    print(f"[DB] ✅ Async database engine created")
except Exception as e:
    error_msg = f"Failed to create async database engine: {type(e).__name__}: {str(e)}"
    logger.critical(error_msg)
    print(f"[DB] ❌ ERROR: {error_msg}")
    raise ValueError(f"Async database initialization failed: {error_msg}") from e

AsyncSessionLocal = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_async_db():
    async with AsyncSessionLocal() as session:
        yield session
