"""Main API v1 router — aggregates all sub-routers."""
from fastapi import APIRouter

from app.api.v1 import (
    auth,
    tenants,
    clinics,
    doctors,
    patients,
    appointments,
    medical_records,
    prescriptions,
    lab_reports,
    billing,
    inventory,
    notifications,
    analytics,
    telemedicine,
    files,
    users,
    public,
    specializations,
    settings,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(tenants.router, prefix="/tenants", tags=["Tenants"])
api_router.include_router(clinics.router, prefix="/clinics", tags=["Clinics"])
api_router.include_router(doctors.router, prefix="/doctors", tags=["Doctors"])
api_router.include_router(patients.router, prefix="/patients", tags=["Patients"])
api_router.include_router(appointments.router, prefix="/appointments", tags=["Appointments"])
api_router.include_router(medical_records.router, prefix="/medical-records", tags=["Medical Records"])
api_router.include_router(prescriptions.router, prefix="/prescriptions", tags=["Prescriptions"])
api_router.include_router(lab_reports.router, prefix="/lab", tags=["Lab Reports"])
api_router.include_router(billing.router, prefix="/billing", tags=["Billing"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["Inventory"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
api_router.include_router(telemedicine.router, prefix="/telemedicine", tags=["Telemedicine"])
api_router.include_router(files.router, prefix="/files", tags=["Files"])
api_router.include_router(public.router, prefix="/public", tags=["Public"])
api_router.include_router(specializations.router, prefix="/specializations", tags=["Specializations"])
api_router.include_router(settings.router, prefix="/settings", tags=["Settings"])
