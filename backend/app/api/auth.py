from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, OperationalError, SQLAlchemyError
from app.db.session import get_db
from app.db.models import User, RefreshToken, TokenBlocklist
from app.schemas.user import UserCreate, UserRead, Token, RefreshTokenRequest
from app.api.deps import get_current_user
from app.api.deps_audit import get_audit_context
from app.services.audit import audit_service, AuditAction
from app.config import settings
from app.services.rate_limiter import rate_limiter
from app.core.limiter import RATE_LIMIT_AUTH, limiter
from app.core.logging import logger, log_api_call
from passlib.context import CryptContext
from passlib.exc import UnknownHashError
from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone
import urllib.parse
import secrets
import uuid

router = APIRouter(prefix="/auth", tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def check_users_table_exists(db: Session) -> None:
    """
    Check if the users table exists in the database.
    Raises HTTPException with 500 status if table doesn't exist.
    """
    try:
        from sqlalchemy import inspect
        from sqlalchemy.exc import NoSuchTableError, OperationalError
        from app.db.session import engine
        
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        if "users" not in tables:
            error_msg = (
                "Database table 'users' does not exist. "
                "Please run database migrations: 'alembic upgrade head'"
            )
            logger.critical(error_msg)
            logger.critical("Available tables during users-table check", extra={"tables": tables})
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )

        # Validate required columns to avoid opaque OperationalError at query time.
        user_columns = {col["name"] for col in inspector.get_columns("users")}
        required_columns = {"id", "email", "hashed_password", "created_at", "updated_at"}
        missing_columns = sorted(required_columns - user_columns)
        if missing_columns:
            error_msg = (
                "Database schema mismatch for table 'users': missing columns "
                f"{missing_columns}. Please run database migrations: 'alembic upgrade head'"
            )
            logger.critical(error_msg)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg,
            )
    except HTTPException:
        # Re-raise HTTPException
        raise
    except NoSuchTableError as e:
        error_msg = f"Database table 'users' does not exist. Run migrations: 'alembic upgrade head'"
        logger.critical(error_msg, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg
        ) from e
    except OperationalError as e:
        error_msg = f"Database operational error: {str(e)}. Check database connection and migrations."
        logger.error(error_msg, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {error_msg}"
        ) from e
    except Exception as e:
        # If inspection fails, log warning but don't block (might be a different error)
        logger.warning(f"Could not inspect database tables: {e}. Attempting query anyway...")


def verify_password(plain: str, hashed: str) -> bool:
    """
    Safely verify password hash.
    Returns False for invalid/malformed hashes instead of propagating errors as 500.
    """
    if not plain or not hashed:
        return False
    try:
        return pwd_context.verify(plain, hashed)
    except (UnknownHashError, ValueError, TypeError) as e:
        logger.warning("Password verification failed due to invalid hash format", extra={"error": str(e)})
        return False


def get_password_hash(password: str) -> str:
    """
    Hash a password using bcrypt.
    Bcrypt has a 72-byte limit, so we truncate if necessary.
    """
    # Convert to bytes to check length
    password_bytes = password.encode('utf-8')
    
    # Bcrypt limit is 72 bytes
    if len(password_bytes) > 72:
        # Truncate to 72 bytes
        logger.warning(f"Password too long ({len(password_bytes)} bytes), truncating to 72 bytes")
        password_bytes = password_bytes[:72]
        # Decode back to string (may lose some characters if multi-byte)
        password = password_bytes.decode('utf-8', errors='ignore')
    
    # Try to hash, and if it still fails, handle the error
    try:
        return pwd_context.hash(password)
    except ValueError as e:
        # If passlib/bcrypt still throws an error, truncate more aggressively
        if "cannot be longer than 72 bytes" in str(e):
            logger.error(f"Password hashing failed even after truncation: {e}")
            # Last resort: hash the first 72 bytes directly as bytes
            password_bytes = password.encode('utf-8')[:72]
            password = password_bytes.decode('utf-8', errors='ignore')
            return pwd_context.hash(password)
        raise


def create_access_token(*, data: dict, expires_delta: timedelta | None = None) -> str:
    """Create a short-lived access token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({
        "exp": expire,
        "type": "access",
        "jti": str(uuid.uuid4()),
    })
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token(
    db: Session,
    user: User,
    device_info: str | None = None,
    ip_address: str | None = None
) -> tuple[str, RefreshToken]:
    """
    Create a long-lived refresh token and store it in the database.
    Returns tuple of (token_string, RefreshToken model)
    """
    jti = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    # Create JWT refresh token
    token_data = {
        "sub": user.email,
        "jti": jti,
        "type": "refresh",
        "exp": expires_at,
    }
    token_string = jwt.encode(token_data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    # Store in database for revocation capability
    db_token = RefreshToken(
        user_id=user.id,
        jti=jti,
        expires_at=expires_at,
        device_info=device_info,
        ip_address=ip_address,
    )
    db.add(db_token)
    # Don't commit here - let the caller commit (avoids double commit issues)
    db.flush()  # Flush to get the ID without committing
    db.refresh(db_token)

    return token_string, db_token


def verify_refresh_token(db: Session, token: str) -> tuple[User, RefreshToken]:
    """
    Verify a refresh token and return the user and token model.
    Raises HTTPException if invalid.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])

        # Verify token type
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type"
            )

        jti = payload.get("jti")
        email = payload.get("sub")

        if not jti or not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload"
            )

        # Check if token exists and is not revoked
        db_token = db.query(RefreshToken).filter(
            RefreshToken.jti == jti,
            RefreshToken.revoked == False
        ).first()

        if not db_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been revoked or does not exist"
            )

        if not db_token.is_valid():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )

        # Check if users table exists before querying
        check_users_table_exists(db)
        # Get user
        user = db.query(User).filter(User.email == email).first()
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive"
            )

        return user, db_token

    except JWTError as e:
        logger.warning(f"JWT verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate token"
        )


def block_access_token(
    db: Session,
    jti: str,
    expires_at: datetime,
    user_id: int | None = None,
    reason: str | None = None
) -> TokenBlocklist:
    """
    Add an access token to the blocklist.

    Args:
        db: Database session
        jti: JWT ID from the token
        expires_at: When the token naturally expires
        user_id: User ID (optional, for cleanup)
        reason: Reason for blocking (optional, for audit)

    Returns:
        TokenBlocklist instance
    """
    # Check if already blocked
    existing = db.query(TokenBlocklist).filter(TokenBlocklist.jti == jti).first()
    if existing:
        return existing

    blocked = TokenBlocklist(
        jti=jti,
        token_type="access",
        user_id=user_id,
        expires_at=expires_at,
        reason=reason
    )
    db.add(blocked)
    db.commit()
    db.refresh(blocked)
    return blocked


def block_refresh_token(
    db: Session,
    jti: str,
    expires_at: datetime,
    user_id: int | None = None,
    reason: str | None = None
) -> TokenBlocklist:
    """
    Add a refresh token to the blocklist.

    Note: Refresh tokens are also stored in RefreshToken table with revoked flag.
    This blocklist provides additional security layer.
    """
    existing = db.query(TokenBlocklist).filter(TokenBlocklist.jti == jti).first()
    if existing:
        return existing

    blocked = TokenBlocklist(
        jti=jti,
        token_type="refresh",
        user_id=user_id,
        expires_at=expires_at,
        reason=reason
    )
    db.add(blocked)
    db.commit()
    db.refresh(blocked)
    return blocked


def revoke_all_user_tokens(db: Session, user_id: int) -> dict:
    """
    Revoke all tokens (both access and refresh) for a user.

    Returns:
        dict with counts of revoked tokens
    """
    # Revoke all refresh tokens
    refresh_count = db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.revoked == False
    ).update({
        "revoked": True,
        "revoked_at": datetime.utcnow()
    })

    # Block all refresh tokens in blocklist
    refresh_tokens = db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.revoked == False
    ).all()

    for token in refresh_tokens:
        block_refresh_token(
            db=db,
            jti=token.jti,
            expires_at=token.expires_at,
            user_id=user_id,
            reason="User logout all devices"
        )

    db.commit()

    return {
        "refresh_tokens_revoked": refresh_count,
        "message": "All tokens revoked successfully"
    }


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
# Rate limiting handled by global middleware or disabled for now
def register(request: Request, user_in: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user and return access + refresh tokens immediately.
    This provides better UX as the user doesn't need to login after registration.
    
    Request Format:
    - Content-Type: application/json
    - Body: { "email": "...", "password": "...", "full_name": "..." (optional) }
    - Uses UserCreate schema (Pydantic validation)
    
    Note: Register uses JSON (not form-urlencoded like login) because:
    - Registration doesn't follow OAuth2 standard (login does)
    - Allows for optional fields (full_name)
    - Better validation with Pydantic schemas
    
    Error Handling:
    - 422: Validation errors (missing/invalid email, password)
    - 400: Client errors (duplicate email, invalid data format)
    - 401: Authentication errors (if applicable)
    - 500: Server errors (DB connection, configuration issues)
    """
    logger.debug(
        "Register endpoint called",
        extra={
            "content_type": request.headers.get("content-type", "NOT SET"),
            "method": request.method,
            "has_email": bool(getattr(user_in, "email", None)),
            "has_password": bool(getattr(user_in, "password", None)),
        },
    )
    
    # Additional validation: Check if email is actually set (defensive programming)
    # FastAPI/Pydantic should catch this, but we check anyway to prevent AttributeError
    if not hasattr(user_in, 'email') or user_in.email is None:
        # Safely log user_in without causing recursion
        try:
            if hasattr(user_in, 'model_dump'):
                user_dict = user_in.model_dump()
            elif hasattr(user_in, 'dict'):
                user_dict = user_in.dict()
            else:
                user_dict = {"type": type(user_in).__name__}
        except Exception:
            user_dict = {"type": type(user_in).__name__, "error": "Could not serialize"}
        logger.error("Email is None or missing in UserCreate", extra={"user_in": user_dict})
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Email is required and cannot be empty"
        )
    
    if not user_in.email or (isinstance(user_in.email, str) and user_in.email.strip() == ''):
        # Safely log user_in without causing recursion
        try:
            if hasattr(user_in, 'model_dump'):
                user_dict = user_in.model_dump()
            elif hasattr(user_in, 'dict'):
                user_dict = user_in.dict()
            else:
                user_dict = {"type": type(user_in).__name__}
        except Exception:
            user_dict = {"type": type(user_in).__name__, "error": "Could not serialize"}
        logger.error("Email is empty string in UserCreate", extra={"user_in": user_dict})
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Email cannot be empty"
        )
    
    if not hasattr(user_in, 'password') or not user_in.password:
        # Safely log user_in without causing recursion
        try:
            if hasattr(user_in, 'model_dump'):
                user_dict = user_in.model_dump()
            elif hasattr(user_in, 'dict'):
                user_dict = user_in.dict()
            else:
                user_dict = {"type": type(user_in).__name__}
        except Exception:
            user_dict = {"type": type(user_in).__name__, "error": "Could not serialize"}
        logger.error("Password is missing or empty in UserCreate", extra={"user_in": user_dict})
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password is required and cannot be empty"
        )
    
    log_api_call("/api/auth/register", "POST", email=user_in.email)

    # Validate critical settings before proceeding
    # Note: This should never happen if config.py is working correctly,
    # but we check anyway as a safety measure
    if not settings.SECRET_KEY:
        logger.error("SECRET_KEY is not configured - this should have been caught at startup")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server configuration error: SECRET_KEY is missing. Please check your .env file or environment variables."
        )
    
    if not settings.DATABASE_URL:
        logger.error("DATABASE_URL is not configured - this should have been caught at startup")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server configuration error: DATABASE_URL is missing. Please check your .env file or environment variables."
        )

    # Test database connection before proceeding
    try:
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
    except Exception as db_error:
        logger.error(f"Database connection test failed: {db_error}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database connection error: {str(db_error)}. Please check DATABASE_URL and ensure the database server is running."
        )

    # CRITICAL: Check if users table exists before querying
    check_users_table_exists(db)
    
    try:
        existing = db.query(User).filter(User.email == user_in.email).first()
        if existing:
            logger.warning("Registration attempt with existing email", extra={"email": user_in.email})
            raise HTTPException(status_code=400, detail="האימייל כבר במערכת")

        logger.info("Creating new user", extra={"email": user_in.email})
        
        # Hash the password (get_password_hash handles 72-byte limit internally)
        try:
            hashed = get_password_hash(user_in.password)
        except ValueError as e:
            # Handle bcrypt password length error specifically
            if "cannot be longer than 72 bytes" in str(e):
                logger.error(f"Password hashing failed: {e}", exc_info=True)
                # Try again with truncated password
                password_bytes = user_in.password.encode('utf-8')[:72]
                password = password_bytes.decode('utf-8', errors='ignore')
                hashed = get_password_hash(password)
            else:
                raise
        
        user = User(
            email=user_in.email,
            hashed_password=hashed,
            full_name=user_in.full_name  # Save full_name if provided
        )
        db.add(user)
        db.flush()  # Flush to get the ID
        logger.info("User created, ID: %s", user.id, extra={"user_id": user.id})
    except HTTPException:
        # Re-raise HTTPException (e.g., from check_users_table_exists)
        raise
    except IntegrityError as e:
        # Handle database constraint violations (e.g., duplicate email)
        db.rollback()
        error_msg = str(e.orig) if hasattr(e, 'orig') else str(e)
        
        # Check if it's a unique constraint violation (duplicate email)
        if "UNIQUE constraint failed" in error_msg or "duplicate key value" in error_msg.lower() or "unique" in error_msg.lower():
            logger.warning(f"Registration attempt with duplicate email: {user_in.email}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="האימייל כבר קיים במערכת. אנא השתמש באימייל אחר או התחבר לחשבון הקיים."
            )
        else:
            # Other integrity errors (foreign key, check constraint, etc.)
            logger.error(f"Database integrity error during user creation: {error_msg}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"שגיאה בשמירת הנתונים: {error_msg}"
            )
    except UnicodeEncodeError as e:
        # Handle encoding errors (e.g., password with invalid characters)
        db.rollback()
        logger.error(f"Unicode encoding error during user creation: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="הסיסמה מכילה תווים לא תקינים. אנא השתמש בתווים ASCII או Unicode תקינים."
        )
    except ValueError as e:
        # Handle validation errors
        db.rollback()
        error_msg = str(e)
        logger.error(f"Validation error during user creation: {error_msg}", exc_info=True)
        
        # Check for specific validation errors
        if "password" in error_msg.lower() or "bcrypt" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="הסיסמה לא תקינה. אנא השתמש בסיסמה באורך של עד 72 תווים."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"שגיאת אימות: {error_msg}"
            )
    except OperationalError as e:
        # Handle database operational errors (connection issues, etc.)
        db.rollback()
        error_msg = str(e)
        logger.error(f"Database operational error during user creation: {error_msg}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="שגיאת חיבור לבסיס הנתונים. אנא נסה שוב מאוחר יותר."
        )
    except SQLAlchemyError as e:
        # Handle other SQLAlchemy errors
        db.rollback()
        error_msg = str(e)
        logger.error(f"SQLAlchemy error during user creation: {error_msg}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"שגיאה בבסיס הנתונים: {error_msg}"
        )
    except Exception as e:
        # Catch-all for any other unexpected errors
        db.rollback()
        error_type = type(e).__name__
        error_msg = str(e)
        logger.error(f"Unexpected error during user creation ({error_type}): {error_msg}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"שגיאה בלתי צפויה ביצירת המשתמש. אנא נסה שוב או פנה לתמיכה."
        )

    # Get audit context (no user yet, so use request info)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    # Create audit log for user registration
    try:
        new_values = {
            "email": user.email,
            "is_active": user.is_active,
            "is_superuser": user.is_superuser,
        }
        audit_service.create_audit_log(
            session=db,
            instance=user,
            action=AuditAction.CREATE,
            user_id=user.id,  # User created themselves
            user_email=user.email,
            new_values=new_values,
            ip_address=client_ip,
            user_agent=user_agent,
        )
    except Exception as e:
        logger.warning(f"Failed to create audit log: {e}", exc_info=True)
        # Continue anyway - audit log failure shouldn't block registration

    # Commit the transaction (user + audit log)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError as e:
        # Handle constraint violations during commit (e.g., race condition with duplicate email)
        db.rollback()
        error_msg = str(e.orig) if hasattr(e, 'orig') else str(e)
        
        if "UNIQUE constraint failed" in error_msg or "duplicate key value" in error_msg.lower() or "unique" in error_msg.lower():
            logger.warning(f"Duplicate email detected during commit: {user_in.email}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="האימייל כבר קיים במערכת. אנא השתמש באימייל אחר או התחבר לחשבון הקיים."
            )
        else:
            logger.error(f"Database integrity error during commit: {error_msg}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"שגיאה בשמירת הנתונים: {error_msg}"
            )
    except OperationalError as e:
        # Handle database operational errors during commit
        db.rollback()
        error_msg = str(e)
        logger.error(f"Database operational error during commit: {error_msg}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="שגיאת חיבור לבסיס הנתונים. אנא נסה שוב מאוחר יותר."
        )
    except SQLAlchemyError as e:
        # Handle other SQLAlchemy errors during commit
        db.rollback()
        error_msg = str(e)
        logger.error(f"SQLAlchemy error during commit: {error_msg}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"שגיאה בשמירת המשתמש: {error_msg}"
        )
    except Exception as e:
        # Catch-all for any other unexpected errors during commit
        db.rollback()
        error_type = type(e).__name__
        error_msg = str(e)
        logger.error(f"Unexpected error during commit ({error_type}): {error_msg}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="שגיאה בלתי צפויה בשמירת המשתמש. אנא נסה שוב או פנה לתמיכה."
        )

    # Create default rooms for new user
    try:
        from app.api.rooms import create_default_rooms
        created_rooms = create_default_rooms(db, user.id)
        logger.info(
            f"Created {len(created_rooms)} default rooms for new user",
            extra={"user_id": user.id, "room_count": len(created_rooms)}
        )
    except Exception as e:
        logger.warning(f"Failed to create default rooms: {e}", extra={"user_id": user.id}, exc_info=True)
        # Don't fail registration if room creation fails

    # Send welcome email in background
    try:
        from app.workers.email_tasks import send_welcome_email
        send_welcome_email.delay(user.id)
    except Exception as e:
        logger.warning(f"Failed to queue welcome email: {e}", extra={"user_id": user.id})

    logger.info("User registered successfully", extra={"user_id": user.id, "email": user.email})

    # Create access + refresh tokens for immediate login
    try:
        logger.debug("Creating access token for new user", extra={"user_id": user.id, "email": user.email})
        access_token = create_access_token(data={"sub": user.email})
        logger.debug("Creating refresh token for new user", extra={"user_id": user.id, "email": user.email})
        refresh_token_str, _ = create_refresh_token(
            db=db,
            user=user,
            device_info=user_agent,
            ip_address=client_ip
        )

        # Create Token response - ensure all fields match the Token schema
        token_response = Token(
            access_token=access_token,
            refresh_token=refresh_token_str,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60  # Convert minutes to seconds
        )
        
        # Verify the response can be serialized (this will catch ValidationError early)
        try:
            if hasattr(token_response, 'model_dump'):
                token_dict = token_response.model_dump()
            else:
                token_dict = token_response.dict()
            logger.debug("Register token response validated", extra={"keys": list(token_dict.keys())})
        except Exception as e:
            logger.exception("Token response validation failed during register")
            raise
        
        return token_response
    except HTTPException:
        # Re-raise HTTPException (already has proper status code)
        raise
    except ValueError as e:
        # Handle validation errors in token creation
        error_msg = str(e)
        logger.error(f"Token creation validation error: {error_msg}", exc_info=True)
        db.rollback()
        if "SECRET_KEY" in error_msg or "secret" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Server configuration error: SECRET_KEY is missing or invalid. Please check your .env file."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Token creation validation error: {error_msg}"
            )
    except Exception as e:
        # Catch-all for token creation errors
        error_type = type(e).__name__
        error_msg = str(e)
        logger.error(f"Failed to create tokens ({error_type}): {error_msg}", exc_info=True)
        db.rollback()
        
        # Check for specific error types
        if "SECRET_KEY" in error_msg or "secret" in error_msg.lower() or "jwt" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Server configuration error: SECRET_KEY is missing or invalid. Please check your .env file."
            )
        elif "database" in error_msg.lower() or "db" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error during token creation: {error_msg}"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create authentication tokens: {error_msg}"
            )


@router.post("/login", response_model=Token)
# Rate limiting handled by global middleware or disabled for now
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    Login endpoint with brute-force protection. Returns access and refresh tokens.
    
    CRITICAL: This endpoint uses OAuth2PasswordRequestForm which REQUIRES:
    - Content-Type: application/x-www-form-urlencoded
    - Body format: username=<email>&password=<password>
    
    If you send JSON (application/json), OAuth2PasswordRequestForm will fail
    and return 422 Unprocessable Entity or 500 Internal Server Error.
    
    Request Format:
    - Content-Type: application/x-www-form-urlencoded (REQUIRED!)
    - Body: username=<email>&password=<password>
    - Uses OAuth2PasswordRequestForm (OAuth2 standard for password grants)
    
    Note: Login uses form-urlencoded (OAuth2PasswordRequestForm) because:
    - Follows OAuth2 standard (RFC 6749)
    - Compatible with OAuth2 clients
    - Standard format for password grant type
    """
    content_type = request.headers.get('content-type', 'NOT SET')
    logger.debug(
        "Login endpoint called",
        extra={
            "content_type": content_type,
            "is_form_urlencoded": 'application/x-www-form-urlencoded' in content_type.lower(),
            "has_username": bool(form_data.username),
            "has_password": bool(form_data.password),
        },
    )
    
    if 'application/json' in content_type.lower():
        logger.warning("Login received JSON but expects form-urlencoded")
    """
    Login endpoint with brute-force protection. Returns access and refresh tokens.
    
    Request Format:
    - Content-Type: application/x-www-form-urlencoded
    - Body: username=<email>&password=<password>
    - Uses OAuth2PasswordRequestForm (OAuth2 standard for password grants)
    
    Note: Login uses form-urlencoded (OAuth2PasswordRequestForm) because:
    - Follows OAuth2 standard (RFC 6749)
    - Compatible with OAuth2 clients
    - Standard format for password grant type
    """
    log_api_call("/api/auth/login", "POST", email=form_data.username)

    # Validate critical settings before proceeding
    # Note: This should never happen if config.py is working correctly,
    # but we check anyway as a safety measure
    if not settings.SECRET_KEY:
        logger.error("SECRET_KEY is not configured - this should have been caught at startup")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server configuration error: SECRET_KEY is missing. Please check your .env file or environment variables."
        )
    
    if not settings.DATABASE_URL:
        logger.error("DATABASE_URL is not configured - this should have been caught at startup")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server configuration error: DATABASE_URL is missing. Please check your .env file or environment variables."
        )

    # Test database connection before proceeding
    try:
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
    except Exception as db_error:
        logger.error(f"Database connection test failed: {db_error}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database connection error: {str(db_error)}. Please check DATABASE_URL and ensure the database server is running."
        )

    # Get client identifier (IP or email)
    client_ip = rate_limiter._get_client_ip(request)
    identifier = f"{client_ip}:{form_data.username}"

    # IMPORTANT: Check if account is already locked out BEFORE attempting login
    # This only checks the lockout status, does NOT record a failed attempt
    is_locked_out = rate_limiter.is_locked_out(identifier)
    
    if is_locked_out:
        ttl = rate_limiter.get_lockout_ttl(identifier)
        minutes = (ttl // 60) + 1 if ttl else settings.BRUTE_FORCE_LOCKOUT_MINUTES
        attempt_count = rate_limiter.get_failed_attempt_count(identifier)
        logger.warning(
            "Login attempt on locked account",
            extra={
                "email": form_data.username,
                "client_ip": client_ip,
                "attempt_count": attempt_count,
                "lockout_minutes": minutes,
            }
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"חשבון נחסם לאחר {settings.BRUTE_FORCE_MAX_ATTEMPTS} ניסיונות כושלים. "
                   f"נסה שוב בעוד {minutes} דקות."
        )

    # Check if users table exists before querying
    check_users_table_exists(db)
    # Verify credentials FIRST - only record failure if credentials are wrong
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, getattr(user, "hashed_password", "")):
        # Only NOW record the failed attempt (credentials were wrong)
        attempt_count, is_locked_out = rate_limiter.record_failed_login(identifier)
        remaining = rate_limiter.get_remaining_attempts(identifier)
        logger.warning(
            "Failed login attempt",
            extra={
                "email": form_data.username,
                "client_ip": client_ip,
                "remaining_attempts": remaining,
                "attempt_count": attempt_count,
            }
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"אימייל/סיסמא לא נכונים. נותרו {remaining} ניסיונות."
        )

    # Successful login - reset failed attempts
    rate_limiter.reset_failed_logins(identifier)

    # Get device info from request
    user_agent = request.headers.get("user-agent", "")[:255]

    # Create tokens with error handling
    try:
        logger.debug("Creating access token for login", extra={"user_id": user.id, "email": user.email})
        access_token = create_access_token(data={"sub": user.email})
        logger.debug("Creating refresh token for login", extra={"user_id": user.id, "email": user.email})
        refresh_token, _ = create_refresh_token(
            db=db,
            user=user,
            device_info=user_agent,
            ip_address=client_ip
        )
    except Exception as e:
        error_type = type(e).__name__
        error_msg = str(e)
        logger.exception(f"Failed to create tokens during login ({error_type}): {error_msg}", exc_info=True)
        
        # Check for specific errors
        if "SECRET_KEY" in error_msg or "secret" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Server configuration error: SECRET_KEY is missing or invalid. Please check your .env file."
            )
        elif "database" in error_msg.lower() or "db" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error during token creation: {error_msg}"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create authentication tokens: {error_msg}"
            )

    logger.info(
        "User logged in successfully",
        extra={"user_id": user.id, "email": user.email, "client_ip": client_ip}
    )

    # Create Token response - ensure all fields match the Token schema
    try:
        token_response = Token(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60  # Convert minutes to seconds
        )
        
        # Verify the response can be serialized (this will catch ValidationError early)
        if hasattr(token_response, 'model_dump'):
            token_dict = token_response.model_dump()
        else:
            token_dict = token_response.dict()
        
        logger.debug("Login token response created successfully", extra={"expires_in": token_response.expires_in})
        
        return token_response
    except Exception as e:
        error_type = type(e).__name__
        error_msg = str(e)
        logger.exception(f"Token response validation failed during login ({error_type}): {error_msg}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create token response: {error_msg}"
        )


@router.post("/refresh", response_model=Token)
def refresh_tokens(
    request: Request,
    body: RefreshTokenRequest,
    db: Session = Depends(get_db)
):
    """
    Refresh access token using a valid refresh token.

    The old refresh token is revoked and a new one is issued (token rotation).
    This provides better security as stolen refresh tokens become useless after one use.
    """
    log_api_call("/api/auth/refresh", "POST")

    # Verify the refresh token
    user, old_token = verify_refresh_token(db, body.refresh_token)

    # Revoke old refresh token (token rotation)
    old_token.revoke()
    db.add(old_token)

    # Block old refresh token in blocklist
    block_refresh_token(
        db=db,
        jti=old_token.jti,
        expires_at=old_token.expires_at,
        user_id=user.id,
        reason="Token rotation"
    )

    # Get client info
    client_ip = rate_limiter._get_client_ip(request) if hasattr(rate_limiter, '_get_client_ip') else None
    user_agent = request.headers.get("user-agent", "")[:255]

    # Create new tokens
    access_token = create_access_token(data={"sub": user.email})
    refresh_token, _ = create_refresh_token(
        db=db,
        user=user,
        device_info=user_agent,
        ip_address=client_ip
    )

    logger.info(
        "Tokens refreshed successfully",
        extra={"user_id": user.id, "email": user.email}
    )

    # Create Token response - ensure all fields match the Token schema
    token_response = Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60  # Convert minutes to seconds
    )
    
    # Verify the response can be serialized (this will catch ValidationError early)
    try:
        if hasattr(token_response, 'model_dump'):
            token_dict = token_response.model_dump()
        else:
            token_dict = token_response.dict()
    except Exception as e:
        logger.error(f"Token response validation failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create token response: {str(e)}"
        )
    
    return token_response


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    body: RefreshTokenRequest | None = None,
    db: Session = Depends(get_db)
):
    """
    Logout by revoking refresh token and optionally blocking current access token.

    Can be called in two ways:
    1. With refresh token in body - revokes refresh token
    2. With access token in Authorization header - blocks access token (even if expired/invalid)

    The client should clear both tokens from local storage.
    """
    log_api_call("/api/auth/logout", "POST")

    # Try to block access token from Authorization header (even if expired)
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "")
        try:
            # Decode without expiration check (verify_signature=False would be unsafe, but we check signature)
            # We'll decode and check expiration manually
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM],
                options={"verify_exp": False}  # Don't fail on expired tokens
            )
            jti = payload.get("jti")
            exp = payload.get("exp")
            user_email = payload.get("sub")

            if jti and exp:
                # Calculate expiration time (exp is Unix timestamp)
                expires_at = datetime.utcfromtimestamp(exp)

                # Get user_id if possible
                user_id = None
                if user_email:
                    # Check if users table exists before querying
                    check_users_table_exists(db)
                    user = db.query(User).filter(User.email == user_email).first()
                    if user:
                        user_id = user.id

                block_access_token(
                    db=db,
                    jti=jti,
                    expires_at=expires_at,
                    user_id=user_id,
                    reason="User logout"
                )
                logger.info("Access token blocked on logout", extra={"jti": jti, "user_id": user_id})
        except JWTError:
            # Token invalid - ignore (might already be expired or malformed)
            pass

    # Revoke refresh token if provided
    if body and body.refresh_token:
        try:
            _, token = verify_refresh_token(db, body.refresh_token)
            token.revoke()
            db.add(token)

            # Also block in blocklist
            block_refresh_token(
                db=db,
                jti=token.jti,
                expires_at=token.expires_at,
                user_id=token.user_id,
                reason="User logout"
            )

            db.commit()
            logger.info("Refresh token revoked on logout", extra={"token_jti": token.jti})
        except HTTPException:
            # Token already invalid/revoked - that's fine for logout
            pass

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
def logout_all_devices(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Logout from all devices by revoking all refresh tokens and blocking all access tokens.

    Requires a valid access token.

    This will:
    - Revoke all refresh tokens for the user
    - Block all access tokens (they will be rejected on next use)
    - Force re-authentication on all devices
    """
    log_api_call("/api/auth/logout-all", "POST")

    result = revoke_all_user_tokens(db, current_user.id)

    # Also block current access token
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "")
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM],
                options={"verify_exp": False}  # Don't fail on expired tokens
            )
            jti = payload.get("jti")
            exp = payload.get("exp")

            if jti and exp:
                expires_at = datetime.utcfromtimestamp(exp)
                block_access_token(
                    db=db,
                    jti=jti,
                    expires_at=expires_at,
                    user_id=current_user.id,
                    reason="User logout all devices"
                )
        except JWTError:
            pass

    logger.info(
        "User logged out from all devices",
        extra={
            "user_id": current_user.id,
            "refresh_tokens_revoked": result.get("refresh_tokens_revoked", 0)
        }
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserRead)
def read_me(current_user: User = Depends(get_current_user)):
    """Return current authenticated user (without hashed_password)."""
    # UserRead requires created_at + updated_at. Do not use model_validate(orm) alone:
    # some DB/loader paths left updated_at out of the validated dict → "Field required" + 500.
    now = datetime.now(timezone.utc)
    created_at = getattr(current_user, "created_at", None) or now
    updated_at = getattr(current_user, "updated_at", None) or created_at
    if getattr(created_at, "tzinfo", None) is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    if getattr(updated_at, "tzinfo", None) is None:
        updated_at = updated_at.replace(tzinfo=timezone.utc)
    return UserRead(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        is_active=current_user.is_active,
        is_superuser=current_user.is_superuser,
        created_at=created_at,
        updated_at=updated_at,
    )


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    audit_context: dict = Depends(get_audit_context),
):
    """
    Deactivate (soft-delete) the current user's account.

    We prefer soft-delete to avoid FK/cascade issues across existing rows (tasks/rooms/etc.).
    The user is anonymized and password is invalidated. All refresh tokens are revoked.
    """
    # Check if users table exists before querying
    check_users_table_exists(db)
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Store old values for audit log
    old_email = user.email
    old_is_active = user.is_active

    # Revoke all refresh tokens
    revoke_all_user_tokens(db, user.id)

    user.is_active = False
    # Anonymize email to free up the original address and reduce PII retention
    new_email = f"deleted_{user.id}_{int(datetime.utcnow().timestamp())}@deleted.local"
    user.email = new_email
    # Invalidate password so the account cannot be reused for login
    user.hashed_password = get_password_hash(secrets.token_urlsafe(32))

    db.add(user)
    db.flush()  # Flush to get updated values

    # Create audit log for user deletion (soft-delete)
    old_values = {
        "email": old_email,
        "is_active": old_is_active,
    }
    new_values = {
        "email": new_email,
        "is_active": False,
    }
    audit_service.create_audit_log(
        session=db,
        instance=user,
        action=AuditAction.DELETE,  # Using DELETE action for soft-delete
        user_id=audit_context["user_id"],
        user_email=audit_context["user_email"],
        old_values=old_values,
        new_values=new_values,
        changed_fields={"email": {"old": old_email, "new": new_email}, "is_active": {"old": old_is_active, "new": False}},
        ip_address=audit_context["ip_address"],
        user_agent=audit_context["user_agent"],
    )

    db.commit()

    logger.info("User account deactivated", extra={"user_id": user.id})
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- Google OAuth with PKCE ----------
@router.get("/google/login")
def google_login(request: Request):
    """
    Initiate Google OAuth flow with PKCE (Proof Key for Code Exchange).

    PKCE protects against authorization code interception attacks.
    Required for production security.
    """
    from app.core.pkce import generate_pkce_pair, store_pkce_state
    import secrets

    # Generate state for CSRF protection
    state = secrets.token_urlsafe(32)

    # Generate PKCE pair (code_verifier, code_challenge)
    if settings.GOOGLE_OAUTH_USE_PKCE:
        code_verifier, code_challenge = generate_pkce_pair(
            method=settings.GOOGLE_OAUTH_PKCE_METHOD
        )
        # Store verifier for later use in callback
        store_pkce_state(state, code_verifier, code_challenge, settings.GOOGLE_OAUTH_PKCE_METHOD)
    else:
        code_challenge = None
        code_verifier = None

    # Build OAuth2 authorization URL
    google_auth_base = "https://accounts.google.com/o/oauth2/v2/auth"
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "response_type": "code",
        "scope": "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email",
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,  # CSRF protection
    }

    # Add PKCE parameters if enabled
    if settings.GOOGLE_OAUTH_USE_PKCE and code_challenge:
        params["code_challenge"] = code_challenge
        params["code_challenge_method"] = settings.GOOGLE_OAUTH_PKCE_METHOD

    url = f"{google_auth_base}?{urllib.parse.urlencode(params)}"

    logger.info(
        "Google OAuth login initiated",
        extra={
            "state": state[:8] + "...",
            "pkce_enabled": settings.GOOGLE_OAUTH_USE_PKCE,
            "pkce_method": settings.GOOGLE_OAUTH_PKCE_METHOD if settings.GOOGLE_OAUTH_USE_PKCE else None
        }
    )

    return {"auth_url": url, "state": state}


@router.get("/google/callback")
def google_callback(
    request: Request,
    code: str,
    state: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Google OAuth callback with PKCE support.

    Receives authorization code from Google, exchanges for tokens using PKCE.
    """
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import Flow
    from app.core.pkce import get_pkce_verifier, clear_pkce_state, validate_code_verifier
    import httpx

    try:
        # Get PKCE verifier if PKCE is enabled
        code_verifier = None
        if settings.GOOGLE_OAUTH_USE_PKCE:
            code_verifier = get_pkce_verifier(state)
            if not code_verifier:
                logger.error("PKCE verifier not found for state", extra={"state": state[:8] + "..."})
                return RedirectResponse(url=f"{settings.FRONTEND_URL}?google_error=1&reason=pkce_verifier_not_found")

        # Exchange authorization code for tokens
        if settings.GOOGLE_OAUTH_USE_PKCE and code_verifier:
            # Use PKCE flow - manual token exchange with code_verifier
            token_url = "https://oauth2.googleapis.com/token"
            token_data = {
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
                "code_verifier": code_verifier,  # PKCE: send code_verifier
            }

            # Make token request
            response = httpx.post(token_url, data=token_data)
            response.raise_for_status()
            token_response = response.json()

            # Create credentials from token response
            credentials = Credentials(
                token=token_response.get("access_token"),
                refresh_token=token_response.get("refresh_token"),
                token_uri="https://oauth2.googleapis.com/token",
                client_id=settings.GOOGLE_CLIENT_ID,
                client_secret=settings.GOOGLE_CLIENT_SECRET,
                scopes=token_response.get("scope", "").split() if token_response.get("scope") else [],
            )
        else:
            # Fallback to non-PKCE flow (not recommended for production)
            flow = Flow.from_client_config(
                client_config={
                    "web": {
                        "client_id": settings.GOOGLE_CLIENT_ID,
                        "client_secret": settings.GOOGLE_CLIENT_SECRET,
                        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                        "token_uri": "https://oauth2.googleapis.com/token",
                    }
                },
                scopes=["https://www.googleapis.com/auth/calendar"],
                redirect_uri=settings.GOOGLE_REDIRECT_URI,
            )
            flow.fetch_token(code=code)
            credentials = flow.credentials

        # Save refresh token to user
        if credentials.refresh_token:
            current_user.google_refresh_token = credentials.refresh_token
            db.commit()
            logger.info(
                "Google OAuth tokens saved",
                extra={
                    "user_id": current_user.id,
                    "pkce_used": settings.GOOGLE_OAUTH_USE_PKCE
                }
            )
        else:
            logger.warning("No refresh token received from Google OAuth")

        # Clear PKCE state
        if settings.GOOGLE_OAUTH_USE_PKCE:
            clear_pkce_state(state)

        # Redirect to frontend with success
        return RedirectResponse(url=f"{settings.FRONTEND_URL}?google_success=1")

    except httpx.HTTPStatusError as e:
        logger.error(
            "Google OAuth token exchange failed",
            extra={
                "status_code": e.response.status_code,
                "response": e.response.text[:200],
                "pkce_used": settings.GOOGLE_OAUTH_USE_PKCE
            }
        )
        return RedirectResponse(url=f"{settings.FRONTEND_URL}?google_error=1&reason=token_exchange_failed")
    except Exception as e:
        logger.error(
            "Google OAuth callback error",
            extra={
                "error": str(e),
                "pkce_used": settings.GOOGLE_OAUTH_USE_PKCE
            },
            exc_info=True
        )
        return RedirectResponse(url=f"{settings.FRONTEND_URL}?google_error=1&reason=unknown")
