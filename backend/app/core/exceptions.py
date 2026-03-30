"""Custom exceptions and FastAPI exception handlers (CORS-safe)."""
from typing import Any, Optional

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

import structlog

log = structlog.get_logger()


# ── Base Exception ───────────────────────────────────────────────
class ClinicBaseException(Exception):
    def __init__(
        self,
        detail: Optional[str] = None,
        data: Optional[Any] = None,
        status_code: Optional[int] = None,
        error_code: Optional[str] = None,
    ):
        self.status_code = status_code or self.status_code
        self.error_code = error_code or self.error_code
        self.detail = detail or self.message
        self.data = data
        super().__init__(self.detail)


# ── HTTP Exceptions ──────────────────────────────────────────────
class BadRequestException(ClinicBaseException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "BAD_REQUEST"
    message = "Bad request"


class UnauthorizedException(ClinicBaseException):
    status_code = status.HTTP_401_UNAUTHORIZED
    error_code = "UNAUTHORIZED"
    message = "Authentication required"


class ForbiddenException(ClinicBaseException):
    status_code = status.HTTP_403_FORBIDDEN
    error_code = "FORBIDDEN"
    message = "Insufficient permissions"


class NotFoundException(ClinicBaseException):
    status_code = status.HTTP_404_NOT_FOUND
    error_code = "NOT_FOUND"
    message = "Resource not found"


class ConflictException(ClinicBaseException):
    status_code = status.HTTP_409_CONFLICT
    error_code = "CONFLICT"
    message = "Resource conflict"


class UnprocessableEntityException(ClinicBaseException):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    error_code = "UNPROCESSABLE_ENTITY"
    message = "Unprocessable entity"


class TooManyRequestsException(ClinicBaseException):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    error_code = "RATE_LIMITED"
    message = "Too many requests"


# ── Domain-Specific Exceptions ───────────────────────────────────
class TenantNotFoundException(NotFoundException):
    error_code = "TENANT_NOT_FOUND"
    message = "Tenant not found"


class TenantInactiveException(ForbiddenException):
    error_code = "TENANT_INACTIVE"
    message = "Tenant account is inactive or suspended"


class SlotUnavailableException(ConflictException):
    error_code = "SLOT_UNAVAILABLE"
    message = "The requested appointment slot is not available"


class DoubleBookingException(ConflictException):
    error_code = "DOUBLE_BOOKING"
    message = "Doctor already has an appointment at this time"


class DoctorUnavailableException(ConflictException):
    error_code = "DOCTOR_UNAVAILABLE"
    message = "Doctor is not available at the requested time"


class PatientNotFoundException(NotFoundException):
    error_code = "PATIENT_NOT_FOUND"
    message = "Patient not found"


class AppointmentNotFoundException(NotFoundException):
    error_code = "APPOINTMENT_NOT_FOUND"
    message = "Appointment not found"


class PrescriptionExpiredException(BadRequestException):
    error_code = "PRESCRIPTION_EXPIRED"
    message = "Prescription has expired"


class DrugInteractionException(UnprocessableEntityException):
    error_code = "DRUG_INTERACTION"
    message = "Drug interaction detected"


class InsufficientInventoryException(ConflictException):
    error_code = "INSUFFICIENT_INVENTORY"
    message = "Insufficient inventory for the requested items"


class InvalidInsuranceException(UnprocessableEntityException):
    error_code = "INVALID_INSURANCE"
    message = "Insurance information is invalid"


class FileUploadException(BadRequestException):
    error_code = "FILE_UPLOAD_ERROR"
    message = "File upload failed"

class MissingTenantException(BadRequestException):
    error_code = "MISSING_TENANT"
    message = "Provide X-Tenant-ID header"


# ── CORS Helper ──────────────────────────────────────────────────
def _add_cors_headers(request: Request, response: JSONResponse) -> JSONResponse:
    origin = request.headers.get("origin")

    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Vary"] = "Origin"

    return response


# ── Response Builder ─────────────────────────────────────────────
def _error_response(
    request: Request,
    status_code: int,
    error_code: str,
    message: str,
    data: Optional[Any] = None,
) -> JSONResponse:
    response = JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "error_code": error_code,
            "message": message,
            "data": data,
        },
    )
    return _add_cors_headers(request, response)


# ── Exception Handlers ───────────────────────────────────────────
async def clinic_exception_handler(
    request: Request, exc: ClinicBaseException
) -> JSONResponse:
    log.warning(
        "Handled exception",
        error_code=exc.error_code,
        detail=exc.detail,
        path=request.url.path,
    )

    return _error_response(
        request=request,
        status_code=exc.status_code,
        error_code=exc.error_code,
        message=exc.detail,
        data=exc.data,
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors = [
        {
            "field": ".".join(str(loc) for loc in error["loc"][1:]),
            "message": error["msg"],
            "type": error["type"],
        }
        for error in exc.errors()
    ]

    log.warning("Validation error", path=request.url.path, errors=errors)

    return _error_response(
        request=request,
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        error_code="VALIDATION_ERROR",
        message="Request validation failed",
        data={"errors": errors},
    )


async def unhandled_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    import traceback
    tb = traceback.format_exc()
    log.error(
        "Unhandled exception",
        path=request.url.path,
        exc_type=type(exc).__name__,
        exc_message=str(exc),
        exc_info=True,
    )

    from app.core.config import settings
    detail = f"{type(exc).__name__}: {exc}" if settings.is_development else None

    return _error_response(
        request=request,
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        error_code="INTERNAL_ERROR",
        message=detail or "An internal server error occurred",
    )