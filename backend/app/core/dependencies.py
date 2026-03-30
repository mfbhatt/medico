"""FastAPI dependency injection: current user, tenant, permissions."""
from typing import Optional
from uuid import UUID

from fastapi import Depends, Request, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token, require_permission
from app.core.exceptions import UnauthorizedException, TenantNotFoundException

security = HTTPBearer(auto_error=False)


class CurrentUser:
    def __init__(
        self,
        user_id: str,
        tenant_id: str,
        role: str,
        clinic_id: Optional[str] = None,
        is_patient: bool = False,
    ):
        self.user_id = user_id
        self.tenant_id = tenant_id
        self.role = role
        self.clinic_id = clinic_id
        self.is_patient = is_patient

    def has_permission(self, permission: str) -> bool:
        from app.core.security import has_permission
        return has_permission(self.role, permission)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> CurrentUser:
    """Decode JWT and return current user. Raises 401 if invalid."""
    if not credentials:
        raise UnauthorizedException(detail="No authentication token provided")

    payload = decode_token(credentials.credentials)

    if payload.get("type") not in ("access",):
        raise UnauthorizedException(detail="Invalid token type")

    user_id = payload.get("sub")
    tenant_id = payload.get("tenant_id")
    role = payload.get("role")

    if not all([user_id, tenant_id, role]):
        raise UnauthorizedException(detail="Malformed token payload")

    # Optionally: verify user still exists and is active in DB
    # (use caching to avoid DB hit on every request)

    return CurrentUser(
        user_id=user_id,
        tenant_id=tenant_id,
        role=role,
        clinic_id=payload.get("clinic_id"),
        is_patient=(role == "patient"),
    )


async def get_current_active_user(
    current_user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    return current_user


def require_roles(*roles: str):
    """Dependency factory: restrict access to specific roles."""
    async def _check(current_user: CurrentUser = Depends(get_current_user)):
        if current_user.role not in roles and current_user.role != "super_admin":
            from app.core.exceptions import ForbiddenException
            raise ForbiddenException(
                detail=f"This action requires one of: {', '.join(roles)}"
            )
        return current_user
    return _check


def require_perm(permission: str):
    """Dependency factory: restrict access by permission."""
    async def _check(current_user: CurrentUser = Depends(get_current_user)):
        require_permission(current_user.role, permission)
        return current_user
    return _check


async def get_tenant_id(request: Request) -> str:
    """Extract tenant_id from request state (set by TenantMiddleware)."""
    tenant_id = getattr(request.state, "tenant_id", None)
    if not tenant_id:
        raise TenantNotFoundException()
    return tenant_id


def get_pagination_params(
    page: int = 1,
    page_size: int = 20,
    max_page_size: int = 100,
):
    """Standardized pagination dependency."""
    page = max(1, page)
    page_size = min(max(1, page_size), max_page_size)
    offset = (page - 1) * page_size
    return {"page": page, "page_size": page_size, "offset": offset}
