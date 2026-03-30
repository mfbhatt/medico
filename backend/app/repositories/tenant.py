"""Tenant repository (not tenant-scoped itself)."""
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant, TenantStatus


class TenantRepository:
    """Tenant is not tenant-scoped, so it doesn't extend BaseRepository."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, tenant_id: str) -> Optional[Tenant]:
        result = await self.db.execute(
            select(Tenant).where(Tenant.id == tenant_id)
        )
        return result.scalar_one_or_none()

    async def get_by_slug(self, slug: str) -> Optional[Tenant]:
        result = await self.db.execute(
            select(Tenant).where(Tenant.slug == slug)
        )
        return result.scalar_one_or_none()

    async def get_active(self) -> list[Tenant]:
        result = await self.db.execute(
            select(Tenant).where(Tenant.status == TenantStatus.ACTIVE)
        )
        return list(result.scalars().all())

    async def create(self, data: dict) -> Tenant:
        tenant = Tenant(**data)
        self.db.add(tenant)
        await self.db.flush()
        await self.db.refresh(tenant)
        return tenant

    async def update(self, tenant_id: str, data: dict) -> Optional[Tenant]:
        tenant = await self.get_by_id(tenant_id)
        if not tenant:
            return None
        for field, value in data.items():
            setattr(tenant, field, value)
        await self.db.flush()
        await self.db.refresh(tenant)
        return tenant
