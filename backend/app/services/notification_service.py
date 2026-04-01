"""Notification service — unified interface for all notification channels."""
from typing import Optional


async def send_sms(phone: str, message: str) -> bool:
    """Send SMS via Twilio."""
    from app.core.config import settings
    if not settings.TWILIO_ACCOUNT_SID:
        return False
    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        client.messages.create(
            body=message,
            from_=settings.TWILIO_FROM_NUMBER,
            to=phone,
        )
        return True
    except Exception:
        print(f"Failed to send SMS to {phone}: {message}")
        return False


async def send_email(
    to: str,
    subject: str,
    body: str,
    html_body: Optional[str] = None,
) -> bool:
    """Send email via SendGrid."""
    from app.core.config import settings
    if not settings.SENDGRID_API_KEY:
        # Dev fallback — print to console
        print(f"[EMAIL] To: {to}\nSubject: {subject}\n{body}")
        return True
    try:
        import sendgrid
        from sendgrid.helpers.mail import Mail, Content

        sg = sendgrid.SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
        contents = [Content("text/plain", body)]
        if html_body:
            contents.append(Content("text/html", html_body))
        message = Mail(
            from_email=(settings.EMAIL_SENDER_ADDRESS, settings.EMAIL_SENDER_NAME),
            to_emails=to,
            subject=subject,
        )
        for content in contents:
            message.add_content(content)
        sg.send(message)
        return True
    except Exception:
        return False


async def send_push_notification(
    fcm_token: str,
    title: str,
    body: str,
    data: Optional[dict] = None,
) -> bool:
    """Send push notification via Firebase Cloud Messaging."""
    from app.core.config import settings
    if not settings.FIREBASE_PROJECT_ID:
        return False
    try:
        import firebase_admin
        from firebase_admin import messaging, credentials

        if not firebase_admin._apps:
            cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
            firebase_admin.initialize_app(cred)

        message = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data={k: str(v) for k, v in (data or {}).items()},
            token=fcm_token,
            android=messaging.AndroidConfig(priority="high"),
            apns=messaging.APNSConfig(
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(sound="default")
                )
            ),
        )
        messaging.send(message)
        return True
    except Exception:
        return False


async def send_bulk_sms(recipients: list[dict], message_template: str) -> int:
    """
    Send SMS to multiple recipients.
    recipients: [{"phone": "+1...", "name": "...", ...}]
    Returns count of successfully sent messages.
    """
    success_count = 0
    for recipient in recipients:
        phone = recipient.get("phone")
        if not phone:
            continue
        # Personalize message
        msg = message_template.format(**recipient)
        if await send_sms(phone, msg):
            success_count += 1
    return success_count


async def create_in_app_notification(
    db,
    recipient_id: str,
    tenant_id: str,
    notification_type: str,
    title: str,
    body: str,
    data: Optional[dict] = None,
    reference_type: Optional[str] = None,
    reference_id: Optional[str] = None,
) -> str:
    """Create an in-app notification record in the database."""
    from app.models.notification import Notification, NotificationChannel, NotificationStatus
    from datetime import datetime, timezone

    notification = Notification(
        tenant_id=tenant_id,
        recipient_id=recipient_id,
        channel=NotificationChannel.IN_APP,
        notification_type=notification_type,
        title=title,
        body=body,
        data=data,
        status=NotificationStatus.DELIVERED,
        sent_at=datetime.now(timezone.utc).isoformat(),
        delivered_at=datetime.now(timezone.utc).isoformat(),
        reference_type=reference_type,
        reference_id=reference_id,
        created_by="system",
    )
    db.add(notification)
    await db.flush()
    return notification.id
