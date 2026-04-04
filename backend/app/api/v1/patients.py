"""Patient management endpoints."""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, CurrentUser, require_perm
from app.core.exceptions import BadRequestException, NotFoundException, ConflictException
from app.models.patient import Patient, EmergencyContact, PatientAllergy, ChronicCondition

router = APIRouter()


def _success(data, message="Success", meta=None):
    return {"success": True, "message": message, "data": data, "meta": meta}


def _patient_response(p: Patient) -> dict:
    return {
        "id": p.id,
        "mrn": p.mrn,
        "first_name": p.first_name,
        "last_name": p.last_name,
        "middle_name": p.middle_name,
        "date_of_birth": p.date_of_birth,
        "gender": p.gender,
        "blood_group": p.blood_group,
        "phone": p.phone,
        "email": p.email,
        "city": p.city,
        "state": p.state,
        "country": p.country,
        "is_minor": p.is_minor,
        "is_vip": p.is_vip,
        "is_deceased": p.is_deceased,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def _generate_mrn(tenant_id: str) -> str:
    """Generate a unique Medical Record Number."""
    prefix = tenant_id[:3].upper()
    unique = str(uuid.uuid4()).replace("-", "")[:8].upper()
    return f"{prefix}-{unique}"


# ── Create Patient ───────────────────────────────────────────────
@router.post("/")
async def create_patient(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("patients:create")),
):
    """Register a new patient."""
    # Required fields
    required = ["first_name", "last_name", "date_of_birth", "gender", "phone"]
    for field in required:
        if not body.get(field):
            raise BadRequestException(detail=f"Missing required field: {field}")

    # Check duplicate by phone
    existing = await db.execute(
        select(Patient).where(
            Patient.phone == body["phone"],
            Patient.tenant_id == current_user.tenant_id,
            Patient.is_deleted == False,
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictException(
            detail=f"A patient with phone {body['phone']} already exists. "
                   "Please check for duplicate records."
        )

    # Check for potential duplicate by name + DOB (fuzzy duplicate detection)
    name_dob_check = await db.execute(
        select(Patient).where(
            Patient.first_name.ilike(body["first_name"]),
            Patient.last_name.ilike(body["last_name"]),
            Patient.date_of_birth == body["date_of_birth"],
            Patient.tenant_id == current_user.tenant_id,
            Patient.is_deleted == False,
        )
    )
    potential_duplicate = name_dob_check.scalar_one_or_none()
    if potential_duplicate:
        return {
            "success": False,
            "error_code": "POTENTIAL_DUPLICATE",
            "message": "A patient with similar name and date of birth exists.",
            "data": {
                "existing_patient_id": potential_duplicate.id,
                "existing_mrn": potential_duplicate.mrn,
            },
        }

    # Is minor check
    from datetime import date
    dob = date.fromisoformat(body["date_of_birth"])
    is_minor = (date.today() - dob).days < 18 * 365

    patient = Patient(
        tenant_id=current_user.tenant_id,
        mrn=_generate_mrn(current_user.tenant_id),
        first_name=body["first_name"],
        last_name=body["last_name"],
        middle_name=body.get("middle_name"),
        date_of_birth=body["date_of_birth"],
        gender=body["gender"],
        marital_status=body.get("marital_status"),
        phone=body["phone"],
        alternate_phone=body.get("alternate_phone"),
        email=body.get("email"),
        blood_group=body.get("blood_group"),
        height_cm=body.get("height_cm"),
        weight_kg=body.get("weight_kg"),
        address_line1=body.get("address_line1"),
        address_line2=body.get("address_line2"),
        city=body.get("city"),
        state=body.get("state"),
        postal_code=body.get("postal_code"),
        country=body.get("country", "US"),
        nationality=body.get("nationality"),
        language=body.get("language", "en"),
        is_minor=is_minor,
        is_vip=body.get("is_vip", False),
        consent_given=body.get("consent_given", False),
        consent_date=body.get("consent_date"),
        marketing_opt_in=body.get("marketing_opt_in", False),
        created_by=current_user.user_id,
    )
    db.add(patient)
    await db.flush()

    # Add emergency contacts
    for ec_data in body.get("emergency_contacts", []):
        ec = EmergencyContact(
            tenant_id=current_user.tenant_id,
            patient_id=patient.id,
            name=ec_data["name"],
            relationship=ec_data["relationship"],
            phone=ec_data["phone"],
            alternate_phone=ec_data.get("alternate_phone"),
            email=ec_data.get("email"),
            is_primary=ec_data.get("is_primary", False),
            created_by=current_user.user_id,
        )
        db.add(ec)

    # Add allergies
    for allergy_data in body.get("allergies", []):
        allergy = PatientAllergy(
            tenant_id=current_user.tenant_id,
            patient_id=patient.id,
            allergen=allergy_data["allergen"],
            allergen_type=allergy_data.get("allergen_type", "drug"),
            severity=allergy_data.get("severity", "moderate"),
            reaction=allergy_data.get("reaction"),
            created_by=current_user.user_id,
        )
        db.add(allergy)

    await db.commit()

    return _success(_patient_response(patient), message="Patient registered successfully")


# ── Get Patient ──────────────────────────────────────────────────
@router.get("/me")
async def get_my_patient_profile(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Return the patient profile for the currently authenticated patient user."""
    from datetime import date as date_type

    result = await db.execute(
        select(Patient).where(
            Patient.user_id == current_user.user_id,
            Patient.tenant_id == current_user.tenant_id,
            Patient.is_deleted == False,
        )
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise NotFoundException(detail="Patient not found")

    allergies = await db.execute(
        select(PatientAllergy).where(
            PatientAllergy.patient_id == patient.id,
            PatientAllergy.is_active == True,
        )
    )
    emergency_contacts = await db.execute(
        select(EmergencyContact).where(EmergencyContact.patient_id == patient.id)
    )
    conditions = await db.execute(
        select(ChronicCondition).where(
            ChronicCondition.patient_id == patient.id,
            ChronicCondition.status == "active",
        )
    )

    # Compute age from date_of_birth
    age = None
    if patient.date_of_birth:
        try:
            today = date_type.today()
            dob = patient.date_of_birth if isinstance(patient.date_of_birth, date_type) else date_type.fromisoformat(str(patient.date_of_birth))
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        except Exception:
            pass

    data = _patient_response(patient)
    data["blood_type"] = patient.blood_group  # alias for mobile
    data["age"] = age
    data["allergies"] = [
        {
            "id": a.id,
            "allergen": a.allergen,
            "allergen_type": a.allergen_type,
            "severity": a.severity,
            "reaction": a.reaction,
        }
        for a in allergies.scalars()
    ]
    data["emergency_contacts"] = [
        {
            "id": ec.id,
            "name": ec.name,
            "relationship": ec.relationship,
            "phone": ec.phone,
            "is_primary": ec.is_primary,
        }
        for ec in emergency_contacts.scalars()
    ]
    data["chronic_conditions"] = [
        {
            "id": c.id,
            "condition_name": c.condition_name,
            "icd10_code": c.icd10_code,
            "status": c.status,
        }
        for c in conditions.scalars()
    ]

    return _success(data)


@router.get("/{patient_id}")
async def get_patient(
    patient_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(
        select(Patient).where(
            Patient.id == patient_id,
            Patient.tenant_id == current_user.tenant_id,
            Patient.is_deleted == False,
        )
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise NotFoundException(detail="Patient not found")

    # Patients can only view their own record
    if current_user.role == "patient":
        from app.models.user import User
        user_result = await db.execute(
            select(Patient).where(Patient.user_id == current_user.user_id)
        )
        own_patient = user_result.scalar_one_or_none()
        if not own_patient or own_patient.id != patient_id:
            from app.core.exceptions import ForbiddenException
            raise ForbiddenException()

    # Load related data
    allergies = await db.execute(
        select(PatientAllergy).where(
            PatientAllergy.patient_id == patient_id,
            PatientAllergy.is_active == True,
        )
    )
    emergency_contacts = await db.execute(
        select(EmergencyContact).where(EmergencyContact.patient_id == patient_id)
    )
    conditions = await db.execute(
        select(ChronicCondition).where(
            ChronicCondition.patient_id == patient_id,
            ChronicCondition.status == "active",
        )
    )

    data = _patient_response(patient)
    data["allergies"] = [
        {
            "id": a.id,
            "allergen": a.allergen,
            "allergen_type": a.allergen_type,
            "severity": a.severity,
            "reaction": a.reaction,
        }
        for a in allergies.scalars()
    ]
    data["emergency_contacts"] = [
        {
            "id": ec.id,
            "name": ec.name,
            "relationship": ec.relationship,
            "phone": ec.phone,
            "is_primary": ec.is_primary,
        }
        for ec in emergency_contacts.scalars()
    ]
    data["chronic_conditions"] = [
        {
            "id": c.id,
            "condition_name": c.condition_name,
            "icd10_code": c.icd10_code,
            "status": c.status,
        }
        for c in conditions.scalars()
    ]

    return _success(data)


# ── Search Patients ──────────────────────────────────────────────
@router.get("/")
async def search_patients(
    q: Optional[str] = Query(None, description="Search by name, phone, MRN, or email"),
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("patients:read")),
):
    """Full-text search across patient records."""
    query = select(Patient).where(
        Patient.tenant_id == current_user.tenant_id,
        Patient.is_deleted == False,
    )

    if q:
        search = f"%{q}%"
        query = query.where(
            or_(
                Patient.first_name.ilike(search),
                Patient.last_name.ilike(search),
                Patient.phone.ilike(search),
                Patient.email.ilike(search),
                Patient.mrn.ilike(search),
            )
        )

    # Total count
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar()

    query = query.order_by(Patient.last_name, Patient.first_name)
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    patients = result.scalars().all()

    return _success(
        [_patient_response(p) for p in patients],
        meta={"total": total, "page": page, "page_size": page_size},
    )


# ── Update Patient ───────────────────────────────────────────────
@router.patch("/{patient_id}")
async def update_patient(
    patient_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("patients:update")),
):
    result = await db.execute(
        select(Patient).where(
            Patient.id == patient_id,
            Patient.tenant_id == current_user.tenant_id,
            Patient.is_deleted == False,
        )
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise NotFoundException(detail="Patient not found")

    updatable_fields = [
        "first_name", "last_name", "middle_name", "date_of_birth",
        "gender", "marital_status", "phone", "alternate_phone", "email",
        "address_line1", "address_line2", "city", "state", "postal_code",
        "blood_group", "height_cm", "weight_kg", "language",
        "is_vip", "consent_given", "marketing_opt_in",
    ]
    for field in updatable_fields:
        if field in body:
            setattr(patient, field, body[field])

    patient.updated_by = current_user.user_id
    await db.commit()

    return _success(_patient_response(patient), message="Patient updated")
