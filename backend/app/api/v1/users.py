"""User management endpoints — create staff accounts, manage roles."""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, asc, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, CurrentUser, require_perm
from app.core.exceptions import BadRequestException, NotFoundException, ConflictException
from app.core.security import hash_password
from app.models.user import User, UserRole, UserStatus
from app.models.user_tenant import UserTenant

router = APIRouter()


def _success(data, message="Success", meta=None):
    return {"success": True, "message": message, "data": data, "meta": meta}


def _user_response(u: User, ut: UserTenant) -> dict:
    return {
        "id": u.id,
        "email": u.email,
        "phone": u.phone,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "full_name": u.full_name,
        "role": ut.role,
        "status": ut.status,
        "clinic_id": ut.clinic_id,
        "is_email_verified": u.is_email_verified,
        "created_at": ut.created_at.isoformat() if ut.created_at else None,
    }


@router.post("/")
async def create_user(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("users:create")),
):
    """
    Create a staff account in the current tenant.

    If the email already exists as a global User, that user is added to this
    tenant instead of creating a duplicate account.
    """
    email = body.get("email", "").lower().strip()
    role = body.get("role", UserRole.RECEPTIONIST)

    # Validate role elevation
    if role in (UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN):
        if current_user.role not in (UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN):
            raise BadRequestException(detail="Insufficient privileges to create this role")

    # Check if this email already has a membership in this tenant
    if email:
        existing_ut = (await db.execute(
            select(UserTenant)
            .join(User, UserTenant.user_id == User.id)
            .where(
                User.email == email,
                UserTenant.tenant_id == current_user.tenant_id,
                UserTenant.is_deleted.isnot(True),
            )
        )).scalar_one_or_none()

        if existing_ut:
            raise ConflictException(
                detail=f"A user with email {email} already exists in this tenant"
            )

    # Find existing global User or create a new one
    user = None
    if email:
        user = (await db.execute(
            select(User).where(User.email == email, User.is_deleted.isnot(True))
        )).scalar_one_or_none()

    if not user:
        password = body.get("password", "")
        if password and len(password) < 8:
            raise BadRequestException(detail="Password must be at least 8 characters")

        if not body.get("first_name") or not body.get("last_name"):
            raise BadRequestException(detail="first_name and last_name are required")

        user = User(
            email=email or None,
            phone=body.get("phone"),
            password_hash=hash_password(password) if password else None,
            first_name=body["first_name"],
            last_name=body["last_name"],
            middle_name=body.get("middle_name"),
            gender=body.get("gender"),
            is_email_verified=False,
            created_by=current_user.user_id,
        )
        db.add(user)
        await db.flush()

    # Create the tenant membership
    ut = UserTenant(
        user_id=user.id,
        tenant_id=current_user.tenant_id,
        role=role,
        status=UserStatus.PENDING_VERIFICATION,
        clinic_id=body.get("clinic_id") or current_user.clinic_id,
        created_by=current_user.user_id,
    )
    db.add(ut)
    await db.flush()

    # Create doctor profile if role is doctor
    if role == UserRole.DOCTOR:
        from app.models.doctor import Doctor
        if not body.get("registration_number"):
            raise BadRequestException(detail="Doctor registration number is required")

        doctor = Doctor(
            tenant_id=current_user.tenant_id,
            user_id=user.id,
            registration_number=body["registration_number"],
            primary_specialization=body.get("specialization", "General Practice"),
            experience_years=body.get("experience_years", 0),
            consultation_fee=body.get("consultation_fee"),
            default_slot_duration=body.get("slot_duration", 15),
            created_by=current_user.user_id,
        )
        db.add(doctor)

    await db.commit()
    return _success(_user_response(user, ut), message="User created successfully")


@router.get("/")
async def list_users(
    role: Optional[str] = None,
    clinic_id: Optional[str] = None,
    status: Optional[str] = None,
    tenant_id: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "last_name",
    sort_order: str = "asc",
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("users:read")),
):
    """List users. Super admin sees all users (optionally scoped by tenant); tenant users see their tenant's members."""
    from app.models.tenant import Tenant
    direction = asc if sort_order == "asc" else desc

    if current_user.role == "super_admin":
        if tenant_id:
            # Scoped view: users belonging to a specific tenant via UserTenant
            query = (
                select(UserTenant, User)
                .join(User, UserTenant.user_id == User.id)
                .where(
                    UserTenant.tenant_id == tenant_id,
                    UserTenant.is_deleted.isnot(True),
                    User.is_deleted.isnot(True),
                    UserTenant.role != "patient",
                )
            )
            if role:
                query = query.where(UserTenant.role == role)
            if clinic_id:
                query = query.where(UserTenant.clinic_id == clinic_id)
            if status:
                query = query.where(UserTenant.status == status)
            if search:
                term = f"%{search}%"
                query = query.where(
                    User.first_name.ilike(term)
                    | User.last_name.ilike(term)
                    | User.email.ilike(term)
                )
            sort_col_map = {
                "first_name": User.first_name,
                "last_name": User.last_name,
                "email": User.email,
                "role": UserTenant.role,
                "status": UserTenant.status,
                "created_at": UserTenant.created_at,
            }
            sort_col = sort_col_map.get(sort_by, User.last_name)
            query = query.order_by(direction(sort_col), asc(User.first_name))
            total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
            rows = (await db.execute(query.offset((page - 1) * page_size).limit(page_size))).all()
            return _success(
                [_user_response(u, ut) for ut, u in rows],
                meta={"total": total, "page": page, "page_size": page_size},
            )

        # Global view: all users not filtered by tenant (exclude patients)
        patient_user_ids = select(UserTenant.user_id).where(UserTenant.role == "patient", UserTenant.is_deleted.isnot(True))
        query = select(User).where(User.is_deleted.isnot(True), User.id.notin_(patient_user_ids))
        if search:
            term = f"%{search}%"
            query = query.where(
                User.first_name.ilike(term)
                | User.last_name.ilike(term)
                | User.email.ilike(term)
            )
        sort_col_map = {
            "first_name": User.first_name,
            "last_name": User.last_name,
            "email": User.email,
            "created_at": User.created_at,
        }
        sort_col = sort_col_map.get(sort_by, User.last_name)
        query = query.order_by(direction(sort_col), asc(User.first_name))
        total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
        query = query.offset((page - 1) * page_size).limit(page_size)
        users = (await db.execute(query)).scalars().all()
        return _success(
            [
                {
                    "id": u.id,
                    "email": u.email,
                    "phone": u.phone,
                    "first_name": u.first_name,
                    "last_name": u.last_name,
                    "full_name": u.full_name,
                    "role": "super_admin" if u.is_super_admin else None,
                    "status": "active",
                    "clinic_id": None,
                    "is_email_verified": u.is_email_verified,
                    "created_at": u.created_at.isoformat() if u.created_at else None,
                }
                for u in users
            ],
            meta={"total": total, "page": page, "page_size": page_size},
        )

    query = (
        select(UserTenant, User)
        .join(User, UserTenant.user_id == User.id)
        .where(
            UserTenant.tenant_id == current_user.tenant_id,
            UserTenant.is_deleted.isnot(True),
            User.is_deleted.isnot(True),
            UserTenant.role != "patient",
        )
    )

    if role:
        query = query.where(UserTenant.role == role)
    if clinic_id:
        query = query.where(UserTenant.clinic_id == clinic_id)
    if status:
        query = query.where(UserTenant.status == status)
    if search:
        term = f"%{search}%"
        query = query.where(
            User.first_name.ilike(term)
            | User.last_name.ilike(term)
            | User.email.ilike(term)
        )

    sort_col_map = {
        "first_name": User.first_name,
        "last_name": User.last_name,
        "email": User.email,
        "role": UserTenant.role,
        "status": UserTenant.status,
        "created_at": UserTenant.created_at,
    }
    sort_col = sort_col_map.get(sort_by, User.last_name)
    query = query.order_by(direction(sort_col), asc(User.first_name))

    total = (await db.execute(
        select(func.count()).select_from(query.subquery())
    )).scalar()
    query = query.offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(query)).all()

    return _success(
        [_user_response(u, ut) for ut, u in rows],
        meta={"total": total, "page": page, "page_size": page_size},
    )


@router.patch("/{user_id}")
async def update_user(
    user_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("users:update")),
):
    """Update a user's profile or tenant-specific settings."""
    user = (await db.execute(
        select(User).where(User.id == user_id, User.is_deleted.isnot(True))
    )).scalar_one_or_none()
    if not user:
        raise NotFoundException(detail="User not found")

    # Super admin: update global profile / password without needing a tenant membership
    if current_user.role == "super_admin":
        for field in ["first_name", "last_name", "middle_name", "phone", "gender"]:
            if field in body:
                setattr(user, field, body[field])
        if body.get("new_password"):
            if len(body["new_password"]) < 8:
                raise BadRequestException(detail="Password must be at least 8 characters")
            user.password_hash = hash_password(body["new_password"])
        user.updated_by = current_user.user_id
        await db.commit()
        return _success(
            {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "first_name": user.first_name,
                "last_name": user.last_name,
            },
            message="User updated",
        )

    # Tenant-scoped update: require a membership in the caller's tenant
    ut = (await db.execute(
        select(UserTenant).where(
            UserTenant.user_id == user_id,
            UserTenant.tenant_id == current_user.tenant_id,
            UserTenant.is_deleted.isnot(True),
        )
    )).scalar_one_or_none()
    if not ut:
        raise NotFoundException(detail="User not found in this tenant")

    # Update tenant-specific fields on UserTenant
    for field in ["role", "status", "clinic_id"]:
        if field in body:
            setattr(ut, field, body[field])

    # Update global profile fields on User
    for field in ["first_name", "last_name", "middle_name", "phone", "gender", "fcm_token"]:
        if field in body:
            setattr(user, field, body[field])

    if body.get("new_password"):
        if len(body["new_password"]) < 8:
            raise BadRequestException(detail="Password must be at least 8 characters")
        user.password_hash = hash_password(body["new_password"])

    ut.updated_by = current_user.user_id
    user.updated_by = current_user.user_id
    await db.commit()

    return _success(_user_response(user, ut), message="User updated")


@router.delete("/{user_id}")
async def deactivate_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("users:update")),
):
    """Remove a user from the current tenant (soft-delete their membership)."""
    if user_id == current_user.user_id:
        raise BadRequestException(detail="Cannot deactivate your own account")

    ut = (await db.execute(
        select(UserTenant).where(
            UserTenant.user_id == user_id,
            UserTenant.tenant_id == current_user.tenant_id,
            UserTenant.is_deleted.isnot(True),
        )
    )).scalar_one_or_none()
    if not ut:
        raise NotFoundException(detail="User not found in this tenant")

    ut.soft_delete(deleted_by=current_user.user_id)
    ut.status = UserStatus.INACTIVE
    ut.refresh_token_hash = None  # Invalidate session for this tenant
    await db.commit()

    return _success({}, message="User removed from tenant")
