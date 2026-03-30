"""Appointment booking models — includes waitlist and visit tracking."""
from enum import Enum
from typing import List, Optional

from sqlalchemy import Boolean, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class AppointmentStatus(str, Enum):
    SCHEDULED = "scheduled"
    CONFIRMED = "confirmed"
    CHECKED_IN = "checked_in"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    NO_SHOW = "no_show"
    CANCELLED = "cancelled"
    RESCHEDULED = "rescheduled"
    WAITLISTED = "waitlisted"


class AppointmentType(str, Enum):
    IN_PERSON = "in_person"
    TELEMEDICINE = "telemedicine"
    HOME_VISIT = "home_visit"
    EMERGENCY = "emergency"


class AppointmentPriority(str, Enum):
    ROUTINE = "routine"
    URGENT = "urgent"
    EMERGENCY = "emergency"


class Appointment(BaseModel):
    """
    Core appointment model.
    Handles: online booking, walk-ins, recurring, emergency, telemedicine.
    """
    __tablename__ = "appointments"

    # Core references
    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    doctor_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False, index=True
    )
    clinic_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True
    )
    room_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("clinic_rooms.id", ondelete="SET NULL"), nullable=True
    )

    # Timing
    appointment_date: Mapped[str] = mapped_column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    start_time: Mapped[str] = mapped_column(String(5), nullable=False)   # HH:MM
    end_time: Mapped[str] = mapped_column(String(5), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=15)
    timezone: Mapped[str] = mapped_column(String(50), default="UTC")

    # Status & type
    status: Mapped[str] = mapped_column(
        String(20), default=AppointmentStatus.SCHEDULED, nullable=False, index=True
    )
    appointment_type: Mapped[str] = mapped_column(
        String(20), default=AppointmentType.IN_PERSON, nullable=False
    )
    priority: Mapped[str] = mapped_column(
        String(20), default=AppointmentPriority.ROUTINE, nullable=False
    )

    # Clinical info
    chief_complaint: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    visit_type: Mapped[str] = mapped_column(String(30), default="new")  # new, follow_up, emergency
    is_first_visit: Mapped[bool] = mapped_column(Boolean, default=True)
    referred_by_doctor_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("doctors.id", ondelete="SET NULL"), nullable=True
    )

    # Check-in/out tracking
    checked_in_at: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    consultation_started_at: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    consultation_ended_at: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    checked_out_at: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Cancellation
    cancelled_at: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    cancelled_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    cancellation_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    cancellation_fee_charged: Mapped[bool] = mapped_column(Boolean, default=False)

    # Rescheduling
    rescheduled_from_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True
    )
    reschedule_count: Mapped[int] = mapped_column(Integer, default=0)

    # Recurring appointment support
    recurrence_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    recurrence_rule: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # {"frequency": "weekly", "until": "2024-12-31", "count": 10}

    # Telemedicine
    video_room_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    video_room_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    video_session_started: Mapped[bool] = mapped_column(Boolean, default=False)

    # Patient arrival
    is_walk_in: Mapped[bool] = mapped_column(Boolean, default=False)
    queue_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Notes
    internal_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    patient_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Reminders
    reminder_24h_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    reminder_2h_sent: Mapped[bool] = mapped_column(Boolean, default=False)

    # Billing ref
    invoice_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    patient: Mapped["Patient"] = relationship("Patient", back_populates="appointments")
    doctor: Mapped["Doctor"] = relationship(
        "Doctor", foreign_keys=[doctor_id], back_populates="appointments"
    )
    clinic: Mapped["Clinic"] = relationship("Clinic", back_populates="appointments")
    medical_record: Mapped[Optional["MedicalRecord"]] = relationship(
        "MedicalRecord", back_populates="appointment", uselist=False
    )
    invoice: Mapped[Optional["Invoice"]] = relationship(
        "Invoice", foreign_keys=[invoice_id]
    )

    def __repr__(self) -> str:
        return f"<Appointment {self.appointment_date} {self.start_time} P:{self.patient_id} D:{self.doctor_id}>"


class AppointmentWaitlist(BaseModel):
    """
    Waitlist entry when no slot is currently available.
    Patients are auto-promoted when a slot opens up.
    """
    __tablename__ = "appointment_waitlists"

    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    doctor_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False, index=True
    )
    clinic_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False
    )
    preferred_date_from: Mapped[str] = mapped_column(String(10), nullable=False)
    preferred_date_until: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    preferred_time_from: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    preferred_time_until: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    priority: Mapped[str] = mapped_column(String(20), default=AppointmentPriority.ROUTINE)
    chief_complaint: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)  # Queue position

    status: Mapped[str] = mapped_column(String(20), default="waiting")
    # waiting, offered, accepted, expired, cancelled

    offered_appointment_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True
    )
    offer_expires_at: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    notification_sent_at: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
