"""Billing repository: invoices, payments, insurance claims."""
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import InsuranceClaim, Invoice, InvoiceItem, InvoiceStatus, Payment
from app.repositories.base import BaseRepository


class InvoiceRepository(BaseRepository[Invoice]):
    def __init__(self, db: AsyncSession, tenant_id: str):
        super().__init__(Invoice, db, tenant_id)

    async def get_by_number(self, invoice_number: str) -> Optional[Invoice]:
        result = await self.db.execute(
            self._base_query().where(Invoice.invoice_number == invoice_number)
        )
        return result.scalar_one_or_none()

    async def get_by_patient(
        self,
        patient_id: str,
        status: Optional[str] = None,
        offset: int = 0,
        limit: int = 20,
    ) -> Tuple[List[Invoice], int]:
        filters = [Invoice.patient_id == patient_id]
        if status:
            filters.append(Invoice.status == status)
        return await self.get_many(
            filters=filters,
            order_by=[Invoice.issue_date.desc()],
            offset=offset,
            limit=limit,
        )

    async def get_overdue(self, as_of_date: str) -> List[Invoice]:
        result = await self.db.execute(
            self._base_query()
            .where(Invoice.due_date < as_of_date)
            .where(Invoice.balance_due > 0)
            .where(Invoice.status.not_in([InvoiceStatus.PAID, InvoiceStatus.VOIDED]))
        )
        return list(result.scalars().all())

    async def get_next_invoice_number(self) -> str:
        result = await self.db.execute(
            select(func.count())
            .select_from(Invoice)
            .where(Invoice.tenant_id == self.tenant_id)
        )
        count = result.scalar_one()
        return f"INV-{count + 1:06d}"

    async def add_item(self, invoice_id: str, data: dict) -> InvoiceItem:
        item = InvoiceItem(**{**data, "invoice_id": invoice_id, "tenant_id": self.tenant_id})
        self.db.add(item)
        await self.db.flush()
        await self.db.refresh(item)
        return item


class PaymentRepository(BaseRepository[Payment]):
    def __init__(self, db: AsyncSession, tenant_id: str):
        super().__init__(Payment, db, tenant_id)

    async def get_by_invoice(self, invoice_id: str) -> List[Payment]:
        result = await self.db.execute(
            self._base_query()
            .where(Payment.invoice_id == invoice_id)
            .order_by(Payment.payment_date)
        )
        return list(result.scalars().all())

    async def get_total_paid(self, invoice_id: str) -> float:
        result = await self.db.execute(
            select(func.sum(Payment.amount))
            .where(Payment.invoice_id == invoice_id)
            .where(Payment.tenant_id == self.tenant_id)
            .where(Payment.status == "completed")
            .where(Payment.is_deleted == False)  # noqa: E712
        )
        return result.scalar_one_or_none() or 0.0


class InsuranceClaimRepository(BaseRepository[InsuranceClaim]):
    def __init__(self, db: AsyncSession, tenant_id: str):
        super().__init__(InsuranceClaim, db, tenant_id)

    async def get_by_invoice(self, invoice_id: str) -> Optional[InsuranceClaim]:
        result = await self.db.execute(
            self._base_query().where(InsuranceClaim.invoice_id == invoice_id)
        )
        return result.scalar_one_or_none()

    async def get_next_claim_number(self) -> str:
        result = await self.db.execute(
            select(func.count())
            .select_from(InsuranceClaim)
            .where(InsuranceClaim.tenant_id == self.tenant_id)
        )
        count = result.scalar_one()
        return f"CLM-{count + 1:06d}"
