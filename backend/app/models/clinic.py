"""Clinic / branch model."""
from enum import Enum
from typing import List, Optional

from sqlalchemy import Boolean, ForeignKey, Integer, JSON, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class ClinicStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    TEMPORARILY_CLOSED = "temporarily_closed"


class Clinic(BaseModel):
    """
    A physical clinic or branch belonging to a Tenant.
    A tenant can have multiple clinics (e.g., City Health - Downtown, Uptown).
    """
    __tablename__ = "clinics"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # Internal code
    status: Mapped[str] = mapped_column(String(20), default=ClinicStatus.ACTIVE)

    # Location
    address_line1: Mapped[str] = mapped_column(String(255), nullable=False)
    address_line2: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[str] = mapped_column(String(100), nullable=False)
    postal_code: Mapped[str] = mapped_column(String(20), nullable=False)
    country: Mapped[str] = mapped_column(String(2), default="US")
    latitude: Mapped[Optional[float]] = mapped_column(nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(nullable=True)
    timezone: Mapped[str] = mapped_column(String(50), default="UTC")

    # Contact
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Operating hours stored as JSON:
    # { "monday": {"open": "09:00", "close": "17:00", "closed": false}, ... }
    operating_hours: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Public holidays (list of YYYY-MM-DD strings)
    holidays: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Services offered (IDs or names)
    services: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Settings
    appointment_slot_duration: Mapped[int] = mapped_column(Integer, default=15)  # minutes
    max_advance_booking_days: Mapped[int] = mapped_column(Integer, default=30)
    cancellation_notice_hours: Mapped[int] = mapped_column(Integer, default=24)
    no_show_charge_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    no_show_charge_amount: Mapped[Optional[float]] = mapped_column(nullable=True)

    # Branding
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Relationships
    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="clinics")
    doctors: Mapped[List["DoctorClinicAssignment"]] = relationship(
        "DoctorClinicAssignment", back_populates="clinic"
    )
    appointments: Mapped[List["Appointment"]] = relationship(
        "Appointment", back_populates="clinic"
    )
    rooms: Mapped[List["ClinicRoom"]] = relationship(
        "ClinicRoom", back_populates="clinic", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Clinic {self.name} ({self.city})>"

    def is_open_on(self, day_of_week: str) -> bool:
        """Check if clinic is open on given day (e.g., 'monday')."""
        if not self.operating_hours:
            return False
        day_hours = self.operating_hours.get(day_of_week.lower())
        if not day_hours:
            return False
        return not day_hours.get("closed", False)


class ClinicRoom(BaseModel):
    """A room or bay within a clinic."""
    __tablename__ = "clinic_rooms"

    clinic_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    room_type: Mapped[str] = mapped_column(String(50), nullable=False)  # consultation, treatment, lab
    capacity: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    equipment: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    clinic: Mapped["Clinic"] = relationship("Clinic", back_populates="rooms")
