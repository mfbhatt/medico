"""Platform-level settings endpoints (super admin manages global defaults)."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, CurrentUser, require_roles
from app.models.platform_config import PlatformConfig

router = APIRouter()

PLATFORM_ID = "default"

# Keys that tenant admins are allowed to override
OVERRIDABLE_KEYS = {
    "enabled_countries",
    "language",
    "currency",
    "appointment_duration",
    "cancelation_deadline",
    "email_notifications",
    "sms_notifications",
    "two_factor_auth",
}


async def _get_or_create(db: AsyncSession) -> PlatformConfig:
    row = (await db.execute(
        select(PlatformConfig).where(PlatformConfig.id == PLATFORM_ID)
    )).scalar_one_or_none()
    if not row:
        row = PlatformConfig(id=PLATFORM_ID, settings={})
        db.add(row)
        await db.flush()
    return row


def _success(data, message="Success"):
    return {"success": True, "message": message, "data": data}


@router.get("/platform")
async def get_platform_settings(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Return platform-level default settings. Readable by all authenticated users."""
    row = await _get_or_create(db)
    await db.commit()
    return _success(row.settings)


@router.patch("/platform")
async def update_platform_settings(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_roles("super_admin")),
):
    """Update platform-level default settings. Super admin only."""
    row = await _get_or_create(db)
    row.settings = {**(row.settings or {}), **body}
    await db.commit()
    return _success(row.settings, message="Platform settings updated")
