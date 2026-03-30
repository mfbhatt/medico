"""Tests for appointment booking system — including edge cases."""
import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import Appointment, AppointmentStatus
from app.models.clinic import Clinic
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.tenant import Tenant
from app.models.user import User
from tests.conftest import auth_headers


pytestmark = pytest.mark.asyncio

# Next Monday (to guarantee a weekday hit the Mon-Fri schedule)
def next_monday() -> date:
    today = date.today()
    days_ahead = (7 - today.weekday()) % 7 or 7
    return today + timedelta(days=days_ahead)


class TestSlotAvailability:
    async def test_get_available_slots(
        self,
        client: AsyncClient,
        admin_user: User,
        tenant: Tenant,
        doctor: Doctor,
        clinic: Clinic,
    ):
        headers = auth_headers(admin_user, tenant)
        slot_date = next_monday().isoformat()
        resp = await client.get(
            f"/api/v1/appointments/slots?doctor_id={doctor.id}"
            f"&clinic_id={clinic.id}&date={slot_date}",
            headers=headers,
        )
        assert resp.status_code == 200
        slots = resp.json()["data"]
        assert isinstance(slots, list)
        assert len(slots) > 0  # 9–17 with 30-min slots = 16 slots

    async def test_slots_on_weekend_returns_empty(
        self,
        client: AsyncClient,
        admin_user: User,
        tenant: Tenant,
        doctor: Doctor,
        clinic: Clinic,
    ):
        # Find next Saturday
        today = date.today()
        days_ahead = (5 - today.weekday()) % 7 or 7
        saturday = today + timedelta(days=days_ahead)

        headers = auth_headers(admin_user, tenant)
        resp = await client.get(
            f"/api/v1/appointments/slots?doctor_id={doctor.id}"
            f"&clinic_id={clinic.id}&date={saturday.isoformat()}",
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["data"] == []


class TestAppointmentBooking:
    async def test_book_appointment_success(
        self,
        client: AsyncClient,
        admin_user: User,
        tenant: Tenant,
        doctor: Doctor,
        clinic: Clinic,
        patient: Patient,
    ):
        headers = auth_headers(admin_user, tenant)
        slot_date = next_monday()
        resp = await client.post(
            "/api/v1/appointments/",
            json={
                "doctor_id": doctor.id,
                "clinic_id": clinic.id,
                "patient_id": patient.id,
                "scheduled_date": slot_date.isoformat(),
                "scheduled_time": "10:00",
                "appointment_type": "consultation",
            },
            headers=headers,
        )
        assert resp.status_code == 201
        data = resp.json()["data"]
        assert data["status"] == "scheduled"
        assert data["patient_id"] == patient.id

    async def test_double_booking_prevention(
        self,
        client: AsyncClient,
        admin_user: User,
        tenant: Tenant,
        doctor: Doctor,
        clinic: Clinic,
        patient: Patient,
        db: AsyncSession,
    ):
        """Two concurrent bookings for the same slot must result in one success + one conflict."""
        headers = auth_headers(admin_user, tenant)
        slot_date = next_monday()

        # Book the slot once
        resp1 = await client.post(
            "/api/v1/appointments/",
            json={
                "doctor_id": doctor.id,
                "clinic_id": clinic.id,
                "patient_id": patient.id,
                "scheduled_date": slot_date.isoformat(),
                "scheduled_time": "11:00",
                "appointment_type": "consultation",
            },
            headers=headers,
        )
        assert resp1.status_code == 201

        # Second patient attempts same slot
        second_patient = Patient(
            tenant_id=tenant.id,
            first_name="Second",
            last_name="Patient",
            date_of_birth=date(1995, 3, 10),
            gender="female",
            phone="+15552222222",
            created_by="system",
        )
        db.add(second_patient)
        await db.flush()

        resp2 = await client.post(
            "/api/v1/appointments/",
            json={
                "doctor_id": doctor.id,
                "clinic_id": clinic.id,
                "patient_id": second_patient.id,
                "scheduled_date": slot_date.isoformat(),
                "scheduled_time": "11:00",
                "appointment_type": "consultation",
            },
            headers=headers,
        )
        assert resp2.status_code == 409  # Conflict

    async def test_book_outside_schedule_fails(
        self,
        client: AsyncClient,
        admin_user: User,
        tenant: Tenant,
        doctor: Doctor,
        clinic: Clinic,
        patient: Patient,
    ):
        """Booking at 22:00 should fail — outside 09-17 schedule."""
        headers = auth_headers(admin_user, tenant)
        slot_date = next_monday()
        resp = await client.post(
            "/api/v1/appointments/",
            json={
                "doctor_id": doctor.id,
                "clinic_id": clinic.id,
                "patient_id": patient.id,
                "scheduled_date": slot_date.isoformat(),
                "scheduled_time": "22:00",
                "appointment_type": "consultation",
            },
            headers=headers,
        )
        assert resp.status_code in (400, 409)

    async def test_cancel_appointment(
        self,
        client: AsyncClient,
        admin_user: User,
        tenant: Tenant,
        doctor: Doctor,
        clinic: Clinic,
        patient: Patient,
    ):
        headers = auth_headers(admin_user, tenant)
        slot_date = next_monday()

        # Book
        book_resp = await client.post(
            "/api/v1/appointments/",
            json={
                "doctor_id": doctor.id,
                "clinic_id": clinic.id,
                "patient_id": patient.id,
                "scheduled_date": slot_date.isoformat(),
                "scheduled_time": "14:00",
                "appointment_type": "consultation",
            },
            headers=headers,
        )
        appt_id = book_resp.json()["data"]["id"]

        # Cancel
        cancel_resp = await client.post(
            f"/api/v1/appointments/{appt_id}/cancel",
            json={"reason": "Patient request"},
            headers=headers,
        )
        assert cancel_resp.status_code == 200
        assert cancel_resp.json()["data"]["status"] == "cancelled"

    async def test_check_in_appointment(
        self,
        client: AsyncClient,
        admin_user: User,
        tenant: Tenant,
        doctor: Doctor,
        clinic: Clinic,
        patient: Patient,
    ):
        headers = auth_headers(admin_user, tenant)
        slot_date = next_monday()

        book_resp = await client.post(
            "/api/v1/appointments/",
            json={
                "doctor_id": doctor.id,
                "clinic_id": clinic.id,
                "patient_id": patient.id,
                "scheduled_date": slot_date.isoformat(),
                "scheduled_time": "15:00",
                "appointment_type": "consultation",
            },
            headers=headers,
        )
        appt_id = book_resp.json()["data"]["id"]

        check_in_resp = await client.post(
            f"/api/v1/appointments/{appt_id}/check-in",
            headers=headers,
        )
        assert check_in_resp.status_code == 200
        assert check_in_resp.json()["data"]["status"] == "checked_in"


class TestWaitlist:
    async def test_add_to_waitlist(
        self,
        client: AsyncClient,
        admin_user: User,
        tenant: Tenant,
        doctor: Doctor,
        clinic: Clinic,
        patient: Patient,
        db: AsyncSession,
    ):
        headers = auth_headers(admin_user, tenant)
        slot_date = next_monday()

        # Fill the slot
        await client.post(
            "/api/v1/appointments/",
            json={
                "doctor_id": doctor.id,
                "clinic_id": clinic.id,
                "patient_id": patient.id,
                "scheduled_date": slot_date.isoformat(),
                "scheduled_time": "09:30",
                "appointment_type": "consultation",
            },
            headers=headers,
        )

        # Second patient joins waitlist
        second_patient = Patient(
            tenant_id=tenant.id,
            first_name="Waitlist",
            last_name="Patient",
            date_of_birth=date(2000, 5, 5),
            gender="male",
            phone="+15553333333",
            created_by="system",
        )
        db.add(second_patient)
        await db.flush()

        wl_resp = await client.post(
            "/api/v1/appointments/waitlist",
            json={
                "doctor_id": doctor.id,
                "clinic_id": clinic.id,
                "patient_id": second_patient.id,
                "preferred_date": slot_date.isoformat(),
            },
            headers=headers,
        )
        assert wl_resp.status_code in (200, 201)
        assert wl_resp.json()["data"]["queue_position"] >= 1


class TestAppointmentPagination:
    async def test_list_appointments_paginated(
        self,
        client: AsyncClient,
        admin_user: User,
        tenant: Tenant,
        doctor: Doctor,
        clinic: Clinic,
        patient: Patient,
    ):
        headers = auth_headers(admin_user, tenant)
        resp = await client.get(
            "/api/v1/appointments/?limit=10&offset=0",
            headers=headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "data" in body
        assert isinstance(body["data"], list)

    async def test_filter_by_doctor(
        self,
        client: AsyncClient,
        admin_user: User,
        tenant: Tenant,
        doctor: Doctor,
        clinic: Clinic,
        patient: Patient,
    ):
        headers = auth_headers(admin_user, tenant)
        slot_date = next_monday()

        await client.post(
            "/api/v1/appointments/",
            json={
                "doctor_id": doctor.id,
                "clinic_id": clinic.id,
                "patient_id": patient.id,
                "scheduled_date": slot_date.isoformat(),
                "scheduled_time": "16:00",
                "appointment_type": "consultation",
            },
            headers=headers,
        )

        resp = await client.get(
            f"/api/v1/appointments/?doctor_id={doctor.id}",
            headers=headers,
        )
        assert resp.status_code == 200
        results = resp.json()["data"]
        assert all(a["doctor_id"] == doctor.id for a in results)
