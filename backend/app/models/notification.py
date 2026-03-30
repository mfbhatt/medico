"""Notification and audit log models."""
from enum import Enum
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class NotificationChannel(str, Enum):
    IN_APP = "in_app"
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"
    WHATSAPP = "whatsapp"


class NotificationStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    READ = "read"


class Notification(BaseModel):
    """Notification log for all channels."""
    __tablename__ = "notifications"

    recipient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    notification_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # appointment_reminder, appointment_confirmation, lab_result, prescription_ready,
    # invoice_issued, payment_received, doctor_unavailable, slot_available, etc.

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # Extra payload for deep linking in mobile app

    status: Mapped[str] = mapped_column(
        String(20), default=NotificationStatus.PENDING, nullable=False
    )
    sent_at: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    delivered_at: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    read_at: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # For email
    email_message_id: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    # For SMS
    sms_message_id: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    # For push
    fcm_message_id: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    error_message: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    retry_count: Mapped[int] = mapped_column(default=0)

    # Reference to the entity this notification is about
    reference_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    reference_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)

    def __repr__(self) -> str:
        return f"<Notification {self.notification_type} → {self.recipient_id} via {self.channel}>"


class AuditLog(BaseModel):
    """
    HIPAA-compliant audit trail for all PHI access and modifications.
    Every read, create, update, delete on sensitive resources is logged.
    """
    __tablename__ = "audit_logs"

    user_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    action: Mapped[str] = mapped_column(String(20), nullable=False)
    # create, read, update, delete, login, logout, export, print

    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # patient, medical_record, prescription, lab_report, etc.
    resource_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)

    # Context
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    request_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)

    # What changed
    old_values: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    new_values: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    changed_fields: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Result
    success: Mapped[bool] = mapped_column(Boolean, default=True)
    error_message: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    user: Mapped[Optional["User"]] = relationship("User", back_populates="audit_logs")

    def __repr__(self) -> str:
        return f"<AuditLog {self.action} on {self.resource_type}:{self.resource_id}>"
