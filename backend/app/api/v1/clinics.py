"""Clinic / branch management endpoints."""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, CurrentUser, require_perm
from app.core.exceptions import BadRequestException, NotFoundException, ConflictException
from app.models.clinic import Clinic, ClinicStatus, ClinicRoom

router = APIRouter()


def _success(data, message="Success", meta=None):
    return {"success": True, "message": message, "data": data, "meta": meta}


def _clinic_response(c: Clinic) -> dict:
    return {
        "id": c.id,
        "tenant_id": c.tenant_id,
        "name": c.name,
        "code": c.code,
        "status": c.status,
        "address_line1": c.address_line1,
        "address_line2": c.address_line2,
        "city": c.city,
        "state": c.state,
        "postal_code": c.postal_code,
        "country": c.country,
        "phone": c.phone,
        "email": c.email,
        "timezone": c.timezone,
        "operating_hours": c.operating_hours,
        "appointment_slot_duration": c.appointment_slot_duration,
        "max_advance_booking_days": c.max_advance_booking_days,
        "cancellation_notice_hours": c.cancellation_notice_hours,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


@router.post("/")
async def create_clinic(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("clinics:create")),
):
    """Create a new clinic / branch."""
    # Determine tenant: super admin must supply tenant_id in body
    if current_user.role == "super_admin":
        tenant_id = body.get("tenant_id")
        if not tenant_id:
            raise BadRequestException(detail="tenant_id is required when creating a clinic as super admin")
    else:
        tenant_id = current_user.tenant_id

    required = ["name", "address_line1", "city", "state", "postal_code"]
    for field in required:
        if not body.get(field):
            raise BadRequestException(detail=f"Missing required field: {field}")

    clinic = Clinic(
        tenant_id=tenant_id,
        name=body["name"],
        code=body.get("code"),
        address_line1=body["address_line1"],
        address_line2=body.get("address_line2"),
        city=body["city"],
        state=body["state"],
        postal_code=body["postal_code"],
        country=body.get("country", "US"),
        timezone=body.get("timezone", "UTC"),
        phone=body.get("phone"),
        email=body.get("email"),
        website=body.get("website"),
        operating_hours=body.get("operating_hours"),
        appointment_slot_duration=body.get("appointment_slot_duration", 15),
        max_advance_booking_days=body.get("max_advance_booking_days", 30),
        cancellation_notice_hours=body.get("cancellation_notice_hours", 24),
        no_show_charge_enabled=body.get("no_show_charge_enabled", False),
        no_show_charge_amount=body.get("no_show_charge_amount"),
        created_by=current_user.user_id,
    )
    db.add(clinic)
    await db.commit()
    return _success(_clinic_response(clinic), message="Clinic created")


@router.get("/")
async def list_clinics(
    tenant_id: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List clinics. Super admin sees all (optionally filtered by tenant_id); others see their tenant."""
    query = select(Clinic).where(Clinic.is_deleted == False)

    if current_user.role == "super_admin":
        if tenant_id:
            query = query.where(Clinic.tenant_id == tenant_id)
    else:
        query = query.where(Clinic.tenant_id == current_user.tenant_id)

    if search:
        term = f"%{search}%"
        query = query.where(Clinic.name.ilike(term) | Clinic.city.ilike(term))

    query = query.order_by(Clinic.name)
    total = (await db.execute(
        select(func.count()).select_from(query.subquery())
    )).scalar()

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)

    return _success(
        [_clinic_response(c) for c in result.scalars()],
        meta={"total": total},
    )


@router.get("/{clinic_id}")
async def get_clinic(
    clinic_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    filters = [Clinic.id == clinic_id, Clinic.is_deleted == False]
    if current_user.role != "super_admin":
        filters.append(Clinic.tenant_id == current_user.tenant_id)

    result = await db.execute(select(Clinic).where(*filters))
    clinic = result.scalar_one_or_none()
    if not clinic:
        raise NotFoundException(detail="Clinic not found")

    data = _clinic_response(clinic)

    # Include rooms
    rooms_result = await db.execute(
        select(ClinicRoom).where(
            ClinicRoom.clinic_id == clinic_id,
            ClinicRoom.is_active == True,
        )
    )
    data["rooms"] = [
        {"id": r.id, "name": r.name, "room_type": r.room_type, "capacity": r.capacity}
        for r in rooms_result.scalars()
    ]
    return _success(data)


@router.patch("/{clinic_id}")
async def update_clinic(
    clinic_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("clinics:update")),
):
    filters = [Clinic.id == clinic_id, Clinic.is_deleted == False]
    if current_user.role != "super_admin":
        filters.append(Clinic.tenant_id == current_user.tenant_id)

    result = await db.execute(select(Clinic).where(*filters))
    clinic = result.scalar_one_or_none()
    if not clinic:
        raise NotFoundException()

    updatable = [
        "name", "phone", "email", "website", "operating_hours",
        "address_line1", "address_line2", "city", "state", "postal_code", "country",
        "appointment_slot_duration", "max_advance_booking_days",
        "cancellation_notice_hours", "no_show_charge_enabled",
        "no_show_charge_amount", "status", "holidays",
    ]
    for field in updatable:
        if field in body:
            setattr(clinic, field, body[field])

    clinic.updated_by = current_user.user_id
    await db.commit()
    return _success(_clinic_response(clinic), message="Clinic updated")
