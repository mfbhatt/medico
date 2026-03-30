"""Inventory repository: drug items, stock batches, transactions, purchase orders."""
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import (
    DrugItem,
    PurchaseOrder,
    PurchaseOrderItem,
    StockBatch,
    StockTransaction,
)
from app.repositories.base import BaseRepository


class DrugItemRepository(BaseRepository[DrugItem]):
    def __init__(self, db: AsyncSession, tenant_id: str):
        super().__init__(DrugItem, db, tenant_id)

    async def get_by_clinic(
        self,
        clinic_id: str,
        category: Optional[str] = None,
        active_only: bool = True,
        offset: int = 0,
        limit: int = 50,
    ) -> Tuple[List[DrugItem], int]:
        filters = [DrugItem.clinic_id == clinic_id]
        if category:
            filters.append(DrugItem.category == category)
        if active_only:
            filters.append(DrugItem.is_active == True)  # noqa: E712
        return await self.get_many(
            filters=filters,
            order_by=[DrugItem.name],
            offset=offset,
            limit=limit,
        )

    async def get_low_stock(self, clinic_id: str) -> List[DrugItem]:
        """Return drugs whose total remaining stock is at or below reorder level."""
        # Subquery: sum of quantity_remaining per drug
        stock_sum = (
            select(StockBatch.drug_item_id, func.sum(StockBatch.quantity_remaining).label("total"))
            .where(StockBatch.is_active == True)  # noqa: E712
            .where(StockBatch.is_deleted == False)  # noqa: E712
            .group_by(StockBatch.drug_item_id)
            .subquery()
        )
        result = await self.db.execute(
            self._base_query()
            .where(DrugItem.clinic_id == clinic_id)
            .where(DrugItem.is_active == True)  # noqa: E712
            .join(stock_sum, stock_sum.c.drug_item_id == DrugItem.id, isouter=True)
            .where(
                (stock_sum.c.total.is_(None)) | (stock_sum.c.total <= DrugItem.reorder_level)
            )
        )
        return list(result.scalars().all())

    async def get_current_stock(self, drug_item_id: str) -> int:
        result = await self.db.execute(
            select(func.sum(StockBatch.quantity_remaining))
            .where(StockBatch.drug_item_id == drug_item_id)
            .where(StockBatch.is_active == True)  # noqa: E712
            .where(StockBatch.is_deleted == False)  # noqa: E712
        )
        return result.scalar_one_or_none() or 0


class StockBatchRepository(BaseRepository[StockBatch]):
    def __init__(self, db: AsyncSession, tenant_id: str):
        super().__init__(StockBatch, db, tenant_id)

    async def get_by_drug(
        self, drug_item_id: str, active_only: bool = True
    ) -> List[StockBatch]:
        filters = [StockBatch.drug_item_id == drug_item_id]
        if active_only:
            filters.append(StockBatch.is_active == True)  # noqa: E712
        return await self.get_all(
            filters=filters,
            order_by=[StockBatch.expiry_date],
        )

    async def get_expiring_soon(self, days_ahead: int = 30) -> List[StockBatch]:
        from datetime import date, timedelta
        cutoff = (date.today() + timedelta(days=days_ahead)).isoformat()
        result = await self.db.execute(
            self._base_query()
            .where(StockBatch.expiry_date <= cutoff)
            .where(StockBatch.expiry_date >= date.today().isoformat())
            .where(StockBatch.quantity_remaining > 0)
            .where(StockBatch.is_active == True)  # noqa: E712
        )
        return list(result.scalars().all())


class StockTransactionRepository(BaseRepository[StockTransaction]):
    def __init__(self, db: AsyncSession, tenant_id: str):
        super().__init__(StockTransaction, db, tenant_id)

    async def get_by_drug(
        self, drug_item_id: str, offset: int = 0, limit: int = 50
    ) -> Tuple[List[StockTransaction], int]:
        return await self.get_many(
            filters=[StockTransaction.drug_item_id == drug_item_id],
            order_by=[StockTransaction.created_at.desc()],
            offset=offset,
            limit=limit,
        )


class PurchaseOrderRepository(BaseRepository[PurchaseOrder]):
    def __init__(self, db: AsyncSession, tenant_id: str):
        super().__init__(PurchaseOrder, db, tenant_id)

    async def get_by_clinic(
        self,
        clinic_id: str,
        status: Optional[str] = None,
        offset: int = 0,
        limit: int = 20,
    ) -> Tuple[List[PurchaseOrder], int]:
        filters = [PurchaseOrder.clinic_id == clinic_id]
        if status:
            filters.append(PurchaseOrder.status == status)
        return await self.get_many(
            filters=filters,
            order_by=[PurchaseOrder.order_date.desc()],
            offset=offset,
            limit=limit,
        )

    async def get_next_po_number(self) -> str:
        result = await self.db.execute(
            select(func.count())
            .select_from(PurchaseOrder)
            .where(PurchaseOrder.tenant_id == self.tenant_id)
        )
        count = result.scalar_one()
        return f"PO-{count + 1:06d}"

    async def add_items(
        self, order_id: str, items_data: List[dict]
    ) -> List[PurchaseOrderItem]:
        items = []
        for data in items_data:
            item = PurchaseOrderItem(
                **{**data, "order_id": order_id, "tenant_id": self.tenant_id}
            )
            self.db.add(item)
            items.append(item)
        await self.db.flush()
        for item in items:
            await self.db.refresh(item)
        return items
