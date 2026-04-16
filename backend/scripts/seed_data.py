"""Seed demo data for local development.

Creates:
  - 1 Tenant (Demo Clinic Group)
  - 1 Clinic (Demo Medical Center)
  - 1 Super-admin user
  - 1 Tenant-admin user
  - 1 Clinic-admin user
  - 8 Doctors (with User accounts)
  - 15 Patients
  - Medical specializations catalog
"""
import asyncio
import random
import sys
import uuid
from pathlib import Path

# Allow running from repo root or backend/
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.core.config import settings
from app.core.security import hash_password
from app.models import *  # noqa: F401,F403 — ensures all models are registered
from app.core.database import Base
from app.models.clinic import Clinic, ClinicStatus
from app.models.doctor import Doctor, DoctorClinicAssignment
from app.models.lab_report import LabTestCatalog
from app.models.patient import Patient, BloodGroup, MaritalStatus
from app.models.specialization import Specialization
from app.models.tenant import Tenant, TenantStatus, SubscriptionPlan
from app.models.user import User, UserRole, UserStatus
from app.models.user_tenant import UserTenant


# ── Fixed IDs (idempotent reruns) ─────────────────────────────────────────────
DEMO_TENANT_ID  = "00000000-0000-0000-0000-000000000001"
DEMO_CLINIC_ID  = "00000000-0000-0000-0000-000000000002"
DEMO_TENANT_SLUG = "demo"

# ── Credentials ───────────────────────────────────────────────────────────────
SUPER_ADMIN_EMAIL    = "admin@demo.com"
TENANT_ADMIN_EMAIL   = "tenant@demo.com"
CLINIC_ADMIN_EMAIL   = "clinic@demo.com"
DEFAULT_PASSWORD     = "Admin1234!"

# ── Lab test catalog ──────────────────────────────────────────────────────────
# (test_name, test_code, loinc_code, panel_name, category, specimen_type, is_fasting)
LAB_TESTS = [
    # Hematology
    ("Complete Blood Count (CBC)", "CBC", "58410-2", "CBC", "Hematology", "Blood", False),
    ("White Blood Cell Count", "WBC", "6690-2", "CBC", "Hematology", "Blood", False),
    ("Red Blood Cell Count", "RBC", "789-8", "CBC", "Hematology", "Blood", False),
    ("Hemoglobin", "HGB", "718-7", "CBC", "Hematology", "Blood", False),
    ("Hematocrit", "HCT", "4544-3", "CBC", "Hematology", "Blood", False),
    ("Platelet Count", "PLT", "777-3", "CBC", "Hematology", "Blood", False),
    ("Erythrocyte Sedimentation Rate (ESR)", "ESR", "30341-2", None, "Hematology", "Blood", False),
    ("Peripheral Blood Smear", "PBS", "5909-7", None, "Hematology", "Blood", False),
    # Chemistry
    ("Basic Metabolic Panel (BMP)", "BMP", "51990-0", "BMP", "Chemistry", "Blood", True),
    ("Comprehensive Metabolic Panel (CMP)", "CMP", "24323-8", "CMP", "Chemistry", "Blood", True),
    ("Glucose (Fasting)", "GLU-F", "1558-6", None, "Chemistry", "Blood", True),
    ("Glucose (Random)", "GLU-R", "2345-7", None, "Chemistry", "Blood", False),
    ("Blood Urea Nitrogen (BUN)", "BUN", "3094-0", "BMP", "Chemistry", "Blood", False),
    ("Creatinine", "CREAT", "2160-0", "BMP", "Chemistry", "Blood", False),
    ("eGFR", "EGFR", "62238-1", "BMP", "Chemistry", "Blood", False),
    ("Sodium", "NA", "2951-2", "BMP", "Chemistry", "Blood", False),
    ("Potassium", "K", "2823-3", "BMP", "Chemistry", "Blood", False),
    ("Chloride", "CL", "2075-0", "BMP", "Chemistry", "Blood", False),
    ("Bicarbonate / CO2", "CO2", "1963-8", "BMP", "Chemistry", "Blood", False),
    ("Calcium", "CA", "17861-6", "BMP", "Chemistry", "Blood", False),
    ("Alanine Aminotransferase (ALT)", "ALT", "1742-6", "LFT", "Chemistry", "Blood", False),
    ("Aspartate Aminotransferase (AST)", "AST", "1920-8", "LFT", "Chemistry", "Blood", False),
    ("Alkaline Phosphatase (ALP)", "ALP", "6768-6", "LFT", "Chemistry", "Blood", False),
    ("Total Bilirubin", "TBIL", "1975-2", "LFT", "Chemistry", "Blood", False),
    ("Direct Bilirubin", "DBIL", "1968-7", "LFT", "Chemistry", "Blood", False),
    ("Albumin", "ALB", "1751-7", "LFT", "Chemistry", "Blood", False),
    ("Total Protein", "TP", "2885-2", "LFT", "Chemistry", "Blood", False),
    ("Uric Acid", "UA", "3084-1", None, "Chemistry", "Blood", False),
    ("Lactate Dehydrogenase (LDH)", "LDH", "2532-0", None, "Chemistry", "Blood", False),
    # Lipids
    ("Lipid Panel", "LIPID", "57698-3", "Lipid Panel", "Lipids", "Blood", True),
    ("Total Cholesterol", "CHOL", "2093-3", "Lipid Panel", "Lipids", "Blood", True),
    ("HDL Cholesterol", "HDL", "2085-9", "Lipid Panel", "Lipids", "Blood", True),
    ("LDL Cholesterol", "LDL", "2089-1", "Lipid Panel", "Lipids", "Blood", True),
    ("Triglycerides", "TRIG", "2571-8", "Lipid Panel", "Lipids", "Blood", True),
    # Thyroid
    ("TSH (Thyroid Stimulating Hormone)", "TSH", "3016-3", "Thyroid Panel", "Thyroid", "Blood", False),
    ("Free T4 (Thyroxine)", "FT4", "3024-7", "Thyroid Panel", "Thyroid", "Blood", False),
    ("Free T3 (Triiodothyronine)", "FT3", "3051-0", "Thyroid Panel", "Thyroid", "Blood", False),
    ("T4 Total", "T4", "3026-2", "Thyroid Panel", "Thyroid", "Blood", False),
    ("T3 Total", "T3", "3053-6", "Thyroid Panel", "Thyroid", "Blood", False),
    ("Anti-TPO Antibodies", "ATPO", "8099-6", None, "Thyroid", "Blood", False),
    # Diabetes
    ("HbA1c (Glycated Hemoglobin)", "HBA1C", "4548-4", None, "Diabetes", "Blood", False),
    ("Insulin (Fasting)", "INS", "20448-7", None, "Diabetes", "Blood", True),
    ("C-Peptide", "CPEP", "1986-5", None, "Diabetes", "Blood", False),
    # Cardiac
    ("Troponin I", "TROPI", "10839-9", "Cardiac Panel", "Cardiac", "Blood", False),
    ("Troponin T", "TROPT", "6598-7", "Cardiac Panel", "Cardiac", "Blood", False),
    ("BNP (B-type Natriuretic Peptide)", "BNP", "42637-9", "Cardiac Panel", "Cardiac", "Blood", False),
    ("NT-proBNP", "NTPRO", "33762-6", "Cardiac Panel", "Cardiac", "Blood", False),
    ("CK-MB", "CKMB", "13969-1", "Cardiac Panel", "Cardiac", "Blood", False),
    ("Creatine Kinase (CK/CPK)", "CK", "2157-6", None, "Cardiac", "Blood", False),
    # Coagulation
    ("Prothrombin Time / INR (PT/INR)", "PT", "5902-2", "Coagulation Panel", "Coagulation", "Blood", False),
    ("Activated Partial Thromboplastin Time (aPTT)", "APTT", "3173-2", "Coagulation Panel", "Coagulation", "Blood", False),
    ("D-Dimer", "DIMER", "48065-7", None, "Coagulation", "Blood", False),
    ("Fibrinogen", "FIB", "3255-7", None, "Coagulation", "Blood", False),
    ("International Normalized Ratio (INR)", "INR", "34714-6", None, "Coagulation", "Blood", False),
    # Inflammation / Infection
    ("C-Reactive Protein (CRP)", "CRP", "1988-5", None, "Inflammation", "Blood", False),
    ("High-Sensitivity CRP (hsCRP)", "HSCRP", "30522-7", None, "Inflammation", "Blood", False),
    ("Procalcitonin (PCT)", "PCT", "33959-8", None, "Inflammation", "Blood", False),
    ("Blood Culture", "BXCUL", "600-7", None, "Microbiology", "Blood", False),
    ("Urine Culture", "UXCUL", "630-4", None, "Microbiology", "Urine", False),
    ("Wound Culture", "WXCUL", "625-4", None, "Microbiology", "Wound Swab", False),
    ("Throat Culture", "TXCUL", "626-2", None, "Microbiology", "Throat Swab", False),
    ("Stool Culture", "SXCUL", "625-4", None, "Microbiology", "Stool", False),
    # Urinalysis
    ("Urinalysis (UA)", "UA", "24357-6", None, "Urinalysis", "Urine", False),
    ("Urine Microalbumin", "MALB", "14957-5", None, "Urinalysis", "Urine", False),
    ("Urine Creatinine", "UCREAT", "2161-8", None, "Urinalysis", "Urine", False),
    ("Urine Protein", "UPROT", "2888-6", None, "Urinalysis", "Urine", False),
    # Vitamins & Minerals
    ("Vitamin D (25-OH)", "VITD", "1989-3", None, "Vitamins & Minerals", "Blood", False),
    ("Vitamin B12 (Cobalamin)", "B12", "2132-9", None, "Vitamins & Minerals", "Blood", False),
    ("Folate (Folic Acid)", "FOLATE", "2284-8", None, "Vitamins & Minerals", "Blood", False),
    ("Iron", "FE", "2498-4", "Iron Studies", "Vitamins & Minerals", "Blood", False),
    ("Ferritin", "FERR", "2276-4", "Iron Studies", "Vitamins & Minerals", "Blood", False),
    ("TIBC (Total Iron Binding Capacity)", "TIBC", "2500-7", "Iron Studies", "Vitamins & Minerals", "Blood", False),
    ("Zinc", "ZN", "2234-3", None, "Vitamins & Minerals", "Blood", False),
    ("Magnesium", "MG", "2601-3", None, "Vitamins & Minerals", "Blood", False),
    # Hormones
    ("Testosterone (Total)", "TEST", "2986-8", None, "Hormones", "Blood", False),
    ("Estradiol (E2)", "E2", "2243-4", None, "Hormones", "Blood", False),
    ("Progesterone", "PROG", "2839-9", None, "Hormones", "Blood", False),
    ("FSH (Follicle Stimulating Hormone)", "FSH", "15067-2", None, "Hormones", "Blood", False),
    ("LH (Luteinizing Hormone)", "LH", "10501-5", None, "Hormones", "Blood", False),
    ("Prolactin", "PRL", "2842-3", None, "Hormones", "Blood", False),
    ("Cortisol", "CORT", "2143-6", None, "Hormones", "Blood", False),
    ("Beta-hCG (Pregnancy Test)", "HCG", "19080-1", None, "Hormones", "Blood", False),
    # Tumor Markers
    ("PSA (Prostate Specific Antigen)", "PSA", "2857-1", None, "Tumor Markers", "Blood", False),
    ("CA-125", "CA125", "10334-1", None, "Tumor Markers", "Blood", False),
    ("CA 19-9", "CA199", "24108-3", None, "Tumor Markers", "Blood", False),
    ("CEA (Carcinoembryonic Antigen)", "CEA", "2857-1", None, "Tumor Markers", "Blood", False),
    ("AFP (Alpha-Fetoprotein)", "AFP", "1834-1", None, "Tumor Markers", "Blood", False),
    # Immunology
    ("ANA (Antinuclear Antibody)", "ANA", "5048-4", None, "Immunology", "Blood", False),
    ("Rheumatoid Factor (RF)", "RF", "11572-5", None, "Immunology", "Blood", False),
    ("Anti-dsDNA Antibody", "DSDNA", "5049-2", None, "Immunology", "Blood", False),
    ("Anti-CCP Antibody", "ACCP", "33935-8", None, "Immunology", "Blood", False),
    ("Complement C3", "C3", "4535-1", None, "Immunology", "Blood", False),
    ("Complement C4", "C4", "4536-9", None, "Immunology", "Blood", False),
    # Infectious Disease
    ("HIV 1/2 Antibody", "HIV", "29893-5", None, "Infectious Disease", "Blood", False),
    ("Hepatitis B Surface Antigen (HBsAg)", "HBSAG", "5196-1", None, "Infectious Disease", "Blood", False),
    ("Hepatitis C Antibody (Anti-HCV)", "HCV", "16128-1", None, "Infectious Disease", "Blood", False),
    ("Hepatitis B Core Antibody (Anti-HBc)", "HBCORE", "22316-4", None, "Infectious Disease", "Blood", False),
    ("Hepatitis B Surface Antibody (Anti-HBs)", "HBSAB", "10900-9", None, "Infectious Disease", "Blood", False),
    ("VDRL / RPR (Syphilis)", "VDRL", "5292-8", None, "Infectious Disease", "Blood", False),
    ("Malaria Antigen Test", "MAL", "32700-7", None, "Infectious Disease", "Blood", False),
    ("Dengue NS1 Antigen", "DENG", "62462-7", None, "Infectious Disease", "Blood", False),
    ("Typhoid (Widal) Test", "WIDAL", "31100-1", None, "Infectious Disease", "Blood", False),
    ("COVID-19 PCR", "COVID", "94500-6", None, "Infectious Disease", "Nasopharyngeal Swab", False),
]

# ── Specialization catalog ────────────────────────────────────────────────────
SPECIALIZATIONS = [
    # Medical
    ("Cardiology", "Medical"), ("Endocrinology", "Medical"), ("Gastroenterology", "Medical"),
    ("General Practice", "Medical"), ("Geriatrics", "Medical"), ("Hematology", "Medical"),
    ("Infectious Disease", "Medical"), ("Internal Medicine", "Medical"), ("Nephrology", "Medical"),
    ("Neurology", "Medical"), ("Oncology", "Medical"), ("Pulmonology", "Medical"),
    ("Rheumatology", "Medical"),
    # Surgical
    ("Cardiothoracic Surgery", "Surgical"), ("General Surgery", "Surgical"),
    ("Neurosurgery", "Surgical"), ("Orthopedic Surgery", "Surgical"),
    ("Plastic Surgery", "Surgical"), ("Urology", "Surgical"), ("Vascular Surgery", "Surgical"),
    # Diagnostic
    ("Pathology", "Diagnostic"), ("Radiology", "Diagnostic"),
    # Allied Health
    ("Dermatology", "Allied Health"), ("Ophthalmology", "Allied Health"),
    ("Otolaryngology (ENT)", "Allied Health"), ("Pediatrics", "Allied Health"),
    ("Obstetrics & Gynecology", "Allied Health"), ("Physical Medicine", "Allied Health"),
    ("Anesthesiology", "Allied Health"), ("Emergency Medicine", "Allied Health"),
    # Mental Health
    ("Psychiatry", "Mental Health"), ("Psychology", "Mental Health"),
]

# ── Doctor seed data ──────────────────────────────────────────────────────────
DOCTORS = [
    {
        "first_name": "James",   "last_name": "Harrison",
        "email": "dr.harrison@demo.com",
        "registration_number": "REG-001",
        "specialization": "Cardiology",
        "experience_years": 15,
        "consultation_fee": 150.0,
        "biography": "Board-certified cardiologist with 15 years of experience in interventional cardiology.",
        "average_rating": 4.8, "total_ratings": 120,
    },
    {
        "first_name": "Sarah",   "last_name": "Mitchell",
        "email": "dr.mitchell@demo.com",
        "registration_number": "REG-002",
        "specialization": "Pediatrics",
        "experience_years": 10,
        "consultation_fee": 100.0,
        "biography": "Dedicated pediatrician focused on child wellness and preventive care.",
        "average_rating": 4.9, "total_ratings": 95,
    },
    {
        "first_name": "Robert",  "last_name": "Chen",
        "email": "dr.chen@demo.com",
        "registration_number": "REG-003",
        "specialization": "Orthopedic Surgery",
        "experience_years": 18,
        "consultation_fee": 200.0,
        "biography": "Specialist in joint replacement and sports medicine injuries.",
        "average_rating": 4.7, "total_ratings": 80,
    },
    {
        "first_name": "Priya",   "last_name": "Sharma",
        "email": "dr.sharma@demo.com",
        "registration_number": "REG-004",
        "specialization": "Obstetrics & Gynecology",
        "experience_years": 12,
        "consultation_fee": 130.0,
        "biography": "Women's health specialist with expertise in high-risk pregnancies.",
        "average_rating": 4.9, "total_ratings": 150,
    },
    {
        "first_name": "Michael", "last_name": "Torres",
        "email": "dr.torres@demo.com",
        "registration_number": "REG-005",
        "specialization": "Neurology",
        "experience_years": 14,
        "consultation_fee": 180.0,
        "biography": "Neurologist specializing in epilepsy, migraines, and stroke management.",
        "average_rating": 4.6, "total_ratings": 60,
    },
    {
        "first_name": "Emily",   "last_name": "Watson",
        "email": "dr.watson@demo.com",
        "registration_number": "REG-006",
        "specialization": "Dermatology",
        "experience_years": 8,
        "consultation_fee": 120.0,
        "biography": "Dermatologist with expertise in cosmetic procedures and skin cancer screening.",
        "average_rating": 4.7, "total_ratings": 110,
    },
    {
        "first_name": "David",   "last_name": "Okafor",
        "email": "dr.okafor@demo.com",
        "registration_number": "REG-007",
        "specialization": "General Practice",
        "experience_years": 20,
        "consultation_fee": 80.0,
        "biography": "Family physician providing comprehensive primary care for all age groups.",
        "average_rating": 4.8, "total_ratings": 200,
    },
    {
        "first_name": "Aisha",   "last_name": "Al-Rashid",
        "email": "dr.alrashid@demo.com",
        "registration_number": "REG-008",
        "specialization": "Psychiatry",
        "experience_years": 11,
        "consultation_fee": 160.0,
        "biography": "Psychiatrist specializing in mood disorders, anxiety, and cognitive behavioral therapy.",
        "average_rating": 4.9, "total_ratings": 75,
    },
]

# ── Patient seed data ─────────────────────────────────────────────────────────
PATIENTS = [
    {
        "first_name": "Alice",   "last_name": "Johnson",
        "mrn": "MRN-0001", "dob": "1985-03-14", "gender": "female",
        "phone": "+1-555-0101", "email": "alice.johnson@email.com",
        "blood_group": "A+",   "city": "New York",     "state": "NY",
    },
    {
        "first_name": "Brian",   "last_name": "Smith",
        "mrn": "MRN-0002", "dob": "1978-07-22", "gender": "male",
        "phone": "+1-555-0102", "email": "brian.smith@email.com",
        "blood_group": "O+",   "city": "Los Angeles",  "state": "CA",
    },
    {
        "first_name": "Clara",   "last_name": "Davis",
        "mrn": "MRN-0003", "dob": "1992-11-05", "gender": "female",
        "phone": "+1-555-0103", "email": "clara.davis@email.com",
        "blood_group": "B+",   "city": "Chicago",      "state": "IL",
    },
    {
        "first_name": "Daniel",  "last_name": "Martinez",
        "mrn": "MRN-0004", "dob": "1965-01-30", "gender": "male",
        "phone": "+1-555-0104", "email": "daniel.martinez@email.com",
        "blood_group": "AB+",  "city": "Houston",      "state": "TX",
    },
    {
        "first_name": "Eva",     "last_name": "Wilson",
        "mrn": "MRN-0005", "dob": "2000-06-18", "gender": "female",
        "phone": "+1-555-0105", "email": "eva.wilson@email.com",
        "blood_group": "O-",   "city": "Phoenix",      "state": "AZ",
    },
    {
        "first_name": "Frank",   "last_name": "Anderson",
        "mrn": "MRN-0006", "dob": "1955-09-25", "gender": "male",
        "phone": "+1-555-0106", "email": "frank.anderson@email.com",
        "blood_group": "A-",   "city": "Philadelphia", "state": "PA",
    },
    {
        "first_name": "Grace",   "last_name": "Taylor",
        "mrn": "MRN-0007", "dob": "1988-12-03", "gender": "female",
        "phone": "+1-555-0107", "email": "grace.taylor@email.com",
        "blood_group": "B-",   "city": "San Antonio",  "state": "TX",
    },
    {
        "first_name": "Henry",   "last_name": "Thomas",
        "mrn": "MRN-0008", "dob": "1972-04-11", "gender": "male",
        "phone": "+1-555-0108", "email": "henry.thomas@email.com",
        "blood_group": "O+",   "city": "San Diego",    "state": "CA",
    },
    {
        "first_name": "Isabelle","last_name": "Jackson",
        "mrn": "MRN-0009", "dob": "1995-08-27", "gender": "female",
        "phone": "+1-555-0109", "email": "isabelle.jackson@email.com",
        "blood_group": "A+",   "city": "Dallas",       "state": "TX",
    },
    {
        "first_name": "James",   "last_name": "White",
        "mrn": "MRN-0010", "dob": "1960-02-14", "gender": "male",
        "phone": "+1-555-0110", "email": "james.white@email.com",
        "blood_group": "AB-",  "city": "San Jose",     "state": "CA",
    },
    {
        "first_name": "Karen",   "last_name": "Harris",
        "mrn": "MRN-0011", "dob": "1983-05-09", "gender": "female",
        "phone": "+1-555-0111", "email": "karen.harris@email.com",
        "blood_group": "O+",   "city": "Austin",       "state": "TX",
    },
    {
        "first_name": "Leo",     "last_name": "Clark",
        "mrn": "MRN-0012", "dob": "2010-10-20", "gender": "male",
        "phone": "+1-555-0112", "email": "leo.clark@email.com",
        "blood_group": "A+",   "city": "Jacksonville", "state": "FL",
        "is_minor": True,
    },
    {
        "first_name": "Maria",   "last_name": "Lewis",
        "mrn": "MRN-0013", "dob": "1970-07-07", "gender": "female",
        "phone": "+1-555-0113", "email": "maria.lewis@email.com",
        "blood_group": "B+",   "city": "Columbus",     "state": "OH",
    },
    {
        "first_name": "Nathan",  "last_name": "Robinson",
        "mrn": "MRN-0014", "dob": "1990-03-31", "gender": "male",
        "phone": "+1-555-0114", "email": "nathan.robinson@email.com",
        "blood_group": "O+",   "city": "Charlotte",    "state": "NC",
    },
    {
        "first_name": "Olivia",  "last_name": "Walker",
        "mrn": "MRN-0015", "dob": "2005-01-15", "gender": "female",
        "phone": "+1-555-0115", "email": "olivia.walker@email.com",
        "blood_group": "AB+",  "city": "Indianapolis", "state": "IN",
        "is_minor": True,
    },
]


# ── Seed function ─────────────────────────────────────────────────────────────

async def seed(session: AsyncSession) -> None:
    # ── Tenant ────────────────────────────────────────────────────────────────
    existing_tenant = await session.scalar(select(Tenant).where(Tenant.id == DEMO_TENANT_ID))
    if not existing_tenant:
        session.add(Tenant(
            id=DEMO_TENANT_ID,
            name="Demo Clinic Group",
            slug=DEMO_TENANT_SLUG,
            status=TenantStatus.ACTIVE,
            subscription_plan=SubscriptionPlan.ENTERPRISE,
            primary_email="contact@demo.com",
            country="US",
            timezone="America/New_York",
            max_clinics=10,
            max_doctors=100,
            max_patients=10000,
        ))
        await session.flush()
        print(f"  [+] Tenant:       Demo Clinic Group")
    else:
        print(f"  [ ] Tenant already exists")

    # ── Clinic ────────────────────────────────────────────────────────────────
    existing_clinic = await session.scalar(select(Clinic).where(Clinic.id == DEMO_CLINIC_ID))
    if not existing_clinic:
        session.add(Clinic(
            id=DEMO_CLINIC_ID,
            tenant_id=DEMO_TENANT_ID,
            name="Demo Medical Center",
            code="DMC-001",
            status=ClinicStatus.ACTIVE,
            address_line1="123 Health Street",
            city="New York",
            state="NY",
            postal_code="10001",
            country="US",
            phone="+1-555-9000",
            email="info@democlinic.com",
            timezone="America/New_York",
            operating_hours={
                "monday":    {"open": "08:00", "close": "18:00", "closed": False},
                "tuesday":   {"open": "08:00", "close": "18:00", "closed": False},
                "wednesday": {"open": "08:00", "close": "18:00", "closed": False},
                "thursday":  {"open": "08:00", "close": "18:00", "closed": False},
                "friday":    {"open": "08:00", "close": "17:00", "closed": False},
                "saturday":  {"open": "09:00", "close": "14:00", "closed": False},
                "sunday":    {"open": "00:00", "close": "00:00", "closed": True},
            },
        ))
        await session.flush()
        print(f"  [+] Clinic:       Demo Medical Center")
    else:
        print(f"  [ ] Clinic already exists")

    # ── Admin users ───────────────────────────────────────────────────────────
    # ── Super admin (platform-level — no UserTenant required) ────────────────
    super_admin = await session.scalar(
        select(User).where(User.email == SUPER_ADMIN_EMAIL, User.is_deleted.isnot(True))
    )
    if not super_admin:
        session.add(User(
            id=str(uuid.uuid4()),
            email=SUPER_ADMIN_EMAIL,
            password_hash=hash_password(DEFAULT_PASSWORD),
            first_name="Super",
            last_name="Admin",
            is_super_admin=True,
            is_email_verified=True,
            failed_login_attempts=0,
        ))
        print(f"  [+] Super Admin: {SUPER_ADMIN_EMAIL} / {DEFAULT_PASSWORD}")
    else:
        # Ensure the flag is set on existing records
        if not super_admin.is_super_admin:
            super_admin.is_super_admin = True
        print(f"  [ ] Super Admin already exists: {SUPER_ADMIN_EMAIL}")

    await session.flush()

    # ── Tenant-scoped admins (need UserTenant) ────────────────────────────────
    tenant_users = [
        (TENANT_ADMIN_EMAIL, "Tenant", "Admin",  UserRole.TENANT_ADMIN, "tenant-admin"),
        (CLINIC_ADMIN_EMAIL, "Clinic", "Admin",  UserRole.CLINIC_ADMIN, "clinic-admin"),
    ]
    for email, first, last, role, label in tenant_users:
        user = await session.scalar(
            select(User).where(User.email == email, User.is_deleted.isnot(True))
        )
        if not user:
            user = User(
                id=str(uuid.uuid4()),
                email=email,
                password_hash=hash_password(DEFAULT_PASSWORD),
                first_name=first,
                last_name=last,
                is_email_verified=True,
                failed_login_attempts=0,
            )
            session.add(user)
            await session.flush()
            print(f"  [+] User ({label}): {email} / {DEFAULT_PASSWORD}")
        else:
            print(f"  [ ] User already exists: {email}")

        existing_ut = await session.scalar(
            select(UserTenant).where(
                UserTenant.user_id == user.id,
                UserTenant.tenant_id == DEMO_TENANT_ID,
                UserTenant.is_deleted.isnot(True),
            )
        )
        if not existing_ut:
            session.add(UserTenant(
                user_id=user.id,
                tenant_id=DEMO_TENANT_ID,
                role=role,
                status=UserStatus.ACTIVE,
                clinic_id=DEMO_CLINIC_ID if role in (UserRole.CLINIC_ADMIN, UserRole.RECEPTIONIST, UserRole.NURSE, UserRole.PHARMACIST, UserRole.LAB_TECHNICIAN) else None,
            ))
            print(f"  [+] UserTenant ({label}): {email} → {DEMO_TENANT_ID}")

    await session.flush()

    # ── Lab Test Catalog ──────────────────────────────────────────────────────
    from app.models.lab_report import LabTestCatalog
    existing_test = await session.scalar(select(LabTestCatalog))
    if not existing_test:
        for test_name, test_code, loinc_code, panel_name, category, specimen_type, is_fasting in LAB_TESTS:
            session.add(LabTestCatalog(
                test_name=test_name,
                test_code=test_code,
                loinc_code=loinc_code,
                panel_name=panel_name,
                category=category,
                specimen_type=specimen_type,
                is_fasting_required=is_fasting,
                is_active=True,
                created_by="system",
                updated_by="system",
            ))
        await session.flush()
        print(f"  [+] Lab Test Catalog: {len(LAB_TESTS)} tests seeded")
    else:
        print(f"  [ ] Lab Test Catalog already exists")

    # ── Specializations ───────────────────────────────────────────────────────
    existing_spec = await session.scalar(select(Specialization))
    if not existing_spec:
        for i, (name, category) in enumerate(SPECIALIZATIONS):
            session.add(Specialization(
                name=name, category=category, sort_order=i,
                created_by="system", updated_by="system",
            ))
        await session.flush()
        print(f"  [+] Specializations: {len(SPECIALIZATIONS)} seeded")
    else:
        print(f"  [ ] Specializations already exist")

    # ── Doctors ───────────────────────────────────────────────────────────────
    doctors_created = 0
    for d in DOCTORS:
        exists = await session.scalar(
            select(User).where(User.email == d["email"], User.is_deleted.isnot(True))
        )
        if exists:
            continue

        user = User(
            id=str(uuid.uuid4()),
            email=d["email"],
            password_hash=hash_password(DEFAULT_PASSWORD),
            first_name=d["first_name"],
            last_name=d["last_name"],
            is_email_verified=True,
            failed_login_attempts=0,
        )
        session.add(user)
        await session.flush()

        # Tenant membership for this doctor
        session.add(UserTenant(
            user_id=user.id,
            tenant_id=DEMO_TENANT_ID,
            role=UserRole.DOCTOR,
            status=UserStatus.ACTIVE,
            clinic_id=DEMO_CLINIC_ID,
        ))
        await session.flush()

        doctor = Doctor(
            tenant_id=DEMO_TENANT_ID,
            user_id=user.id,
            registration_number=d["registration_number"],
            primary_specialization=d["specialization"],
            experience_years=d["experience_years"],
            consultation_fee=d["consultation_fee"],
            biography=d.get("biography"),
            average_rating=d.get("average_rating", 0.0),
            total_ratings=d.get("total_ratings", 0),
            is_accepting_new_patients=True,
            default_slot_duration=15,
            max_patients_per_day=30,
        )
        session.add(doctor)
        await session.flush()

        # Assign doctor to the demo clinic
        session.add(DoctorClinicAssignment(
            tenant_id=DEMO_TENANT_ID,
            doctor_id=doctor.id,
            clinic_id=DEMO_CLINIC_ID,
            is_primary_clinic=True,
            is_active=True,
        ))
        doctors_created += 1

    if doctors_created:
        print(f"  [+] Doctors: {doctors_created} created (password: {DEFAULT_PASSWORD})")
    else:
        print(f"  [ ] Doctors already exist")

    # ── Patients ──────────────────────────────────────────────────────────────
    patients_created = 0
    for p in PATIENTS:
        exists = await session.scalar(
            select(Patient).where(Patient.mrn == p["mrn"])
        )
        if exists:
            continue

        session.add(Patient(
            tenant_id=DEMO_TENANT_ID,
            mrn=p["mrn"],
            first_name=p["first_name"],
            last_name=p["last_name"],
            date_of_birth=p["dob"],
            gender=p["gender"],
            phone=p["phone"],
            email=p.get("email"),
            blood_group=p.get("blood_group"),
            city=p.get("city"),
            state=p.get("state"),
            country="US",
            is_minor=p.get("is_minor", False),
        ))
        patients_created += 1

    if patients_created:
        print(f"  [+] Patients: {patients_created} created")
    else:
        print(f"  [ ] Patients already exist")

    await session.commit()


async def main() -> None:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Tables OK\n")

    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session() as session:
        await seed(session)

    await engine.dispose()
    print("\nDone. Login credentials:")
    print(f"  Super Admin:  {SUPER_ADMIN_EMAIL} / {DEFAULT_PASSWORD}")
    print(f"  Tenant Admin: {TENANT_ADMIN_EMAIL} / {DEFAULT_PASSWORD}")
    print(f"  Clinic Admin: {CLINIC_ADMIN_EMAIL} / {DEFAULT_PASSWORD}")
    print(f"  Doctors:      dr.harrison@demo.com … dr.alrashid@demo.com / {DEFAULT_PASSWORD}")
    print(f"  Tenant ID header (X-Tenant-ID): {DEMO_TENANT_ID}")


if __name__ == "__main__":
    asyncio.run(main())
