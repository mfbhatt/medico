"""Billing service: invoice calculation, payment processing, claim management."""
from datetime import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictException, NotFoundException, ValidationException
from app.models.billing import InvoiceStatus
from app.repositories.billing import (
    InsuranceClaimRepository,
    InvoiceRepository,
    PaymentRepository,
)
from app.schemas.billing import InsuranceClaimCreate, InvoiceCreate, PaymentCreate


class BillingService:
    def __init__(self, db: AsyncSession, tenant_id: str):
        self.db = db
        self.tenant_id = tenant_id
        self.invoice_repo = InvoiceRepository(db, tenant_id)
        self.payment_repo = PaymentRepository(db, tenant_id)
        self.claim_repo = InsuranceClaimRepository(db, tenant_id)

    # ── Invoice ────────────────────────────────────────────────────────────

    async def create_invoice(self, payload: InvoiceCreate, created_by: str):
        invoice_number = await self.invoice_repo.get_next_invoice_number()

        # Calculate line totals and subtotal
        subtotal = 0.0
        items_data = []
        for item in payload.items:
            line_total = (
                item.quantity
                * item.unit_price
                * (1 - item.discount_percent / 100)
                * (1 + item.tax_percent / 100)
            )
            subtotal += item.quantity * item.unit_price * (1 - item.discount_percent / 100)
            items_data.append({**item.model_dump(), "line_total": round(line_total, 2)})

        tax_amount = round(subtotal * payload.tax_rate / 100, 2)
        total_amount = round(
            subtotal - payload.discount_amount + tax_amount, 2
        )
        patient_responsibility = round(
            total_amount - payload.insurance_amount - payload.copay_amount, 2
        )

        invoice_data = payload.model_dump(exclude={"items"})
        invoice_data.update(
            invoice_number=invoice_number,
            subtotal=round(subtotal, 2),
            tax_amount=tax_amount,
            total_amount=total_amount,
            balance_due=total_amount,
            patient_responsibility=max(0.0, patient_responsibility),
            status=InvoiceStatus.DRAFT,
        )

        invoice = await self.invoice_repo.create(invoice_data, created_by=created_by)

        for item_data in items_data:
            await self.invoice_repo.add_item(invoice.id, item_data)

        await self.db.refresh(invoice)
        return invoice

    async def issue_invoice(self, invoice_id: str, updated_by: str):
        invoice = await self._get_invoice_or_404(invoice_id)
        if invoice.status != InvoiceStatus.DRAFT:
            raise ValidationException("Only draft invoices can be issued")
        return await self.invoice_repo.update(
            invoice_id, {"status": InvoiceStatus.ISSUED}, updated_by=updated_by
        )

    async def void_invoice(self, invoice_id: str, updated_by: str):
        invoice = await self._get_invoice_or_404(invoice_id)
        if invoice.status == InvoiceStatus.PAID:
            raise ValidationException("Cannot void a fully paid invoice")
        return await self.invoice_repo.update(
            invoice_id, {"status": InvoiceStatus.VOIDED}, updated_by=updated_by
        )

    # ── Payment ────────────────────────────────────────────────────────────

    async def record_payment(self, payload: PaymentCreate, created_by: str):
        invoice = await self._get_invoice_or_404(payload.invoice_id)
        if invoice.status == InvoiceStatus.VOIDED:
            raise ValidationException("Cannot record payment on a voided invoice")
        if invoice.balance_due <= 0:
            raise ValidationException("Invoice is already fully paid")
        if payload.amount > invoice.balance_due:
            raise ValidationException(
                f"Payment amount ({payload.amount}) exceeds balance due ({invoice.balance_due})"
            )

        payment = await self.payment_repo.create(
            payload.model_dump(), created_by=created_by
        )

        # Update invoice balances
        new_paid = invoice.paid_amount + payload.amount
        new_balance = round(invoice.total_amount - new_paid, 2)
        new_status = (
            InvoiceStatus.PAID
            if new_balance <= 0
            else InvoiceStatus.PARTIALLY_PAID
        )
        await self.invoice_repo.update(
            invoice.id,
            {
                "paid_amount": round(new_paid, 2),
                "balance_due": new_balance,
                "status": new_status,
            },
            updated_by=created_by,
        )

        return payment

    # ── Insurance Claim ────────────────────────────────────────────────────

    async def create_claim(self, payload: InsuranceClaimCreate, created_by: str):
        invoice = await self._get_invoice_or_404(payload.invoice_id)
        existing = await self.claim_repo.get_by_invoice(payload.invoice_id)
        if existing:
            raise ConflictException("A claim already exists for this invoice")

        claim_number = await self.claim_repo.get_next_claim_number()
        data = {
            **payload.model_dump(),
            "claim_number": claim_number,
            "submitted_at": datetime.utcnow().isoformat(),
        }
        return await self.claim_repo.create(data, created_by=created_by)

    # ── Helpers ────────────────────────────────────────────────────────────

    async def _get_invoice_or_404(self, invoice_id: str):
        invoice = await self.invoice_repo.get_by_id(invoice_id)
        if not invoice:
            raise NotFoundException("Invoice not found")
        return invoice
