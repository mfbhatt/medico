"""Prescription management endpoints."""
import uuid
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, CurrentUser, require_perm
from app.core.exceptions import BadRequestException, NotFoundException, ForbiddenException
from app.models.prescription import Prescription, PrescriptionItem, PrescriptionRefillRequest, PrescriptionStatus

router = APIRouter()


def _success(data, message="Success", meta=None):
    return {"success": True, "message": message, "data": data, "meta": meta}


@router.post("/")
async def create_prescription(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("prescriptions:create")),
):
    """Create a digital prescription with drug interaction checking."""
    from app.models.doctor import Doctor
    from app.models.patient import PatientAllergy

    doctor_res = await db.execute(
        select(Doctor).where(Doctor.user_id == current_user.user_id)
    )
    doctor = doctor_res.scalar_one_or_none()
    if not doctor and current_user.role == "doctor":
        raise BadRequestException(detail="Doctor profile not found")

    # Check drug-allergy interactions
    patient_id = body.get("patient_id")
    medications = body.get("medications", [])
    interaction_warnings = []

    if patient_id and medications:
        allergies_res = await db.execute(
            select(PatientAllergy).where(
                PatientAllergy.patient_id == patient_id,
                PatientAllergy.is_active == True,
                PatientAllergy.allergen_type == "drug",
            )
        )
        allergies = [a.allergen.lower() for a in allergies_res.scalars()]

        for med in medications:
            drug_name = med.get("drug_name", "").lower()
            generic_name = med.get("generic_name", "").lower()
            for allergen in allergies:
                if allergen in drug_name or allergen in generic_name:
                    interaction_warnings.append({
                        "type": "allergy",
                        "severity": "high",
                        "drug": med.get("drug_name"),
                        "allergen": allergen,
                        "message": f"Patient has documented allergy to {allergen}",
                    })

    if interaction_warnings and not body.get("override_warnings"):
        return {
            "success": False,
            "error_code": "DRUG_INTERACTION",
            "message": "Drug-allergy interaction detected",
            "data": {"warnings": interaction_warnings},
        }

    # Calculate expiry
    expiry_days = body.get("expiry_days", 30)
    expiry_date = (date.today() + timedelta(days=expiry_days)).isoformat()

    # Generate prescription number
    prefix = date.today().strftime("%Y%m")
    number = f"RX-{prefix}-{str(uuid.uuid4())[:8].upper()}"

    prescription = Prescription(
        tenant_id=current_user.tenant_id,
        medical_record_id=body.get("medical_record_id"),
        patient_id=patient_id,
        doctor_id=doctor.id if doctor else body.get("doctor_id"),
        clinic_id=body.get("clinic_id") or current_user.clinic_id,
        prescription_number=number,
        status=PrescriptionStatus.ACTIVE,
        prescribed_date=date.today().isoformat(),
        expiry_date=expiry_date,
        diagnosis_notes=body.get("diagnosis_notes"),
        special_instructions=body.get("special_instructions"),
        dispense_as_written=body.get("dispense_as_written", False),
        refills_allowed=body.get("refills_allowed", 0),
        is_controlled_substance=body.get("is_controlled_substance", False),
        interaction_warnings=interaction_warnings or None,
        created_by=current_user.user_id,
    )
    db.add(prescription)
    await db.flush()

    for med in medications:
        item = PrescriptionItem(
            tenant_id=current_user.tenant_id,
            prescription_id=prescription.id,
            drug_name=med["drug_name"],
            generic_name=med.get("generic_name"),
            drug_code=med.get("drug_code"),
            form=med.get("form", "tablet"),
            strength=med["strength"],
            dose=med["dose"],
            frequency=med["frequency"],
            route=med.get("route", "oral"),
            duration=med["duration"],
            quantity=med["quantity"],
            instructions=med.get("instructions"),
            take_with_food=med.get("take_with_food"),
            allow_generic=med.get("allow_generic", True),
            created_by=current_user.user_id,
        )
        db.add(item)

    await db.commit()

    return _success(
        {"prescription_id": prescription.id, "prescription_number": number},
        message="Prescription created",
    )


@router.get("/patient/{patient_id}")
async def get_patient_prescriptions(
    patient_id: str,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    query = select(Prescription).where(
        Prescription.patient_id == patient_id,
        Prescription.tenant_id == current_user.tenant_id,
        Prescription.is_deleted == False,
    )
    if status:
        query = query.where(Prescription.status == status)

    query = query.order_by(Prescription.prescribed_date.desc())
    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)

    prescriptions = []
    for p in result.scalars():
        items_res = await db.execute(
            select(PrescriptionItem).where(PrescriptionItem.prescription_id == p.id)
        )
        prescriptions.append({
            "id": p.id,
            "prescription_number": p.prescription_number,
            "prescribed_date": p.prescribed_date,
            "expiry_date": p.expiry_date,
            "status": p.status,
            "refills_remaining": p.refills_remaining,
            "medications": [
                {
                    "drug_name": i.drug_name,
                    "strength": i.strength,
                    "dose": i.dose,
                    "frequency": i.frequency,
                    "duration": i.duration,
                    "instructions": i.instructions,
                }
                for i in items_res.scalars()
            ],
        })

    return _success(prescriptions, meta={"total": total, "page": page, "page_size": page_size})


@router.post("/{prescription_id}/request-refill")
async def request_refill(
    prescription_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Request a prescription refill."""
    from datetime import datetime, timezone

    result = await db.execute(
        select(Prescription).where(
            Prescription.id == prescription_id,
            Prescription.tenant_id == current_user.tenant_id,
            Prescription.is_deleted == False,
        )
    )
    rx = result.scalar_one_or_none()
    if not rx:
        raise NotFoundException()

    if rx.status == PrescriptionStatus.EXPIRED:
        raise BadRequestException(detail="Prescription has expired")

    if rx.refills_remaining <= 0:
        raise BadRequestException(detail="No refills remaining on this prescription")

    request = PrescriptionRefillRequest(
        tenant_id=current_user.tenant_id,
        prescription_id=prescription_id,
        requested_by=current_user.user_id,
        requested_at=datetime.now(timezone.utc).isoformat(),
        status="pending",
        notes=body.get("notes"),
        created_by=current_user.user_id,
    )
    db.add(request)
    await db.commit()

    return _success({"request_id": request.id}, message="Refill request submitted")
