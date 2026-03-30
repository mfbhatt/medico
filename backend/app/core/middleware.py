# """Custom FastAPI middleware: tenant resolution, logging, rate limiting, security headers."""
# import time
# import uuid
# from typing import Optional

# import structlog
# from fastapi import Request, Response
# from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
# from starlette.responses import JSONResponse

# from app.core.config import settings

# log = structlog.get_logger()

# # Paths that don't require tenant resolution
# TENANT_EXEMPT_PATHS = {
#     "/health",
#     "/readiness",
#     "/docs",
#     "/redoc",
#     "/openapi.json",
#     "/api/v1/auth/login",
#     "/api/v1/auth/register",
#     "/api/v1/auth/refresh",
#     "/api/v1/auth/forgot-password",
#     "/api/v1/auth/reset-password",
#     "/api/v1/auth/otp/send",
#     "/api/v1/auth/otp/verify",
#     "/api/v1/tenants/onboard",
# }


# class TenantMiddleware(BaseHTTPMiddleware):
#     """
#     Resolves tenant from:
#     1. X-Tenant-ID header (preferred for API clients)
#     2. Subdomain: cityhealth.app.com → tenant slug = "cityhealth"
#     3. JWT claim (after authentication)

#     Sets request.state.tenant_id for downstream use.
#     """

#     async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
#         if request.method == "OPTIONS" or request.url.path in TENANT_EXEMPT_PATHS:
#             return await call_next(request)

#         tenant_id = self._resolve_tenant(request)

#         if not tenant_id:
#             return JSONResponse(
#                 status_code=400,
#                 content={
#                     "success": False,
#                     "error_code": "MISSING_TENANT",
#                     "message": "Tenant could not be determined. Provide X-Tenant-ID header.",
#                 },
#             )

#         request.state.tenant_id = tenant_id
#         return await call_next(request)

#     def _resolve_tenant(self, request: Request) -> Optional[str]:
#         # 1. Header
#         tenant_id = request.headers.get("X-Tenant-ID")
#         if tenant_id:
#             return tenant_id

#         # 2. Subdomain
#         host = request.headers.get("host", "")
#         parts = host.split(".")
#         if len(parts) >= 3:  # subdomain.domain.tld
#             return parts[0]

#         # 3. JWT claim
#         auth_header = request.headers.get("Authorization", "")
#         if auth_header.startswith("Bearer "):
#             token = auth_header[7:]
#             try:
#                 from app.core.security import decode_token
#                 payload = decode_token(token)
#                 jwt_tenant = payload.get("tenant_id")
#                 if jwt_tenant:
#                     return str(jwt_tenant)
#             except Exception:
#                 pass

#         # 4. Query param (for development only)
#         if settings.is_development:
#             return request.query_params.get("tenant_id")

#         return None


# class RequestLoggingMiddleware(BaseHTTPMiddleware):
#     """Logs all requests with timing and request ID."""

#     async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
#         request_id = str(uuid.uuid4())
#         request.state.request_id = request_id

#         start_time = time.time()

#         # Bind context for structured logging
#         with structlog.contextvars.bound_contextvars(
#             request_id=request_id,
#             method=request.method,
#             path=request.url.path,
#             tenant_id=getattr(request.state, "tenant_id", None),
#         ):
#             log.info("Request started")
#             response = await call_next(request)
#             duration_ms = round((time.time() - start_time) * 1000, 2)

#             log.info(
#                 "Request completed",
#                 status_code=response.status_code,
#                 duration_ms=duration_ms,
#             )

#         response.headers["X-Request-ID"] = request_id
#         return response


# class RateLimitMiddleware(BaseHTTPMiddleware):
#     """
#     Simple rate limiter using Redis sliding window.
#     Limits: per tenant + per user (after auth).
#     """

#     async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
#         if request.method == "OPTIONS" or request.url.path in TENANT_EXEMPT_PATHS:
#             return await call_next(request)

#         try:
#             from app.core.cache import redis_client

#             tenant_id = getattr(request.state, "tenant_id", "anonymous")
#             client_ip = request.client.host if request.client else "unknown"
#             window_key = f"rate_limit:{tenant_id}:{client_ip}"

#             current = await redis_client.incr(window_key)
#             if current == 1:
#                 await redis_client.expire(window_key, 60)  # 1-minute window

#             if current > settings.RATE_LIMIT_REQUESTS_PER_MINUTE:
#                 return JSONResponse(
#                     status_code=429,
#                     content={
#                         "success": False,
#                         "error_code": "RATE_LIMITED",
#                         "message": "Too many requests. Please slow down.",
#                     },
#                     headers={"Retry-After": "60"},
#                 )
#         except Exception:
#             # Don't block requests if Redis is down
#             pass

#         return await call_next(request)


# class SecurityHeadersMiddleware(BaseHTTPMiddleware):
#     """Adds security headers to all responses."""

#     async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
#         response = await call_next(request)
#         response.headers["X-Content-Type-Options"] = "nosniff"
#         response.headers["X-Frame-Options"] = "DENY"
#         response.headers["X-XSS-Protection"] = "1; mode=block"
#         response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
#         response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
#         response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
#         if settings.is_production:
#             response.headers["Content-Security-Policy"] = (
#                 "default-src 'self'; "
#                 "script-src 'self'; "
#                 "style-src 'self' 'unsafe-inline'; "
#                 "img-src 'self' data: blob:; "
#                 "connect-src 'self' https:;"
#             )
#         return response


import time
import uuid
from typing import Optional

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.config import settings

log = structlog.get_logger()

TENANT_EXEMPT_PATHS = {
    "/health",
    "/readiness",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/refresh",
    "/api/v1/auth/forgot-password",
    "/api/v1/auth/reset-password",
    "/api/v1/auth/otp/send",
    "/api/v1/auth/otp/verify",
    "/api/v1/tenants/onboard",
}


# ✅ Tenant Middleware
class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if (
            request.method == "OPTIONS"
            or path in TENANT_EXEMPT_PATHS
            or path.startswith("/api/v1/public/")
            or path.startswith("/api/v1/admin/")
        ):
            return await call_next(request)

        tenant_id = self._resolve_tenant(request)

        if not tenant_id:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "error_code": "MISSING_TENANT",
                    "message": "Tenant could not be determined. Provide X-Tenant-ID header.",
                },
            )

        request.state.tenant_id = tenant_id
        return await call_next(request)

    def _resolve_tenant(self, request: Request) -> Optional[str]:
        # 1. Header
        if tenant := request.headers.get("X-Tenant-ID"):
            return tenant

        # 2. JWT claim
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            try:
                from app.core.security import decode_token
                payload = decode_token(auth_header[7:])
                jwt_tenant = payload.get("tenant_id")
                if jwt_tenant:
                    return str(jwt_tenant)
            except Exception:
                pass

        # 3. Query param (dev only)
        if settings.is_development:
            return request.query_params.get("tenant_id")

        return None


# ✅ Logging Middleware
class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        start = time.time()

        log.info("Request started", path=request.url.path)

        response = await call_next(request)

        duration = round((time.time() - start) * 1000, 2)

        log.info("Request completed", status=response.status_code, duration_ms=duration)

        response.headers["X-Request-ID"] = request_id
        return response


# ✅ Rate Limit Middleware
class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS" or request.url.path in TENANT_EXEMPT_PATHS:
            return await call_next(request)

        try:
            from app.core.cache import redis_client

            tenant_id = getattr(request.state, "tenant_id", "anon")
            ip = request.client.host if request.client else "unknown"

            key = f"rate:{tenant_id}:{ip}"
            count = await redis_client.incr(key)

            if count == 1:
                await redis_client.expire(key, 60)

            if count > settings.RATE_LIMIT_REQUESTS_PER_MINUTE:
                return JSONResponse(
                    status_code=429,
                    content={
                        "success": False,
                        "error_code": "RATE_LIMITED",
                        "message": "Too many requests. Please slow down.",
                    },
                    headers={"Retry-After": "60"},
                )
        except Exception:
            pass

        return await call_next(request)


# ✅ Security Headers
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)

        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"

        return response