"""
Security Headers Middleware (Helmet-style)
==========================================

Adds security headers to all responses, similar to Express.js Helmet middleware.

Security Headers:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY/SAMEORIGIN
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security (HSTS)
- Content-Security-Policy (CSP)
- Referrer-Policy
- Permissions-Policy
- X-DNS-Prefetch-Control
- X-Download-Options
- X-Permitted-Cross-Domain-Policies
"""
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from app.config import settings
from app.core.logging import logger
from typing import Callable, List, Optional


class SecureHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add security headers to all responses.

    Similar to Express.js Helmet middleware, adds:
    - X-Content-Type-Options
    - X-Frame-Options
    - X-XSS-Protection
    - Strict-Transport-Security (HSTS)
    - Content-Security-Policy
    - Referrer-Policy
    - Permissions-Policy
    - And more...
    """

    def __init__(
        self,
        app,
        content_type_nosniff: bool = True,
        frame_options: str = "DENY",
        xss_protection: bool = True,
        hsts_enabled: bool = True,
        hsts_max_age: int = 31536000,  # 1 year
        hsts_include_subdomains: bool = True,
        hsts_preload: bool = False,
        content_security_policy: Optional[str] = None,
        referrer_policy: str = "strict-origin-when-cross-origin",
        permissions_policy: Optional[str] = None,
        dns_prefetch_control: bool = True,
        download_options: bool = True,
        permitted_cross_domain_policies: bool = True,
    ):
        super().__init__(app)
        self.content_type_nosniff = content_type_nosniff
        self.frame_options = frame_options
        self.xss_protection = xss_protection
        self.hsts_enabled = hsts_enabled
        self.hsts_max_age = hsts_max_age
        self.hsts_include_subdomains = hsts_include_subdomains
        self.hsts_preload = hsts_preload
        self.content_security_policy = content_security_policy
        self.referrer_policy = referrer_policy
        self.permissions_policy = permissions_policy
        self.dns_prefetch_control = dns_prefetch_control
        self.download_options = download_options
        self.permitted_cross_domain_policies = permitted_cross_domain_policies

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Add security headers to response"""
        # Skip security headers for OPTIONS (CORS preflight) and certain paths
        if request.method == "OPTIONS":
            return await call_next(request)
        
        response = await call_next(request)

        # Skip security headers for certain paths (e.g., docs, health checks)
        skip_paths = ["/docs", "/redoc", "/openapi.json", "/health"]
        if any(request.url.path.startswith(path) for path in skip_paths):
            return response

        # Determine if HTTPS
        is_https = (
            request.url.scheme == 'https' or
            request.headers.get('x-forwarded-proto') == 'https' or
            settings.ENVIRONMENT == 'production'
        )

        # X-Content-Type-Options: nosniff
        # Prevents MIME type sniffing
        if self.content_type_nosniff:
            response.headers["X-Content-Type-Options"] = "nosniff"

        # X-Frame-Options: DENY | SAMEORIGIN | ALLOW-FROM
        # Prevents clickjacking attacks
        if self.frame_options:
            response.headers["X-Frame-Options"] = self.frame_options

        # X-XSS-Protection: 1; mode=block
        # Enables XSS filter in older browsers
        if self.xss_protection:
            response.headers["X-XSS-Protection"] = "1; mode=block"

        # Strict-Transport-Security (HSTS)
        # Forces HTTPS connections
        if self.hsts_enabled and is_https:
            hsts_value = f"max-age={self.hsts_max_age}"
            if self.hsts_include_subdomains:
                hsts_value += "; includeSubDomains"
            if self.hsts_preload:
                hsts_value += "; preload"
            response.headers["Strict-Transport-Security"] = hsts_value

        # Content-Security-Policy (CSP)
        # Controls which resources can be loaded
        if self.content_security_policy:
            response.headers["Content-Security-Policy"] = self.content_security_policy
        elif settings.CSP_POLICY:
            response.headers["Content-Security-Policy"] = settings.CSP_POLICY

        # Referrer-Policy
        # Controls how much referrer information is sent
        if self.referrer_policy:
            response.headers["Referrer-Policy"] = self.referrer_policy

        # Permissions-Policy (formerly Feature-Policy)
        # Controls browser features and APIs
        if self.permissions_policy:
            response.headers["Permissions-Policy"] = self.permissions_policy
        elif settings.PERMISSIONS_POLICY:
            response.headers["Permissions-Policy"] = settings.PERMISSIONS_POLICY

        # X-DNS-Prefetch-Control: off
        # Disables DNS prefetching (privacy)
        if self.dns_prefetch_control:
            response.headers["X-DNS-Prefetch-Control"] = "off"

        # X-Download-Options: noopen
        # Prevents IE from executing downloads in site context
        if self.download_options:
            response.headers["X-Download-Options"] = "noopen"

        # X-Permitted-Cross-Domain-Policies: none
        # Prevents Adobe Flash/PDF from loading cross-domain content
        if self.permitted_cross_domain_policies:
            response.headers["X-Permitted-Cross-Domain-Policies"] = "none"

        # X-Powered-By: Remove (security through obscurity)
        # Remove server information
        if "X-Powered-By" in response.headers:
            del response.headers["X-Powered-By"]

        # Server: Remove (security through obscurity)
        # Remove server information
        if "Server" in response.headers:
            del response.headers["Server"]

        return response


def create_secure_headers_middleware(app) -> SecureHeadersMiddleware:
    """
    Factory function to create SecureHeadersMiddleware with app settings.

    Args:
        app: FastAPI application instance

    Returns:
        Configured SecureHeadersMiddleware
    """
    return SecureHeadersMiddleware(
        app,
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


def create_trusted_host_middleware(allowed_hosts: List[str]) -> TrustedHostMiddleware:
    """
    Factory function to create TrustedHostMiddleware.

    Args:
        allowed_hosts: List of allowed hostnames

    Returns:
        Configured TrustedHostMiddleware
    """
    return TrustedHostMiddleware(
        allowed_hosts=allowed_hosts or ["*"]  # Allow all in development
    )
