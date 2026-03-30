"""Medical record service: EMR creation, signing, addenda."""
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictException, ForbiddenException, NotFoundException
from app.repositories.appointment import AppointmentRepository
from app.repositories.medical_record import MedicalRecordRepository
from app.schemas.medical_record import (
    MedicalRecordAddendumCreate,
    MedicalRecordCreate,
    MedicalRecordUpdate,
)


class MedicalRecordService:
    def __init__(self, db: AsyncSession, tenant_id: str):
        self.db = db
        self.tenant_id = tenant_id
        self.repo = MedicalRecordRepository(db, tenant_id)
        self.appt_repo = AppointmentRepository(db, tenant_id)

    async def create(self, payload: MedicalRecordCreate, created_by: str):
        # Ensure appointment exists
        appt = await self.appt_repo.get_by_id(payload.appointment_id)
        if not appt:
            raise NotFoundException("Appointment not found")

        # One record per appointment
        existing = await self.repo.get_by_appointment(payload.appointment_id)
        if existing:
            raise ConflictException("A medical record already exists for this appointment")

        return await self.repo.create(payload.model_dump(), created_by=created_by)

    async def update(self, record_id: str, payload: MedicalRecordUpdate, updated_by: str):
        record = await self.get_or_404(record_id)
        if record.is_locked:
            raise ForbiddenException("Medical record is locked and cannot be edited. Add an addendum instead.")
        data = payload.model_dump(exclude_unset=True)
        return await self.repo.update(record_id, data, updated_by=updated_by)

    async def sign(self, record_id: str, signed_by: str):
        record = await self.get_or_404(record_id)
        if record.is_signed:
            raise ConflictException("Medical record is already signed")
        now = datetime.utcnow().isoformat()
        return await self.repo.update(
            record_id,
            {"is_signed": True, "signed_at": now, "signed_by": signed_by, "is_locked": True},
            updated_by=signed_by,
        )

    async def add_addendum(
        self, record_id: str, payload: MedicalRecordAddendumCreate, doctor_id: str
    ):
        record = await self.get_or_404(record_id)
        if not record.is_locked:
            raise ConflictException("Addenda can only be added to signed/locked records")
        return await self.repo.add_addendum(
            record_id,
            {**payload.model_dump(), "doctor_id": doctor_id},
            created_by=doctor_id,
        )

    async def get_or_404(self, record_id: str):
        record = await self.repo.get_by_id(record_id)
        if not record:
            raise NotFoundException("Medical record not found")
        return record
