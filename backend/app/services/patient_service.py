"""Patient service: registration, MRN generation, duplicate detection, search."""
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictException, NotFoundException
from app.repositories.patient import PatientRepository
from app.schemas.patient import PatientCreate, PatientUpdate


class PatientService:
    def __init__(self, db: AsyncSession, tenant_id: str):
        self.db = db
        self.tenant_id = tenant_id
        self.repo = PatientRepository(db, tenant_id)

    async def register(self, payload: PatientCreate, created_by: str):
        # Duplicate check by phone (primary identifier)
        existing = await self.repo.get_by_phone(payload.phone)
        if existing:
            raise ConflictException(
                f"A patient with phone {payload.phone} already exists (MRN: {existing.mrn})"
            )

        if payload.email:
            existing_email = await self.repo.get_by_email(payload.email)
            if existing_email:
                raise ConflictException(
                    f"A patient with email {payload.email} already exists (MRN: {existing_email.mrn})"
                )

        mrn = await self.repo.get_next_mrn()

        # Determine if minor
        from datetime import date
        dob = date.fromisoformat(payload.date_of_birth)
        age = (date.today() - dob).days // 365
        is_minor = age < 18

        data = payload.model_dump(exclude={"emergency_contacts"})
        data["mrn"] = mrn
        data["is_minor"] = is_minor

        patient = await self.repo.create(data, created_by=created_by)

        # Create emergency contacts
        if payload.emergency_contacts:
            for contact_data in payload.emergency_contacts:
                await self.repo.add_emergency_contact(
                    patient.id, contact_data.model_dump(), created_by=created_by
                )

        await self.db.refresh(patient)
        return patient

    async def update(self, patient_id: str, payload: PatientUpdate, updated_by: str):
        patient = await self.repo.get_by_id(patient_id)
        if not patient:
            raise NotFoundException("Patient not found")

        data = payload.model_dump(exclude_unset=True)

        if "date_of_birth" in data and data["date_of_birth"]:
            from datetime import date
            dob = date.fromisoformat(data["date_of_birth"])
            age = (date.today() - dob).days // 365
            data["is_minor"] = age < 18

        return await self.repo.update(patient_id, data, updated_by=updated_by)

    async def get_or_404(self, patient_id: str):
        patient = await self.repo.get_by_id(patient_id)
        if not patient:
            raise NotFoundException("Patient not found")
        return patient

    async def search(
        self,
        query: str,
        clinic_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ):
        offset = (page - 1) * page_size
        return await self.repo.search(
            query=query, clinic_id=clinic_id, offset=offset, limit=page_size
        )

    async def soft_delete(self, patient_id: str, deleted_by: str) -> bool:
        patient = await self.repo.get_by_id(patient_id)
        if not patient:
            raise NotFoundException("Patient not found")
        return await self.repo.soft_delete(patient_id, deleted_by)
