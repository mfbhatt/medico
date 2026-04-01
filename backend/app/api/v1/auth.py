"""Authentication endpoints — login, register, refresh, OTP, password reset."""
import random
import string
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Request, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    create_otp_token,
)
from app.core.exceptions import (
    UnauthorizedException,
    BadRequestException,
    NotFoundException,
    ConflictException,
    ForbiddenException,
)
from app.core.cache import redis_client, cache_set, cache_get, cache_delete, make_cache_key
from app.core.dependencies import get_current_user, CurrentUser
from app.models.user import User, UserStatus
from app.models.user_tenant import UserTenant
from app.models.patient import Patient
from app.schemas.auth import (
    LoginRequest,
    OTPRequest,
    OTPVerifyRequest,
    RefreshTokenRequest,
    PasswordResetRequest,
    PasswordResetConfirm,
)

router = APIRouter()


def _success(data: dict, message: str = "Success") -> dict:
    return {"success": True, "message": message, "data": data}


SYSTEM_TENANT_ID = "system"


def _issue_tokens(user: User, ut: UserTenant) -> tuple[str, str]:
    """Create access + refresh token pair for a given user+tenant membership."""
    access_token = create_access_token(
        subject=user.id,
        tenant_id=ut.tenant_id,
        role=ut.role,
        extra_claims={"clinic_id": ut.clinic_id},
    )
    refresh_token = create_refresh_token(
        subject=user.id,
        tenant_id=ut.tenant_id,
    )
    return access_token, refresh_token


def _issue_super_admin_tokens(user: User) -> tuple[str, str]:
    """Create access + refresh token pair for a platform super admin (no tenant)."""
    access_token = create_access_token(
        subject=user.id,
        tenant_id=SYSTEM_TENANT_ID,
        role="super_admin",
    )
    refresh_token = create_refresh_token(
        subject=user.id,
        tenant_id=SYSTEM_TENANT_ID,
    )
    return access_token, refresh_token


# ── Staff Login ─────────────────────────────────────────────────
@router.post("/login")
async def login(
    request: Request,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Login for staff users (email + password)."""
    email = (body.email or "").lower().strip()
    password = body.password

    if not email or not password:
        raise BadRequestException(detail="Email and password are required")

    # Find the global User record
    user = (await db.execute(
        select(User).where(User.email == email, User.is_deleted.isnot(True))
    )).scalar_one_or_none()

    if not user or not verify_password(password, user.password_hash or ""):
        raise UnauthorizedException(detail="Invalid email or password")

    # Update global login tracking
    user.failed_login_attempts = 0
    user.last_login_at = datetime.now(timezone.utc)
    user.last_login_ip = request.client.host if request.client else None

    # ── Super admin: platform-level login, no tenant required ──────
    if user.is_super_admin:
        access_token, refresh_token = _issue_super_admin_tokens(user)
        user.refresh_token_hash = hash_password(refresh_token)
        await db.commit()
        return _success(
            {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "full_name": user.full_name,
                    "role": "super_admin",
                    "tenant_id": SYSTEM_TENANT_ID,
                },
            },
            message="Login successful",
        )

    # ── Tenant user: requires at least one UserTenant membership ───
    memberships = (await db.execute(
        select(UserTenant).where(
            UserTenant.user_id == user.id,
            UserTenant.is_deleted.isnot(True),
        ).order_by(UserTenant.created_at)
    )).scalars().all()

    if not memberships:
        raise UnauthorizedException(detail="No tenant access found for this account")

    # If a specific tenant was requested, use it; otherwise pick first active one
    requested_tenant_id = getattr(body, "tenant_id", None)
    if requested_tenant_id:
        ut = next((m for m in memberships if m.tenant_id == requested_tenant_id), None)
        if not ut:
            raise ForbiddenException(detail="You do not have access to this tenant")
    else:
        ut = next((m for m in memberships if m.status == UserStatus.ACTIVE), memberships[0])

    # Status check for the selected membership
    if ut.status == UserStatus.LOCKED:
        raise UnauthorizedException(
            detail="Account is locked due to multiple failed attempts. Contact support."
        )
    if ut.status == UserStatus.INACTIVE:
        raise UnauthorizedException(detail="Account is inactive")
    if ut.status == UserStatus.PENDING_VERIFICATION:
        raise UnauthorizedException(detail="Please verify your email first")

    access_token, refresh_token = _issue_tokens(user, ut)
    ut.refresh_token_hash = hash_password(refresh_token)
    await db.commit()

    return _success(
        {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "role": ut.role,
                "tenant_id": ut.tenant_id,
            },
        },
        message="Login successful",
    )


# ── Patient OTP Login ────────────────────────────────────────────
@router.post("/otp/send")
async def send_otp(
    body: OTPRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Send OTP to patient's phone for login/registration."""
    phone = (body.phone or "").strip()
    if not phone:
        raise BadRequestException(detail="Phone number is required")

    otp = "".join(random.choices(string.digits, k=6))
    otp_key = make_cache_key("otp", phone)
    await cache_set(otp_key, {"otp": otp, "attempts": 0}, ttl=600)
    background_tasks.add_task(_send_otp_sms, phone, otp)

    return _success(
        {"phone": phone, "expires_in_seconds": 600},
        message="OTP sent successfully",
    )


@router.post("/otp/verify")
async def verify_otp(
    body: OTPVerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """Verify OTP and login/register patient."""
    phone = (body.phone or "").strip()
    otp = body.otp.strip()
    tenant_id = getattr(body, "tenant_id", None)

    if not phone or not otp:
        raise BadRequestException(detail="Phone and OTP are required")

    otp_key = make_cache_key("otp", phone)
    stored = await cache_get(otp_key)
    if not stored:
        raise UnauthorizedException(detail="OTP expired or not found. Please request a new one.")

    if stored.get("attempts", 0) >= 3:
        await cache_delete(otp_key)
        raise UnauthorizedException(detail="Too many failed attempts. Please request a new OTP.")

    if stored["otp"] != otp:
        stored["attempts"] = stored.get("attempts", 0) + 1
        await cache_set(otp_key, stored, ttl=600)
        raise UnauthorizedException(detail="Invalid OTP")

    await cache_delete(otp_key)

    # Find or create the global User by phone
    user = (await db.execute(
        select(User).where(User.phone == phone, User.is_deleted.isnot(True))
    )).scalar_one_or_none()

    if not user:
        user = User(
            phone=phone,
            first_name="Patient",
            last_name="",
            is_phone_verified=True,
        )
        db.add(user)
        await db.flush()

    user.is_phone_verified = True
    user.last_login_at = datetime.now(timezone.utc)

    # Find or create the UserTenant record for this tenant
    ut = None
    from app.models.user import UserRole
    if tenant_id:
        ut = (await db.execute(
            select(UserTenant).where(
                UserTenant.user_id == user.id,
                UserTenant.tenant_id == tenant_id,
                UserTenant.is_deleted.isnot(True),
            )
        )).scalar_one_or_none()

        if not ut:
            ut = UserTenant(
                user_id=user.id,
                tenant_id=tenant_id,
                role=UserRole.PATIENT,
                status=UserStatus.ACTIVE,
            )
            db.add(ut)
            await db.flush()
        else:
            ut.status = UserStatus.ACTIVE
    else:
        # No tenant_id provided — auto-select from existing memberships
        existing_uts = (await db.execute(
            select(UserTenant).where(
                UserTenant.user_id == user.id,
                UserTenant.is_deleted.isnot(True),
            )
        )).scalars().all()

        if existing_uts:
            ut = next((m for m in existing_uts if m.status == UserStatus.ACTIVE), existing_uts[0])
            ut.status = UserStatus.ACTIVE
        else:
            # Brand-new user — auto-assign to first active non-system tenant
            from app.models.tenant import Tenant
            first_tenant = (await db.execute(
                select(Tenant).where(
                    Tenant.id != SYSTEM_TENANT_ID,
                    Tenant.is_active == True,
                    Tenant.is_deleted.isnot(True),
                ).order_by(Tenant.created_at).limit(1)
            )).scalar_one_or_none()

            if first_tenant:
                ut = UserTenant(
                    user_id=user.id,
                    tenant_id=first_tenant.id,
                    role=UserRole.PATIENT,
                    status=UserStatus.ACTIVE,
                )
                db.add(ut)
                await db.flush()

    await db.commit()

    if not ut:
        return _success(
            {
                "access_token": None,
                "refresh_token": None,
                "is_new_user": not bool(user.first_name and user.first_name != "Patient"),
                "user": {"id": user.id, "phone": user.phone},
            }
        )

    access_token, refresh_token = _issue_tokens(user, ut)

    return _success(
        {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "is_new_user": not bool(user.first_name and user.first_name != "Patient"),
            "user": {
                "id": user.id,
                "phone": user.phone,
                "role": ut.role,
                "tenant_id": ut.tenant_id,
            },
        }
    )


# ── Token Refresh ────────────────────────────────────────────────
@router.post("/refresh")
async def refresh_token(
    body: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """Exchange a refresh token for a new access token."""
    refresh_tok = body.refresh_token
    if not refresh_tok:
        raise BadRequestException(detail="Refresh token is required")

    payload = decode_token(refresh_tok)
    if payload.get("type") != "refresh":
        raise UnauthorizedException(detail="Invalid token type")

    user_id = payload.get("sub")
    tenant_id = payload.get("tenant_id")

    user = (await db.execute(
        select(User).where(User.id == user_id, User.is_deleted.isnot(True))
    )).scalar_one_or_none()

    if not user:
        raise UnauthorizedException(detail="Invalid refresh token")

    # ── Super admin: validate against User.refresh_token_hash ──────
    if tenant_id == SYSTEM_TENANT_ID:
        if not user.refresh_token_hash or not verify_password(refresh_tok, user.refresh_token_hash):
            raise UnauthorizedException(detail="Refresh token mismatch")
        new_access, new_refresh = _issue_super_admin_tokens(user)
        user.refresh_token_hash = hash_password(new_refresh)
        await db.commit()
        return _success({"access_token": new_access, "refresh_token": new_refresh})

    # ── Tenant user: validate against UserTenant.refresh_token_hash ─
    ut = (await db.execute(
        select(UserTenant).where(
            UserTenant.user_id == user_id,
            UserTenant.tenant_id == tenant_id,
            UserTenant.is_deleted.isnot(True),
        )
    )).scalar_one_or_none()

    if not ut or not ut.refresh_token_hash:
        raise UnauthorizedException(detail="Invalid refresh token")

    if not verify_password(refresh_tok, ut.refresh_token_hash):
        raise UnauthorizedException(detail="Refresh token mismatch")

    new_access, new_refresh = _issue_tokens(user, ut)
    ut.refresh_token_hash = hash_password(new_refresh)
    await db.commit()

    return _success({"access_token": new_access, "refresh_token": new_refresh})


# ── Logout ───────────────────────────────────────────────────────
@router.post("/logout")
async def logout(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Invalidate the refresh token for the current session."""
    if current_user.tenant_id == SYSTEM_TENANT_ID:
        # Super admin: clear platform-level token
        user = (await db.execute(
            select(User).where(User.id == current_user.user_id)
        )).scalar_one_or_none()
        if user:
            user.refresh_token_hash = None
            await db.commit()
    else:
        ut = (await db.execute(
            select(UserTenant).where(
                UserTenant.user_id == current_user.user_id,
                UserTenant.tenant_id == current_user.tenant_id,
                UserTenant.is_deleted.isnot(True),
            )
        )).scalar_one_or_none()
        if ut:
            ut.refresh_token_hash = None
            await db.commit()

    return _success({}, message="Logged out successfully")


# ── Password Reset ───────────────────────────────────────────────
@router.post("/forgot-password")
async def forgot_password(
    body: PasswordResetRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Send password reset link via email."""
    email = body.email.lower().strip()

    user = (await db.execute(
        select(User).where(User.email == email, User.is_deleted.isnot(True))
    )).scalar_one_or_none()

    if user:
        import uuid
        reset_token = str(uuid.uuid4())
        key = make_cache_key("pwd_reset", reset_token)
        await cache_set(key, {"user_id": user.id}, ttl=3600)
        background_tasks.add_task(_send_password_reset_email, user.email, reset_token)

    return _success({}, message="If the email exists, a reset link has been sent")


@router.post("/reset-password")
async def reset_password(
    body: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db),
):
    """Reset password using token from email."""
    key = make_cache_key("pwd_reset", body.token)
    stored = await cache_get(key)
    if not stored:
        raise BadRequestException(detail="Invalid or expired reset token")

    user = (await db.execute(
        select(User).where(User.id == stored["user_id"], User.is_deleted.isnot(True))
    )).scalar_one_or_none()
    if not user:
        raise NotFoundException(detail="User not found")

    user.password_hash = hash_password(body.new_password)
    # Invalidate all tenant sessions
    all_uts = (await db.execute(
        select(UserTenant).where(
            UserTenant.user_id == user.id,
            UserTenant.is_deleted.isnot(True),
        )
    )).scalars().all()
    for ut in all_uts:
        ut.refresh_token_hash = None

    await db.commit()
    await cache_delete(key)

    return _success({}, message="Password reset successfully")


# ── Multi-tenant: list tenants & switch ─────────────────────────
@router.get("/my-tenants")
async def list_my_tenants(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Return all tenants the current user belongs to."""
    from app.models.tenant import Tenant

    # Super admin is a platform-level user — no tenant memberships
    if current_user.tenant_id == SYSTEM_TENANT_ID:
        return _success([])

    memberships = (await db.execute(
        select(UserTenant).where(
            UserTenant.user_id == current_user.user_id,
            UserTenant.is_deleted.isnot(True),
        )
    )).scalars().all()

    tenant_ids = [m.tenant_id for m in memberships]
    tenants_map = {
        t.id: t
        for t in (await db.execute(
            select(Tenant).where(Tenant.id.in_(tenant_ids))
        )).scalars().all()
    }

    return _success([
        {
            "tenant_id": m.tenant_id,
            "tenant_name": tenants_map[m.tenant_id].name if m.tenant_id in tenants_map else "Unknown",
            "tenant_slug": tenants_map[m.tenant_id].slug if m.tenant_id in tenants_map else "",
            "role": m.role,
            "is_current": m.tenant_id == current_user.tenant_id,
        }
        for m in memberships
        if m.tenant_id in tenants_map
    ])


@router.post("/switch-tenant")
async def switch_tenant(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Issue new tokens scoped to a different tenant the user belongs to."""
    if current_user.tenant_id == SYSTEM_TENANT_ID:
        raise BadRequestException(detail="Super admins manage tenants from the admin panel")

    target_tenant_id = body.get("tenant_id")
    if not target_tenant_id:
        raise BadRequestException(detail="tenant_id is required")

    if target_tenant_id == current_user.tenant_id:
        raise BadRequestException(detail="Already in this tenant")

    # Find the user's membership in the target tenant
    ut = (await db.execute(
        select(UserTenant).where(
            UserTenant.user_id == current_user.user_id,
            UserTenant.tenant_id == target_tenant_id,
            UserTenant.is_deleted.isnot(True),
        )
    )).scalar_one_or_none()

    if not ut:
        raise ForbiddenException(detail="You do not have access to this tenant")

    if ut.status != UserStatus.ACTIVE:
        raise UnauthorizedException(detail="Your account in this tenant is not active")

    user = (await db.execute(
        select(User).where(User.id == current_user.user_id, User.is_deleted.isnot(True))
    )).scalar_one_or_none()
    if not user:
        raise UnauthorizedException(detail="User not found")

    access_token, refresh_token = _issue_tokens(user, ut)
    ut.refresh_token_hash = hash_password(refresh_token)
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    return _success(
        {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "role": ut.role,
                "tenant_id": ut.tenant_id,
            },
        },
        message="Switched tenant successfully",
    )


# ── Social Login ─────────────────────────────────────────────────
@router.post("/social")
async def social_login(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """
    Verify a social provider token and issue JWT tokens.
    Body: { provider: "google"|"facebook", token: str, tenant_id?: str }
    """
    import httpx

    provider = (body.get("provider") or "").lower()
    token = body.get("token", "").strip()
    tenant_id = body.get("tenant_id")

    if not provider or not token:
        raise BadRequestException(detail="provider and token are required")
    if provider not in ("google", "facebook"):
        raise BadRequestException(detail="Unsupported provider. Use 'google' or 'facebook'")

    # ── Verify token with the provider and extract profile ─────────
    email: Optional[str] = None
    first_name = ""
    last_name = ""
    provider_user_id = ""

    async with httpx.AsyncClient(timeout=10) as client:
        if provider == "google":
            if not settings.GOOGLE_CLIENT_ID:
                raise BadRequestException(detail="Google login is not configured")
            # Supports both access_token (implicit flow) and id_token flows
            token_type = body.get("token_type", "access_token")
            if token_type == "id_token":
                resp = await client.get(
                    "https://oauth2.googleapis.com/tokeninfo",
                    params={"id_token": token},
                )
                if resp.status_code != 200:
                    raise UnauthorizedException(detail="Invalid Google ID token")
                info = resp.json()
                if info.get("aud") != settings.GOOGLE_CLIENT_ID:
                    raise UnauthorizedException(detail="Google token audience mismatch")
            else:
                # Access token — fetch user info from Google
                resp = await client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {token}"},
                )
                if resp.status_code != 200:
                    raise UnauthorizedException(detail="Invalid Google access token")
                info = resp.json()
            email = (info.get("email") or "").lower().strip() or None
            first_name = info.get("given_name", "")
            last_name = info.get("family_name", "")
            provider_user_id = info.get("sub", "")

        elif provider == "facebook":
            if not settings.FACEBOOK_APP_ID or not settings.FACEBOOK_APP_SECRET:
                raise BadRequestException(detail="Facebook login is not configured")
            # Verify the access token is genuine
            app_token = f"{settings.FACEBOOK_APP_ID}|{settings.FACEBOOK_APP_SECRET}"
            debug_resp = await client.get(
                "https://graph.facebook.com/debug_token",
                params={"input_token": token, "access_token": app_token},
            )
            if debug_resp.status_code != 200:
                raise UnauthorizedException(detail="Invalid Facebook token")
            debug_data = debug_resp.json().get("data", {})
            if not debug_data.get("is_valid") or debug_data.get("app_id") != settings.FACEBOOK_APP_ID:
                raise UnauthorizedException(detail="Facebook token validation failed")
            # Fetch user profile
            profile_resp = await client.get(
                "https://graph.facebook.com/me",
                params={"fields": "id,email,first_name,last_name", "access_token": token},
            )
            if profile_resp.status_code != 200:
                raise UnauthorizedException(detail="Failed to fetch Facebook profile")
            profile = profile_resp.json()
            email = (profile.get("email") or "").lower().strip() or None
            first_name = profile.get("first_name", "")
            last_name = profile.get("last_name", "")
            provider_user_id = profile.get("id", "")

    if not email:
        raise BadRequestException(
            detail="Your social account does not have a verified email address. Please use email/password login."
        )

    # ── Find or create the global User record ─────────────────────
    user = (await db.execute(
        select(User).where(User.email == email, User.is_deleted.isnot(True))
    )).scalar_one_or_none()

    if not user:
        user = User(
            email=email,
            first_name=first_name or "User",
            last_name=last_name,
            is_email_verified=True,
        )
        db.add(user)
        await db.flush()
    else:
        # Update name from provider if not already set
        if not user.first_name and first_name:
            user.first_name = first_name
        if not user.last_name and last_name:
            user.last_name = last_name

    user.last_login_at = datetime.now(timezone.utc)

    # ── Super admin: no tenant membership needed ───────────────────
    if user.is_super_admin:
        access_token, refresh_token = _issue_super_admin_tokens(user)
        user.refresh_token_hash = hash_password(refresh_token)
        await db.commit()
        return _success({
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "is_new_user": False,
            "user": {
                "id": user.id, "email": user.email,
                "full_name": user.full_name, "role": "super_admin",
                "tenant_id": SYSTEM_TENANT_ID,
            },
        }, message="Login successful")

    # ── Tenant user: find the right membership ─────────────────────
    memberships = (await db.execute(
        select(UserTenant).where(
            UserTenant.user_id == user.id,
            UserTenant.is_deleted.isnot(True),
        )
    )).scalars().all()

    if not memberships:
        await db.commit()
        return _success({
            "access_token": None, "refresh_token": None,
            "is_new_user": True,
            "user": {"id": user.id, "email": user.email, "full_name": user.full_name},
        }, message="Account created. Please contact your administrator to activate access.")

    if tenant_id:
        ut = next((m for m in memberships if m.tenant_id == tenant_id), None)
        if not ut:
            raise ForbiddenException(detail="You do not have access to this tenant")
    else:
        ut = next((m for m in memberships if m.status == UserStatus.ACTIVE), memberships[0])

    if ut.status not in (UserStatus.ACTIVE,):
        raise UnauthorizedException(detail=f"Account status: {ut.status}. Contact your administrator.")

    access_token, refresh_token = _issue_tokens(user, ut)
    ut.refresh_token_hash = hash_password(refresh_token)
    await db.commit()

    return _success({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "is_new_user": False,
        "user": {
            "id": user.id, "email": user.email,
            "full_name": user.full_name, "role": ut.role,
            "tenant_id": ut.tenant_id,
        },
    }, message="Login successful")


# ── Internal helpers ─────────────────────────────────────────────
async def _send_otp_sms(phone: str, otp: str) -> None:
    try:
        from app.services.notification_service import send_sms
        await send_sms(phone, f"Your ClinicManagement OTP is: {otp}. Valid for 10 minutes.")
    except Exception:
        pass


async def _send_password_reset_email(email: str, token: str) -> None:
    try:
        from app.services.notification_service import send_email
        reset_link = f"https://app.clinicmanagement.com/reset-password?token={token}"
        await send_email(
            to=email,
            subject="Password Reset Request",
            body=f"Click here to reset your password: {reset_link}\n\nExpires in 1 hour.",
        )
    except Exception:
        pass
