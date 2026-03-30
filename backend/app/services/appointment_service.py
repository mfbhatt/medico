"""Appointment service: slot availability, conflict detection, booking, cancellation."""
from datetime import date, datetime, timedelta
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictException, NotFoundException, ValidationException
from app.models.appointment import AppointmentStatus, AppointmentType
from app.repositories.appointment import AppointmentRepository, WaitlistRepository
from app.repositories.doctor import DoctorRepository
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentRescheduleRequest,
    AvailableSlot,
    WaitlistCreate,
)
from app.schemas.doctor import AvailableSlot


_DAY_MAP = {
    0: "monday",
    1: "tuesday",
    2: "wednesday",
    3: "thursday",
    4: "friday",
    5: "saturday",
    6: "sunday",
}


class AppointmentService:
    def __init__(self, db: AsyncSession, tenant_id: str):
        self.db = db
        self.tenant_id = tenant_id
        self.appt_repo = AppointmentRepository(db, tenant_id)
        self.waitlist_repo = WaitlistRepository(db, tenant_id)
        self.doctor_repo = DoctorRepository(db, tenant_id)

    # ── Availability ───────────────────────────────────────────────────────

    async def get_available_slots(
        self,
        doctor_id: str,
        clinic_id: str,
        date_from: str,
        date_until: str,
        appointment_type: Optional[str] = None,
    ) -> List[AvailableSlot]:
        doctor = await self.doctor_repo.get_by_id(doctor_id)
        if not doctor:
            raise NotFoundException("Doctor not found")

        schedules = await self.doctor_repo.get_schedule(doctor_id, clinic_id)
        if not schedules:
            return []

        exceptions = await self.doctor_repo.get_schedule_exceptions(
            doctor_id, date_from, date_until
        )
        exception_dates = {exc.exception_date: exc for exc in exceptions}

        slots: List[AvailableSlot] = []
        current = date.fromisoformat(date_from)
        end_date = date.fromisoformat(date_until)

        while current <= end_date:
            day_name = _DAY_MAP[current.weekday()]
            date_str = current.isoformat()

            # Check for exception on this date
            if date_str in exception_dates:
                exc = exception_dates[date_str]
                if exc.exception_type in ("day_off", "leave", "emergency_leave"):
                    current += timedelta(days=1)
                    continue
                # modified_hours: use exception times
                if exc.exception_type == "modified_hours" and exc.start_time and exc.end_time:
                    day_schedules = [
                        s for s in schedules
                        if s.clinic_id == clinic_id and s.day_of_week == day_name
                    ]
                    for sched in day_schedules:
                        day_slots = self._generate_slots_for_day(
                            doctor_id=doctor_id,
                            clinic_id=clinic_id,
                            date_str=date_str,
                            start_time=exc.start_time,
                            end_time=exc.end_time,
                            slot_duration=sched.slot_duration,
                            break_start=None,
                            break_end=None,
                        )
                        slots.extend(day_slots)
                    current += timedelta(days=1)
                    continue

            # Regular schedule for this day of week
            day_schedules = [
                s for s in schedules
                if s.clinic_id == clinic_id
                and s.day_of_week == day_name
                and s.is_active
                and (not s.valid_from or s.valid_from <= date_str)
                and (not s.valid_until or s.valid_until >= date_str)
            ]

            for sched in day_schedules:
                day_slots = self._generate_slots_for_day(
                    doctor_id=doctor_id,
                    clinic_id=clinic_id,
                    date_str=date_str,
                    start_time=sched.start_time,
                    end_time=sched.end_time,
                    slot_duration=sched.slot_duration,
                    break_start=sched.break_start,
                    break_end=sched.break_end,
                )
                slots.extend(day_slots)

            current += timedelta(days=1)

        # Remove slots that are already booked
        slots = await self._filter_booked_slots(slots, doctor_id)

        # Filter telemedicine if doctor doesn't support it
        if appointment_type == AppointmentType.TELEMEDICINE and not doctor.telemedicine_enabled:
            return []

        return slots

    def _generate_slots_for_day(
        self,
        doctor_id: str,
        clinic_id: str,
        date_str: str,
        start_time: str,
        end_time: str,
        slot_duration: int,
        break_start: Optional[str],
        break_end: Optional[str],
    ) -> List[AvailableSlot]:
        slots = []
        current = self._time_to_minutes(start_time)
        end = self._time_to_minutes(end_time)
        break_s = self._time_to_minutes(break_start) if break_start else None
        break_e = self._time_to_minutes(break_end) if break_end else None

        while current + slot_duration <= end:
            slot_end = current + slot_duration
            # Skip if overlaps break
            if break_s and break_e and current < break_e and slot_end > break_s:
                current = break_e
                continue

            slots.append(AvailableSlot(
                date=date_str,
                start_time=self._minutes_to_time(current),
                end_time=self._minutes_to_time(slot_end),
                doctor_id=doctor_id,
                clinic_id=clinic_id,
            ))
            current += slot_duration

        return slots

    async def _filter_booked_slots(
        self, slots: List[AvailableSlot], doctor_id: str
    ) -> List[AvailableSlot]:
        if not slots:
            return slots
        # Group by date for efficiency
        by_date: dict[str, List[AvailableSlot]] = {}
        for slot in slots:
            by_date.setdefault(slot.date, []).append(slot)

        available = []
        for date_str, day_slots in by_date.items():
            booked, _ = await self.appt_repo.get_by_doctor(
                doctor_id=doctor_id, date=date_str, limit=200
            )
            booked_ranges = [
                (a.start_time, a.end_time)
                for a in booked
                if a.status not in (
                    AppointmentStatus.CANCELLED,
                    AppointmentStatus.NO_SHOW,
                    AppointmentStatus.RESCHEDULED,
                )
            ]
            for slot in day_slots:
                if not any(
                    slot.start_time < end and slot.end_time > start
                    for start, end in booked_ranges
                ):
                    available.append(slot)

        return available

    # ── Booking ────────────────────────────────────────────────────────────

    async def book_appointment(
        self, payload: AppointmentCreate, booked_by: str
    ) -> dict:
        # Calculate end time
        start_minutes = self._time_to_minutes(payload.start_time)
        end_minutes = start_minutes + payload.duration_minutes
        end_time = self._minutes_to_time(end_minutes)

        # Double-booking check
        conflicts = await self.appt_repo.get_conflicting(
            doctor_id=payload.doctor_id,
            date=payload.appointment_date,
            start_time=payload.start_time,
            end_time=end_time,
        )
        if conflicts:
            raise ConflictException(
                "The selected time slot is no longer available. Please choose another slot."
            )

        data = payload.model_dump()
        data["end_time"] = end_time
        data["created_by"] = booked_by

        appt = await self.appt_repo.create(data, created_by=booked_by)
        return appt

    async def cancel_appointment(
        self,
        appointment_id: str,
        reason: str,
        cancelled_by: str,
        charge_fee: bool = False,
    ):
        appt = await self.appt_repo.get_by_id(appointment_id)
        if not appt:
            raise NotFoundException("Appointment not found")
        if appt.status in (AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED):
            raise ValidationException(f"Cannot cancel appointment with status '{appt.status}'")

        now = datetime.utcnow().isoformat()
        await self.appt_repo.update(
            appointment_id,
            {
                "status": AppointmentStatus.CANCELLED,
                "cancelled_at": now,
                "cancelled_by": cancelled_by,
                "cancellation_reason": reason,
                "cancellation_fee_charged": charge_fee,
            },
            updated_by=cancelled_by,
        )

        # Promote next waitlist entry
        await self._promote_waitlist(appt.doctor_id, appt.clinic_id)
        return await self.appt_repo.get_by_id(appointment_id)

    async def reschedule_appointment(
        self,
        appointment_id: str,
        payload: AppointmentRescheduleRequest,
        rescheduled_by: str,
    ):
        appt = await self.appt_repo.get_by_id(appointment_id)
        if not appt:
            raise NotFoundException("Appointment not found")
        if appt.status == AppointmentStatus.CANCELLED:
            raise ValidationException("Cannot reschedule a cancelled appointment")

        start_minutes = self._time_to_minutes(payload.new_start_time)
        end_minutes = start_minutes + appt.duration_minutes
        new_end_time = self._minutes_to_time(end_minutes)

        conflicts = await self.appt_repo.get_conflicting(
            doctor_id=appt.doctor_id,
            date=payload.new_date,
            start_time=payload.new_start_time,
            end_time=new_end_time,
            exclude_id=appointment_id,
        )
        if conflicts:
            raise ConflictException("The new time slot is not available.")

        # Mark original as rescheduled, create new one
        await self.appt_repo.update(
            appointment_id,
            {"status": AppointmentStatus.RESCHEDULED},
            updated_by=rescheduled_by,
        )

        new_data = {
            "patient_id": appt.patient_id,
            "doctor_id": appt.doctor_id,
            "clinic_id": appt.clinic_id,
            "room_id": appt.room_id,
            "appointment_date": payload.new_date,
            "start_time": payload.new_start_time,
            "end_time": new_end_time,
            "duration_minutes": appt.duration_minutes,
            "timezone": appt.timezone,
            "status": AppointmentStatus.SCHEDULED,
            "appointment_type": appt.appointment_type,
            "priority": appt.priority,
            "chief_complaint": appt.chief_complaint,
            "visit_type": appt.visit_type,
            "is_first_visit": False,
            "rescheduled_from_id": appointment_id,
            "reschedule_count": appt.reschedule_count + 1,
            "internal_notes": payload.reason,
        }
        return await self.appt_repo.create(new_data, created_by=rescheduled_by)

    async def check_in(self, appointment_id: str, queue_number: Optional[int] = None):
        appt = await self.appt_repo.get_by_id(appointment_id)
        if not appt:
            raise NotFoundException("Appointment not found")
        if appt.status not in (AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED):
            raise ValidationException(f"Cannot check in appointment with status '{appt.status}'")

        now = datetime.utcnow().isoformat()
        updates: dict = {"status": AppointmentStatus.CHECKED_IN, "checked_in_at": now}
        if queue_number:
            updates["queue_number"] = queue_number
        await self.appt_repo.update(appointment_id, updates)
        return await self.appt_repo.get_by_id(appointment_id)

    # ── Waitlist ───────────────────────────────────────────────────────────

    async def add_to_waitlist(self, payload: WaitlistCreate, added_by: str):
        position = await self.waitlist_repo.get_next_position(
            payload.doctor_id, payload.clinic_id
        )
        data = {**payload.model_dump(), "position": position}
        return await self.waitlist_repo.create(data, created_by=added_by)

    async def _promote_waitlist(self, doctor_id: str, clinic_id: str):
        waiting = await self.waitlist_repo.get_waiting(doctor_id, clinic_id)
        if waiting:
            first = waiting[0]
            await self.waitlist_repo.update(
                first.id, {"status": "offered", "offer_expires_at": (
                    datetime.utcnow() + timedelta(hours=24)
                ).isoformat()}
            )

    # ── Utilities ──────────────────────────────────────────────────────────

    @staticmethod
    def _time_to_minutes(time_str: str) -> int:
        h, m = time_str.split(":")
        return int(h) * 60 + int(m)

    @staticmethod
    def _minutes_to_time(minutes: int) -> str:
        return f"{minutes // 60:02d}:{minutes % 60:02d}"
