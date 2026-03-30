"""Patient schemas: demographics, contacts, allergies, conditions, insurance."""
from typing import List, Optional

from pydantic import EmailStr

from app.models.patient import BloodGroup, MaritalStatus
from app.schemas.base import AuditSchema, BaseSchema


# ── Emergency Contact ──────────────────────────────────────────────────────


class EmergencyContactCreate(BaseSchema):
    name: str
    relationship: str
    phone: str
    alternate_phone: Optional[str] = None
    email: Optional[EmailStr] = None
    is_primary: bool = False


class EmergencyContactResponse(AuditSchema):
    id: str
    patient_id: str
    name: str
    relationship: str
    phone: str
    alternate_phone: Optional[str] = None
    email: Optional[str] = None
    is_primary: bool


# ── Allergy ────────────────────────────────────────────────────────────────


class PatientAllergyCreate(BaseSchema):
    allergen: str
    allergen_type: str  # drug, food, environmental, latex, contrast_media, other
    severity: str       # mild, moderate, severe, life_threatening
    reaction: Optional[str] = None
    onset_date: Optional[str] = None
    is_active: bool = True
    noted_by_doctor_id: Optional[str] = None


class PatientAllergyResponse(AuditSchema):
    id: str
    patient_id: str
    allergen: str
    allergen_type: str
    severity: str
    reaction: Optional[str] = None
    onset_date: Optional[str] = None
    is_active: bool
    noted_by_doctor_id: Optional[str] = None


# ── Chronic Condition ──────────────────────────────────────────────────────


class ChronicConditionCreate(BaseSchema):
    condition_name: str
    icd10_code: Optional[str] = None
    diagnosed_date: Optional[str] = None
    status: str = "active"  # active, remission, resolved
    notes: Optional[str] = None
    diagnosed_by_doctor_id: Optional[str] = None


class ChronicConditionResponse(AuditSchema):
    id: str
    patient_id: str
    condition_name: str
    icd10_code: Optional[str] = None
    diagnosed_date: Optional[str] = None
    status: str
    notes: Optional[str] = None
    diagnosed_by_doctor_id: Optional[str] = None


# ── Insurance Policy ───────────────────────────────────────────────────────


class InsurancePolicyCreate(BaseSchema):
    insurance_provider: str
    policy_number: str
    group_number: Optional[str] = None
    member_id: str
    policy_holder_name: str
    relationship_to_patient: str = "self"
    valid_from: str
    valid_until: Optional[str] = None
    copay_amount: Optional[float] = None
    deductible_amount: Optional[float] = None
    coverage_type: Optional[str] = None
    is_primary: bool = True


class InsurancePolicyResponse(AuditSchema):
    id: str
    patient_id: str
    insurance_provider: str
    policy_number: str
    group_number: Optional[str] = None
    member_id: str
    policy_holder_name: str
    relationship_to_patient: str
    valid_from: str
    valid_until: Optional[str] = None
    copay_amount: Optional[float] = None
    deductible_amount: Optional[float] = None
    coverage_type: Optional[str] = None
    is_primary: bool
    is_active: bool


# ── Family Link ────────────────────────────────────────────────────────────


class FamilyLinkCreate(BaseSchema):
    related_patient_id: str
    relationship_type: str  # parent, child, spouse, sibling, guardian


class FamilyLinkResponse(BaseSchema):
    id: str
    patient_id: str
    related_patient_id: str
    relationship_type: str


# ── Patient ────────────────────────────────────────────────────────────────


class PatientCreate(BaseSchema):
    first_name: str
    last_name: str
    middle_name: Optional[str] = None
    date_of_birth: str  # YYYY-MM-DD
    gender: str
    marital_status: Optional[MaritalStatus] = None
    nationality: Optional[str] = None
    language: str = "en"
    email: Optional[EmailStr] = None
    phone: str
    alternate_phone: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: str = "US"
    blood_group: Optional[BloodGroup] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    preferred_doctor_id: Optional[str] = None
    preferred_clinic_id: Optional[str] = None
    consent_given: bool = False
    consent_date: Optional[str] = None
    marketing_opt_in: bool = False
    emergency_contacts: Optional[List[EmergencyContactCreate]] = None


class PatientUpdate(BaseSchema):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    marital_status: Optional[MaritalStatus] = None
    nationality: Optional[str] = None
    language: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    alternate_phone: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    blood_group: Optional[BloodGroup] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    preferred_doctor_id: Optional[str] = None
    preferred_clinic_id: Optional[str] = None
    consent_given: Optional[bool] = None
    consent_date: Optional[str] = None
    marketing_opt_in: Optional[bool] = None
    is_vip: Optional[bool] = None


class PatientResponse(AuditSchema):
    id: str
    tenant_id: str
    mrn: str
    user_id: Optional[str] = None
    first_name: str
    last_name: str
    middle_name: Optional[str] = None
    date_of_birth: str
    gender: str
    marital_status: Optional[str] = None
    nationality: Optional[str] = None
    language: str
    email: Optional[str] = None
    phone: str
    alternate_phone: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: str
    blood_group: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    is_minor: bool
    is_vip: bool
    is_deceased: bool
    deceased_date: Optional[str] = None
    consent_given: bool
    consent_date: Optional[str] = None
    marketing_opt_in: bool
    preferred_doctor_id: Optional[str] = None
    preferred_clinic_id: Optional[str] = None
    emergency_contacts: List[EmergencyContactResponse] = []
    allergies: List[PatientAllergyResponse] = []
    chronic_conditions: List[ChronicConditionResponse] = []
    insurance_policies: List[InsurancePolicyResponse] = []


class PatientSummary(BaseSchema):
    id: str
    mrn: str
    first_name: str
    last_name: str
    date_of_birth: str
    gender: str
    phone: str
    email: Optional[str] = None
    blood_group: Optional[str] = None
    is_minor: bool
    is_vip: bool
