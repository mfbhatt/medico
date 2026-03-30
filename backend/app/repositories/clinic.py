"""Clinic and room repository."""
from typing import List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clinic import Clinic, ClinicRoom, ClinicStatus
from app.repositories.base import BaseRepository


class ClinicRepository(BaseRepository[Clinic]):
    def __init__(self, db: AsyncSession, tenant_id: str):
        super().__init__(Clinic, db, tenant_id)

    async def get_active(self, offset: int = 0, limit: int = 50) -> Tuple[List[Clinic], int]:
        return await self.get_many(
            filters=[Clinic.status == ClinicStatus.ACTIVE],
            order_by=[Clinic.name],
            offset=offset,
            limit=limit,
        )

    async def get_rooms(
        self, clinic_id: str, active_only: bool = True
    ) -> List[ClinicRoom]:
        query = (
            select(ClinicRoom)
            .where(ClinicRoom.clinic_id == clinic_id)
            .where(ClinicRoom.tenant_id == self.tenant_id)
            .where(ClinicRoom.is_deleted == False)  # noqa: E712
        )
        if active_only:
            query = query.where(ClinicRoom.is_active == True)  # noqa: E712
        result = await self.db.execute(query.order_by(ClinicRoom.name))
        return list(result.scalars().all())

    async def add_room(
        self, clinic_id: str, data: dict, created_by: Optional[str] = None
    ) -> ClinicRoom:
        room = ClinicRoom(**{**data, "clinic_id": clinic_id, "tenant_id": self.tenant_id})
        if created_by:
            room.created_by = created_by
        self.db.add(room)
        await self.db.flush()
        await self.db.refresh(room)
        return room

    async def get_room_by_id(self, room_id: str) -> Optional[ClinicRoom]:
        result = await self.db.execute(
            select(ClinicRoom)
            .where(ClinicRoom.id == room_id)
            .where(ClinicRoom.tenant_id == self.tenant_id)
            .where(ClinicRoom.is_deleted == False)  # noqa: E712
        )
        return result.scalar_one_or_none()
