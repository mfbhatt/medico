# """
# ClinicManagement — FastAPI Application Entry Point
# """
# from contextlib import asynccontextmanager

# import structlog
# from fastapi import FastAPI, Request, status
# from fastapi.exceptions import RequestValidationError
# from fastapi.middleware.cors import CORSMiddleware
# from fastapi.middleware.gzip import GZipMiddleware
# from fastapi.responses import JSONResponse

# from app.api.v1.router import api_router
# from app.core.config import settings
# from app.core.database import engine, Base
# from app.core.exceptions import (
#     ClinicBaseException,
#     clinic_exception_handler,
#     validation_exception_handler,
#     unhandled_exception_handler,
# )
# from app.core.middleware import (
#     TenantMiddleware,
#     RequestLoggingMiddleware,
#     RateLimitMiddleware,
#     SecurityHeadersMiddleware,
# )

# log = structlog.get_logger()


# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     """Application startup and shutdown events."""
#     log.info("Starting ClinicManagement API", version=settings.APP_VERSION, env=settings.APP_ENV)

#     # Create DB tables (use Alembic in production)
#     if settings.APP_ENV == "development":
#         async with engine.begin() as conn:
#             await conn.run_sync(Base.metadata.create_all)

#     yield

#     log.info("Shutting down ClinicManagement API")
#     await engine.dispose()


# def create_app() -> FastAPI:
#     app = FastAPI(
#         title="ClinicManagement API",
#         description="Enterprise multi-tenant clinic & health center management platform",
#         version=settings.APP_VERSION,
#         docs_url="/docs" if settings.APP_DEBUG else None,
#         redoc_url="/redoc" if settings.APP_DEBUG else None,
#         openapi_url="/openapi.json" if settings.APP_DEBUG else None,
#         lifespan=lifespan,
#     )

#     # ── Middleware (order matters — outer → inner) ──────────────
#     app.add_middleware(SecurityHeadersMiddleware)
#     app.add_middleware(GZipMiddleware, minimum_size=1000)
#     app.add_middleware(
#         CORSMiddleware,
#         allow_origins=settings.ALLOWED_ORIGINS,
#         allow_credentials=True,
#         allow_methods=["*"],
#         allow_headers=["*"],
#         expose_headers=["X-Request-ID", "X-Tenant-ID"],
#     )
#     app.add_middleware(RequestLoggingMiddleware)
#     app.add_middleware(RateLimitMiddleware)
#     app.add_middleware(TenantMiddleware)

#     # ── Exception Handlers ──────────────────────────────────────
#     app.add_exception_handler(ClinicBaseException, clinic_exception_handler)
#     app.add_exception_handler(RequestValidationError, validation_exception_handler)
#     app.add_exception_handler(Exception, unhandled_exception_handler)

#     # ── Routers ─────────────────────────────────────────────────
#     app.include_router(api_router, prefix="/api/v1")

#     # ── Health & Readiness Endpoints ────────────────────────────
#     @app.get("/health", tags=["Health"])
#     async def health_check():
#         return {"status": "healthy", "version": settings.APP_VERSION}

#     @app.get("/readiness", tags=["Health"])
#     async def readiness_check(request: Request):
#         # Check DB and Redis connectivity
#         from app.core.database import async_session_factory
#         from app.core.cache import redis_client
#         checks = {}
#         try:
#             async with async_session_factory() as session:
#                 await session.execute("SELECT 1")
#             checks["database"] = "ok"
#         except Exception as e:
#             checks["database"] = f"error: {e}"

#         try:
#             await redis_client.ping()
#             checks["redis"] = "ok"
#         except Exception as e:
#             checks["redis"] = f"error: {e}"

#         all_ok = all(v == "ok" for v in checks.values())
#         return JSONResponse(
#             status_code=status.HTTP_200_OK if all_ok else status.HTTP_503_SERVICE_UNAVAILABLE,
#             content={"status": "ready" if all_ok else "not_ready", "checks": checks},
#         )

#     return app


# app = create_app()


"""
ClinicManagement — FastAPI Application Entry Point
"""
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import engine, Base
from app.core.exceptions import (
    ClinicBaseException,
    clinic_exception_handler,
    validation_exception_handler,
    unhandled_exception_handler,
)
from app.core.middleware import (
    TenantMiddleware,
    RequestLoggingMiddleware,
    RateLimitMiddleware,
    SecurityHeadersMiddleware,
)

log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Starting ClinicManagement API", version=settings.APP_VERSION)

    if settings.APP_ENV == "development":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    yield

    log.info("Shutting down ClinicManagement API")
    await engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(
        title="ClinicManagement API",
        version=settings.APP_VERSION,
        lifespan=lifespan,
    )

    # add_middleware wraps in reverse — last added = outermost = runs first.
    # Desired execution order: CORS → Tenant → RateLimit → Logging → Gzip → Security
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(TenantMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "X-Tenant-ID"],
    )

    # Exception handlers
    app.add_exception_handler(ClinicBaseException, clinic_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

    # Routes
    app.include_router(api_router, prefix="/api/v1")

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app


app = create_app()