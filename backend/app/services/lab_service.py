"""Lab service: order management, result entry, critical value alerting."""
from datetime import datetime
from typing import List

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictException, NotFoundException, ValidationException
from app.models.lab_report import LabOrderStatus, ResultStatus
from app.repositories.lab_report import LabOrderRepository, LabReportRepository
from app.schemas.lab_report import (
    LabOrderCreate,
    LabOrderUpdate,
    LabReportCreate,
    LabReportUpdate,
)


class LabService:
    def __init__(self, db: AsyncSession, tenant_id: str):
        self.db = db
        self.tenant_id = tenant_id
        self.order_repo = LabOrderRepository(db, tenant_id)
        self.report_repo = LabReportRepository(db, tenant_id)

    async def create_order(self, payload: LabOrderCreate, created_by: str):
        order_number = await self.order_repo.get_next_order_number()
        data = payload.model_dump(exclude={"items"})
        data["order_number"] = order_number

        order = await self.order_repo.create(data, created_by=created_by)
        items_data = [item.model_dump() for item in payload.items]
        await self.order_repo.add_items(order.id, items_data)

        await self.db.refresh(order)
        return order

    async def update_order(self, order_id: str, payload: LabOrderUpdate, updated_by: str):
        await self.get_order_or_404(order_id)
        data = payload.model_dump(exclude_unset=True)
        return await self.order_repo.update(order_id, data, updated_by=updated_by)

    async def record_specimen_collected(
        self, order_id: str, collected_by: str, specimen_type: str
    ):
        order = await self.get_order_or_404(order_id)
        if order.status != LabOrderStatus.ORDERED:
            raise ValidationException(f"Order status is '{order.status}', expected 'ordered'")
        now = datetime.utcnow().isoformat()
        return await self.order_repo.update(
            order_id,
            {
                "status": LabOrderStatus.SPECIMEN_COLLECTED,
                "collected_at": now,
                "collected_by": collected_by,
                "specimen_type": specimen_type,
            },
            updated_by=collected_by,
        )

    async def enter_results(self, order_id: str, payload: LabReportCreate, created_by: str):
        order = await self.get_order_or_404(order_id)

        existing = await self.report_repo.get_by_order(order_id)
        if existing:
            raise ConflictException("Results have already been entered for this order")

        # Auto-detect critical values in results
        has_critical = any(
            r.flag in ("critical_high", "critical_low")
            for r in payload.results
        )

        data = payload.model_dump()
        data["results"] = [r.model_dump() for r in payload.results]
        data["has_critical_values"] = has_critical or payload.has_critical_values
        data["status"] = ResultStatus.FINAL

        report = await self.report_repo.create(data, created_by=created_by)

        # Update order status
        await self.order_repo.update(
            order_id,
            {"status": LabOrderStatus.COMPLETED},
            updated_by=created_by,
        )

        return report

    async def update_report(self, report_id: str, payload: LabReportUpdate, updated_by: str):
        report = await self.get_report_or_404(report_id)
        if report.is_signed:
            raise ValidationException("Cannot update a signed report")
        data = payload.model_dump(exclude_unset=True)
        if "results" in data and data["results"]:
            data["results"] = [r.model_dump() for r in payload.results]
        return await self.report_repo.update(report_id, data, updated_by=updated_by)

    async def sign_report(self, report_id: str, signed_by: str):
        report = await self.get_report_or_404(report_id)
        if report.is_signed:
            raise ConflictException("Report is already signed")
        now = datetime.utcnow().isoformat()
        return await self.report_repo.update(
            report_id,
            {"is_signed": True, "signed_at": now, "signed_by": signed_by},
            updated_by=signed_by,
        )

    async def mark_critical_notified(self, report_id: str, notified_by: str):
        now = datetime.utcnow().isoformat()
        return await self.report_repo.update(
            report_id,
            {"critical_notified_at": now, "critical_notified_by": notified_by},
            updated_by=notified_by,
        )

    async def get_order_or_404(self, order_id: str):
        order = await self.order_repo.get_by_id(order_id)
        if not order:
            raise NotFoundException("Lab order not found")
        return order

    async def get_report_or_404(self, report_id: str):
        report = await self.report_repo.get_by_id(report_id)
        if not report:
            raise NotFoundException("Lab report not found")
        return report
