"""JWT creation/validation, password hashing, RBAC permission checking."""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import jwt
from jwt.exceptions import InvalidTokenError as JWTError
from passlib.context import CryptContext

from app.core.config import settings
from app.core.exceptions import UnauthorizedException, ForbiddenException

# ── Password Hashing ─────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# ── JWT ──────────────────────────────────────────────────────────
def create_access_token(
    subject: str,
    tenant_id: str,
    role: str,
    extra_claims: Optional[Dict[str, Any]] = None,
) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": subject,
        "tenant_id": tenant_id,
        "role": role,
        "jti": str(uuid.uuid4()),
        "iat": now,
        "exp": expire,
        "type": "access",
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(subject: str, tenant_id: str) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": subject,
        "tenant_id": tenant_id,
        "jti": str(uuid.uuid4()),
        "iat": now,
        "exp": expire,
        "type": "refresh",
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> Dict[str, Any]:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except JWTError as e:
        raise UnauthorizedException(detail=f"Invalid token: {e}")


def create_otp_token(phone_or_email: str, otp: str) -> str:
    """Short-lived token for OTP verification (10 minutes)."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=10)
    payload = {
        "sub": phone_or_email,
        "otp": otp,
        "exp": expire,
        "type": "otp",
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


# ── RBAC Permission Matrix ────────────────────────────────────────
ROLE_PERMISSIONS: Dict[str, set] = {
    "super_admin": {"*"},  # All permissions
    "tenant_admin": {
        "tenants:read", "tenants:update",
        "clinics:*", "doctors:*", "patients:*", "appointments:*",
        "medical_records:*", "prescriptions:*", "lab_reports:*",
        "billing:*", "inventory:*", "analytics:*", "users:*",
        "notifications:*", "reports:*",
    },
    "clinic_admin": {
        "clinics:read", "clinics:update",
        "doctors:read", "doctors:update", "doctors:schedule",
        "patients:*", "appointments:*",
        "medical_records:read",
        "billing:*", "inventory:read",
        "analytics:read", "reports:read",
        "users:read", "users:create",
    },
    "doctor": {
        "patients:read", "patients:update",
        "appointments:read", "appointments:update",
        "medical_records:*",
        "prescriptions:*",
        "lab_reports:*",
        "billing:read",
    },
    "nurse": {
        "patients:read", "patients:update",
        "appointments:read", "appointments:update",
        "medical_records:read", "medical_records:create",
        "lab_reports:read",
        "prescriptions:read",
    },
    "receptionist": {
        "patients:read", "patients:create",
        "appointments:*",
        "billing:read", "billing:create",
    },
    "pharmacist": {
        "prescriptions:read", "prescriptions:dispense",
        "inventory:*",
        "patients:read",
    },
    "lab_technician": {
        "lab_reports:*",
        "patients:read",
        "appointments:read",
    },
    "patient": {
        "patients:read:own",
        "appointments:read:own", "appointments:create", "appointments:cancel:own",
        "medical_records:read:own",
        "prescriptions:read:own",
        "lab_reports:read:own",
        "billing:read:own",
    },
}


def has_permission(role: str, permission: str) -> bool:
    """Check if a role has a specific permission."""
    role_perms = ROLE_PERMISSIONS.get(role, set())

    # Super admin has all permissions
    if "*" in role_perms:
        return True

    # Exact match
    if permission in role_perms:
        return True

    # Wildcard match (e.g., "patients:*" covers "patients:read")
    resource = permission.split(":")[0]
    if f"{resource}:*" in role_perms:
        return True

    return False


def require_permission(role: str, permission: str) -> None:
    if not has_permission(role, permission):
        raise ForbiddenException(
            detail=f"Role '{role}' lacks permission '{permission}'"
        )
