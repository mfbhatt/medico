"""Generic async repository with standard CRUD operations."""
from typing import Any, Dict, Generic, List, Optional, Tuple, Type, TypeVar

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import BaseModel

ModelT = TypeVar("ModelT", bound=BaseModel)


class BaseRepository(Generic[ModelT]):
    """
    Async SQLAlchemy repository implementing standard CRUD.
    All queries automatically filter by tenant_id and exclude soft-deleted rows.
    """

    def __init__(self, model: Type[ModelT], db: AsyncSession, tenant_id: str):
        self.model = model
        self.db = db
        self.tenant_id = tenant_id

    # ── Internal helpers ───────────────────────────────────────────────────

    def _base_query(self):
        return (
            select(self.model)
            .where(self.model.tenant_id == self.tenant_id)
            .where(self.model.is_deleted == False)  # noqa: E712
        )

    # ── Read ───────────────────────────────────────────────────────────────

    async def get_by_id(self, record_id: str) -> Optional[ModelT]:
        result = await self.db.execute(
            self._base_query().where(self.model.id == record_id)
        )
        return result.scalar_one_or_none()

    async def get_many(
        self,
        filters: Optional[List] = None,
        order_by: Optional[List] = None,
        offset: int = 0,
        limit: int = 20,
    ) -> Tuple[List[ModelT], int]:
        query = self._base_query()
        if filters:
            query = query.where(*filters)
        if order_by:
            query = query.order_by(*order_by)

        count_query = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_query)).scalar_one()

        query = query.offset(offset).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all()), total

    async def get_all(
        self,
        filters: Optional[List] = None,
        order_by: Optional[List] = None,
    ) -> List[ModelT]:
        query = self._base_query()
        if filters:
            query = query.where(*filters)
        if order_by:
            query = query.order_by(*order_by)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def exists(self, record_id: str) -> bool:
        result = await self.db.execute(
            select(func.count())
            .select_from(self.model)
            .where(self.model.id == record_id)
            .where(self.model.tenant_id == self.tenant_id)
            .where(self.model.is_deleted == False)  # noqa: E712
        )
        return result.scalar_one() > 0

    # ── Write ──────────────────────────────────────────────────────────────

    async def create(self, data: Dict[str, Any], created_by: Optional[str] = None) -> ModelT:
        data = {**data, "tenant_id": self.tenant_id}
        if created_by:
            data["created_by"] = created_by
        instance = self.model(**data)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def update(
        self,
        record_id: str,
        data: Dict[str, Any],
        updated_by: Optional[str] = None,
    ) -> Optional[ModelT]:
        instance = await self.get_by_id(record_id)
        if not instance:
            return None
        if updated_by:
            data["updated_by"] = updated_by
        for field, value in data.items():
            setattr(instance, field, value)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def soft_delete(self, record_id: str, deleted_by: str) -> bool:
        instance = await self.get_by_id(record_id)
        if not instance:
            return False
        instance.soft_delete(deleted_by)
        await self.db.flush()
        return True

    async def hard_delete(self, record_id: str) -> bool:
        instance = await self.get_by_id(record_id)
        if not instance:
            return False
        await self.db.delete(instance)
        await self.db.flush()
        return True

    async def bulk_create(
        self, items: List[Dict[str, Any]], created_by: Optional[str] = None
    ) -> List[ModelT]:
        instances = []
        for data in items:
            data = {**data, "tenant_id": self.tenant_id}
            if created_by:
                data["created_by"] = created_by
            instance = self.model(**data)
            self.db.add(instance)
            instances.append(instance)
        await self.db.flush()
        for instance in instances:
            await self.db.refresh(instance)
        return instances
