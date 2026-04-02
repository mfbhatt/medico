"""Appointment booking API — handles all booking scenarios including edge cases."""
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, BackgroundTasks
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, CurrentUser, require_perm
from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    NotFoundException,
    SlotUnavailableException,
    DoubleBookingException,
    DoctorUnavailableException,
)
from app.core.cache import DistributedLock, cache_delete_pattern
from app.models.appointment import Appointment, AppointmentStatus, AppointmentWaitlist
from app.models.doctor import Doctor, DoctorSchedule, DoctorScheduleException

router = APIRouter()


def _success(data, message="Success", meta=None):
    return {"success": True, "message": message, "data": data, "meta": meta}


# ── Get Available Slots ──────────────────────────────────────────
@router.get("/slots")
async def get_available_slots(
    doctor_id: str = Query(...),
    clinic_id: str = Query(...),
    date: str = Query(..., description="YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Returns available appointment slots for a doctor on a given date.
    Handles: schedule exceptions, existing appointments, break times, clinic hours.
    """
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise BadRequestException(detail="Invalid date format. Use YYYY-MM-DD")

    if target_date < datetime.now().date():
        raise BadRequestException(detail="Cannot book appointments in the past")

    # Get doctor schedule for the day
    day_name = target_date.strftime("%A").lower()

    # Check for schedule exceptions first
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
        return _success(
            {"available_slots": [], "message": "Doctor is not available on this date"},
            message="No slots available",
        )

    # Get regular schedule
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
        return _success(
            {"available_slots": []},
            message="Doctor does not have a schedule on this day",
        )

    # Use modified hours if exception exists
    start_str = schedule.start_time
    end_str = schedule.end_time
    if exception and exception.exception_type == "modified_hours":
        start_str = exception.start_time or start_str
        end_str = exception.end_time or end_str

    # Generate all slots
    all_slots = _generate_time_slots(
        start_str, end_str,
        schedule.slot_duration,
        schedule.break_start,
        schedule.break_end,
    )

    # Get booked slots for this doctor/date
    booked_result = await db.execute(
        select(Appointment.start_time, Appointment.end_time).where(
            Appointment.doctor_id == doctor_id,
            Appointment.clinic_id == clinic_id,
            Appointment.appointment_date == date,
            Appointment.status.notin_([
                AppointmentStatus.CANCELLED,
                AppointmentStatus.NO_SHOW,
            ]),
            Appointment.is_deleted == False,
        )
    )
    booked = [(row.start_time, row.end_time) for row in booked_result]
    booked_starts = {b[0] for b in booked}

    # Partition slots into available and booked
    available = [slot for slot in all_slots if slot["start_time"] not in booked_starts]
    booked_slots = [slot for slot in all_slots if slot["start_time"] in booked_starts]

    return _success(
        {
            "date": date,
            "doctor_id": doctor_id,
            "clinic_id": clinic_id,
            "slot_duration": schedule.slot_duration,
            "all_slots": all_slots,
            "available_slots": available,
            "booked_slots": booked_slots,
            "total_slots": len(all_slots),
            "booked_count": len(booked_starts),
            "available_count": len(available),
        }
    )


def _generate_time_slots(
    start: str, end: str, duration: int,
    break_start: Optional[str] = None, break_end: Optional[str] = None
) -> List[dict]:
    """Generate list of time slots between start and end, skipping break."""
    slots = []
    current = datetime.strptime(start, "%H:%M")
    end_dt = datetime.strptime(end, "%H:%M")
    break_start_dt = datetime.strptime(break_start, "%H:%M") if break_start else None
    break_end_dt = datetime.strptime(break_end, "%H:%M") if break_end else None

    while current < end_dt:
        slot_end = current + timedelta(minutes=duration)
        if slot_end > end_dt:
            break

        # Skip break time
        if break_start_dt and break_end_dt:
            if current >= break_start_dt and current < break_end_dt:
                current = break_end_dt
                continue

        slots.append({
            "start_time": current.strftime("%H:%M"),
            "end_time": slot_end.strftime("%H:%M"),
        })
        current = slot_end

    return slots


# ── My Appointments (patient shortcut) ──────────────────────────
@router.get("/my")
async def get_my_appointments(
    status: Optional[str] = None,
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Return appointments for the currently authenticated patient. Supports comma-separated status filter."""
    from app.models.patient import Patient
    from app.models.clinic import Clinic

    patient_result = await db.execute(
        select(Patient).where(Patient.user_id == current_user.user_id)
    )
    patient = patient_result.scalar_one_or_none()
    if not patient:
        return _success([])

    query = select(Appointment).where(
        Appointment.patient_id == patient.id,
        Appointment.tenant_id == current_user.tenant_id,
        Appointment.is_deleted == False,
    )

    if status:
        statuses = [s.strip() for s in status.split(",")]
        query = query.where(Appointment.status.in_(statuses))

    query = query.order_by(Appointment.appointment_date, Appointment.start_time).limit(limit)
    result = await db.execute(query)
    appointments = result.scalars().all()

    doctor_ids = list({a.doctor_id for a in appointments if a.doctor_id})
    clinic_ids = list({a.clinic_id for a in appointments if a.clinic_id})

    from app.models.user import User as UserModel
    doctor_name_map: dict = {}
    if doctor_ids:
        d_rows = (await db.execute(
            select(Doctor.id, UserModel.first_name, UserModel.last_name)
            .join(UserModel, UserModel.id == Doctor.user_id)
            .where(Doctor.id.in_(doctor_ids))
        )).all()
        doctor_name_map = {r[0]: f"Dr. {r[1]} {r[2]}" for r in d_rows}

    clinic_name_map: dict = {}
    if clinic_ids:
        from app.models.clinic import Clinic
        c_rows = (await db.execute(
            select(Clinic.id, Clinic.name).where(Clinic.id.in_(clinic_ids))
        )).all()
        clinic_name_map = {r[0]: r[1] for r in c_rows}

    return _success([
        {
            "id": a.id,
            "doctor_id": a.doctor_id,
            "doctor_name": doctor_name_map.get(a.doctor_id),
            "clinic_id": a.clinic_id,
            "clinic_name": clinic_name_map.get(a.clinic_id),
            "scheduled_date": a.appointment_date,
            "scheduled_time": a.start_time,
            "appointment_date": a.appointment_date,
            "start_time": a.start_time,
            "end_time": a.end_time,
            "status": a.status,
            "appointment_type": a.appointment_type,
            "chief_complaint": a.chief_complaint,
        }
        for a in appointments
    ])


# ── Book Appointment ─────────────────────────────────────────────
@router.post("/")
async def book_appointment(
    body: dict,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("appointments:create")),
):
    """
    Book an appointment.
    Edge cases handled:
    - Double booking prevention (distributed lock)
    - Doctor unavailability
    - Clinic closure
    - Past date booking
    - Overlapping appointments
    """
    # Accept field name aliases from mobile clients
    if not body.get("appointment_date") and body.get("scheduled_date"):
        body = {**body, "appointment_date": body["scheduled_date"]}
    if not body.get("start_time") and body.get("scheduled_time"):
        body = {**body, "start_time": body["scheduled_time"]}

    # Auto-resolve patient_id for patient role
    if current_user.role == "patient" and not body.get("patient_id"):
        from app.models.patient import Patient
        import uuid as _uuid
        from app.models.user import User as UserModel
        patient_result = await db.execute(
            select(Patient).where(Patient.user_id == current_user.user_id)
        )
        existing_patient = patient_result.scalar_one_or_none()
        if existing_patient:
            body = {**body, "patient_id": existing_patient.id}
        else:
            # Create a Patient profile on-the-fly for users who registered before the Patient record was required
            user_row = (await db.execute(
                select(UserModel).where(UserModel.id == current_user.user_id)
            )).scalar_one_or_none()
            first_name = (user_row.first_name or "Patient") if user_row else "Patient"
            last_name = (user_row.last_name or "") if user_row else ""
            email = user_row.email if user_row else None
            phone = (user_row.phone or "") if user_row else ""
            mrn_prefix = current_user.tenant_id[:3].upper()
            mrn = f"{mrn_prefix}-{_uuid.uuid4().hex[:8].upper()}"
            new_patient = Patient(
                user_id=current_user.user_id,
                tenant_id=current_user.tenant_id,
                mrn=mrn,
                first_name=first_name,
                last_name=last_name,
                email=email,
                phone=phone,
                date_of_birth="1900-01-01",
                gender="unknown",
            )
            db.add(new_patient)
            await db.flush()
            body = {**body, "patient_id": new_patient.id}

    # Validate required fields
    required = ["patient_id", "doctor_id", "clinic_id", "appointment_date", "start_time"]
    for field in required:
        if not body.get(field):
            raise BadRequestException(detail=f"Missing required field: {field}")

    patient_id = body["patient_id"]
    doctor_id = body["doctor_id"]
    clinic_id = body["clinic_id"]
    appt_date = body["appointment_date"]
    start_time = body["start_time"]
    duration = body.get("duration_minutes", 15)
    is_emergency = body.get("priority") == "emergency"

    # Validate date
    try:
        target_date = datetime.strptime(appt_date, "%Y-%m-%d").date()
    except ValueError:
        raise BadRequestException(detail="Invalid date format")

    if target_date < datetime.now().date() and not is_emergency:
        raise BadRequestException(detail="Cannot book in the past")

    # Calculate end time
    start_dt = datetime.strptime(start_time, "%H:%M")
    end_dt = start_dt + timedelta(minutes=duration)
    end_time = end_dt.strftime("%H:%M")

    # ── Distributed lock to prevent race conditions ──────────────
    lock_key = f"appointment:{doctor_id}:{appt_date}:{start_time}"
    async with DistributedLock(lock_key, timeout=10):

        # Check same patient already has an appointment with this doctor on this day
        same_patient = await db.execute(
            select(Appointment).where(
                Appointment.patient_id == patient_id,
                Appointment.doctor_id == doctor_id,
                Appointment.appointment_date == appt_date,
                Appointment.is_deleted == False,
                Appointment.status.notin_([
                    AppointmentStatus.CANCELLED,
                    AppointmentStatus.NO_SHOW,
                ]),
            )
        )
        if same_patient.scalar_one_or_none() and not is_emergency:
            raise DoubleBookingException(
                detail="This patient already has an appointment with this doctor on the selected date."
            )

        # Check for double booking
        conflict = await db.execute(
            select(Appointment).where(
                Appointment.doctor_id == doctor_id,
                Appointment.appointment_date == appt_date,
                Appointment.is_deleted == False,
                Appointment.status.notin_([
                    AppointmentStatus.CANCELLED,
                    AppointmentStatus.NO_SHOW,
                ]),
                or_(
                    and_(
                        Appointment.start_time <= start_time,
                        Appointment.end_time > start_time,
                    ),
                    and_(
                        Appointment.start_time < end_time,
                        Appointment.end_time >= end_time,
                    ),
                    and_(
                        Appointment.start_time >= start_time,
                        Appointment.end_time <= end_time,
                    ),
                ),
            )
        )
        if conflict.scalar_one_or_none() and not is_emergency:
            raise DoubleBookingException(
                detail="The requested slot is already booked. Please choose a different time."
            )

        # Check doctor exception (day off)
        exception_result = await db.execute(
            select(DoctorScheduleException).where(
                DoctorScheduleException.doctor_id == doctor_id,
                DoctorScheduleException.exception_date == appt_date,
                DoctorScheduleException.exception_type.in_(["day_off", "leave", "emergency_leave"]),
                DoctorScheduleException.is_deleted == False,
            )
        )
        if exception_result.scalar_one_or_none() and not is_emergency:
            raise DoctorUnavailableException(
                detail="Doctor is on leave on this date"
            )

        # Determine queue number for walk-ins
        queue_num = None
        if body.get("is_walk_in"):
            count_result = await db.execute(
                select(func.count(Appointment.id)).where(
                    Appointment.clinic_id == clinic_id,
                    Appointment.appointment_date == appt_date,
                    Appointment.is_walk_in == True,
                    Appointment.is_deleted == False,
                )
            )
            queue_num = (count_result.scalar() or 0) + 1

        # Create appointment
        appointment = Appointment(
            tenant_id=current_user.tenant_id,
            patient_id=patient_id,
            doctor_id=doctor_id,
            clinic_id=clinic_id,
            appointment_date=appt_date,
            start_time=start_time,
            end_time=end_time,
            duration_minutes=duration,
            status=AppointmentStatus.SCHEDULED,
            appointment_type=body.get("appointment_type", "in_person"),
            priority=body.get("priority", "routine"),
            chief_complaint=body.get("chief_complaint"),
            visit_type=body.get("visit_type", "new"),
            is_walk_in=body.get("is_walk_in", False),
            queue_number=queue_num,
            patient_notes=body.get("patient_notes"),
            created_by=current_user.user_id,
        )
        db.add(appointment)
        await db.flush()

        # Schedule reminders
        background_tasks.add_task(
            _schedule_appointment_reminders,
            appointment.id,
            patient_id,
            appt_date,
            start_time,
        )

        # Send confirmation notification
        background_tasks.add_task(
            _send_appointment_confirmation,
            appointment.id,
            patient_id,
            doctor_id,
            appt_date,
            start_time,
        )

        # Invalidate availability cache
        await cache_delete_pattern(f"slots:{doctor_id}:{clinic_id}:{appt_date}*")

    return _success(
        {
            "id": appointment.id,
            "appointment_id": appointment.id,  # keep for backwards compat
            "appointment_date": appt_date,
            "start_time": start_time,
            "end_time": end_time,
            "status": appointment.status,
            "queue_number": queue_num,
        },
        message="Appointment booked successfully",
    )


# ── Get Appointments ─────────────────────────────────────────────
@router.get("/")
async def list_appointments(
    clinic_id: Optional[str] = None,
    doctor_id: Optional[str] = None,
    patient_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List appointments with filters. Patients see only their own."""
    query = select(Appointment).where(
        Appointment.tenant_id == current_user.tenant_id,
        Appointment.is_deleted == False,
    )

    # Patients can only see their own appointments
    if current_user.role == "patient":
        # Get patient profile for this user
        from app.models.patient import Patient
        patient_result = await db.execute(
            select(Patient).where(Patient.user_id == current_user.user_id)
        )
        patient = patient_result.scalar_one_or_none()
        if patient:
            query = query.where(Appointment.patient_id == patient.id)

    if clinic_id:
        query = query.where(Appointment.clinic_id == clinic_id)
    if doctor_id:
        query = query.where(Appointment.doctor_id == doctor_id)
    if patient_id and current_user.role != "patient":
        query = query.where(Appointment.patient_id == patient_id)
    if date_from:
        query = query.where(Appointment.appointment_date >= date_from)
    if date_to:
        query = query.where(Appointment.appointment_date <= date_to)
    if status:
        query = query.where(Appointment.status == status)

    # Count
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()

    # Paginate
    query = query.order_by(
        Appointment.appointment_date.desc(), Appointment.start_time
    ).offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    appointments = result.scalars().all()

    # Enrich with patient and doctor names in bulk
    from app.models.patient import Patient
    from app.models.user import User

    appt_ids = [a.id for a in appointments]
    patient_ids = list({a.patient_id for a in appointments if a.patient_id})
    doctor_ids = list({a.doctor_id for a in appointments if a.doctor_id})

    patient_map: dict = {}
    if patient_ids:
        p_rows = (await db.execute(
            select(Patient.id, Patient.first_name, Patient.last_name)
            .where(Patient.id.in_(patient_ids))
        )).all()
        patient_map = {r.id: f"{r.first_name} {r.last_name}" for r in p_rows}

    doctor_name_map: dict = {}
    if doctor_ids:
        d_rows = (await db.execute(
            select(Doctor.id, User.first_name, User.last_name)
            .join(User, User.id == Doctor.user_id)
            .where(Doctor.id.in_(doctor_ids))
        )).all()
        doctor_name_map = {r[0]: f"Dr. {r[1]} {r[2]}" for r in d_rows}

    return _success(
        [
            {
                "id": a.id,
                "patient_id": a.patient_id,
                "patient_name": patient_map.get(a.patient_id),
                "doctor_id": a.doctor_id,
                "doctor_name": doctor_name_map.get(a.doctor_id),
                "clinic_id": a.clinic_id,
                "appointment_date": a.appointment_date,
                "start_time": a.start_time,
                "scheduled_time": a.start_time,
                "end_time": a.end_time,
                "status": a.status,
                "appointment_type": a.appointment_type,
                "priority": a.priority,
                "chief_complaint": a.chief_complaint,
                "queue_number": a.queue_number,
            }
            for a in appointments
        ],
        meta={"total": total, "page": page, "page_size": page_size},
    )


# ── Get Single Appointment ───────────────────────────────────────
@router.get("/{appointment_id}")
async def get_appointment(
    appointment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get a single appointment by ID with patient/doctor/clinic names."""
    from app.models.patient import Patient
    from app.models.clinic import Clinic
    from app.models.user import User

    result = await db.execute(
        select(Appointment).where(
            Appointment.id == appointment_id,
            Appointment.tenant_id == current_user.tenant_id,
            Appointment.is_deleted == False,
        )
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise NotFoundException(detail="Appointment not found")

    # Enrich with names
    patient_name = None
    if appt.patient_id:
        p_res = await db.execute(select(Patient).where(Patient.id == appt.patient_id))
        p = p_res.scalar_one_or_none()
        if p:
            patient_name = f"{p.first_name} {p.last_name}"

    doctor_name = None
    if appt.doctor_id:
        d_res = await db.execute(select(Doctor).where(Doctor.id == appt.doctor_id))
        d = d_res.scalar_one_or_none()
        if d:
            u_res = await db.execute(select(User).where(User.id == d.user_id))
            u = u_res.scalar_one_or_none()
            if u:
                doctor_name = f"Dr. {u.first_name} {u.last_name}"

    clinic_name = None
    if appt.clinic_id:
        c_res = await db.execute(select(Clinic).where(Clinic.id == appt.clinic_id))
        c = c_res.scalar_one_or_none()
        if c:
            clinic_name = c.name

    return _success({
        "id": appt.id,
        "patient_id": appt.patient_id,
        "patient_name": patient_name,
        "doctor_id": appt.doctor_id,
        "doctor_name": doctor_name,
        "clinic_id": appt.clinic_id,
        "clinic_name": clinic_name,
        "appointment_date": appt.appointment_date,
        "start_time": appt.start_time,
        "end_time": appt.end_time,
        "status": appt.status,
        "appointment_type": appt.appointment_type,
        "priority": appt.priority,
        "chief_complaint": appt.chief_complaint,
        "notes": appt.internal_notes,
        "queue_number": appt.queue_number,
        "cancellation_reason": appt.cancellation_reason,
    })


# ── Cancel Appointment ───────────────────────────────────────────
@router.patch("/{appointment_id}/cancel")
async def cancel_appointment(
    appointment_id: str,
    body: dict,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Cancel an appointment. Checks cancellation policy."""
    result = await db.execute(
        select(Appointment).where(
            Appointment.id == appointment_id,
            Appointment.tenant_id == current_user.tenant_id,
            Appointment.is_deleted == False,
        )
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise NotFoundException(detail="Appointment not found")

    if appt.status in (AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED):
        raise BadRequestException(
            detail=f"Cannot cancel an appointment that is already {appt.status}"
        )

    # Patients can only cancel their own
    if current_user.role == "patient":
        from app.models.patient import Patient
        patient_result = await db.execute(
            select(Patient).where(Patient.user_id == current_user.user_id)
        )
        patient = patient_result.scalar_one_or_none()
        if not patient or appt.patient_id != patient.id:
            from app.core.exceptions import ForbiddenException
            raise ForbiddenException(detail="You can only cancel your own appointments")

    appt.status = AppointmentStatus.CANCELLED
    appt.cancelled_at = datetime.now(timezone.utc).isoformat()
    appt.cancelled_by = current_user.user_id
    appt.cancellation_reason = body.get("reason")
    await db.commit()

    # Promote from waitlist
    background_tasks.add_task(
        _promote_from_waitlist,
        appt.doctor_id,
        appt.clinic_id,
        appt.appointment_date,
        appt.start_time,
    )

    return _success({"appointment_id": appointment_id}, message="Appointment cancelled")


# ── Reschedule ───────────────────────────────────────────────────
@router.patch("/{appointment_id}/reschedule")
async def reschedule_appointment(
    appointment_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Reschedule an appointment to a new date/time."""
    result = await db.execute(
        select(Appointment).where(
            Appointment.id == appointment_id,
            Appointment.tenant_id == current_user.tenant_id,
            Appointment.is_deleted == False,
        )
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise NotFoundException(detail="Appointment not found")

    if appt.status in (AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW):
        raise BadRequestException(detail=f"Cannot reschedule a {appt.status} appointment")

    # Patients can only reschedule their own
    if current_user.role == "patient":
        from app.models.patient import Patient
        patient_result = await db.execute(
            select(Patient).where(Patient.user_id == current_user.user_id)
        )
        patient = patient_result.scalar_one_or_none()
        if not patient or appt.patient_id != patient.id:
            from app.core.exceptions import ForbiddenException
            raise ForbiddenException(detail="You can only reschedule your own appointments")

    new_date = body.get("appointment_date")
    new_start = body.get("start_time")
    if not new_date or not new_start:
        raise BadRequestException(detail="appointment_date and start_time are required")

    try:
        target_date = datetime.strptime(new_date, "%Y-%m-%d").date()
    except ValueError:
        raise BadRequestException(detail="Invalid date format")

    if target_date < datetime.now().date():
        raise BadRequestException(detail="Cannot reschedule to a past date")

    # Check for double booking on new slot
    conflict = await db.execute(
        select(Appointment).where(
            Appointment.id != appointment_id,
            Appointment.doctor_id == appt.doctor_id,
            Appointment.appointment_date == new_date,
            Appointment.start_time == new_start,
            Appointment.is_deleted == False,
            Appointment.status.notin_([AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW]),
        )
    )
    if conflict.scalar_one_or_none():
        raise BadRequestException(detail="The requested slot is already booked. Please choose a different time.")

    duration = appt.duration_minutes or 15
    end_dt = datetime.strptime(new_start, "%H:%M") + timedelta(minutes=duration)

    appt.appointment_date = new_date
    appt.start_time = new_start
    appt.end_time = end_dt.strftime("%H:%M")
    appt.status = AppointmentStatus.SCHEDULED
    await db.commit()

    return _success({"appointment_id": appointment_id}, message="Appointment rescheduled")


# ── Check In ────────────────────────────────────────────────────
@router.patch("/{appointment_id}/check-in")
async def check_in(
    appointment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("appointments:update")),
):
    """Mark patient as checked in."""
    result = await db.execute(
        select(Appointment).where(
            Appointment.id == appointment_id,
            Appointment.tenant_id == current_user.tenant_id,
        )
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise NotFoundException(detail="Appointment not found")

    if appt.status != AppointmentStatus.SCHEDULED:
        raise BadRequestException(detail=f"Cannot check in: appointment is {appt.status}")

    appt.status = AppointmentStatus.CHECKED_IN
    appt.checked_in_at = datetime.now(timezone.utc).isoformat()
    await db.commit()

    return _success({"status": appt.status})


# ── Mark No-Show ─────────────────────────────────────────────────
@router.patch("/{appointment_id}/no-show")
async def mark_no_show(
    appointment_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("appointments:update")),
):
    """Mark a patient as no-show. May trigger a charge."""
    result = await db.execute(
        select(Appointment).where(
            Appointment.id == appointment_id,
            Appointment.tenant_id == current_user.tenant_id,
        )
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise NotFoundException(detail="Appointment not found")

    appt.status = AppointmentStatus.NO_SHOW
    await db.commit()

    # Apply no-show charge if configured
    background_tasks.add_task(_handle_no_show_charge, appointment_id, current_user.tenant_id)

    # Promote from waitlist
    background_tasks.add_task(
        _promote_from_waitlist,
        appt.doctor_id, appt.clinic_id, appt.appointment_date, appt.start_time
    )

    return _success({"status": "no_show"})


# ── Join Waitlist ────────────────────────────────────────────────
@router.post("/waitlist")
async def join_waitlist(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Add patient to waitlist for a doctor/clinic."""
    # Get current max position
    pos_result = await db.execute(
        select(func.max(AppointmentWaitlist.position)).where(
            AppointmentWaitlist.doctor_id == body.get("doctor_id"),
            AppointmentWaitlist.clinic_id == body.get("clinic_id"),
            AppointmentWaitlist.status == "waiting",
            AppointmentWaitlist.is_deleted == False,
        )
    )
    max_pos = pos_result.scalar() or 0

    entry = AppointmentWaitlist(
        tenant_id=current_user.tenant_id,
        patient_id=body.get("patient_id"),
        doctor_id=body.get("doctor_id"),
        clinic_id=body.get("clinic_id"),
        preferred_date_from=body.get("preferred_date_from"),
        preferred_date_until=body.get("preferred_date_until"),
        preferred_time_from=body.get("preferred_time_from"),
        preferred_time_until=body.get("preferred_time_until"),
        chief_complaint=body.get("chief_complaint"),
        position=max_pos + 1,
        created_by=current_user.user_id,
    )
    db.add(entry)
    await db.commit()

    return _success(
        {"waitlist_position": entry.position, "waitlist_id": entry.id},
        message="Added to waitlist successfully",
    )


# ── Background Tasks ─────────────────────────────────────────────
async def _schedule_appointment_reminders(
    appointment_id: str, patient_id: str, appt_date: str, start_time: str
) -> None:
    """Queue reminder tasks for 24h and 2h before appointment."""
    try:
        from app.tasks.notification_tasks import send_appointment_reminder
        # Queue 24h reminder
        send_appointment_reminder.apply_async(
            args=[appointment_id, "24h"],
            eta=_reminder_eta(appt_date, start_time, hours_before=24),
        )
        # Queue 2h reminder
        send_appointment_reminder.apply_async(
            args=[appointment_id, "2h"],
            eta=_reminder_eta(appt_date, start_time, hours_before=2),
        )
    except Exception:
        pass  # Graceful degradation


def _reminder_eta(appt_date: str, start_time: str, hours_before: int):
    from datetime import datetime, timezone, timedelta
    dt = datetime.strptime(f"{appt_date} {start_time}", "%Y-%m-%d %H:%M")
    return dt.replace(tzinfo=timezone.utc) - timedelta(hours=hours_before)


async def _send_appointment_confirmation(
    appointment_id, patient_id, doctor_id, appt_date, start_time
) -> None:
    try:
        from app.tasks.notification_tasks import send_appointment_confirmation
        send_appointment_confirmation.delay(appointment_id)
    except Exception:
        pass


async def _promote_from_waitlist(
    doctor_id: str, clinic_id: str, appt_date: str, start_time: str
) -> None:
    """Auto-promote waitlisted patients when a slot opens."""
    try:
        from app.tasks.appointment_tasks import promote_waitlist_patient
        promote_waitlist_patient.delay(doctor_id, clinic_id, appt_date, start_time)
    except Exception:
        pass


async def _handle_no_show_charge(appointment_id: str, tenant_id: str) -> None:
    try:
        from app.tasks.billing_tasks import process_no_show_charge
        process_no_show_charge.delay(appointment_id)
    except Exception:
        pass
