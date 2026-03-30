"""Appointment repository."""
from typing import List, Optional, Tuple

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import Appointment, AppointmentStatus, AppointmentWaitlist
from app.repositories.base import BaseRepository


class AppointmentRepository(BaseRepository[Appointment]):
    def __init__(self, db: AsyncSession, tenant_id: str):
        super().__init__(Appointment, db, tenant_id)

    async def get_by_patient(
        self,
        patient_id: str,
        status: Optional[str] = None,
        offset: int = 0,
        limit: int = 20,
    ) -> Tuple[List[Appointment], int]:
        filters = [Appointment.patient_id == patient_id]
        if status:
            filters.append(Appointment.status == status)
        return await self.get_many(filters=filters, offset=offset, limit=limit)

    async def get_by_doctor(
        self,
        doctor_id: str,
        date: Optional[str] = None,
        status: Optional[str] = None,
        offset: int = 0,
        limit: int = 50,
    ) -> Tuple[List[Appointment], int]:
        filters = [Appointment.doctor_id == doctor_id]
        if date:
            filters.append(Appointment.appointment_date == date)
        if status:
            filters.append(Appointment.status == status)
        return await self.get_many(
            filters=filters,
            order_by=[Appointment.appointment_date, Appointment.start_time],
            offset=offset,
            limit=limit,
        )

    async def get_by_clinic(
        self,
        clinic_id: str,
        date: Optional[str] = None,
        status: Optional[str] = None,
        offset: int = 0,
        limit: int = 50,
    ) -> Tuple[List[Appointment], int]:
        filters = [Appointment.clinic_id == clinic_id]
        if date:
            filters.append(Appointment.appointment_date == date)
        if status:
            filters.append(Appointment.status == status)
        return await self.get_many(
            filters=filters,
            order_by=[Appointment.appointment_date, Appointment.start_time],
            offset=offset,
            limit=limit,
        )

    async def get_conflicting(
        self,
        doctor_id: str,
        date: str,
        start_time: str,
        end_time: str,
        exclude_id: Optional[str] = None,
    ) -> List[Appointment]:
        """Find appointments that overlap the given time slot for a doctor."""
        query = (
            self._base_query()
            .where(Appointment.doctor_id == doctor_id)
            .where(Appointment.appointment_date == date)
            .where(
                Appointment.status.not_in([
                    AppointmentStatus.CANCELLED,
                    AppointmentStatus.NO_SHOW,
                    AppointmentStatus.RESCHEDULED,
                ])
            )
            .where(
                and_(
                    Appointment.start_time < end_time,
                    Appointment.end_time > start_time,
                )
            )
        )
        if exclude_id:
            query = query.where(Appointment.id != exclude_id)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_today_queue(
        self, clinic_id: str, doctor_id: Optional[str] = None, date: Optional[str] = None
    ) -> List[Appointment]:
        """Return today's appointments ordered by queue/start time."""
        from datetime import date as date_type
        target_date = date or date_type.today().isoformat()
        filters = [
            Appointment.clinic_id == clinic_id,
            Appointment.appointment_date == target_date,
            Appointment.status.in_([
                AppointmentStatus.SCHEDULED,
                AppointmentStatus.CONFIRMED,
                AppointmentStatus.CHECKED_IN,
                AppointmentStatus.IN_PROGRESS,
            ]),
        ]
        if doctor_id:
            filters.append(Appointment.doctor_id == doctor_id)

        result = await self.db.execute(
            self._base_query()
            .where(*filters)
            .order_by(Appointment.queue_number.nullsfirst(), Appointment.start_time)
        )
        return list(result.scalars().all())

    async def get_upcoming_reminders(
        self, hours_ahead: int, reminder_field: str
    ) -> List[Appointment]:
        """Get appointments due for a reminder in the next N hours."""
        from datetime import datetime, timedelta, timezone
        now = datetime.now(timezone.utc)
        target = now + timedelta(hours=hours_ahead)
        target_date = target.date().isoformat()
        target_time = target.strftime("%H:%M")

        reminder_sent = getattr(Appointment, reminder_field)
        result = await self.db.execute(
            self._base_query()
            .where(reminder_sent == False)  # noqa: E712
            .where(Appointment.appointment_date == target_date)
            .where(Appointment.start_time <= target_time)
            .where(Appointment.status.in_([
                AppointmentStatus.SCHEDULED,
                AppointmentStatus.CONFIRMED,
            ]))
        )
        return list(result.scalars().all())

    async def count_by_date_range(
        self, clinic_id: str, date_from: str, date_until: str
    ) -> int:
        result = await self.db.execute(
            select(func.count())
            .select_from(Appointment)
            .where(Appointment.tenant_id == self.tenant_id)
            .where(Appointment.clinic_id == clinic_id)
            .where(Appointment.appointment_date >= date_from)
            .where(Appointment.appointment_date <= date_until)
            .where(Appointment.is_deleted == False)  # noqa: E712
        )
        return result.scalar_one()


class WaitlistRepository(BaseRepository[AppointmentWaitlist]):
    def __init__(self, db: AsyncSession, tenant_id: str):
        super().__init__(AppointmentWaitlist, db, tenant_id)

    async def get_next_position(self, doctor_id: str, clinic_id: str) -> int:
        result = await self.db.execute(
            select(func.max(AppointmentWaitlist.position))
            .where(AppointmentWaitlist.tenant_id == self.tenant_id)
            .where(AppointmentWaitlist.doctor_id == doctor_id)
            .where(AppointmentWaitlist.clinic_id == clinic_id)
            .where(AppointmentWaitlist.status == "waiting")
            .where(AppointmentWaitlist.is_deleted == False)  # noqa: E712
        )
        max_pos = result.scalar_one_or_none()
        return (max_pos or 0) + 1

    async def get_waiting(self, doctor_id: str, clinic_id: str) -> List[AppointmentWaitlist]:
        result = await self.db.execute(
            self._base_query()
            .where(AppointmentWaitlist.doctor_id == doctor_id)
            .where(AppointmentWaitlist.clinic_id == clinic_id)
            .where(AppointmentWaitlist.status == "waiting")
            .order_by(AppointmentWaitlist.position)
        )
        return list(result.scalars().all())
