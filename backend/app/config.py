"""
Application Configuration
All values are loaded from environment variables or secrets management systems.
NO hardcoded secrets allowed!

Secrets are loaded in this priority:
1. Environment variables
2. Docker secrets (/run/secrets/)
3. AWS Secrets Manager
"""
import os
from pathlib import Path
from typing import Optional, List
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator, model_validator


def get_secret_with_fallback(key: str, default: str = "") -> str:
    """
    Get a secret from environment or Docker secrets.
    For use in Field defaults.
    """
    # Try environment variable first
    value = os.getenv(key)
    if value:
        return value

    # Try Docker secret
    docker_secret_path = Path(f"/run/secrets/{key.lower()}")
    if docker_secret_path.exists():
        try:
            return docker_secret_path.read_text().strip()
        except Exception:
            pass

    return default


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.

    IMPORTANT: All sensitive values MUST be set via environment variables
    or secrets management (Docker secrets, AWS Secrets Manager, HashiCorp Vault).

    VAPID_PRIVATE_KEY supports:
    - Plain text (not recommended for production)
    - Encrypted format (requires VAPID_ENCRYPTION_KEY)
    - HashiCorp Vault (recommended for production)
    - AWS Secrets Manager
    """

    # =====================================================
    # CORE SETTINGS
    # =====================================================
    PROJECT_NAME: str = Field(
        default="אלי מאור – סידור ואירגון הבית",
        description="Project name"
    )
    DEBUG: bool = Field(
        default=False,  # Default to False for security
        description="Debug mode (set to true only in development)"
    )
    ENV: str = Field(
        default="development",
        description="Environment: development, staging, production. Alias for ENVIRONMENT."
    )
    ENVIRONMENT: str = Field(
        default="development",
        description="Environment: development, staging, production"
    )

    # =====================================================
    # SECURITY SETTINGS (SENSITIVE!)
    # =====================================================
    SECRET_KEY: str = Field(
        default="dev-secret-key",  # Development fallback - MUST be overridden in production
        description="Secret key for JWT tokens - MUST BE SET in production!"
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=60,  # Default 60 for dev, should be 30 for prod
        description="Access token expiry in minutes (30 recommended for production, 60 for development)"
    )
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(
        default=30,
        description="Refresh token expiry in days (30 days recommended)"
    )
    ALGORITHM: str = Field(
        default="HS256",
        description="JWT algorithm"
    )

    # =====================================================
    # DATABASE (SENSITIVE!)
    # =====================================================
    DATABASE_URL: str = Field(
        default="sqlite:///./dev.db",  # Development fallback - MUST be overridden in production
        description="Database connection URL - MUST BE SET in production!"
    )

    # =====================================================
    # REDIS / CELERY
    # =====================================================
    CELERY_BROKER_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis URL for Celery broker"
    )
    CELERY_RESULT_BACKEND: str = Field(
        default="redis://localhost:6379/0",
        description="Redis URL for Celery result backend"
    )
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis URL for caching"
    )

    # =====================================================
    # CACHE SETTINGS
    # =====================================================
    CACHE_ENABLED: bool = Field(default=True)
    CACHE_TTL_ROOMS: int = Field(default=60)
    CACHE_TTL_TASKS: int = Field(default=120)
    CACHE_TTL_CATEGORIES: int = Field(default=60)

    # =====================================================
    # COOKIE SETTINGS
    # =====================================================
    COOKIE_SECURE: bool = Field(
        default=False,
        description="Set Secure flag on cookies (HTTPS only). Auto-enabled in production."
    )
    COOKIE_HTTPONLY: bool = Field(
        default=True,
        description="Set HttpOnly flag on cookies (prevents XSS attacks)"
    )
    COOKIE_SAMESITE: str = Field(
        default="Strict",
        description="SameSite cookie attribute: Strict, Lax, or None"
    )
    COOKIE_DOMAIN: Optional[str] = Field(
        default=None,
        description="Cookie domain (optional, for cross-subdomain cookies)"
    )
    COOKIE_PATH: str = Field(
        default="/",
        description="Cookie path (default: /)"
    )
    # Session cookie settings (if using session-based auth)
    SESSION_COOKIE_NAME: str = Field(
        default="session",
        description="Session cookie name"
    )
    SESSION_COOKIE_MAX_AGE: int = Field(
        default=60 * 60 * 24 * 30,  # 30 days
        description="Session cookie max age in seconds"
    )

    # =====================================================
    # SECURITY HEADERS (Helmet-style)
    # =====================================================
    SECURITY_HEADERS_ENABLED: bool = Field(
        default=True,
        description="Enable security headers middleware"
    )
    SECURITY_HEADERS_CONTENT_TYPE_NOSNIFF: bool = Field(
        default=True,
        description="X-Content-Type-Options: nosniff"
    )
    SECURITY_HEADERS_FRAME_OPTIONS: str = Field(
        default="DENY",
        description="X-Frame-Options: DENY, SAMEORIGIN, or ALLOW-FROM"
    )
    SECURITY_HEADERS_XSS_PROTECTION: bool = Field(
        default=True,
        description="X-XSS-Protection: 1; mode=block"
    )
    SECURITY_HEADERS_HSTS_ENABLED: bool = Field(
        default=True,
        description="Enable Strict-Transport-Security (HSTS)"
    )
    SECURITY_HEADERS_HSTS_MAX_AGE: int = Field(
        default=31536000,  # 1 year
        description="HSTS max-age in seconds"
    )
    SECURITY_HEADERS_HSTS_INCLUDE_SUBDOMAINS: bool = Field(
        default=True,
        description="HSTS includeSubDomains"
    )
    SECURITY_HEADERS_HSTS_PRELOAD: bool = Field(
        default=False,
        description="HSTS preload (requires manual submission to HSTS preload list)"
    )
    SECURITY_HEADERS_REFERRER_POLICY: str = Field(
        default="strict-origin-when-cross-origin",
        description="Referrer-Policy value"
    )
    SECURITY_HEADERS_DNS_PREFETCH_CONTROL: bool = Field(
        default=True,
        description="X-DNS-Prefetch-Control: off"
    )
    SECURITY_HEADERS_DOWNLOAD_OPTIONS: bool = Field(
        default=True,
        description="X-Download-Options: noopen"
    )
    SECURITY_HEADERS_PERMITTED_CROSS_DOMAIN: bool = Field(
        default=True,
        description="X-Permitted-Cross-Domain-Policies: none"
    )

    # Content Security Policy (CSP)
    CSP_POLICY: Optional[str] = Field(
        default=None,
        description="Content-Security-Policy header value"
    )

    # Permissions Policy (formerly Feature-Policy)
    PERMISSIONS_POLICY: Optional[str] = Field(
        default=None,
        description="Permissions-Policy header value"
    )

    # Trusted Hosts
    TRUSTED_HOSTS: List[str] = Field(
        default=["*"],
        description="List of trusted hostnames (use ['*'] to allow all in development)"
    )

    # =====================================================
    # RATE LIMITING
    # =====================================================
    RATE_LIMIT_ENABLED: bool = Field(default=True)
    RATE_LIMIT_PER_MINUTE: int = Field(default=60)
    RATE_LIMIT_PER_HOUR: int = Field(default=1000)
    BRUTE_FORCE_MAX_ATTEMPTS: int = Field(default=5)
    BRUTE_FORCE_LOCKOUT_MINUTES: int = Field(default=15)

    # =====================================================
    # GOOGLE OAUTH (SENSITIVE!)
    # =====================================================
    GOOGLE_CLIENT_ID: str = Field(
        default="",
        description="Google OAuth Client ID"
    )
    GOOGLE_CLIENT_SECRET: str = Field(
        default="",  # Sensitive - must be set via secrets
        description="Google OAuth Client Secret - SENSITIVE"
    )
    GOOGLE_REDIRECT_URI: str = Field(
        default="http://localhost:8000/api/google-calendar/callback"
    )
    GOOGLE_OAUTH_USE_PKCE: bool = Field(
        default=True,
        description="Use PKCE (Proof Key for Code Exchange) for OAuth2. Required for production."
    )
    GOOGLE_OAUTH_PKCE_METHOD: str = Field(
        default="S256",
        description="PKCE challenge method: S256 (SHA256, recommended) or plain"
    )

    # =====================================================
    # WEB PUSH / VAPID (SENSITIVE!)
    # =====================================================
    VAPID_PRIVATE_KEY: str = Field(
        default="",  # Sensitive - must be set via secrets (can be encrypted)
        description="VAPID private key - SENSITIVE (supports encrypted format)"
    )
    VAPID_PRIVATE_KEY_ENCRYPTED: str = Field(
        default="",  # Encrypted VAPID private key
        description="Encrypted VAPID private key (requires VAPID_ENCRYPTION_KEY)"
    )
    VAPID_PUBLIC_KEY: str = Field(
        default="",
        description="VAPID public key"
    )
    # VAPID Encryption Settings
    VAPID_ENCRYPTION_KEY: str = Field(
        default="",
        description="Fernet encryption key for VAPID private key (from Vault or env)"
    )
    VAPID_ENCRYPTION_PASSWORD: str = Field(
        default="",
        description="Password to derive encryption key (alternative to VAPID_ENCRYPTION_KEY)"
    )
    VAPID_ENCRYPTION_KEY_FILE: str = Field(
        default="",
        description="Path to file containing encryption key"
    )
    VAPID_ENCRYPTION_SALT: str = Field(
        default="eli-maor-vapid-salt-2024",
        description="Salt for PBKDF2 key derivation (if using password)"
    )

    # =====================================================
    # EMAIL (SENSITIVE!)
    # =====================================================
    MAIL_USERNAME: str = Field(default="")
    MAIL_PASSWORD: str = Field(
        default="",  # Sensitive - must be set via secrets
        description="SMTP password - SENSITIVE"
    )
    MAIL_FROM: str = Field(default="noreply@eli-maor.com")
    MAIL_FROM_NAME: str = Field(default="אלי מאור - סידור וארגון הבית")
    MAIL_PORT: int = Field(default=587)
    MAIL_SERVER: str = Field(default="smtp.gmail.com")
    MAIL_STARTTLS: bool = Field(default=True)
    MAIL_SSL_TLS: bool = Field(default=False)
    MAIL_USE_CREDENTIALS: bool = Field(default=True)
    MAIL_VALIDATE_CERTS: bool = Field(default=True)
    EMAIL_REMINDERS_ENABLED: bool = Field(default=True)
    EMAIL_REMINDER_HOUR: int = Field(default=9)

    # =====================================================
    # AI / OPENAI (SENSITIVE!)
    # =====================================================
    OPENAI_API_KEY: str = Field(
        default="",  # Sensitive - must be set via secrets
        description="OpenAI API key - SENSITIVE"
    )
    AI_ENABLED: bool = Field(default=True)
    AI_MODEL: str = Field(default="gpt-4o-mini")
    AI_TEMPERATURE: float = Field(default=0.7)
    AI_MAX_TOKENS: int = Field(default=1000)

    # =====================================================
    # YOUTUBE CONTENT
    # =====================================================
    YOUTUBE_API_KEY: str = Field(
        default="",
        description="YouTube Data API v3 key"
    )
    YOUTUBE_HANDLE: str = Field(
        default="@EliMaor555",
        description="Preferred YouTube channel handle for recommendations"
    )

    # =====================================================
    # FRONTEND / CORS
    # =====================================================
    FRONTEND_URL: str = Field(default="http://localhost:3000")
    CORS_ORIGINS: List[str] = Field(
        default=[
            "http://localhost:5179",   # Custom Vite port (primary)
            "http://127.0.0.1:5179",   # Custom Vite port (IP)
            "http://localhost:5178",   # Alternative Vite port
            "http://127.0.0.1:5178",   # Alternative Vite port (IP)
            "http://localhost:5181",   # Alternate Vite port
            "http://127.0.0.1:5181",   # Alternate Vite port (IP)
            "http://localhost:5173",   # Vite default port
            "http://127.0.0.1:5173",   # Vite default port (IP)
            "http://localhost:3000",   # Create React App default
            "http://127.0.0.1:3000",   # Create React App default (IP)
            # HTTPS origins (for development with SSL)
            "https://localhost:8000",  # Backend HTTPS
            "https://localhost:5179",  # Frontend HTTPS (if configured)
            "https://127.0.0.1:8000",  # Backend HTTPS (IP)
            "https://127.0.0.1:5179",  # Frontend HTTPS (IP)
        ],
        description="Allowed CORS origins. Can be overridden via CORS_ORIGINS environment variable (JSON array string). "
                   "IMPORTANT: Cannot contain '*' when allow_credentials=True (CORS spec requirement). "
                   "In production, should only include your production domain."
    )

    @field_validator("CORS_ORIGINS")
    @classmethod
    def validate_cors_origins(cls, v: List[str]) -> List[str]:
        """
        Validate CORS origins to prevent wildcard '*' when allow_credentials=True.
        
        CORS specification: allow_origins=["*"] is incompatible with allow_credentials=True.
        This validator ensures we use specific origins instead of wildcard.
        """
        if not isinstance(v, list):
            raise ValueError("CORS_ORIGINS must be a list of strings")
        
        # Check for wildcard
        if "*" in v or any(origin == "*" for origin in v):
            raise ValueError(
                "CORS_ORIGINS cannot contain '*' when allow_credentials=True. "
                "Please specify explicit origins (e.g., ['http://localhost:5179'])."
            )
        
        # Validate each origin is a string
        for origin in v:
            if not isinstance(origin, str):
                raise ValueError(f"CORS_ORIGINS must contain only strings, got {type(origin)}")
            if not origin.startswith(("http://", "https://")):
                raise ValueError(f"CORS origin must start with http:// or https://, got: {origin}")
        
        return v

    # =====================================================
    # LOGGING
    # =====================================================
    LOG_LEVEL: str = Field(default="INFO")
    LOG_FORMAT: str = Field(
        default="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}",
        description="Loguru format string. Must be simple to prevent recursion errors. "
                   "Do NOT use nested braces like {{time}} or color tags like {red}."
    )
    LOG_FORMAT_TYPE: str = Field(default="text", description="Format type: 'text' or 'json'")
    LOG_DIR: str = Field(default="logs")
    LOG_ROTATION: str = Field(default="100 MB")
    LOG_RETENTION: str = Field(default="30 days")
    LOG_COMPRESSION: str = Field(default="gz")

    # =====================================================
    # AWS CLOUDWATCH
    # =====================================================
    AWS_CLOUDWATCH_LOG_GROUP: str = Field(default="")
    AWS_CLOUDWATCH_LOG_STREAM: str = Field(default="eli-maor-api")
    AWS_REGION: str = Field(default="us-east-1")
    AWS_ACCESS_KEY_ID: str = Field(
        default="",  # Sensitive
        description="AWS access key - SENSITIVE"
    )
    AWS_SECRET_ACCESS_KEY: str = Field(
        default="",  # Sensitive
        description="AWS secret key - SENSITIVE"
    )
    AWS_SECRET_NAME: str = Field(
        default="",
        description="AWS Secrets Manager secret name"
    )

    # =====================================================
    # ELK / ELASTICSEARCH
    # =====================================================
    ELK_URL: str = Field(default="")
    ELK_INDEX_PREFIX: str = Field(default="logs-eli-maor")

    # =====================================================
    # SENTRY (Error Tracking)
    # =====================================================
    SENTRY_DSN: str = Field(
        default="",
        description="Sentry DSN for error tracking (optional but recommended for production)"
    )
    SENTRY_ENVIRONMENT: str = Field(
        default="production",
        description="Sentry environment name (production, staging, development)"
    )
    SENTRY_TRACES_SAMPLE_RATE: float = Field(
        default=0.1,
        ge=0.0,
        le=1.0,
        description="Sentry traces sample rate (0.0 to 1.0)"
    )

    # =====================================================
    # VALIDATORS
    # =====================================================

    @model_validator(mode="after")
    def sync_environment_from_env(self):
        """Sync ENVIRONMENT from ENV if ENV is set (ENV takes precedence)"""
        if self.ENV and self.ENV != self.ENVIRONMENT:
            self.ENVIRONMENT = self.ENV
        return self

    @model_validator(mode="after")
    def merge_local_dev_cors_origins(self):
        """
        In local development, always allow common Vite / CRA localhost origins.

        CORS_ORIGINS is often overridden via .env as a JSON list; a partial list
        (e.g. missing :5178) breaks browser preflight with no ACAO header.
        Production/staging: unchanged — only explicit CORS_ORIGINS apply.
        """
        env = (self.ENVIRONMENT or self.ENV or "development").lower()
        if env not in ("development", "dev", "local"):
            return self

        local_dev_origins = [
            "http://localhost:5178",
            "http://127.0.0.1:5178",
            "http://localhost:5179",
            "http://127.0.0.1:5179",
            "http://localhost:5181",
            "http://127.0.0.1:5181",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
        seen: set[str] = set()
        merged: List[str] = []
        for origin in [*self.CORS_ORIGINS, *local_dev_origins]:
            if origin not in seen:
                seen.add(origin)
                merged.append(origin)
        self.CORS_ORIGINS = merged
        return self

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str, info) -> str:
        """
        Validate SECRET_KEY is set and secure.
        
        Production: MUST be set and at least 32 characters.
        Development: Falls back to dev-secret-key if not set.
        """
        # Get environment from info.data (Pydantic context)
        # ENV takes precedence, fallback to ENVIRONMENT, default to development
        env = info.data.get("ENV") or info.data.get("ENVIRONMENT", "development")
        is_production = env.lower() == "production"
        
        # Try Docker secret if not set or using dev default
        if not v or v == "dev-secret-key":
            docker_secret = Path("/run/secrets/secret_key")
            if docker_secret.exists():
                v = docker_secret.read_text().strip()
        
        # Production: MUST be set (not dev default), fail fast
        if is_production:
            if not v or v == "dev-secret-key":
                raise ValueError(
                    "SECRET_KEY must be set in production! "
                    "Use environment variable, Docker secret, or AWS Secrets Manager. "
                    "Cannot use dev-secret-key in production."
                )
            if len(v) < 32:
                raise ValueError("SECRET_KEY must be at least 32 characters in production")
            return v
        
        # Development: allow dev default
        if not v or v == "dev-secret-key":
            return "dev-secret-key"
        
        return v

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_database_url(cls, v: str, info) -> str:
        """
        Validate DATABASE_URL is set.
        
        Production: MUST be set and cannot be SQLite.
        Development: Falls back to sqlite:///./dev.db if not set.
        """
        # Get environment from info.data (Pydantic context)
        # ENV takes precedence, fallback to ENVIRONMENT, default to development
        env = info.data.get("ENV") or info.data.get("ENVIRONMENT", "development")
        is_production = env.lower() == "production"
        
        # Try Docker secret if not set or using dev default
        if not v or v == "sqlite:///./dev.db":
            docker_secret = Path("/run/secrets/database_url")
            if docker_secret.exists():
                v = docker_secret.read_text().strip()
        
        # Production: MUST be set (not dev default), fail fast
        if is_production:
            if not v or v == "sqlite:///./dev.db":
                raise ValueError(
                    "DATABASE_URL must be set in production! "
                    "Use environment variable, Docker secret, or AWS Secrets Manager. "
                    "Cannot use sqlite:///./dev.db in production."
                )
            if "sqlite" in v.lower():
                raise ValueError(
                    "DATABASE_URL cannot use SQLite in production! "
                    "Use PostgreSQL or another production database."
                )
            return v
        
        # Development: allow SQLite default
        if not v or v == "sqlite:///./dev.db":
            return "sqlite:///./dev.db"
        
        return v

    class Config:
        # Look for .env file in the backend directory (where this file is located)
        # Convert Path to string for pydantic-settings compatibility
        # IMPORTANT: Use absolute path to ensure .env file is found regardless of working directory
        env_file_path = Path(__file__).parent.parent / ".env"
        env_file = str(env_file_path.absolute())
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"


def get_settings() -> Settings:
    """
    Get application settings.
    Use this function instead of accessing settings directly
    to allow for easier testing and mocking.
    
    Raises:
        ValueError: If SECRET_KEY or DATABASE_URL are not set (in production)
    """
    # Debug: Check .env file before creating Settings
    env_file_path = Path(__file__).parent.parent / ".env"
    print(f"[CONFIG] 🔍 Loading settings...")
    print(f"[CONFIG]    .env file path: {env_file_path.absolute()}")
    print(f"[CONFIG]    .env file exists: {env_file_path.exists()}")
    if env_file_path.exists():
        try:
            env_content = env_file_path.read_text(encoding='utf-8')
            has_secret_key = 'SECRET_KEY=' in env_content
            has_database_url = 'DATABASE_URL=' in env_content
            env_value = None
            for line in env_content.splitlines():
                if line.strip().startswith('ENV=') or line.strip().startswith('ENVIRONMENT='):
                    env_value = line.split('=', 1)[1].strip()
                    break
            print(f"[CONFIG]    Environment: {env_value or 'not set (defaults to development)'}")
            print(f"[CONFIG]    .env contains SECRET_KEY: {has_secret_key}")
            print(f"[CONFIG]    .env contains DATABASE_URL: {has_database_url}")
            if has_secret_key:
                # Extract SECRET_KEY value (first line that starts with SECRET_KEY=)
                for line in env_content.splitlines():
                    if line.strip().startswith('SECRET_KEY='):
                        key_value = line.split('=', 1)[1].strip()
                        print(f"[CONFIG]    SECRET_KEY value (first 20 chars): {key_value[:20]}...")
                        break
        except Exception as e:
            print(f"[CONFIG]    ⚠️  Error reading .env file: {e}")
    else:
        print(f"[CONFIG]    ⚠️  WARNING: .env file not found!")
        print(f"[CONFIG]    Current working directory: {Path.cwd()}")
        print(f"[CONFIG]    Config file location: {Path(__file__).parent}")
    
    settings_instance = Settings()
    
    # Get environment (ENV takes precedence over ENVIRONMENT)
    env = settings_instance.ENV or settings_instance.ENVIRONMENT
    is_production = env.lower() == "production"
    
    # CRITICAL: In production, SECRET_KEY and DATABASE_URL MUST be set
    # Validation happens in field_validator, but we add a final check here for clarity
    if is_production:
        if not settings_instance.SECRET_KEY or settings_instance.SECRET_KEY == "dev-secret-key":
            error_msg = (
                "SECRET_KEY is missing or using dev default in production! "
                "Please set SECRET_KEY in your .env file or environment variable. "
                "Example: SECRET_KEY=<strong-random-32-chars-minimum>"
            )
            print(f"[CONFIG] ❌ ERROR: {error_msg}")
            raise ValueError(error_msg)
        
        if not settings_instance.DATABASE_URL or settings_instance.DATABASE_URL == "sqlite:///./dev.db" or "sqlite" in settings_instance.DATABASE_URL.lower():
            error_msg = (
                "DATABASE_URL is missing or using SQLite in production! "
                "Please set DATABASE_URL to a production database (PostgreSQL). "
                "Example: DATABASE_URL=postgresql+psycopg://user:pass@db:5432/app"
            )
            print(f"[CONFIG] ❌ ERROR: {error_msg}")
            raise ValueError(error_msg)
    
    # Log successful configuration (without exposing secrets)
    print(f"[CONFIG] ✅ Configuration loaded successfully")
    print(f"[CONFIG]   Environment: {env} ({'PRODUCTION' if is_production else 'DEVELOPMENT'})")
    print(f"[CONFIG]   SECRET_KEY: {'SET' if settings_instance.SECRET_KEY else 'NOT SET'} ({len(settings_instance.SECRET_KEY)} chars)")
    print(f"[CONFIG]   DATABASE_URL: {'SET' if settings_instance.DATABASE_URL else 'NOT SET'} ({settings_instance.DATABASE_URL[:30] + '...' if settings_instance.DATABASE_URL else 'N/A'})")
    print(f"[CONFIG]   DEBUG: {settings_instance.DEBUG}")
    print(f"[CONFIG]   ACCESS_TOKEN_EXPIRE_MINUTES: {settings_instance.ACCESS_TOKEN_EXPIRE_MINUTES}")
    
    return settings_instance


# Create global settings instance
# This will raise ValueError if SECRET_KEY or DATABASE_URL are missing
try:
    settings = get_settings()
except ValueError as e:
    # Log the error and re-raise
    import sys
    print(f"[CONFIG] ❌ Failed to load settings: {e}", file=sys.stderr)
    raise


# Add property to Settings class for decrypted VAPID key
def _get_vapid_private_key_decrypted(self) -> str:
    """
    Get decrypted VAPID private key.
    Automatically handles encryption/decryption and Vault integration.
    """
    from app.core.vapid_encryption import get_vapid_private_key
    return get_vapid_private_key() or ""


# Add as property to Settings class
Settings.vapid_private_key_decrypted = property(_get_vapid_private_key_decrypted)


def validate_production_secrets():
    """
    Validate that all required secrets are properly configured for production.
    Call this on application startup in production.
    """
    if settings.DEBUG:
        return  # Skip validation in development

    errors = []

    # Required secrets
    if not settings.SECRET_KEY or settings.SECRET_KEY.startswith("dev-"):
        errors.append("SECRET_KEY: Must be set to a secure value")

    if not settings.DATABASE_URL or "sqlite" in settings.DATABASE_URL.lower():
        errors.append("DATABASE_URL: Must use a production database (not SQLite)")

    # Optional but important secrets
    warnings = []

    if not settings.GOOGLE_CLIENT_SECRET:
        warnings.append("GOOGLE_CLIENT_SECRET: Not set - Google OAuth disabled")

    # Check VAPID_PRIVATE_KEY (supports encrypted format and Vault)
    try:
        from app.core.vapid_encryption import get_vapid_private_key
        vapid_key = get_vapid_private_key()
        if not vapid_key:
            warnings.append("VAPID_PRIVATE_KEY: Not set - Push notifications disabled")
    except Exception as e:
        warnings.append(f"VAPID_PRIVATE_KEY: Error loading key - {e}")

    if not settings.OPENAI_API_KEY:
        warnings.append("OPENAI_API_KEY: Not set - AI features disabled")

    if errors:
        raise ValueError(
            "Production secrets validation failed:\n" +
            "\n".join(f"  - {e}" for e in errors)
        )

    if warnings:
        import logging
        logger = logging.getLogger(__name__)
        for w in warnings:
            logger.warning(f"Secret warning: {w}")
