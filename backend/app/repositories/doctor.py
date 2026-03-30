"""Doctor repository."""
from typing import List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.doctor import (
    Doctor,
    DoctorClinicAssignment,
    DoctorRating,
    DoctorSchedule,
    DoctorScheduleException,
)
from app.repositories.base import BaseRepository


class DoctorRepository(BaseRepository[Doctor]):
    def __init__(self, db: AsyncSession, tenant_id: str):
        super().__init__(Doctor, db, tenant_id)

    async def get_by_user_id(self, user_id: str) -> Optional[Doctor]:
        result = await self.db.execute(
            self._base_query().where(Doctor.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_by_clinic(
        self,
        clinic_id: str,
        specialization: Optional[str] = None,
        accepting_patients: Optional[bool] = None,
        offset: int = 0,
        limit: int = 20,
    ) -> Tuple[List[Doctor], int]:
        # Doctors assigned to this clinic
        assigned_doctor_ids_q = (
            select(DoctorClinicAssignment.doctor_id)
            .where(DoctorClinicAssignment.clinic_id == clinic_id)
            .where(DoctorClinicAssignment.is_active == True)  # noqa: E712
        )
        filters = [Doctor.id.in_(assigned_doctor_ids_q)]
        if specialization:
            filters.append(Doctor.primary_specialization.ilike(f"%{specialization}%"))
        if accepting_patients is not None:
            filters.append(Doctor.is_accepting_new_patients == accepting_patients)
        return await self.get_many(filters=filters, offset=offset, limit=limit)

    async def get_schedule(
        self, doctor_id: str, clinic_id: Optional[str] = None
    ) -> List[DoctorSchedule]:
        query = (
            select(DoctorSchedule)
            .where(DoctorSchedule.doctor_id == doctor_id)
            .where(DoctorSchedule.tenant_id == self.tenant_id)
            .where(DoctorSchedule.is_deleted == False)  # noqa: E712
            .where(DoctorSchedule.is_active == True)  # noqa: E712
        )
        if clinic_id:
            query = query.where(DoctorSchedule.clinic_id == clinic_id)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_schedule_exceptions(
        self,
        doctor_id: str,
        date_from: Optional[str] = None,
        date_until: Optional[str] = None,
    ) -> List[DoctorScheduleException]:
        query = (
            select(DoctorScheduleException)
            .where(DoctorScheduleException.doctor_id == doctor_id)
            .where(DoctorScheduleException.tenant_id == self.tenant_id)
            .where(DoctorScheduleException.is_deleted == False)  # noqa: E712
        )
        if date_from:
            query = query.where(DoctorScheduleException.exception_date >= date_from)
        if date_until:
            query = query.where(DoctorScheduleException.exception_date <= date_until)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def add_clinic_assignment(
        self, doctor_id: str, data: dict, created_by: Optional[str] = None
    ) -> DoctorClinicAssignment:
        assignment = DoctorClinicAssignment(
            **{**data, "doctor_id": doctor_id, "tenant_id": self.tenant_id}
        )
        if created_by:
            assignment.created_by = created_by
        self.db.add(assignment)
        await self.db.flush()
        await self.db.refresh(assignment)
        return assignment

    async def add_schedule(
        self, doctor_id: str, data: dict, created_by: Optional[str] = None
    ) -> DoctorSchedule:
        schedule = DoctorSchedule(
            **{**data, "doctor_id": doctor_id, "tenant_id": self.tenant_id}
        )
        if created_by:
            schedule.created_by = created_by
        self.db.add(schedule)
        await self.db.flush()
        await self.db.refresh(schedule)
        return schedule

    async def add_schedule_exception(
        self, doctor_id: str, data: dict, created_by: Optional[str] = None
    ) -> DoctorScheduleException:
        exc = DoctorScheduleException(
            **{**data, "doctor_id": doctor_id, "tenant_id": self.tenant_id}
        )
        if created_by:
            exc.created_by = created_by
        self.db.add(exc)
        await self.db.flush()
        await self.db.refresh(exc)
        return exc

    async def add_rating(self, data: dict, created_by: Optional[str] = None) -> DoctorRating:
        rating = DoctorRating(**{**data, "tenant_id": self.tenant_id})
        if created_by:
            rating.created_by = created_by
        self.db.add(rating)
        await self.db.flush()
        await self.db.refresh(rating)
        return rating
