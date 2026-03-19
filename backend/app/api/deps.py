"""
Dependencies for FastAPI routes
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import User, TokenBlocklist
from app.config import settings
from app.core.logging import logger
from jose import JWTError, jwt
from datetime import datetime

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_user_by_email(db: Session, email: str):
    """Get user by email"""
    return db.query(User).filter(User.email == email).first()


def check_token_blocklist(db: Session, jti: str) -> bool:
    """
    Check if a token JTI is in the blocklist.
    Returns True if token is blocked, False otherwise.
    """
    blocked = db.query(TokenBlocklist).filter(
        TokenBlocklist.jti == jti,
        TokenBlocklist.expires_at > datetime.utcnow()  # Only check non-expired entries
    ).first()

    return blocked is not None


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """
    Get current authenticated user from JWT token.

    Validates:
    - Token signature
    - Token expiration
    - Token type (must be 'access')
    - Token not in blocklist
    - User exists and is active
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="לא ניתן לאמת את הכרטיסייה",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # Decode and validate JWT
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])

        # Verify token type
        token_type = payload.get("type")
        if token_type != "access":
            logger.warning("Invalid token type used as access token", extra={"type": token_type})
            raise credentials_exception

        # Get email and JTI
        email: str = payload.get("sub")
        jti: str = payload.get("jti")

        if email is None:
            raise credentials_exception

        # Check if token is blocked
        if jti and check_token_blocklist(db, jti):
            logger.warning("Blocked token used", extra={"jti": jti, "email": email})
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been revoked",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Get user
        user = get_user_by_email(db, email=email)
        if user is None:
            raise credentials_exception

        # Check if user is active
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is inactive"
            )

        return user

    except JWTError as e:
        logger.warning(f"JWT validation failed: {e}", extra={"error_type": type(e).__name__})
        raise credentials_exception
    except HTTPException:
        # Re-raise HTTPException directly (401/403/etc.) - don't convert to 500
        raise
    except Exception as e:
        logger.error(f"Unexpected error in get_current_user: {e}", exc_info=True, extra={"error_type": type(e).__name__})
        raise credentials_exception
