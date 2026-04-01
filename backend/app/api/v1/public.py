"""Public-facing endpoints — no authentication required."""
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import BadRequestException, NotFoundException
from app.models.appointment import Appointment, AppointmentStatus
from app.models.clinic import Clinic, ClinicStatus
from app.models.doctor import Doctor, DoctorClinicAssignment, DoctorSchedule, DoctorScheduleException
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
                "tenant_id": c.tenant_id,
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
            "tenant_id": clinic.tenant_id,
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


@router.get("/slots")
async def get_public_slots(
    doctor_id: str = Query(...),
    clinic_id: str = Query(...),
    date: str = Query(..., description="YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
):
    """Get available appointment slots — no authentication required (used by public booking page)."""
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise BadRequestException(detail="Invalid date format. Use YYYY-MM-DD")

    if target_date < datetime.now().date():
        raise BadRequestException(detail="Cannot book appointments in the past")

    day_name = target_date.strftime("%A").lower()

    exception_result = await db.execute(
        select(DoctorScheduleException).where(
            DoctorScheduleException.doctor_id == doctor_id,
            DoctorScheduleException.clinic_id == clinic_id,
            DoctorScheduleException.exception_date == date,
            DoctorScheduleException.is_deleted == False,
        )
    )
    exception = exception_result.scalar_one_or_none()

    if exception and exception.exception_type in ("day_off", "leave", "emergency_leave"):
        return _success({"date": date, "available_slots": [], "booked_slots": [], "total_slots": 0})

    schedule_result = await db.execute(
        select(DoctorSchedule).where(
            DoctorSchedule.doctor_id == doctor_id,
            DoctorSchedule.clinic_id == clinic_id,
            DoctorSchedule.day_of_week == day_name,
            DoctorSchedule.is_active == True,
            DoctorSchedule.is_deleted == False,
        )
    )
    schedule = schedule_result.scalar_one_or_none()

    if not schedule:
        return _success({"date": date, "available_slots": [], "booked_slots": [], "total_slots": 0})

    start_str = schedule.start_time
    end_str = schedule.end_time
    if exception and exception.exception_type == "modified_hours":
        start_str = exception.start_time or start_str
        end_str = exception.end_time or end_str

    all_slots = _generate_time_slots(start_str, end_str, schedule.slot_duration, schedule.break_start, schedule.break_end)

    booked_result = await db.execute(
        select(Appointment.start_time).where(
            Appointment.doctor_id == doctor_id,
            Appointment.clinic_id == clinic_id,
            Appointment.appointment_date == date,
            Appointment.status.notin_([AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW]),
            Appointment.is_deleted == False,
        )
    )
    booked_starts = {row[0] for row in booked_result}

    available = [s for s in all_slots if s["start_time"] not in booked_starts]

    return _success({
        "date": date,
        "doctor_id": doctor_id,
        "clinic_id": clinic_id,
        "slot_duration": schedule.slot_duration,
        "available_slots": available,
        "booked_slots": [s for s in all_slots if s["start_time"] in booked_starts],
        "total_slots": len(all_slots),
        "available_count": len(available),
    })


def _generate_time_slots(
    start: str, end: str, duration: int,
    break_start: Optional[str] = None, break_end: Optional[str] = None
) -> List[dict]:
    slots = []
    current = datetime.strptime(start, "%H:%M")
    end_dt = datetime.strptime(end, "%H:%M")
    break_start_dt = datetime.strptime(break_start, "%H:%M") if break_start else None
    break_end_dt = datetime.strptime(break_end, "%H:%M") if break_end else None

    while current < end_dt:
        slot_end = current + timedelta(minutes=duration)
        if slot_end > end_dt:
            break
        if break_start_dt and break_end_dt:
            if break_start_dt <= current < break_end_dt:
                current = break_end_dt
                continue
        slots.append({"start_time": current.strftime("%H:%M"), "end_time": slot_end.strftime("%H:%M")})
        current = slot_end

    return slots
