"""Celery tasks for notifications — SMS, email, push."""
from app.tasks.celery_app import celery_app


@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    name="app.tasks.notification_tasks.send_appointment_reminder",
)
def send_appointment_reminder(self, appointment_id: str, reminder_type: str):
    """Send appointment reminder (24h or 2h before)."""
    import asyncio
    from app.core.database import async_session_factory
    from sqlalchemy import select
    from app.models.appointment import Appointment
    from app.models.patient import Patient
    from app.models.doctor import Doctor
    from app.models.user import User

    async def _run():
        async with async_session_factory() as db:
            result = await db.execute(
                select(Appointment).where(
                    Appointment.id == appointment_id,
                    Appointment.is_deleted == False,
                )
            )
            appt = result.scalar_one_or_none()
            if not appt:
                return

            # Skip if already cancelled
            if appt.status in ("cancelled", "completed", "no_show"):
                return

            # Get patient contact
            patient_result = await db.execute(
                select(Patient).where(Patient.id == appt.patient_id)
            )
            patient = patient_result.scalar_one_or_none()
            if not patient:
                return

            message = (
                f"Reminder: Your appointment is "
                f"{'tomorrow' if reminder_type == '24h' else 'in 2 hours'} "
                f"on {appt.appointment_date} at {appt.start_time}. "
                f"Reply CANCEL to cancel."
            )

            # Send SMS
            if patient.phone:
                await _send_sms(patient.phone, message)

            # Send push notification
            if patient.user_id:
                user_result = await db.execute(
                    select(User).where(User.id == patient.user_id)
                )
                user = user_result.scalar_one_or_none()
                if user and user.fcm_token:
                    await _send_push(
                        token=user.fcm_token,
                        title="Appointment Reminder",
                        body=message,
                        data={"type": "appointment_reminder", "appointment_id": appointment_id},
                    )

            # Update reminder sent flag
            if reminder_type == "24h":
                appt.reminder_24h_sent = True
            else:
                appt.reminder_2h_sent = True
            await db.commit()

    try:
        asyncio.get_event_loop().run_until_complete(_run())
    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    name="app.tasks.notification_tasks.send_appointment_confirmation",
)
def send_appointment_confirmation(self, appointment_id: str):
    """Send booking confirmation to patient and doctor."""
    import asyncio

    async def _run():
        from app.core.database import async_session_factory
        from sqlalchemy import select
        from app.models.appointment import Appointment
        from app.models.patient import Patient

        async with async_session_factory() as db:
            result = await db.execute(
                select(Appointment).where(Appointment.id == appointment_id)
            )
            appt = result.scalar_one_or_none()
            if not appt:
                return

            patient_result = await db.execute(
                select(Patient).where(Patient.id == appt.patient_id)
            )
            patient = patient_result.scalar_one_or_none()
            if not patient:
                return

            confirmation_msg = (
                f"Appointment confirmed! "
                f"Date: {appt.appointment_date} at {appt.start_time}. "
                f"Reference: {appt.id[:8].upper()}"
            )

            if patient.phone:
                await _send_sms(patient.phone, confirmation_msg)

            if patient.email:
                await _send_email(
                    to=patient.email,
                    subject="Appointment Confirmation",
                    body=_confirmation_email_body(appt, patient),
                )

    try:
        asyncio.get_event_loop().run_until_complete(_run())
    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task(name="app.tasks.notification_tasks.send_pending_reminders")
def send_pending_reminders():
    """Scan for appointments needing reminders and queue them."""
    import asyncio
    from datetime import datetime, timedelta, timezone

    async def _run():
        from app.core.database import async_session_factory
        from sqlalchemy import select, and_
        from app.models.appointment import Appointment, AppointmentStatus

        now = datetime.now(timezone.utc)
        tomorrow = (now + timedelta(hours=24)).strftime("%Y-%m-%d")
        in_2h_date = (now + timedelta(hours=2)).strftime("%Y-%m-%d")
        in_2h_time = (now + timedelta(hours=2)).strftime("%H:%M")

        async with async_session_factory() as db:
            # 24-hour reminders
            result_24h = await db.execute(
                select(Appointment).where(
                    Appointment.appointment_date == tomorrow,
                    Appointment.status == AppointmentStatus.SCHEDULED,
                    Appointment.reminder_24h_sent == False,
                    Appointment.is_deleted == False,
                )
            )
            for appt in result_24h.scalars():
                send_appointment_reminder.delay(appt.id, "24h")

            # 2-hour reminders
            result_2h = await db.execute(
                select(Appointment).where(
                    Appointment.appointment_date == in_2h_date,
                    Appointment.start_time <= in_2h_time,
                    Appointment.status == AppointmentStatus.SCHEDULED,
                    Appointment.reminder_2h_sent == False,
                    Appointment.is_deleted == False,
                )
            )
            for appt in result_2h.scalars():
                send_appointment_reminder.delay(appt.id, "2h")

    asyncio.get_event_loop().run_until_complete(_run())


@celery_app.task(name="app.tasks.notification_tasks.notify_critical_lab_result")
def notify_critical_lab_result(lab_report_id: str):
    """Immediately notify doctor of critical lab values."""
    import asyncio

    async def _run():
        from app.core.database import async_session_factory
        from sqlalchemy import select
        from app.models.lab_report import LabReport
        from app.models.doctor import Doctor
        from app.models.user import User

        async with async_session_factory() as db:
            result = await db.execute(
                select(LabReport).where(LabReport.id == lab_report_id)
            )
            report = result.scalar_one_or_none()
            if not report:
                return

            doctor_user_result = await db.execute(
                select(User).join(Doctor, Doctor.user_id == User.id).where(
                    Doctor.id == report.ordering_doctor_id
                )
            )
            user = doctor_user_result.scalar_one_or_none()
            if user and user.fcm_token:
                await _send_push(
                    token=user.fcm_token,
                    title="CRITICAL Lab Result",
                    body=f"Patient {report.patient_id[:8]} has critical lab values. Immediate review required.",
                    data={
                        "type": "critical_lab_result",
                        "lab_report_id": lab_report_id,
                        "priority": "critical",
                    },
                )

            report.critical_notified_at = datetime.now(timezone.utc).isoformat()
            await db.commit()

    asyncio.get_event_loop().run_until_complete(_run())


@celery_app.task(name="app.tasks.notification_tasks.notify_expiring_insurance")
def notify_expiring_insurance():
    """Notify patients whose insurance expires within 30 days."""
    import asyncio

    async def _run():
        from datetime import date, timedelta
        from app.core.database import async_session_factory
        from sqlalchemy import select, and_
        from app.models.patient import Patient, InsurancePolicy

        expiry_threshold = (date.today() + timedelta(days=30)).isoformat()

        async with async_session_factory() as db:
            result = await db.execute(
                select(InsurancePolicy, Patient).join(
                    Patient, Patient.id == InsurancePolicy.patient_id
                ).where(
                    InsurancePolicy.valid_until <= expiry_threshold,
                    InsurancePolicy.is_active == True,
                    InsurancePolicy.is_deleted == False,
                )
            )
            for policy, patient in result:
                msg = (
                    f"Your insurance policy ({policy.insurance_provider}) "
                    f"expires on {policy.valid_until}. "
                    f"Please renew to avoid coverage gaps."
                )
                if patient.phone:
                    await _send_sms(patient.phone, msg)

    asyncio.get_event_loop().run_until_complete(_run())


@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    name="app.tasks.notification_tasks.send_patient_welcome_whatsapp",
)
def send_patient_welcome_whatsapp(self, phone: str, patient_name: str, username: str, temporary_password: str):
    """Send new patient account credentials via WhatsApp."""
    import asyncio

    message = (
        f"Welcome to our clinic, {patient_name}!\n\n"
        f"Your patient portal account has been created.\n"
        f"Username: {username}\n"
        f"Temporary Password: {temporary_password}\n\n"
        f"Please log in and change your password at first login.\n"
        f"Keep these credentials safe and do not share them."
    )

    async def _run():
        await _send_whatsapp(phone, message)

    try:
        asyncio.get_event_loop().run_until_complete(_run())
    except Exception as exc:
        raise self.retry(exc=exc)


# ── Internal helpers ─────────────────────────────────────────────
async def _send_sms(phone: str, message: str) -> None:
    from app.core.config import settings
    if not settings.TWILIO_ACCOUNT_SID:
        return
    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        client.messages.create(
            body=message,
            from_=settings.TWILIO_FROM_NUMBER,
            to=phone,
        )
    except Exception:
        pass


async def _send_whatsapp(phone: str, message: str) -> None:
    from app.core.config import settings
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_WHATSAPP_NUMBER:
        return
    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        # Ensure phone is in whatsapp: format
        to = phone if phone.startswith("whatsapp:") else f"whatsapp:{phone}"
        client.messages.create(
            body=message,
            from_=settings.TWILIO_WHATSAPP_NUMBER,
            to=to,
        )
    except Exception:
        pass


async def _send_email(to: str, subject: str, body: str) -> None:
    from app.core.config import settings
    if not settings.SENDGRID_API_KEY:
        return
    try:
        import sendgrid
        from sendgrid.helpers.mail import Mail

        sg = sendgrid.SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
        message = Mail(
            from_email=settings.EMAIL_SENDER_ADDRESS,
            to_emails=to,
            subject=subject,
            plain_text_content=body,
        )
        sg.send(message)
    except Exception:
        pass


async def _send_push(token: str, title: str, body: str, data: dict = None) -> None:
    from app.core.config import settings
    if not settings.FIREBASE_PROJECT_ID:
        return
    try:
        import firebase_admin
        from firebase_admin import messaging

        if not firebase_admin._apps:
            import firebase_admin
            from firebase_admin import credentials
            cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
            firebase_admin.initialize_app(cred)

        message = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data={k: str(v) for k, v in (data or {}).items()},
            token=token,
        )
        messaging.send(message)
    except Exception:
        pass


def _confirmation_email_body(appt, patient) -> str:
    return f"""
Dear {patient.full_name},

Your appointment has been confirmed.

Date: {appt.appointment_date}
Time: {appt.start_time}
Reference: #{appt.id[:8].upper()}

Please arrive 10 minutes early with any relevant documents.

If you need to cancel or reschedule, please do so at least 24 hours in advance.

Best regards,
ClinicManagement Team
"""
