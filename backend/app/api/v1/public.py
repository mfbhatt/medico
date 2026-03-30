"""Public-facing endpoints — no authentication required."""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import NotFoundException
from app.models.clinic import Clinic, ClinicStatus
from app.models.doctor import Doctor, DoctorClinicAssignment
from app.models.tenant import Tenant
from app.models.user import User

router = APIRouter()


def _success(data, message="Success"):
    return {"success": True, "message": message, "data": data}


@router.get("/clinics")
async def list_public_clinics(
    city: Optional[str] = None,
    search: Optional[str] = None,
    specialty: Optional[str] = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List all active clinics for public discovery."""
    filters = [
        Clinic.status == ClinicStatus.ACTIVE,
        Clinic.is_deleted == False,
    ]
    if city:
        filters.append(Clinic.city.ilike(f"%{city}%"))
    if search:
        filters.append(
            or_(
                Clinic.name.ilike(f"%{search}%"),
                Clinic.city.ilike(f"%{search}%"),
                Clinic.state.ilike(f"%{search}%"),
            )
        )

    total = (await db.execute(
        select(func.count(Clinic.id)).where(*filters)
    )).scalar()

    result = await db.execute(
        select(Clinic).where(*filters)
        .order_by(Clinic.name)
        .limit(limit)
        .offset(offset)
    )
    clinics = result.scalars().all()

    return _success({
        "clinics": [
            {
                "id": c.id,
                "name": c.name,
                "city": c.city,
                "state": c.state,
                "address": c.address_line1,
                "phone": c.phone,
                "email": c.email,
                "website": c.website,
                "services": c.services or [],
                "operating_hours": c.operating_hours,
                "logo_url": c.logo_url,
                "appointment_slot_duration": c.appointment_slot_duration,
                "timezone": c.timezone,
            }
            for c in clinics
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    })


@router.get("/clinics/{clinic_id}")
async def get_public_clinic(
    clinic_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get public clinic details with available doctors."""
    result = await db.execute(
        select(Clinic).where(
            Clinic.id == clinic_id,
            Clinic.status == ClinicStatus.ACTIVE,
            Clinic.is_deleted == False,
        )
    )
    clinic = result.scalar_one_or_none()
    if not clinic:
        raise NotFoundException("Clinic not found")

    # Fetch doctors assigned to this clinic
    docs_result = await db.execute(
        select(Doctor, User)
        .join(User, Doctor.user_id == User.id)
        .join(DoctorClinicAssignment, DoctorClinicAssignment.doctor_id == Doctor.id)
        .where(
            DoctorClinicAssignment.clinic_id == clinic_id,
            DoctorClinicAssignment.is_active == True,
            Doctor.is_deleted == False,
            User.is_deleted == False,
        )
        .order_by(Doctor.primary_specialization)
    )
    docs = docs_result.all()

    return _success({
        "clinic": {
            "id": clinic.id,
            "name": clinic.name,
            "city": clinic.city,
            "state": clinic.state,
            "address_line1": clinic.address_line1,
            "address_line2": clinic.address_line2,
            "phone": clinic.phone,
            "email": clinic.email,
            "website": clinic.website,
            "services": clinic.services or [],
            "operating_hours": clinic.operating_hours,
            "logo_url": clinic.logo_url,
            "appointment_slot_duration": clinic.appointment_slot_duration,
            "max_advance_booking_days": clinic.max_advance_booking_days,
            "timezone": clinic.timezone,
        },
        "doctors": [
            {
                "id": doc.Doctor.id,
                "name": f"{doc.User.first_name} {doc.User.last_name}",
                "specialization": doc.Doctor.primary_specialization,
                "experience_years": doc.Doctor.experience_years,
                "consultation_fee": doc.Doctor.consultation_fee,
                "biography": doc.Doctor.biography,
                "languages": doc.Doctor.languages or [],
                "average_rating": doc.Doctor.average_rating,
                "total_ratings": doc.Doctor.total_ratings,
                "is_accepting_new_patients": doc.Doctor.is_accepting_new_patients,
                "telemedicine_enabled": doc.Doctor.telemedicine_enabled,
                "photo_url": doc.User.profile_photo_url,
            }
            for doc in docs
        ],
    })
