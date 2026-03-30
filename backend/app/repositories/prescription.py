"""Prescription repository."""
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.prescription import (
    Prescription,
    PrescriptionItem,
    PrescriptionRefillRequest,
    PrescriptionStatus,
)
from app.repositories.base import BaseRepository


class PrescriptionRepository(BaseRepository[Prescription]):
    def __init__(self, db: AsyncSession, tenant_id: str):
        super().__init__(Prescription, db, tenant_id)

    async def get_by_number(self, prescription_number: str) -> Optional[Prescription]:
        result = await self.db.execute(
            self._base_query().where(Prescription.prescription_number == prescription_number)
        )
        return result.scalar_one_or_none()

    async def get_by_patient(
        self,
        patient_id: str,
        status: Optional[str] = None,
        offset: int = 0,
        limit: int = 20,
    ) -> Tuple[List[Prescription], int]:
        filters = [Prescription.patient_id == patient_id]
        if status:
            filters.append(Prescription.status == status)
        return await self.get_many(
            filters=filters,
            order_by=[Prescription.prescribed_date.desc()],
            offset=offset,
            limit=limit,
        )

    async def get_by_medical_record(self, record_id: str) -> List[Prescription]:
        result = await self.db.execute(
            self._base_query().where(Prescription.medical_record_id == record_id)
        )
        return list(result.scalars().all())

    async def get_expiring_soon(self, as_of_date: str, days_ahead: int = 7) -> List[Prescription]:
        from datetime import date, timedelta
        cutoff = (date.fromisoformat(as_of_date) + timedelta(days=days_ahead)).isoformat()
        result = await self.db.execute(
            self._base_query()
            .where(Prescription.expiry_date <= cutoff)
            .where(Prescription.expiry_date >= as_of_date)
            .where(Prescription.status == PrescriptionStatus.ACTIVE)
        )
        return list(result.scalars().all())

    async def get_next_prescription_number(self) -> str:
        result = await self.db.execute(
            select(func.count())
            .select_from(Prescription)
            .where(Prescription.tenant_id == self.tenant_id)
        )
        count = result.scalar_one()
        return f"RX-{count + 1:07d}"

    async def add_items(
        self, prescription_id: str, items_data: List[dict]
    ) -> List[PrescriptionItem]:
        items = []
        for data in items_data:
            item = PrescriptionItem(
                **{**data, "prescription_id": prescription_id, "tenant_id": self.tenant_id}
            )
            self.db.add(item)
            items.append(item)
        await self.db.flush()
        for item in items:
            await self.db.refresh(item)
        return items

    async def add_refill_request(
        self, prescription_id: str, data: dict
    ) -> PrescriptionRefillRequest:
        req = PrescriptionRefillRequest(
            **{**data, "prescription_id": prescription_id, "tenant_id": self.tenant_id}
        )
        self.db.add(req)
        await self.db.flush()
        await self.db.refresh(req)
        return req
