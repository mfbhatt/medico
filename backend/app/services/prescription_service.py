"""Prescription service: creation, dispensing, refill workflow."""
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictException, NotFoundException, ValidationException
from app.models.prescription import PrescriptionStatus
from app.repositories.prescription import PrescriptionRepository
from app.schemas.prescription import (
    PrescriptionCreate,
    PrescriptionDispenseRequest,
    PrescriptionRefillRequestCreate,
    PrescriptionRefillReview,
    PrescriptionUpdate,
)


class PrescriptionService:
    def __init__(self, db: AsyncSession, tenant_id: str):
        self.db = db
        self.tenant_id = tenant_id
        self.repo = PrescriptionRepository(db, tenant_id)

    async def create(self, payload: PrescriptionCreate, created_by: str):
        rx_number = await self.repo.get_next_prescription_number()
        data = payload.model_dump(exclude={"items"})
        data["prescription_number"] = rx_number

        prescription = await self.repo.create(data, created_by=created_by)

        items_data = [item.model_dump() for item in payload.items]
        await self.repo.add_items(prescription.id, items_data)

        await self.db.refresh(prescription)
        return prescription

    async def update(self, rx_id: str, payload: PrescriptionUpdate, updated_by: str):
        rx = await self.get_or_404(rx_id)
        if rx.is_signed:
            raise ValidationException("Cannot update a signed prescription")
        data = payload.model_dump(exclude_unset=True)
        return await self.repo.update(rx_id, data, updated_by=updated_by)

    async def dispense(
        self, rx_id: str, payload: PrescriptionDispenseRequest, dispensed_by: str
    ):
        rx = await self.get_or_404(rx_id)
        if rx.status not in (PrescriptionStatus.ACTIVE, PrescriptionStatus.PARTIALLY_DISPENSED):
            raise ValidationException(f"Cannot dispense prescription with status '{rx.status}'")

        now = datetime.utcnow().isoformat()
        return await self.repo.update(
            rx_id,
            {
                "status": PrescriptionStatus.DISPENSED,
                "dispensed_at": now,
                "dispensed_by_id": payload.dispensed_by_id,
                "dispensed_clinic_id": payload.dispensed_clinic_id,
            },
            updated_by=dispensed_by,
        )

    async def request_refill(
        self, rx_id: str, payload: PrescriptionRefillRequestCreate, requested_by: str
    ):
        rx = await self.get_or_404(rx_id)
        if rx.status == PrescriptionStatus.EXPIRED:
            raise ValidationException("Cannot request a refill for an expired prescription")
        if rx.refills_remaining <= 0:
            raise ValidationException("No refills remaining on this prescription")

        now = datetime.utcnow().isoformat()
        return await self.repo.add_refill_request(
            rx_id,
            {**payload.model_dump(), "requested_by": requested_by, "requested_at": now},
        )

    async def review_refill(
        self,
        rx_id: str,
        refill_request_id: str,
        payload: PrescriptionRefillReview,
        reviewed_by: str,
    ):
        rx = await self.get_or_404(rx_id)
        now = datetime.utcnow().isoformat()

        if payload.approve:
            # Increment refills_used
            await self.repo.update(
                rx_id,
                {"refills_used": rx.refills_used + 1},
                updated_by=reviewed_by,
            )
            status = "approved"
        else:
            if not payload.denial_reason:
                raise ValidationException("Denial reason is required when rejecting a refill")
            status = "denied"

        # Update the refill request record directly
        from app.models.prescription import PrescriptionRefillRequest
        from sqlalchemy import select
        result = await self.db.execute(
            select(PrescriptionRefillRequest).where(
                PrescriptionRefillRequest.id == refill_request_id
            )
        )
        req = result.scalar_one_or_none()
        if req:
            req.status = status
            req.reviewed_by = reviewed_by
            req.reviewed_at = now
            req.denial_reason = payload.denial_reason
            await self.db.flush()
        return req

    async def get_or_404(self, rx_id: str):
        rx = await self.repo.get_by_id(rx_id)
        if not rx:
            raise NotFoundException("Prescription not found")
        return rx
