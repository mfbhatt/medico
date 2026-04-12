"""Tenant management endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, CurrentUser, require_perm, require_roles
from app.core.exceptions import BadRequestException, NotFoundException, ConflictException, UnauthorizedException
from app.models.tenant import Tenant, TenantStatus, SubscriptionPlan

router = APIRouter()


def _success(data, message="Success", meta=None):
    return {"success": True, "message": message, "data": data, "meta": meta}


VALID_MODULES = {
    "appointments", "patients", "doctors", "medical_records",
    "prescriptions", "lab", "billing", "pharmacy", "accounting", "analytics",
}


def _tenant_response(t: Tenant, clinics_count: int = 0, users_count: int = 0) -> dict:
    settings = t.settings or {}
    return {
        "id": t.id,
        "name": t.name,
        "slug": t.slug,
        "status": t.status,
        "plan": t.subscription_plan,
        "primary_email": t.primary_email,
        "primary_phone": t.primary_phone,
        "country": t.country,
        "timezone": t.timezone,
        "max_clinics": t.max_clinics,
        "max_doctors": t.max_doctors,
        "max_patients": t.max_patients,
        "clinics_count": clinics_count,
        "users_count": users_count,
        "admin_user_id": settings.get("_admin_user_id"),
        "admin_name": settings.get("_admin_name"),
        "admin_email": settings.get("_admin_email"),
        "features": t.features or {},
        "settings": {k: v for k, v in settings.items() if not k.startswith("_")},
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


@router.post("/onboard")
async def onboard_tenant(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """
    Onboard a new clinic group (tenant).
    This endpoint is public — called during signup.
    """
    import re as _re, uuid as _uuid
    from app.models.user import User, UserRole, UserStatus
    from app.models.user_tenant import UserTenant
    from app.core.security import hash_password

    if not body.get("name"):
        raise BadRequestException(detail="Missing required field: name")
    if not body.get("primary_email"):
        raise BadRequestException(detail="Missing required field: primary_email")

    # Auto-generate slug from name if not provided; ensure uniqueness
    raw_slug = body.get("slug") or _re.sub(r"[^a-z0-9]+", "-", body["name"].lower().strip()).strip("-")
    slug = raw_slug.lower().strip()
    base_slug, suffix = slug, 1
    while (await db.execute(select(Tenant).where(Tenant.slug == slug))).scalar_one_or_none():
        slug = f"{base_slug}-{suffix}"
        suffix += 1

    plan_map = {
        "basic": SubscriptionPlan.BASIC,
        "professional": SubscriptionPlan.PROFESSIONAL,
        "enterprise": SubscriptionPlan.ENTERPRISE,
    }
    plan = plan_map.get(body.get("plan", "basic"), SubscriptionPlan.BASIC)

    tenant = Tenant(
        name=body["name"],
        slug=slug,
        primary_email=body["primary_email"].lower().strip(),
        primary_phone=body.get("primary_phone"),
        country=body.get("country", "US"),
        timezone=body.get("timezone", "UTC"),
        status=TenantStatus.TRIAL,
        subscription_plan=plan,
    )
    db.add(tenant)
    await db.flush()

    # Admin user: use admin_email if provided, otherwise fall back to primary_email
    admin_email = (body.get("admin_email") or body["primary_email"]).lower().strip()
    admin_password = body.get("admin_password") or str(_uuid.uuid4())[:12]

    # Find or create the global User
    admin_user = (await db.execute(
        select(User).where(User.email == admin_email, User.is_deleted.isnot(True))
    )).scalar_one_or_none()

    if not admin_user:
        admin_user = User(
            email=admin_email,
            password_hash=hash_password(admin_password),
            first_name=body.get("admin_first_name") or "Admin",
            last_name=body.get("admin_last_name") or tenant.name,
            is_email_verified=True,
        )
        db.add(admin_user)
        await db.flush()
        created_password = admin_password
    else:
        # User exists globally — just add them to this tenant; don't change their password
        created_password = None

    # Ensure they don't already have a membership in this tenant
    existing_ut = (await db.execute(
        select(UserTenant).where(
            UserTenant.user_id == admin_user.id,
            UserTenant.tenant_id == tenant.id,
            UserTenant.is_deleted.isnot(True),
        )
    )).scalar_one_or_none()

    if existing_ut:
        raise ConflictException(
            detail=f"A user with email {admin_email} already has access to this tenant"
        )

    admin_ut = UserTenant(
        user_id=admin_user.id,
        tenant_id=tenant.id,
        role=UserRole.TENANT_ADMIN,
        status=UserStatus.ACTIVE,
    )
    db.add(admin_ut)
    await db.flush()

    # Store admin reference on tenant for display purposes
    admin_first = body.get("admin_first_name") or admin_user.first_name
    admin_last = body.get("admin_last_name") or admin_user.last_name
    tenant.settings = {
        **(tenant.settings or {}),
        "_admin_user_id": admin_user.id,
        "_admin_name": f"{admin_first} {admin_last}".strip(),
        "_admin_email": admin_email,
    }
    await db.commit()

    return _success(
        {
            "tenant": _tenant_response(tenant),
            "admin_user_id": admin_user.id,
            "admin_email": admin_email,
            "temporary_password": created_password,
        },
        message="Tenant onboarded successfully.",
    )


@router.get("/")
async def list_tenants(
    page: int = 1,
    page_size: int = 20,
    search: str = "",
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_roles("super_admin")),
):
    """List all tenants (super admin only)."""
    from app.models.clinic import Clinic
    from app.models.user_tenant import UserTenant

    query = select(Tenant)
    if search:
        term = f"%{search}%"
        query = query.where(Tenant.name.ilike(term) | Tenant.primary_email.ilike(term))

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    result = await db.execute(
        query.order_by(Tenant.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )
    tenants = result.scalars().all()

    tenant_ids = [t.id for t in tenants]
    clinic_counts: dict = {}
    user_counts: dict = {}
    if tenant_ids:
        rows = (await db.execute(
            select(Clinic.tenant_id, func.count(Clinic.id))
            .where(Clinic.tenant_id.in_(tenant_ids))
            .group_by(Clinic.tenant_id)
        )).all()
        clinic_counts = {r[0]: r[1] for r in rows}

        rows = (await db.execute(
            select(UserTenant.tenant_id, func.count(UserTenant.id))
            .where(
                UserTenant.tenant_id.in_(tenant_ids),
                UserTenant.is_deleted.isnot(True),
            )
            .group_by(UserTenant.tenant_id)
        )).all()
        user_counts = {r[0]: r[1] for r in rows}

    return _success(
        [_tenant_response(t, clinic_counts.get(t.id, 0), user_counts.get(t.id, 0)) for t in tenants],
        meta={"total": total, "page": page, "page_size": page_size},
    )


@router.get("/me")
async def get_my_tenant(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get current tenant details with settings merged from platform defaults. Super admin has no tenant context."""
    from app.models.platform_config import PlatformConfig

    platform_row = (await db.execute(
        select(PlatformConfig).where(PlatformConfig.id == "default")
    )).scalar_one_or_none()
    platform_settings: dict = platform_row.settings if platform_row else {}

    if current_user.role == "super_admin":
        return _success(None, message="Platform admin has no tenant context")

    tenant = (await db.execute(
        select(Tenant).where(Tenant.id == current_user.tenant_id)
    )).scalar_one_or_none()
    if not tenant:
        raise NotFoundException(detail="Tenant not found")

    from app.models.user_tenant import UserTenant
    ut = (await db.execute(
        select(UserTenant).where(
            UserTenant.user_id == current_user.user_id,
            UserTenant.tenant_id == current_user.tenant_id,
            UserTenant.is_deleted.isnot(True),
        )
    )).scalar_one_or_none()

    data = _tenant_response(tenant)
    # Merge: platform defaults first, then tenant overrides on top
    data["settings"] = {**platform_settings, **(tenant.settings or {})}
    data["platform_settings"] = platform_settings
    # Per-user module access overrides (None means inherit all tenant-enabled modules)
    data["user_features"] = ut.features if ut and ut.features else {}
    return _success(data)


@router.patch("/me")
async def update_my_tenant(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("tenants:update")),
):
    """Update current tenant settings (name, contact info, timezone, preferences)."""
    if current_user.role == "super_admin":
        raise BadRequestException(detail="Use PATCH /tenants/{tenant_id} to update a specific tenant")

    tenant = (await db.execute(
        select(Tenant).where(Tenant.id == current_user.tenant_id)
    )).scalar_one_or_none()
    if not tenant:
        raise NotFoundException(detail="Tenant not found")

    for field in ["name", "primary_email", "primary_phone", "timezone", "country"]:
        if field in body:
            setattr(tenant, field, body[field])
    if "settings" in body:
        tenant.settings = {**(tenant.settings or {}), **body["settings"]}

    await db.commit()
    return _success(_tenant_response(tenant), message="Settings saved")


@router.patch("/{tenant_id}")
async def update_tenant(
    tenant_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_roles("super_admin")),
):
    """Update any tenant (super admin only)."""
    tenant = (await db.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one_or_none()
    if not tenant:
        raise NotFoundException(detail="Tenant not found")

    for field in ["name", "primary_email", "primary_phone", "country", "timezone"]:
        if field in body:
            setattr(tenant, field, body[field])
    if "plan" in body:
        plan_map = {
            "basic": SubscriptionPlan.BASIC,
            "professional": SubscriptionPlan.PROFESSIONAL,
            "enterprise": SubscriptionPlan.ENTERPRISE,
        }
        tenant.subscription_plan = plan_map.get(body["plan"], tenant.subscription_plan)
    if "status" in body:
        status_map = {s.value: s for s in TenantStatus}
        if body["status"] in status_map:
            tenant.status = status_map[body["status"]]

    await db.commit()
    return _success(_tenant_response(tenant), message="Tenant updated")


@router.get("/{tenant_id}/users")
async def list_tenant_users(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_roles("super_admin")),
):
    """List all users for a specific tenant (super admin only)."""
    from app.models.user import User
    from app.models.user_tenant import UserTenant

    rows = (await db.execute(
        select(UserTenant, User)
        .join(User, UserTenant.user_id == User.id)
        .where(
            UserTenant.tenant_id == tenant_id,
            UserTenant.is_deleted.isnot(True),
            User.is_deleted.isnot(True),
        )
        .order_by(UserTenant.role, User.last_name, User.first_name)
    )).all()

    return _success([
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "role": ut.role,
            "status": ut.status,
        }
        for ut, u in rows
    ])


@router.patch("/{tenant_id}/admin")
async def change_tenant_admin(
    tenant_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_roles("super_admin")),
):
    """Promote a user to tenant_admin (super admin only)."""
    from app.models.user import User, UserRole
    from app.models.user_tenant import UserTenant

    new_admin_user_id = body.get("user_id")
    if not new_admin_user_id:
        raise BadRequestException(detail="user_id is required")

    # Verify the user exists globally
    new_admin = (await db.execute(
        select(User).where(User.id == new_admin_user_id, User.is_deleted.isnot(True))
    )).scalar_one_or_none()
    if not new_admin:
        raise NotFoundException(detail="User not found")

    # Load or create the UserTenant record for this user+tenant
    ut = (await db.execute(
        select(UserTenant).where(
            UserTenant.user_id == new_admin_user_id,
            UserTenant.tenant_id == tenant_id,
            UserTenant.is_deleted.isnot(True),
        )
    )).scalar_one_or_none()

    if not ut:
        # User doesn't have a membership yet — create one
        ut = UserTenant(
            user_id=new_admin_user_id,
            tenant_id=tenant_id,
            role=UserRole.TENANT_ADMIN,
            status="active",
        )
        db.add(ut)
    else:
        ut.role = UserRole.TENANT_ADMIN

    # Load the tenant to update the admin reference
    tenant = (await db.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one_or_none()
    if not tenant:
        raise NotFoundException(detail="Tenant not found")

    tenant.settings = {
        **(tenant.settings or {}),
        "_admin_user_id": new_admin.id,
        "_admin_name": new_admin.full_name,
        "_admin_email": new_admin.email,
    }
    await db.commit()

    return _success(
        {"user_id": new_admin.id, "email": new_admin.email, "full_name": new_admin.full_name},
        message="Tenant admin updated",
    )


@router.patch("/{tenant_id}/suspend")
async def suspend_tenant(
    tenant_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_roles("super_admin")),
):
    """Suspend a tenant (super admin only)."""
    tenant = (await db.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one_or_none()
    if not tenant:
        raise NotFoundException(detail="Tenant not found")
    tenant.status = TenantStatus.SUSPENDED
    await db.commit()
    return _success(_tenant_response(tenant), message="Tenant suspended")


@router.patch("/{tenant_id}/modules")
async def update_tenant_modules(
    tenant_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_roles("super_admin")),
):
    """
    Enable or disable modules for a tenant (super admin only).
    Body: { "modules": { "pharmacy": true, "lab": false, ... } }
    Unknown module keys are silently ignored.
    """
    tenant = (await db.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one_or_none()
    if not tenant:
        raise NotFoundException(detail="Tenant not found")

    modules: dict = body.get("modules", {})
    current_features = dict(tenant.features or {})
    for key, value in modules.items():
        if key in VALID_MODULES:
            current_features[key] = bool(value)

    tenant.features = current_features
    await db.commit()
    return _success({"features": tenant.features}, message="Module access updated")
