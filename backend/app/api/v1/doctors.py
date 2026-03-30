"""Doctor management and scheduling endpoints."""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user, CurrentUser, require_perm
from app.core.exceptions import BadRequestException, NotFoundException, ConflictException
from app.models.doctor import (
    Doctor, DoctorClinicAssignment, DoctorSchedule,
    DoctorScheduleException, DoctorRating,
)
from app.models.user import User

router = APIRouter()


def _success(data, message="Success", meta=None):
    return {"success": True, "message": message, "data": data, "meta": meta}


@router.get("/")
async def list_doctors(
    clinic_id: Optional[str] = None,
    specialization: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List doctors for this tenant (optionally filtered by clinic/specialization/search)."""
    query = (
        select(Doctor)
        .options(selectinload(Doctor.user))
        .join(User, User.id == Doctor.user_id)
        .where(
            Doctor.tenant_id == current_user.tenant_id,
            Doctor.is_deleted == False,
        )
    )
    if specialization:
        query = query.where(Doctor.primary_specialization.ilike(f"%{specialization}%"))

    if search:
        term = f"%{search}%"
        from sqlalchemy import or_
        query = query.where(
            or_(
                User.first_name.ilike(term),
                User.last_name.ilike(term),
                Doctor.registration_number.ilike(term),
            )
        )

    if clinic_id:
        query = query.join(
            DoctorClinicAssignment,
            DoctorClinicAssignment.doctor_id == Doctor.id,
        ).where(
            DoctorClinicAssignment.clinic_id == clinic_id,
            DoctorClinicAssignment.is_active == True,
        )

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    doctors = result.scalars().all()

    return _success(
        [_doctor_response(d) for d in doctors],
        meta={"total": total, "page": page, "page_size": page_size},
    )


def _doctor_response(d: Doctor) -> dict:
    u = d.user
    return {
        "id": d.id,
        "user_id": d.user_id,
        # User fields
        "full_name": u.full_name if u else None,
        "first_name": u.first_name if u else None,
        "last_name": u.last_name if u else None,
        "email": u.email if u else None,
        "phone": u.phone if u else None,
        # Doctor profile fields
        "registration_number": d.registration_number,
        "primary_specialization": d.primary_specialization,
        "secondary_specializations": d.secondary_specializations,
        "experience_years": d.experience_years,
        "consultation_fee": d.consultation_fee,
        "follow_up_fee": d.follow_up_fee,
        "biography": d.biography,
        "default_slot_duration": d.default_slot_duration,
        "is_accepting_new_patients": d.is_accepting_new_patients,
        "telemedicine_enabled": d.telemedicine_enabled,
        "average_rating": d.average_rating,
        "total_ratings": d.total_ratings,
    }


@router.get("/{doctor_id}")
async def get_doctor(
    doctor_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(
        select(Doctor).options(selectinload(Doctor.user)).where(
            Doctor.id == doctor_id,
            Doctor.tenant_id == current_user.tenant_id,
            Doctor.is_deleted == False,
        )
    )
    doctor = result.scalar_one_or_none()
    if not doctor:
        raise NotFoundException(detail="Doctor not found")

    data = _doctor_response(doctor)

    # Load schedules
    schedules_result = await db.execute(
        select(DoctorSchedule).where(
            DoctorSchedule.doctor_id == doctor_id,
            DoctorSchedule.is_active == True,
            DoctorSchedule.is_deleted == False,
        )
    )
    data["schedules"] = [
        {
            "id": s.id,
            "clinic_id": s.clinic_id,
            "day_of_week": s.day_of_week,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "slot_duration": s.slot_duration,
            "break_start": s.break_start,
            "break_end": s.break_end,
        }
        for s in schedules_result.scalars()
    ]

    return _success(data)


@router.patch("/{doctor_id}")
async def update_doctor(
    doctor_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("doctors:update")),
):
    """Update doctor profile fields."""
    result = await db.execute(
        select(Doctor).options(selectinload(Doctor.user)).where(
            Doctor.id == doctor_id,
            Doctor.tenant_id == current_user.tenant_id,
            Doctor.is_deleted == False,
        )
    )
    doctor = result.scalar_one_or_none()
    if not doctor:
        raise NotFoundException(detail="Doctor not found")

    updatable = [
        "primary_specialization", "secondary_specializations", "experience_years",
        "consultation_fee", "follow_up_fee", "default_slot_duration",
        "is_accepting_new_patients", "telemedicine_enabled", "bio",
        "languages", "registration_number",
    ]
    for field in updatable:
        if field in body:
            setattr(doctor, field, body[field])

    doctor.updated_by = current_user.user_id
    await db.commit()

    return _success(_doctor_response(doctor), message="Doctor profile updated")


@router.post("/{doctor_id}/schedules")
async def set_doctor_schedule(
    doctor_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("doctors:schedule")),
):
    """Create or update weekly schedules for a doctor. Accepts { schedules: [...] } or a single entry."""
    # Validate doctor exists
    result = await db.execute(
        select(Doctor).where(
            Doctor.id == doctor_id,
            Doctor.tenant_id == current_user.tenant_id,
        )
    )
    if not result.scalar_one_or_none():
        raise NotFoundException(detail="Doctor not found")

    # Support both bulk { schedules: [...] } and single-entry body
    entries = body.get("schedules") if "schedules" in body else [body]
    if not entries:
        raise BadRequestException(detail="No schedule entries provided")

    created_ids = []
    for entry in entries:
        clinic_id = entry.get("clinic_id")
        day_of_week = entry.get("day_of_week")
        if not clinic_id or not day_of_week:
            raise BadRequestException(detail="Each schedule entry requires clinic_id and day_of_week")

        # Deactivate existing schedule for this day/clinic
        existing = await db.execute(
            select(DoctorSchedule).where(
                DoctorSchedule.doctor_id == doctor_id,
                DoctorSchedule.clinic_id == clinic_id,
                DoctorSchedule.day_of_week == day_of_week,
                DoctorSchedule.is_deleted == False,
            )
        )
        for s in existing.scalars():
            s.is_active = False

        schedule = DoctorSchedule(
            tenant_id=current_user.tenant_id,
            doctor_id=doctor_id,
            clinic_id=clinic_id,
            day_of_week=day_of_week,
            start_time=entry["start_time"],
            end_time=entry["end_time"],
            slot_duration=entry.get("slot_duration_minutes") or entry.get("slot_duration", 15),
            break_start=entry.get("break_start"),
            break_end=entry.get("break_end"),
            max_appointments=entry.get("max_patients") or entry.get("max_appointments"),
            valid_from=entry.get("valid_from"),
            valid_until=entry.get("valid_until"),
            is_active=True,
            created_by=current_user.user_id,
        )
        db.add(schedule)
        await db.flush()
        created_ids.append(schedule.id)

    await db.commit()
    return _success({"schedule_ids": created_ids}, message="Schedule updated")


@router.post("/{doctor_id}/schedule-exceptions")
async def add_schedule_exception(
    doctor_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("doctors:schedule")),
):
    """Add a schedule exception (day off, leave, modified hours)."""
    exception = DoctorScheduleException(
        tenant_id=current_user.tenant_id,
        doctor_id=doctor_id,
        clinic_id=body["clinic_id"],
        exception_date=body["exception_date"],
        exception_type=body["exception_type"],
        start_time=body.get("start_time"),
        end_time=body.get("end_time"),
        reason=body.get("reason"),
        notify_patients=body.get("notify_patients", True),
        substitute_doctor_id=body.get("substitute_doctor_id"),
        created_by=current_user.user_id,
    )
    db.add(exception)
    await db.commit()

    # Notify affected patients if requested
    if exception.notify_patients:
        from app.tasks.appointment_tasks import notify_affected_patients
        notify_affected_patients.delay(
            doctor_id=doctor_id,
            exception_date=body["exception_date"],
            substitute_doctor_id=body.get("substitute_doctor_id"),
        )

    return _success({"exception_id": exception.id}, message="Schedule exception added")


@router.get("/{doctor_id}/clinics")
async def list_doctor_clinics(
    doctor_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List all clinic assignments for a doctor."""
    from app.models.clinic import Clinic

    result = await db.execute(
        select(DoctorClinicAssignment, Clinic)
        .join(Clinic, Clinic.id == DoctorClinicAssignment.clinic_id)
        .where(
            DoctorClinicAssignment.doctor_id == doctor_id,
            DoctorClinicAssignment.tenant_id == current_user.tenant_id,
            DoctorClinicAssignment.is_deleted == False,
        )
        .order_by(DoctorClinicAssignment.is_primary_clinic.desc(), Clinic.name)
    )
    rows = result.all()

    return _success([
        {
            "id": a.id,
            "clinic_id": c.id,
            "clinic_name": c.name,
            "is_primary_clinic": a.is_primary_clinic,
            "consultation_fee_override": a.consultation_fee_override,
            "is_active": a.is_active,
            "start_date": a.start_date,
            "end_date": a.end_date,
        }
        for a, c in rows
    ])


@router.post("/{doctor_id}/clinics")
async def assign_doctor_to_clinic(
    doctor_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("doctors:update")),
):
    """Assign a doctor to a clinic (or re-activate an existing assignment)."""
    clinic_id = body.get("clinic_id")
    if not clinic_id:
        raise BadRequestException(detail="clinic_id is required")

    # Verify doctor belongs to tenant
    doctor = (await db.execute(
        select(Doctor).where(
            Doctor.id == doctor_id,
            Doctor.tenant_id == current_user.tenant_id,
            Doctor.is_deleted == False,
        )
    )).scalar_one_or_none()
    if not doctor:
        raise NotFoundException(detail="Doctor not found")

    # Check for existing (including soft-deleted) assignment
    existing = (await db.execute(
        select(DoctorClinicAssignment).where(
            DoctorClinicAssignment.doctor_id == doctor_id,
            DoctorClinicAssignment.clinic_id == clinic_id,
        )
    )).scalar_one_or_none()

    if existing:
        # Re-activate if soft-deleted or inactive
        existing.is_deleted = False
        existing.is_active = body.get("is_active", True)
        existing.is_primary_clinic = body.get("is_primary_clinic", existing.is_primary_clinic)
        existing.consultation_fee_override = body.get("consultation_fee_override", existing.consultation_fee_override)
        existing.start_date = body.get("start_date", existing.start_date)
        existing.end_date = body.get("end_date", existing.end_date)
        await db.commit()
        return _success({"assignment_id": existing.id}, message="Doctor clinic assignment updated")

    assignment = DoctorClinicAssignment(
        tenant_id=current_user.tenant_id,
        doctor_id=doctor_id,
        clinic_id=clinic_id,
        is_primary_clinic=body.get("is_primary_clinic", False),
        consultation_fee_override=body.get("consultation_fee_override"),
        is_active=body.get("is_active", True),
        start_date=body.get("start_date"),
        end_date=body.get("end_date"),
        created_by=current_user.user_id,
    )
    db.add(assignment)
    await db.commit()
    return _success({"assignment_id": assignment.id}, message="Doctor assigned to clinic")


@router.patch("/{doctor_id}/clinics/{clinic_id}")
async def update_doctor_clinic_assignment(
    doctor_id: str,
    clinic_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("doctors:update")),
):
    """Update a doctor's clinic assignment (enable/disable, fee override, primary clinic)."""
    assignment = (await db.execute(
        select(DoctorClinicAssignment).where(
            DoctorClinicAssignment.doctor_id == doctor_id,
            DoctorClinicAssignment.clinic_id == clinic_id,
            DoctorClinicAssignment.is_deleted == False,
        )
    )).scalar_one_or_none()
    if not assignment:
        raise NotFoundException(detail="Assignment not found")

    for field in ["is_active", "is_primary_clinic", "consultation_fee_override", "start_date", "end_date"]:
        if field in body:
            setattr(assignment, field, body[field])

    await db.commit()
    return _success({"assignment_id": assignment.id}, message="Assignment updated")


@router.delete("/{doctor_id}/clinics/{clinic_id}")
async def remove_doctor_from_clinic(
    doctor_id: str,
    clinic_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("doctors:update")),
):
    """Remove a doctor from a clinic (soft delete)."""
    assignment = (await db.execute(
        select(DoctorClinicAssignment).where(
            DoctorClinicAssignment.doctor_id == doctor_id,
            DoctorClinicAssignment.clinic_id == clinic_id,
            DoctorClinicAssignment.is_deleted == False,
        )
    )).scalar_one_or_none()
    if not assignment:
        raise NotFoundException(detail="Assignment not found")

    assignment.is_deleted = True
    assignment.is_active = False
    await db.commit()
    return _success(None, message="Doctor removed from clinic")


@router.get("/{doctor_id}/stats")
async def get_doctor_stats(
    doctor_id: str,
    clinic_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    group_by: str = Query("day", pattern="^(day|month)$"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Doctor appointment statistics: totals, new vs revisit, free consultations.
    Grouped by day or month. Optionally filtered by clinic and date range.
    """
    from app.models.appointment import Appointment, AppointmentStatus
    from app.models.billing import Invoice

    # Base filter
    filters = [
        Appointment.doctor_id == doctor_id,
        Appointment.tenant_id == current_user.tenant_id,
        Appointment.status == AppointmentStatus.COMPLETED,
        Appointment.is_deleted == False,
    ]
    if clinic_id:
        filters.append(Appointment.clinic_id == clinic_id)
    if date_from:
        filters.append(Appointment.appointment_date >= date_from)
    if date_to:
        filters.append(Appointment.appointment_date <= date_to)

    # Summary totals
    appts_result = await db.execute(
        select(
            Appointment.appointment_date,
            Appointment.is_first_visit,
            Appointment.visit_type,
            Appointment.id.label("appt_id"),
        ).where(*filters)
    )
    rows = appts_result.all()

    # Get invoice totals for these appointments to detect free consultations
    appt_ids = [r.appt_id for r in rows]
    invoice_map: dict[str, float] = {}
    if appt_ids:
        inv_rows = await db.execute(
            select(Invoice.appointment_id, Invoice.total_amount)
            .where(Invoice.appointment_id.in_(appt_ids))
        )
        invoice_map = {r.appointment_id: r.total_amount for r in inv_rows}

    def _period_key(date_str: str) -> str:
        if group_by == "month":
            return date_str[:7]  # YYYY-MM
        return date_str  # YYYY-MM-DD

    # Aggregate by period
    periods: dict[str, dict] = {}
    for r in rows:
        key = _period_key(r.appointment_date)
        if key not in periods:
            periods[key] = {
                "period": key,
                "total": 0,
                "new_patients": 0,
                "revisits": 0,
                "free_consultations": 0,
            }
        p = periods[key]
        p["total"] += 1
        if r.is_first_visit:
            p["new_patients"] += 1
        else:
            p["revisits"] += 1
        fee = invoice_map.get(r.appt_id, -1)
        if fee == 0:
            p["free_consultations"] += 1

    grouped = sorted(periods.values(), key=lambda x: x["period"])

    # Overall summary
    total = len(rows)
    new_pts = sum(1 for r in rows if r.is_first_visit)
    revisits = total - new_pts
    free = sum(1 for r in rows if invoice_map.get(r.appt_id, -1) == 0)

    return _success({
        "summary": {
            "total_appointments": total,
            "new_patients": new_pts,
            "revisits": revisits,
            "free_consultations": free,
        },
        "grouped": grouped,
    })


@router.get("/{doctor_id}/settlement")
async def get_doctor_settlement(
    doctor_id: str,
    clinic_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("billing:read")),
):
    """
    Settlement report: per-appointment fee breakdown for doctor payment.
    Returns total consultation fees billed, collected, and outstanding.
    """
    from app.models.appointment import Appointment, AppointmentStatus
    from app.models.billing import Invoice
    from app.models.patient import Patient
    from app.models.clinic import Clinic
    from app.models.user import User

    filters = [
        Appointment.doctor_id == doctor_id,
        Appointment.tenant_id == current_user.tenant_id,
        Appointment.status == AppointmentStatus.COMPLETED,
        Appointment.is_deleted == False,
    ]
    if clinic_id:
        filters.append(Appointment.clinic_id == clinic_id)
    if date_from:
        filters.append(Appointment.appointment_date >= date_from)
    if date_to:
        filters.append(Appointment.appointment_date <= date_to)

    appts = (await db.execute(
        select(Appointment).where(*filters).order_by(Appointment.appointment_date.desc())
    )).scalars().all()

    appt_ids = [a.id for a in appts]
    clinic_ids = list({a.clinic_id for a in appts})
    patient_ids = list({a.patient_id for a in appts})

    # Batch-load invoices, clinics, patients
    invoice_map: dict[str, Invoice] = {}
    if appt_ids:
        inv_rows = (await db.execute(
            select(Invoice).where(Invoice.appointment_id.in_(appt_ids))
        )).scalars().all()
        invoice_map = {inv.appointment_id: inv for inv in inv_rows}

    clinic_map: dict[str, str] = {}
    if clinic_ids:
        c_rows = (await db.execute(
            select(Clinic.id, Clinic.name).where(Clinic.id.in_(clinic_ids))
        )).all()
        clinic_map = {r.id: r.name for r in c_rows}

    patient_map: dict[str, str] = {}
    if patient_ids:
        pt_rows = (await db.execute(
            select(Patient.id, User.first_name, User.last_name)
            .join(User, User.id == Patient.user_id)
            .where(Patient.id.in_(patient_ids))
        )).all()
        patient_map = {r.id: f"{r.first_name} {r.last_name}".strip() for r in pt_rows}

    # Load doctor's base consultation fee for appointments without invoice
    doctor = (await db.execute(select(Doctor).where(Doctor.id == doctor_id))).scalar_one_or_none()
    base_fee = doctor.consultation_fee or 0 if doctor else 0

    rows_out = []
    total_billed = 0.0
    total_paid = 0.0
    total_discount = 0.0

    for a in appts:
        inv = invoice_map.get(a.id)
        billed = inv.total_amount if inv else base_fee
        paid = inv.paid_amount if inv else 0.0
        discount = inv.discount_amount if inv else 0.0
        total_billed += billed
        total_paid += paid
        total_discount += discount
        rows_out.append({
            "appointment_id": a.id,
            "appointment_date": a.appointment_date,
            "start_time": a.start_time,
            "clinic_name": clinic_map.get(a.clinic_id, ""),
            "patient_name": patient_map.get(a.patient_id, ""),
            "visit_type": a.visit_type,
            "is_first_visit": a.is_first_visit,
            "invoice_number": inv.invoice_number if inv else None,
            "invoice_status": inv.status if inv else None,
            "total_amount": billed,
            "discount_amount": discount,
            "paid_amount": paid,
            "balance_due": inv.balance_due if inv else billed,
        })

    return _success({
        "summary": {
            "total_appointments": len(appts),
            "total_billed": round(total_billed, 2),
            "total_paid": round(total_paid, 2),
            "total_discount": round(total_discount, 2),
            "total_outstanding": round(total_billed - total_paid, 2),
        },
        "appointments": rows_out,
    })


@router.post("/{doctor_id}/rate")
async def rate_doctor(
    doctor_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Patient rates a doctor after a completed appointment."""
    rating_value = body.get("rating")
    if not isinstance(rating_value, int) or not (1 <= rating_value <= 5):
        raise BadRequestException(detail="Rating must be an integer between 1 and 5")

    # Verify appointment was completed and belongs to patient
    from app.models.appointment import Appointment, AppointmentStatus
    from app.models.patient import Patient

    patient_res = await db.execute(
        select(Patient).where(Patient.user_id == current_user.user_id)
    )
    patient = patient_res.scalar_one_or_none()
    if not patient:
        raise BadRequestException(detail="No patient profile found")

    appt_res = await db.execute(
        select(Appointment).where(
            Appointment.id == body.get("appointment_id"),
            Appointment.patient_id == patient.id,
            Appointment.doctor_id == doctor_id,
            Appointment.status == AppointmentStatus.COMPLETED,
        )
    )
    appt = appt_res.scalar_one_or_none()
    if not appt:
        raise BadRequestException(
            detail="Can only rate a completed appointment for this doctor"
        )

    # Check not already rated
    existing_rating = await db.execute(
        select(DoctorRating).where(
            DoctorRating.appointment_id == appt.id
        )
    )
    if existing_rating.scalar_one_or_none():
        raise ConflictException(detail="You have already rated this appointment")

    rating = DoctorRating(
        tenant_id=current_user.tenant_id,
        doctor_id=doctor_id,
        patient_id=patient.id,
        appointment_id=appt.id,
        rating=rating_value,
        review=body.get("review"),
        is_anonymous=body.get("is_anonymous", False),
        created_by=current_user.user_id,
    )
    db.add(rating)

    # Update doctor aggregate rating
    doctor_res = await db.execute(
        select(Doctor).where(Doctor.id == doctor_id)
    )
    doctor = doctor_res.scalar_one_or_none()
    if doctor:
        total = doctor.total_ratings + 1
        avg = ((doctor.average_rating * doctor.total_ratings) + rating_value) / total
        doctor.average_rating = round(avg, 2)
        doctor.total_ratings = total

    await db.commit()
    return _success({"rating_id": rating.id}, message="Rating submitted")
