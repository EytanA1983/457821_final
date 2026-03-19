"""
Cookie Middleware for Secure Cookie Management
=============================================

Handles secure cookie settings with:
- SameSite=Strict (CSRF protection)
- Secure flag (HTTPS only)
- HttpOnly flag (XSS protection)
- Proper domain and path settings
"""
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse
from app.config import settings
from app.core.logging import logger
from typing import Callable


class SecureCookieMiddleware(BaseHTTPMiddleware):
    """
    Middleware to enforce secure cookie settings on all responses.

    Automatically sets secure cookie attributes:
    - SameSite=Strict (prevents CSRF attacks)
    - Secure=True (HTTPS only, in production)
    - HttpOnly=True (prevents XSS attacks)
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request and enforce secure cookie settings"""
        # Skip cookie processing for OPTIONS (CORS preflight) - no cookies needed
        # CRITICAL: OPTIONS requests must pass through without cookie processing
        if request.method == "OPTIONS":
            return await call_next(request)
        
        response = await call_next(request)

        # Only modify Set-Cookie headers if they exist
        if hasattr(response, 'headers'):
            # Get existing cookies (can be multiple)
            set_cookie_header = response.headers.get('set-cookie')
            if set_cookie_header:
                # Handle single cookie or multiple cookies
                cookies = response.headers.getlist('set-cookie') if hasattr(response.headers, 'getlist') else [set_cookie_header]

                # Clear existing Set-Cookie headers
                if hasattr(response.headers, 'popall'):
                    response.headers.popall('set-cookie')
                else:
                    # Fallback: remove all set-cookie headers
                    headers_to_remove = []
                    for key, value in response.headers.items():
                        if key.lower() == 'set-cookie':
                            headers_to_remove.append(key)
                    for key in headers_to_remove:
                        del response.headers[key]

                # Re-set cookies with secure attributes
                for cookie in cookies:
                    # Parse cookie string (format: name=value; attr1=val1; attr2=val2)
                    parts = cookie.split(';')
                    name_value = parts[0].strip()

                    # Extract cookie name and value
                    if '=' in name_value:
                        name, value = name_value.split('=', 1)
                        name = name.strip()
                        value = value.strip()

                        # Build secure cookie string
                        secure_cookie = self._build_secure_cookie(
                            name=name,
                            value=value,
                            original_cookie=cookie,
                            request=request
                        )

                        response.headers.append('set-cookie', secure_cookie)
                    else:
                        # If parsing fails, use original cookie but add secure attributes
                        secure_cookie = self._add_secure_attributes(cookie, request)
                        response.headers.append('set-cookie', secure_cookie)

        return response

    def _build_secure_cookie(
        self,
        name: str,
        value: str,
        original_cookie: str,
        request: Request
    ) -> str:
        """
        Build a secure cookie string with all security attributes.

        Args:
            name: Cookie name
            value: Cookie value
            original_cookie: Original cookie string (to extract existing attributes)
            request: Request object (to determine if HTTPS)

        Returns:
            Secure cookie string
        """
        # Parse existing attributes from original cookie
        attrs = {}
        parts = original_cookie.split(';')[1:]  # Skip name=value part

        for part in parts:
            part = part.strip()
            if '=' in part:
                key, val = part.split('=', 1)
                attrs[key.strip().lower()] = val.strip()
            else:
                attrs[part.lower()] = True

        # Determine if we're in production (HTTPS)
        is_https = (
            request.url.scheme == 'https' or
            request.headers.get('x-forwarded-proto') == 'https' or
            settings.ENVIRONMENT == 'production'
        )

        # Build cookie string
        cookie_parts = [f"{name}={value}"]

        # Path (default to / if not specified)
        if 'path' not in attrs:
            cookie_parts.append("Path=/")
        else:
            cookie_parts.append(f"Path={attrs['path']}")

        # Domain (only set if specified in original cookie)
        if 'domain' in attrs:
            cookie_parts.append(f"Domain={attrs['domain']}")

        # SameSite=Strict (CSRF protection)
        cookie_parts.append("SameSite=Strict")

        # Secure flag (HTTPS only)
        if is_https or settings.COOKIE_SECURE:
            cookie_parts.append("Secure")

        # HttpOnly (XSS protection) - enabled by default
        if settings.COOKIE_HTTPONLY:
            cookie_parts.append("HttpOnly")

        # Max-Age or Expires (if specified)
        if 'max-age' in attrs:
            cookie_parts.append(f"Max-Age={attrs['max-age']}")
        elif 'expires' in attrs:
            cookie_parts.append(f"Expires={attrs['expires']}")

        return "; ".join(cookie_parts)

    def _add_secure_attributes(self, cookie: str, request: Request) -> str:
        """
        Add secure attributes to an existing cookie string.
        Used as fallback when cookie parsing fails.
        """
        is_https = (
            request.url.scheme == 'https' or
            request.headers.get('x-forwarded-proto') == 'https' or
            settings.ENVIRONMENT == 'production'
        )

        # Add secure attributes if not already present
        if 'SameSite' not in cookie:
            cookie += "; SameSite=Strict"

        if is_https or settings.COOKIE_SECURE:
            if 'Secure' not in cookie:
                cookie += "; Secure"

        if settings.COOKIE_HTTPONLY:
            if 'HttpOnly' not in cookie:
                cookie += "; HttpOnly"

        return cookie


def set_secure_cookie(
    response: Response,
    key: str,
    value: str,
    max_age: int | None = None,
    expires: str | None = None,
    path: str = "/",
    domain: str | None = None,
    secure: bool | None = None,
    httponly: bool = True,
    samesite: str = "Strict"
) -> None:
    """
    Helper function to set a secure cookie on a response.

    Args:
        response: FastAPI Response object
        key: Cookie name
        value: Cookie value
        max_age: Max age in seconds (optional)
        expires: Expiration date string (optional)
        path: Cookie path (default: /)
        domain: Cookie domain (optional)
        secure: Force Secure flag (default: auto-detect from HTTPS)
        httponly: HttpOnly flag (default: True)
        samesite: SameSite value (default: Strict)
    """
    # Determine if secure should be enabled
    if secure is None:
        secure = (settings.ENVIRONMENT == 'production') or settings.COOKIE_SECURE

    # Build cookie string
    cookie_parts = [f"{key}={value}"]
    cookie_parts.append(f"Path={path}")

    if domain:
        cookie_parts.append(f"Domain={domain}")

    cookie_parts.append(f"SameSite={samesite}")

    if secure:
        cookie_parts.append("Secure")

    if httponly:
        cookie_parts.append("HttpOnly")

    if max_age is not None:
        cookie_parts.append(f"Max-Age={max_age}")
    elif expires:
        cookie_parts.append(f"Expires={expires}")

    cookie_string = "; ".join(cookie_parts)
    response.headers.append("set-cookie", cookie_string)

    logger.debug(
        "Secure cookie set",
        extra={
            "cookie_name": key,
            "path": path,
            "secure": secure,
            "httponly": httponly,
            "samesite": samesite
        }
    )


def delete_cookie(
    response: Response,
    key: str,
    path: str = "/",
    domain: str | None = None
) -> None:
    """
    Delete a cookie by setting it to expire immediately.

    Args:
        response: FastAPI Response object
        key: Cookie name
        path: Cookie path (must match original path)
        domain: Cookie domain (must match original domain)
    """
    cookie_parts = [f"{key}="]
    cookie_parts.append(f"Path={path}")

    if domain:
        cookie_parts.append(f"Domain={domain}")

    cookie_parts.append("SameSite=Strict")
    cookie_parts.append("Secure")
    cookie_parts.append("HttpOnly")
    cookie_parts.append("Max-Age=0")
    cookie_parts.append("Expires=Thu, 01 Jan 1970 00:00:00 GMT")

    cookie_string = "; ".join(cookie_parts)
    response.headers.append("set-cookie", cookie_string)

    logger.debug("Cookie deleted", extra={"cookie_name": key})
