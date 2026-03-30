"""Inventory service: stock management, dispensing, purchase orders."""
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException, ValidationException
from app.repositories.inventory import (
    DrugItemRepository,
    PurchaseOrderRepository,
    StockBatchRepository,
    StockTransactionRepository,
)
from app.schemas.inventory import (
    DrugItemCreate,
    DrugItemUpdate,
    PurchaseOrderCreate,
    StockAdjustmentCreate,
    StockBatchCreate,
)


class InventoryService:
    def __init__(self, db: AsyncSession, tenant_id: str):
        self.db = db
        self.tenant_id = tenant_id
        self.drug_repo = DrugItemRepository(db, tenant_id)
        self.batch_repo = StockBatchRepository(db, tenant_id)
        self.tx_repo = StockTransactionRepository(db, tenant_id)
        self.po_repo = PurchaseOrderRepository(db, tenant_id)

    # ── Drug Items ─────────────────────────────────────────────────────────

    async def create_drug_item(self, payload: DrugItemCreate, created_by: str):
        return await self.drug_repo.create(payload.model_dump(), created_by=created_by)

    async def update_drug_item(self, drug_id: str, payload: DrugItemUpdate, updated_by: str):
        drug = await self._get_drug_or_404(drug_id)
        return await self.drug_repo.update(
            drug_id, payload.model_dump(exclude_unset=True), updated_by=updated_by
        )

    # ── Stock Batches ──────────────────────────────────────────────────────

    async def receive_stock(self, payload: StockBatchCreate, received_by: str):
        drug = await self._get_drug_or_404(payload.drug_item_id)
        if payload.quantity <= 0:
            raise ValidationException("Quantity must be positive")

        batch_data = payload.model_dump()
        batch_data["quantity_remaining"] = payload.quantity
        batch = await self.batch_repo.create(batch_data, created_by=received_by)

        # Record transaction
        current_stock = await self.drug_repo.get_current_stock(payload.drug_item_id)
        await self.tx_repo.create({
            "drug_item_id": payload.drug_item_id,
            "batch_id": batch.id,
            "transaction_type": "purchase",
            "quantity": payload.quantity,
            "quantity_before": current_stock - payload.quantity,
            "quantity_after": current_stock,
            "unit_cost": payload.unit_cost,
            "performed_by": received_by,
        }, created_by=received_by)

        return batch

    async def adjust_stock(self, payload: StockAdjustmentCreate, adjusted_by: str):
        drug = await self._get_drug_or_404(payload.drug_item_id)

        current_stock = await self.drug_repo.get_current_stock(payload.drug_item_id)

        # For outbound transactions (dispensed, expired, damaged, transfer)
        outbound_types = {"dispensed", "expired", "damaged", "transfer"}
        is_outbound = payload.transaction_type in outbound_types

        if is_outbound and payload.quantity > current_stock:
            raise ValidationException(
                f"Insufficient stock. Available: {current_stock}, Requested: {payload.quantity}"
            )

        qty_change = -payload.quantity if is_outbound else payload.quantity
        new_stock = current_stock + qty_change

        # Update batch if specified
        if payload.batch_id:
            batch = await self.batch_repo.get_by_id(payload.batch_id)
            if batch:
                batch.quantity_remaining = max(0, batch.quantity_remaining + qty_change)
                await self.db.flush()

        await self.tx_repo.create({
            "drug_item_id": payload.drug_item_id,
            "batch_id": payload.batch_id,
            "transaction_type": payload.transaction_type,
            "quantity": payload.quantity,
            "quantity_before": current_stock,
            "quantity_after": new_stock,
            "unit_cost": payload.unit_cost,
            "reference_id": payload.reference_id,
            "reference_type": payload.reference_type,
            "notes": payload.notes,
            "performed_by": adjusted_by,
        }, created_by=adjusted_by)

        return {"drug_item_id": payload.drug_item_id, "new_stock": new_stock}

    # ── Purchase Orders ────────────────────────────────────────────────────

    async def create_purchase_order(self, payload: PurchaseOrderCreate, created_by: str):
        po_number = await self.po_repo.get_next_po_number()

        total = sum(item.quantity_ordered * item.unit_cost for item in payload.items)
        po_data = payload.model_dump(exclude={"items"})
        po_data.update(po_number=po_number, total_amount=round(total, 2))

        po = await self.po_repo.create(po_data, created_by=created_by)

        items_data = [
            {**item.model_dump(), "line_total": round(item.quantity_ordered * item.unit_cost, 2)}
            for item in payload.items
        ]
        await self.po_repo.add_items(po.id, items_data)

        await self.db.refresh(po)
        return po

    # ── Helpers ────────────────────────────────────────────────────────────

    async def _get_drug_or_404(self, drug_id: str):
        drug = await self.drug_repo.get_by_id(drug_id)
        if not drug:
            raise NotFoundException("Drug item not found")
        return drug
