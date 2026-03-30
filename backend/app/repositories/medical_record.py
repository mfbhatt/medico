"""Medical record and addendum repository."""
from typing import List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.medical_record import MedicalRecord, MedicalRecordAddendum
from app.repositories.base import BaseRepository


class MedicalRecordRepository(BaseRepository[MedicalRecord]):
    def __init__(self, db: AsyncSession, tenant_id: str):
        super().__init__(MedicalRecord, db, tenant_id)

    async def get_by_appointment(self, appointment_id: str) -> Optional[MedicalRecord]:
        result = await self.db.execute(
            self._base_query().where(MedicalRecord.appointment_id == appointment_id)
        )
        return result.scalar_one_or_none()

    async def get_by_patient(
        self,
        patient_id: str,
        offset: int = 0,
        limit: int = 20,
    ) -> Tuple[List[MedicalRecord], int]:
        return await self.get_many(
            filters=[MedicalRecord.patient_id == patient_id],
            order_by=[MedicalRecord.visit_date.desc()],
            offset=offset,
            limit=limit,
        )

    async def get_by_doctor(
        self,
        doctor_id: str,
        offset: int = 0,
        limit: int = 20,
    ) -> Tuple[List[MedicalRecord], int]:
        return await self.get_many(
            filters=[MedicalRecord.doctor_id == doctor_id],
            order_by=[MedicalRecord.visit_date.desc()],
            offset=offset,
            limit=limit,
        )

    async def add_addendum(
        self, record_id: str, data: dict, created_by: Optional[str] = None
    ) -> MedicalRecordAddendum:
        addendum = MedicalRecordAddendum(
            **{**data, "record_id": record_id, "tenant_id": self.tenant_id}
        )
        if created_by:
            addendum.created_by = created_by
            addendum.doctor_id = created_by
        self.db.add(addendum)
        await self.db.flush()
        await self.db.refresh(addendum)
        return addendum

    async def get_addenda(self, record_id: str) -> List[MedicalRecordAddendum]:
        result = await self.db.execute(
            select(MedicalRecordAddendum)
            .where(MedicalRecordAddendum.record_id == record_id)
            .where(MedicalRecordAddendum.is_deleted == False)  # noqa: E712
            .order_by(MedicalRecordAddendum.created_at)
        )
        return list(result.scalars().all())
