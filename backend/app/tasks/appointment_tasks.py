"""Celery tasks for appointment management."""
from app.tasks.celery_app import celery_app


@celery_app.task(name="app.tasks.appointment_tasks.auto_mark_no_shows")
def auto_mark_no_shows():
    """
    Scan appointments that passed their start time by 30+ minutes
    and are still in 'scheduled' status → mark as no-show.
    """
    import asyncio
    from datetime import datetime, timezone, timedelta

    async def _run():
        from app.core.database import async_session_factory
        from sqlalchemy import select, and_
        from app.models.appointment import Appointment, AppointmentStatus

        now = datetime.now(timezone.utc)
        cutoff_date = now.strftime("%Y-%m-%d")
        cutoff_time = (now - timedelta(minutes=30)).strftime("%H:%M")

        async with async_session_factory() as db:
            result = await db.execute(
                select(Appointment).where(
                    Appointment.appointment_date == cutoff_date,
                    Appointment.start_time <= cutoff_time,
                    Appointment.status == AppointmentStatus.SCHEDULED,
                    Appointment.is_deleted == False,
                )
            )
            appointments = list(result.scalars())

            for appt in appointments:
                appt.status = AppointmentStatus.NO_SHOW
                # Promote from waitlist
                promote_waitlist_patient.delay(
                    appt.doctor_id, appt.clinic_id,
                    appt.appointment_date, appt.start_time
                )

            if appointments:
                await db.commit()

    asyncio.get_event_loop().run_until_complete(_run())


@celery_app.task(name="app.tasks.appointment_tasks.promote_waitlist_patient")
def promote_waitlist_patient(
    doctor_id: str, clinic_id: str, appointment_date: str, start_time: str
):
    """
    When a slot opens (cancellation / no-show), promote the next waitlisted
    patient and send them a slot offer notification.
    """
    import asyncio

    async def _run():
        from app.core.database import async_session_factory
        from sqlalchemy import select
        from app.models.appointment import AppointmentWaitlist
        from datetime import datetime, timezone, timedelta

        async with async_session_factory() as db:
            # Find next eligible waitlist entry
            result = await db.execute(
                select(AppointmentWaitlist).where(
                    AppointmentWaitlist.doctor_id == doctor_id,
                    AppointmentWaitlist.clinic_id == clinic_id,
                    AppointmentWaitlist.status == "waiting",
                    AppointmentWaitlist.preferred_date_from <= appointment_date,
                    AppointmentWaitlist.is_deleted == False,
                ).order_by(AppointmentWaitlist.position)
            )
            entry = result.scalar_one_or_none()

            if not entry:
                return

            # Mark as offered with 2-hour expiry
            offer_expires = (
                datetime.now(timezone.utc) + timedelta(hours=2)
            ).isoformat()
            entry.status = "offered"
            entry.offer_expires_at = offer_expires
            entry.notification_sent_at = datetime.now(timezone.utc).isoformat()
            await db.commit()

            # Send notification to patient
            from app.models.patient import Patient
            from app.models.user import User

            patient_res = await db.execute(
                select(Patient).where(Patient.id == entry.patient_id)
            )
            patient = patient_res.scalar_one_or_none()

            if patient and patient.user_id:
                user_res = await db.execute(
                    select(User).where(User.id == patient.user_id)
                )
                user = user_res.scalar_one_or_none()
                if user and user.fcm_token:
                    from app.tasks.notification_tasks import _send_push
                    asyncio.create_task(_send_push(
                        token=user.fcm_token,
                        title="Appointment Slot Available!",
                        body=(
                            f"A slot opened for {appointment_date} at {start_time}. "
                            f"You have 2 hours to accept."
                        ),
                        data={
                            "type": "waitlist_offer",
                            "waitlist_id": entry.id,
                            "appointment_date": appointment_date,
                            "start_time": start_time,
                            "expires_at": offer_expires,
                        },
                    ))

    asyncio.get_event_loop().run_until_complete(_run())


@celery_app.task(name="app.tasks.appointment_tasks.notify_affected_patients")
def notify_affected_patients(
    doctor_id: str, exception_date: str, substitute_doctor_id: str = None
):
    """
    When a doctor adds a day-off exception, notify all patients with
    appointments on that date and offer rescheduling.
    """
    import asyncio

    async def _run():
        from app.core.database import async_session_factory
        from sqlalchemy import select
        from app.models.appointment import Appointment, AppointmentStatus
        from app.models.patient import Patient
        from app.models.user import User

        async with async_session_factory() as db:
            result = await db.execute(
                select(Appointment).where(
                    Appointment.doctor_id == doctor_id,
                    Appointment.appointment_date == exception_date,
                    Appointment.status.in_([
                        AppointmentStatus.SCHEDULED,
                        AppointmentStatus.CONFIRMED,
                    ]),
                    Appointment.is_deleted == False,
                )
            )
            appointments = list(result.scalars())

            for appt in appointments:
                patient_res = await db.execute(
                    select(Patient).where(Patient.id == appt.patient_id)
                )
                patient = patient_res.scalar_one_or_none()
                if not patient:
                    continue

                msg = (
                    f"Your appointment on {exception_date} at {appt.start_time} "
                    f"has been cancelled as the doctor is unavailable. "
                )
                if substitute_doctor_id:
                    msg += "A substitute doctor has been assigned. Please confirm."
                else:
                    msg += "Please reschedule at your convenience."

                # SMS notification
                if patient.phone:
                    from app.tasks.notification_tasks import _send_sms
                    await _send_sms(patient.phone, msg)

                # Push notification
                if patient.user_id:
                    user_res = await db.execute(
                        select(User).where(User.id == patient.user_id)
                    )
                    user = user_res.scalar_one_or_none()
                    if user and user.fcm_token:
                        from app.tasks.notification_tasks import _send_push
                        await _send_push(
                            token=user.fcm_token,
                            title="Appointment Update",
                            body=msg,
                            data={
                                "type": "doctor_unavailable",
                                "appointment_id": appt.id,
                                "appointment_date": exception_date,
                            },
                        )

    asyncio.get_event_loop().run_until_complete(_run())


@celery_app.task(name="app.tasks.appointment_tasks.expire_waitlist_offers")
def expire_waitlist_offers():
    """Expire waitlist slot offers that have not been accepted in time."""
    import asyncio
    from datetime import datetime, timezone

    async def _run():
        from app.core.database import async_session_factory
        from sqlalchemy import select
        from app.models.appointment import AppointmentWaitlist

        now = datetime.now(timezone.utc).isoformat()
        async with async_session_factory() as db:
            result = await db.execute(
                select(AppointmentWaitlist).where(
                    AppointmentWaitlist.status == "offered",
                    AppointmentWaitlist.offer_expires_at <= now,
                    AppointmentWaitlist.is_deleted == False,
                )
            )
            for entry in result.scalars():
                entry.status = "waiting"  # Back to waiting
                entry.offered_appointment_id = None
                entry.offer_expires_at = None
            await db.commit()

    asyncio.get_event_loop().run_until_complete(_run())
