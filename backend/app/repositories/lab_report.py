"""Lab order and report repository."""
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lab_report import LabOrder, LabOrderItem, LabOrderStatus, LabReport
from app.repositories.base import BaseRepository


class LabOrderRepository(BaseRepository[LabOrder]):
    def __init__(self, db: AsyncSession, tenant_id: str):
        super().__init__(LabOrder, db, tenant_id)

    async def get_by_number(self, order_number: str) -> Optional[LabOrder]:
        result = await self.db.execute(
            self._base_query().where(LabOrder.order_number == order_number)
        )
        return result.scalar_one_or_none()

    async def get_by_patient(
        self,
        patient_id: str,
        status: Optional[str] = None,
        offset: int = 0,
        limit: int = 20,
    ) -> Tuple[List[LabOrder], int]:
        filters = [LabOrder.patient_id == patient_id]
        if status:
            filters.append(LabOrder.status == status)
        return await self.get_many(
            filters=filters,
            order_by=[LabOrder.order_date.desc()],
            offset=offset,
            limit=limit,
        )

    async def get_by_medical_record(self, record_id: str) -> List[LabOrder]:
        result = await self.db.execute(
            self._base_query().where(LabOrder.medical_record_id == record_id)
        )
        return list(result.scalars().all())

    async def get_pending(self, clinic_id: Optional[str] = None) -> List[LabOrder]:
        filters = [
            LabOrder.status.in_([
                LabOrderStatus.ORDERED,
                LabOrderStatus.SPECIMEN_COLLECTED,
                LabOrderStatus.IN_PROGRESS,
            ])
        ]
        if clinic_id:
            filters.append(LabOrder.clinic_id == clinic_id)
        return await self.get_all(filters=filters, order_by=[LabOrder.is_urgent.desc(), LabOrder.order_date])

    async def get_next_order_number(self) -> str:
        result = await self.db.execute(
            select(func.count())
            .select_from(LabOrder)
            .where(LabOrder.tenant_id == self.tenant_id)
        )
        count = result.scalar_one()
        return f"LAB-{count + 1:07d}"

    async def add_items(
        self, order_id: str, items_data: List[dict]
    ) -> List[LabOrderItem]:
        items = []
        for data in items_data:
            item = LabOrderItem(
                **{**data, "order_id": order_id, "tenant_id": self.tenant_id}
            )
            self.db.add(item)
            items.append(item)
        await self.db.flush()
        for item in items:
            await self.db.refresh(item)
        return items


class LabReportRepository(BaseRepository[LabReport]):
    def __init__(self, db: AsyncSession, tenant_id: str):
        super().__init__(LabReport, db, tenant_id)

    async def get_by_order(self, order_id: str) -> Optional[LabReport]:
        result = await self.db.execute(
            self._base_query().where(LabReport.order_id == order_id)
        )
        return result.scalar_one_or_none()

    async def get_by_patient(
        self,
        patient_id: str,
        offset: int = 0,
        limit: int = 20,
    ) -> Tuple[List[LabReport], int]:
        return await self.get_many(
            filters=[LabReport.patient_id == patient_id],
            order_by=[LabReport.report_date.desc()],
            offset=offset,
            limit=limit,
        )

    async def get_critical_unnotified(self) -> List[LabReport]:
        result = await self.db.execute(
            self._base_query()
            .where(LabReport.has_critical_values == True)  # noqa: E712
            .where(LabReport.critical_notified_at.is_(None))
        )
        return list(result.scalars().all())
