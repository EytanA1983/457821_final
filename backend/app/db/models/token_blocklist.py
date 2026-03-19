"""
Token Blocklist Model
=====================

Stores revoked/blocked JWT tokens (both access and refresh tokens).
Used for immediate token revocation before expiration.

Note: For long-term storage, consider using Redis for better performance.
This model is suitable for smaller applications or when persistence is required.
"""
from __future__ import annotations
from datetime import datetime, timedelta
from typing import TYPE_CHECKING, Optional
from sqlalchemy import String, DateTime, Boolean, Index, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base

if TYPE_CHECKING:
    pass


class TokenBlocklist(Base):
    """
    Blocklist for revoked JWT tokens.

    Stores JWT IDs (jti) of tokens that have been revoked.
    Both access and refresh tokens can be blocked here.

    Features:
    - Automatic cleanup of expired tokens (via scheduled task)
    - Fast lookup by jti
    - TTL-based expiration tracking
    """
    __tablename__ = "token_blocklist"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # JWT ID - unique identifier from the token
    # Note: index is defined in __table_args__ below, not here to avoid duplicate
    jti: Mapped[str] = mapped_column(String(36), unique=True, nullable=False)

    # Token type: 'access' or 'refresh'
    token_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)

    # User ID (for cleanup and analytics)
    user_id: Mapped[Optional[int]] = mapped_column(nullable=True, index=True)

    # Expiration time (when the token would have naturally expired)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)

    # When was this token revoked
    revoked_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Reason for revocation (optional, for audit)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Indexes for common queries
    __table_args__ = (
        Index("ix_token_blocklist_jti", "jti"),
        Index("ix_token_blocklist_user_type", "user_id", "token_type"),
        Index("ix_token_blocklist_expires", "expires_at"),
    )

    def is_expired(self) -> bool:
        """Check if the blocked token has passed its natural expiration"""
        return datetime.utcnow() > self.expires_at

    def __repr__(self) -> str:
        return f"<TokenBlocklist(jti={self.jti[:8]}..., type={self.token_type}, user_id={self.user_id})>"
