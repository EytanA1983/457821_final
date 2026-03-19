"""
Rate Limiting and Brute-Force Protection Service
Uses Redis to track request rates and failed login attempts
"""
import redis
import json
from typing import Optional
from datetime import datetime, timedelta
from fastapi import Request, HTTPException, status
from app.config import settings
from app.core.logging import logger


class RateLimiter:
    """Rate limiting service using Redis"""

    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        if settings.RATE_LIMIT_ENABLED:
            try:
                self.redis_client = redis.from_url(
                    settings.REDIS_URL,
                    decode_responses=True,
                    socket_connect_timeout=5,
                    socket_timeout=5,
                )
                # Test connection
                self.redis_client.ping()
                logger.info("Rate limiter connected to Redis")
            except Exception as e:
                logger.warning(f"Failed to connect to Redis for rate limiting: {e}")
                logger.warning("Rate limiting will be disabled")
                self.redis_client = None

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request"""
        # Check for forwarded IP (behind proxy/load balancer)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # Take the first IP in the chain
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()
        
        # Fallback to direct client IP
        if request.client:
            return request.client.host
        
        return "unknown"

    def _get_key(self, prefix: str, identifier: str) -> str:
        """Generate Redis key"""
        return f"rate_limit:{prefix}:{identifier}"

    def check_rate_limit(
        self,
        request: Request,
        limit_per_minute: Optional[int] = None,
        limit_per_hour: Optional[int] = None,
    ) -> tuple[bool, Optional[str]]:
        """
        Check if request is within rate limits
        Returns: (is_allowed, error_message)
        """
        if not settings.RATE_LIMIT_ENABLED or not self.redis_client:
            return True, None

        try:
            client_ip = self._get_client_ip(request)
            limit_per_minute = limit_per_minute or settings.RATE_LIMIT_PER_MINUTE
            limit_per_hour = limit_per_hour or settings.RATE_LIMIT_PER_HOUR

            now = datetime.utcnow()
            minute_key = self._get_key("minute", client_ip)
            hour_key = self._get_key("hour", client_ip)

            # Check per-minute limit
            minute_count = self.redis_client.get(minute_key)
            if minute_count and int(minute_count) >= limit_per_minute:
                return False, f"Rate limit exceeded: {limit_per_minute} requests per minute"

            # Check per-hour limit
            hour_count = self.redis_client.get(hour_key)
            if hour_count and int(hour_count) >= limit_per_hour:
                return False, f"Rate limit exceeded: {limit_per_hour} requests per hour"

            # Increment counters
            pipe = self.redis_client.pipeline()
            pipe.incr(minute_key)
            pipe.expire(minute_key, 60)  # Expire after 1 minute
            pipe.incr(hour_key)
            pipe.expire(hour_key, 3600)  # Expire after 1 hour
            pipe.execute()

            return True, None

        except Exception as e:
            logger.error(f"Error checking rate limit: {e}")
            # On error, allow the request (fail open)
            return True, None

    def record_failed_login(self, identifier: str) -> tuple[int, bool]:
        """
        Record a failed login attempt
        Returns: (attempt_count, is_locked_out)
        """
        if not self.redis_client:
            return 0, False

        try:
            key = self._get_key("brute_force", identifier)
            
            # Get current attempt count
            attempts = self.redis_client.get(key)
            attempt_count = int(attempts) if attempts else 0
            
            # Increment attempt count
            attempt_count += 1
            self.redis_client.setex(
                key,
                settings.BRUTE_FORCE_LOCKOUT_MINUTES * 60,
                attempt_count
            )

            # Check if locked out
            is_locked_out = attempt_count >= settings.BRUTE_FORCE_MAX_ATTEMPTS

            if is_locked_out:
                logger.warning(
                    f"Brute-force lockout triggered for {identifier} "
                    f"after {attempt_count} attempts"
                )

            return attempt_count, is_locked_out

        except Exception as e:
            logger.error(f"Error recording failed login: {e}")
            return 0, False

    def reset_failed_logins(self, identifier: str):
        """Reset failed login attempts for identifier"""
        if not self.redis_client:
            return

        try:
            key = self._get_key("brute_force", identifier)
            self.redis_client.delete(key)
            logger.debug(f"Reset brute-force attempts for {identifier}")
        except Exception as e:
            logger.error(f"Error resetting failed logins: {e}")

    def get_remaining_attempts(self, identifier: str) -> int:
        """Get remaining login attempts before lockout"""
        if not self.redis_client:
            return settings.BRUTE_FORCE_MAX_ATTEMPTS

        try:
            key = self._get_key("brute_force", identifier)
            attempts = self.redis_client.get(key)
            attempt_count = int(attempts) if attempts else 0
            remaining = max(0, settings.BRUTE_FORCE_MAX_ATTEMPTS - attempt_count)
            return remaining
        except Exception as e:
            logger.error(f"Error getting remaining attempts: {e}")
            return settings.BRUTE_FORCE_MAX_ATTEMPTS

    def get_lockout_ttl(self, identifier: str) -> Optional[int]:
        """Get time remaining until lockout expires (in seconds)"""
        if not self.redis_client:
            return None

        try:
            key = self._get_key("brute_force", identifier)
            ttl = self.redis_client.ttl(key)
            return ttl if ttl > 0 else None
        except Exception as e:
            logger.error(f"Error getting lockout TTL: {e}")
            return None

    def get_failed_attempt_count(self, identifier: str) -> int:
        """Get current failed attempt count WITHOUT incrementing it"""
        if not self.redis_client:
            return 0

        try:
            key = self._get_key("brute_force", identifier)
            attempts = self.redis_client.get(key)
            return int(attempts) if attempts else 0
        except Exception as e:
            logger.error(f"Error getting failed attempt count: {e}")
            return 0

    def is_locked_out(self, identifier: str) -> bool:
        """Check if account is locked out WITHOUT recording a new attempt"""
        if not self.redis_client:
            return False

        try:
            attempt_count = self.get_failed_attempt_count(identifier)
            return attempt_count >= settings.BRUTE_FORCE_MAX_ATTEMPTS
        except Exception as e:
            logger.error(f"Error checking lockout status: {e}")
            return False


# Global instance
rate_limiter = RateLimiter()
