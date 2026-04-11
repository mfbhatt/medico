"""Patient management endpoints."""
import uuid
import secrets
import string
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, CurrentUser, require_perm
from app.core.exceptions import BadRequestException, NotFoundException, ConflictException, ForbiddenException
from app.core.security import hash_password
from app.models.patient import Patient, EmergencyContact, PatientAllergy, ChronicCondition, PatientFamilyLink
from app.models.user import User, UserStatus
from app.models.user_tenant import UserTenant

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


def _generate_temp_password(length: int = 10) -> str:
    """Generate a random temporary password: letters + digits."""
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


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
    current_user: CurrentUser = Depends(get_current_user),
):
    """Register a new patient.

    Staff with patients:create can register any patient.
    Patients with patients:create:family can register a new family member by
    supplying link_to_patient_id equal to their own patient record's ID.
    """
    if current_user.has_permission("patients:create"):
        pass  # full access
    elif current_user.has_permission("patients:create:family"):
        # Patient role: they must link the new record to their own patient record
        link_to_patient_id = body.get("link_to_patient_id")
        if not link_to_patient_id:
            raise ForbiddenException(
                detail="Patients may only register family members (link_to_patient_id required)"
            )
        # Verify link_to_patient_id resolves to the current user's own patient record
        own_patient = await db.execute(
            select(Patient).where(
                Patient.user_id == current_user.user_id,
                Patient.tenant_id == current_user.tenant_id,
                Patient.is_deleted == False,
            )
        )
        own = own_patient.scalar_one_or_none()
        if not own or str(own.id) != str(link_to_patient_id):
            raise ForbiddenException(
                detail="link_to_patient_id must reference your own patient record"
            )
    else:
        raise ForbiddenException(detail=f"Role '{current_user.role}' lacks permission 'patients:create'")

    # Required fields (phone and email are optional for walk-in / on-behalf registrations)
    required = ["first_name", "last_name", "date_of_birth", "gender"]
    for field in required:
        if not body.get(field):
            raise BadRequestException(detail=f"Missing required field: {field}")

    # Check duplicate by phone only when provided
    if body.get("phone"):
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

    # ── Auto-create a user account for the patient ────────────────────────────
    # Only when staff (not a patient self-registering a family member) and the
    # patient has an email or phone we can use as login identity.
    temp_password: Optional[str] = None
    if (
        current_user.role in ("super_admin", "tenant_admin", "clinic_admin", "receptionist")
        and (body.get("email") or body.get("phone"))
        and not body.get("link_to_patient_id")  # skip for family-member sub-records
    ):
        login_email = body.get("email") or None
        login_phone = body.get("phone") or None

        # Check if a user with this email/phone already exists
        existing_user_q = select(User).where(
            (User.email == login_email) if login_email else (User.phone == login_phone)
        )
        existing_user = (await db.execute(existing_user_q)).scalar_one_or_none()

        if existing_user is None:
            temp_password = body.get("password") or _generate_temp_password()
            new_user = User(
                id=str(uuid.uuid4()),
                email=login_email,
                phone=login_phone,
                first_name=body["first_name"],
                last_name=body["last_name"],
                middle_name=body.get("middle_name"),
                gender=body.get("gender"),
                date_of_birth=body["date_of_birth"],
                password_hash=hash_password(temp_password),
                is_email_verified=bool(login_email),
                is_phone_verified=bool(login_phone and not login_email),
            )
            db.add(new_user)
            await db.flush()  # get new_user.id

            # Tenant membership with patient role
            membership = UserTenant(
                id=str(uuid.uuid4()),
                user_id=new_user.id,
                tenant_id=current_user.tenant_id,
                role="patient",
                status=UserStatus.ACTIVE,
                created_by=current_user.user_id,
            )
            db.add(membership)

            # Link user → patient
            patient.user_id = new_user.id
        else:
            # User exists — just link if not already linked to a patient
            existing_patient_q = select(Patient).where(
                Patient.user_id == existing_user.id,
                Patient.is_deleted == False,
            )
            already_linked = (await db.execute(existing_patient_q)).scalar_one_or_none()
            if not already_linked:
                patient.user_id = existing_user.id

    # Auto-link to an existing patient (e.g. patient booking for a family member)
    link_to_patient_id = body.get("link_to_patient_id")
    link_relationship_type = body.get("relationship_type", "child")
    if link_to_patient_id:
        head_result = await db.execute(
            select(Patient).where(
                Patient.id == link_to_patient_id,
                Patient.tenant_id == current_user.tenant_id,
                Patient.is_deleted == False,
            )
        )
        if head_result.scalar_one_or_none():
            family_link = PatientFamilyLink(
                tenant_id=current_user.tenant_id,
                patient_id=link_to_patient_id,
                related_patient_id=patient.id,
                relationship_type=link_relationship_type,
                created_by=current_user.user_id,
            )
            db.add(family_link)

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

    response_data = _patient_response(patient)
    if temp_password is not None:
        username = body.get("email") or body.get("phone")
        response_data["login_credentials"] = {
            "username": username,
            "temporary_password": temp_password,
            "note": "Share these credentials with the patient. They should change their password on first login.",
        }
        # Send credentials via WhatsApp if patient has a phone number
        if patient.phone:
            try:
                from app.tasks.notification_tasks import send_patient_welcome_whatsapp
                send_patient_welcome_whatsapp.delay(
                    phone=patient.phone,
                    patient_name=f"{patient.first_name} {patient.last_name}",
                    username=username,
                    temporary_password=temp_password,
                )
            except Exception:
                pass  # WhatsApp delivery failure must not block registration

    return _success(response_data, message="Patient registered successfully")


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


@router.get("/me/family")
async def get_my_family_members(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Return dependent/linked profiles for the currently authenticated patient."""
    result = await db.execute(
        select(Patient).where(
            Patient.user_id == current_user.user_id,
            Patient.tenant_id == current_user.tenant_id,
            Patient.is_deleted == False,
        )
    )
    patient = result.scalar_one_or_none()
    if not patient:
        return {"success": True, "data": [], "message": "No patient profile found"}

    links_result = await db.execute(
        select(PatientFamilyLink).where(
            or_(
                PatientFamilyLink.patient_id == patient.id,
                PatientFamilyLink.related_patient_id == patient.id,
            ),
            PatientFamilyLink.is_deleted == False,
        )
    )
    links = links_result.scalars().all()

    INVERSE = {
        "child": "parent", "parent": "child",
        "spouse": "spouse", "sibling": "sibling",
        "guardian": "ward", "ward": "guardian",
    }

    # Collect all other-side IDs to batch-fetch
    other_ids = []
    link_meta = []  # (other_patient_id, relationship_label)
    for link in links:
        if str(link.patient_id) == str(patient.id):
            other_ids.append(link.related_patient_id)
            link_meta.append((link.related_patient_id, link.relationship_type))
        else:
            other_ids.append(link.patient_id)
            link_meta.append((link.patient_id, INVERSE.get(link.relationship_type, link.relationship_type)))

    patient_rows = {}
    if other_ids:
        rows = (await db.execute(
            select(Patient).where(
                Patient.id.in_(other_ids),
                Patient.is_deleted == False,
            )
        )).scalars().all()
        patient_rows = {str(p.id): p for p in rows}

    family = []
    seen = set()
    for other_id, rel in link_meta:
        key = str(other_id)
        if key in seen:
            continue
        seen.add(key)
        dep = patient_rows.get(key)
        if dep:
            family.append({
                "id": dep.id,
                "mrn": dep.mrn,
                "first_name": dep.first_name,
                "last_name": dep.last_name,
                "date_of_birth": dep.date_of_birth,
                "gender": dep.gender,
                "is_minor": dep.is_minor,
                "relationship_type": rel,
            })

    return _success(family)


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
                func.concat(Patient.first_name, " ", Patient.last_name).ilike(search),
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

    # Attach family members for this page — check both link directions
    patient_ids = [p.id for p in patients]
    patient_id_set = set(patient_ids)
    family_map: dict = {pid: [] for pid in patient_ids}

    INVERSE = {
        "child": "parent", "parent": "child",
        "spouse": "spouse", "sibling": "sibling",
        "guardian": "ward", "ward": "guardian",
    }

    if patient_ids:
        links_result = await db.execute(
            select(PatientFamilyLink).where(
                or_(
                    PatientFamilyLink.patient_id.in_(patient_ids),
                    PatientFamilyLink.related_patient_id.in_(patient_ids),
                )
            )
        )
        links = links_result.scalars().all()

        # Collect all "other" patient IDs we need to look up
        other_ids = list({
            lnk.related_patient_id if lnk.patient_id in patient_id_set else lnk.patient_id
            for lnk in links
        })
        other_map: dict = {}
        if other_ids:
            rel_result = await db.execute(
                select(Patient).where(Patient.id.in_(other_ids), Patient.is_deleted == False)
            )
            other_map = {rp.id: rp for rp in rel_result.scalars()}

        for lnk in links:
            # Determine which side is the "head" (in our page) and which is the dependent
            if lnk.patient_id in patient_id_set:
                head_id = lnk.patient_id
                dep_id = lnk.related_patient_id
                rel = lnk.relationship_type
            else:
                head_id = lnk.related_patient_id
                dep_id = lnk.patient_id
                rel = INVERSE.get(lnk.relationship_type, lnk.relationship_type)

            dep = other_map.get(dep_id)
            if dep:
                family_map[head_id].append({
                    "id": dep.id,
                    "mrn": dep.mrn,
                    "name": f"{dep.first_name} {dep.last_name}",
                    "relationship_type": rel,
                    "is_minor": dep.is_minor,
                    "date_of_birth": dep.date_of_birth,
                    "gender": dep.gender,
                })

    rows = []
    for p in patients:
        row = _patient_response(p)
        row["family_members"] = family_map.get(p.id, [])
        rows.append(row)

    return _success(rows, meta={"total": total, "page": page, "page_size": page_size})


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


# ── Family Links (Admin) ─────────────────────────────────────────────────────

@router.get("/{patient_id}/family")
async def list_patient_family_links(
    patient_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("patients:read")),
):
    """List all family links for a patient (admin view)."""
    result = await db.execute(
        select(Patient).where(
            Patient.id == patient_id,
            Patient.tenant_id == current_user.tenant_id,
            Patient.is_deleted == False,
        )
    )
    if not result.scalar_one_or_none():
        raise NotFoundException(detail="Patient not found")

    # Fetch links in both directions
    links_result = await db.execute(
        select(PatientFamilyLink).where(
            or_(
                PatientFamilyLink.patient_id == patient_id,
                PatientFamilyLink.related_patient_id == patient_id,
            )
        )
    )
    links = links_result.scalars().all()

    # Collect the "other" patient ID for each link
    other_ids = list({
        (lnk.related_patient_id if lnk.patient_id == patient_id else lnk.patient_id)
        for lnk in links
    })

    other_map: dict = {}
    if other_ids:
        others_result = await db.execute(
            select(Patient).where(Patient.id.in_(other_ids), Patient.is_deleted == False)
        )
        other_map = {p.id: p for p in others_result.scalars()}

    INVERSE = {
        "child": "parent", "parent": "child",
        "spouse": "spouse", "sibling": "sibling",
        "guardian": "ward", "ward": "guardian",
    }

    family = []
    for link in links:
        if link.patient_id == patient_id:
            other_id = link.related_patient_id
            rel = link.relationship_type
        else:
            other_id = link.patient_id
            rel = INVERSE.get(link.relationship_type, link.relationship_type)

        dep = other_map.get(other_id)
        if dep:
            family.append({
                "link_id": link.id,
                "patient_id": dep.id,
                "mrn": dep.mrn,
                "first_name": dep.first_name,
                "last_name": dep.last_name,
                "date_of_birth": dep.date_of_birth,
                "gender": dep.gender,
                "is_minor": dep.is_minor,
                "relationship_type": rel,
            })

    return _success(family)


@router.post("/{patient_id}/family")
async def add_patient_family_link(
    patient_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("patients:update")),
):
    """Link two patients as family members."""
    related_patient_id = body.get("related_patient_id")
    relationship_type = body.get("relationship_type")

    if not related_patient_id or not relationship_type:
        raise BadRequestException(detail="related_patient_id and relationship_type are required")

    if patient_id == related_patient_id:
        raise BadRequestException(detail="Cannot link a patient to themselves")

    for pid in [patient_id, related_patient_id]:
        r = await db.execute(
            select(Patient).where(
                Patient.id == pid,
                Patient.tenant_id == current_user.tenant_id,
                Patient.is_deleted == False,
            )
        )
        if not r.scalar_one_or_none():
            raise NotFoundException(detail=f"Patient {pid} not found")

    existing = await db.execute(
        select(PatientFamilyLink).where(
            PatientFamilyLink.patient_id == patient_id,
            PatientFamilyLink.related_patient_id == related_patient_id,
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictException(detail="This family link already exists")

    link = PatientFamilyLink(
        tenant_id=current_user.tenant_id,
        patient_id=patient_id,
        related_patient_id=related_patient_id,
        relationship_type=relationship_type,
        created_by=current_user.user_id,
    )
    db.add(link)
    await db.commit()

    return _success({"link_id": link.id}, message="Family link created")


@router.delete("/{patient_id}/family/{link_id}")
async def remove_patient_family_link(
    patient_id: str,
    link_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("patients:update")),
):
    """Remove a family link."""
    result = await db.execute(
        select(PatientFamilyLink).where(
            PatientFamilyLink.id == link_id,
            PatientFamilyLink.patient_id == patient_id,
        )
    )
    link = result.scalar_one_or_none()
    if not link:
        raise NotFoundException(detail="Family link not found")

    await db.delete(link)
    await db.commit()

    return _success(None, message="Family link removed")
