"""Medical Records (EMR/EHR) endpoints."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.database import get_db
from app.core.dependencies import get_current_user, CurrentUser, require_perm
from app.core.exceptions import BadRequestException, NotFoundException, ForbiddenException
from app.models.medical_record import MedicalRecord, MedicalRecordAddendum
from app.models.appointment import Appointment, AppointmentStatus

router = APIRouter()


def _success(data, message="Success", meta=None):
    return {"success": True, "message": message, "data": data, "meta": meta}


def _record_response(r: MedicalRecord) -> dict:
    return {
        "id": r.id,
        "appointment_id": r.appointment_id,
        "patient_id": r.patient_id,
        "doctor_id": r.doctor_id,
        "visit_date": r.visit_date,
        "subjective": r.subjective,
        "objective": r.objective,
        "assessment": r.assessment,
        "plan": r.plan,
        "vitals": r.vitals,
        "diagnoses": r.diagnoses,
        "procedures": r.procedures,
        "follow_up_required": r.follow_up_required,
        "follow_up_days": r.follow_up_days,
        "referrals": r.referrals,
        "attachments": r.attachments,
        "is_signed": r.is_signed,
        "is_locked": r.is_locked,
        "is_confidential": r.is_confidential,
        "clinical_alerts": r.clinical_alerts,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.post("/")
async def create_medical_record(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("medical_records:create")),
):
    """Create a new medical record for an appointment visit."""
    appt_id = body.get("appointment_id")
    if not appt_id:
        raise BadRequestException(detail="appointment_id is required")

    # Verify appointment exists and belongs to this tenant
    appt_res = await db.execute(
        select(Appointment).where(
            Appointment.id == appt_id,
            Appointment.tenant_id == current_user.tenant_id,
        )
    )
    appt = appt_res.scalar_one_or_none()
    if not appt:
        raise NotFoundException(detail="Appointment not found")

    # Check for existing record
    existing = await db.execute(
        select(MedicalRecord).where(
            MedicalRecord.appointment_id == appt_id,
            MedicalRecord.is_deleted == False,
        )
    )
    if existing.scalar_one_or_none():
        raise BadRequestException(detail="Medical record already exists for this appointment")

    # Check for clinical alerts (drug interactions, allergy conflicts)
    alerts = await _check_clinical_alerts(appt.patient_id, body, db)

    record = MedicalRecord(
        tenant_id=current_user.tenant_id,
        appointment_id=appt_id,
        patient_id=appt.patient_id,
        doctor_id=appt.doctor_id,
        clinic_id=appt.clinic_id,
        visit_date=appt.appointment_date,
        subjective=body.get("subjective"),
        objective=body.get("objective"),
        assessment=body.get("assessment"),
        plan=body.get("plan"),
        vitals=body.get("vitals"),
        diagnoses=body.get("diagnoses"),
        procedures=body.get("procedures"),
        follow_up_required=body.get("follow_up_required", False),
        follow_up_days=body.get("follow_up_days"),
        follow_up_notes=body.get("follow_up_notes"),
        referrals=body.get("referrals"),
        is_confidential=body.get("is_confidential", False),
        clinical_alerts=alerts if alerts else None,
        created_by=current_user.user_id,
    )
    db.add(record)

    # Update appointment status to in-progress
    if appt.status == AppointmentStatus.CHECKED_IN:
        appt.status = AppointmentStatus.IN_PROGRESS
        from datetime import datetime, timezone
        appt.consultation_started_at = datetime.now(timezone.utc).isoformat()

    await db.commit()
    return _success(_record_response(record), message="Medical record created")


@router.patch("/{record_id}")
async def update_medical_record(
    record_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("medical_records:update")),
):
    """Update an unsigned medical record."""
    result = await db.execute(
        select(MedicalRecord).where(
            MedicalRecord.id == record_id,
            MedicalRecord.tenant_id == current_user.tenant_id,
            MedicalRecord.is_deleted == False,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise NotFoundException()

    if record.is_locked:
        raise ForbiddenException(
            detail="This record is signed and locked. Add an addendum instead."
        )

    updatable = [
        "subjective", "objective", "assessment", "plan",
        "vitals", "diagnoses", "procedures", "follow_up_required",
        "follow_up_days", "follow_up_notes", "referrals", "attachments",
    ]
    for field in updatable:
        if field in body:
            setattr(record, field, body[field])

    record.updated_by = current_user.user_id
    await db.commit()
    return _success(_record_response(record), message="Record updated")


@router.post("/{record_id}/sign")
async def sign_medical_record(
    record_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("medical_records:update")),
):
    """Sign and lock a medical record. Cannot be edited after this."""
    from datetime import datetime, timezone

    result = await db.execute(
        select(MedicalRecord).where(
            MedicalRecord.id == record_id,
            MedicalRecord.tenant_id == current_user.tenant_id,
            MedicalRecord.is_deleted == False,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise NotFoundException()

    if record.is_locked:
        raise BadRequestException(detail="Record is already signed")

    # Only the doctor who created it can sign
    from app.models.doctor import Doctor
    doctor_res = await db.execute(
        select(Doctor).where(Doctor.user_id == current_user.user_id)
    )
    doctor = doctor_res.scalar_one_or_none()
    if doctor and record.doctor_id != doctor.id:
        raise ForbiddenException(detail="Only the treating doctor can sign this record")

    record.is_signed = True
    record.is_locked = True
    record.signed_at = datetime.now(timezone.utc).isoformat()
    record.signed_by = current_user.user_id

    # Complete the appointment
    appt_res = await db.execute(
        select(Appointment).where(Appointment.id == record.appointment_id)
    )
    appt = appt_res.scalar_one_or_none()
    if appt:
        appt.status = AppointmentStatus.COMPLETED
        appt.consultation_ended_at = datetime.now(timezone.utc).isoformat()

    await db.commit()
    return _success({"is_locked": True}, message="Record signed and locked")


@router.post("/{record_id}/addendum")
async def add_addendum(
    record_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("medical_records:update")),
):
    """Add an addendum to a locked medical record."""
    result = await db.execute(
        select(MedicalRecord).where(
            MedicalRecord.id == record_id,
            MedicalRecord.tenant_id == current_user.tenant_id,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise NotFoundException()

    from app.models.doctor import Doctor
    doctor_res = await db.execute(
        select(Doctor).where(Doctor.user_id == current_user.user_id)
    )
    doctor = doctor_res.scalar_one_or_none()
    if not doctor:
        raise ForbiddenException(detail="Only doctors can add addenda")

    addendum = MedicalRecordAddendum(
        tenant_id=current_user.tenant_id,
        record_id=record_id,
        doctor_id=doctor.id,
        content=body.get("content", ""),
        reason=body.get("reason"),
        created_by=current_user.user_id,
    )
    db.add(addendum)
    await db.commit()

    return _success({"addendum_id": addendum.id}, message="Addendum added")


@router.get("/patient/{patient_id}")
async def get_patient_medical_history(
    patient_id: str,
    page: int = 1,
    page_size: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get paginated medical record history for a patient."""
    # Patients can only view their own records
    if current_user.role == "patient":
        from app.models.patient import Patient
        own_res = await db.execute(
            select(Patient).where(Patient.user_id == current_user.user_id)
        )
        own = own_res.scalar_one_or_none()
        if not own or own.id != patient_id:
            raise ForbiddenException()

    query = select(MedicalRecord).where(
        MedicalRecord.patient_id == patient_id,
        MedicalRecord.tenant_id == current_user.tenant_id,
        MedicalRecord.is_deleted == False,
    ).order_by(MedicalRecord.visit_date.desc())

    total = (await db.execute(
        select(func.count()).select_from(query.subquery())
    )).scalar()

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)

    return _success(
        [_record_response(r) for r in result.scalars()],
        meta={"total": total, "page": page, "page_size": page_size},
    )


async def _check_clinical_alerts(patient_id: str, body: dict, db) -> list:
    """Check for drug interactions, allergy conflicts, etc."""
    alerts = []

    diagnoses = body.get("diagnoses") or []
    # Add alert checks here — integrates with drug API for real-world use
    # For now returns empty list

    return alerts
