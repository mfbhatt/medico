"""Doctor profile, specializations, and schedule models."""
from enum import Enum
from typing import List, Optional

from sqlalchemy import (
    Boolean, Date, ForeignKey, Integer, JSON, String, Text, Time, Float,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class DayOfWeek(str, Enum):
    MONDAY = "monday"
    TUESDAY = "tuesday"
    WEDNESDAY = "wednesday"
    THURSDAY = "thursday"
    FRIDAY = "friday"
    SATURDAY = "saturday"
    SUNDAY = "sunday"


class Doctor(BaseModel):
    """Doctor profile linked to a User account."""
    __tablename__ = "doctors"

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )

    # Professional info
    registration_number: Mapped[str] = mapped_column(String(50), nullable=False)
    registration_council: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    registration_expiry: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    npi_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # USA

    # Qualifications
    primary_specialization: Mapped[str] = mapped_column(String(100), nullable=False)
    secondary_specializations: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    qualifications: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # [{"degree": "MBBS", "institution": "...", "year": 2010}, ...]
    experience_years: Mapped[int] = mapped_column(Integer, default=0)

    # Bio
    biography: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    languages: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # ["English", "Spanish"]
    consultation_fee: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    follow_up_fee: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Availability defaults
    default_slot_duration: Mapped[int] = mapped_column(Integer, default=15)  # minutes
    max_patients_per_day: Mapped[int] = mapped_column(Integer, default=30)
    is_accepting_new_patients: Mapped[bool] = mapped_column(Boolean, default=True)
    telemedicine_enabled: Mapped[bool] = mapped_column(Boolean, default=False)

    # Ratings (aggregated)
    average_rating: Mapped[float] = mapped_column(Float, default=0.0)
    total_ratings: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="doctor_profile")
    clinic_assignments: Mapped[List["DoctorClinicAssignment"]] = relationship(
        "DoctorClinicAssignment", back_populates="doctor", cascade="all, delete-orphan"
    )
    schedules: Mapped[List["DoctorSchedule"]] = relationship(
        "DoctorSchedule", back_populates="doctor", cascade="all, delete-orphan"
    )
    schedule_exceptions: Mapped[List["DoctorScheduleException"]] = relationship(
        "DoctorScheduleException",
        foreign_keys="[DoctorScheduleException.doctor_id]",
        back_populates="doctor",
        cascade="all, delete-orphan",
    )
    appointments: Mapped[List["Appointment"]] = relationship(
        "Appointment",
        foreign_keys="[Appointment.doctor_id]",
        back_populates="doctor",
    )

    def __repr__(self) -> str:
        return f"<Doctor {self.user_id} - {self.primary_specialization}>"


class DoctorClinicAssignment(BaseModel):
    """Many-to-many: a doctor can work at multiple clinics."""
    __tablename__ = "doctor_clinic_assignments"

    doctor_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False
    )
    clinic_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False
    )
    is_primary_clinic: Mapped[bool] = mapped_column(Boolean, default=True)
    consultation_fee_override: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    start_date: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    end_date: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)

    doctor: Mapped["Doctor"] = relationship("Doctor", back_populates="clinic_assignments")
    clinic: Mapped["Clinic"] = relationship("Clinic", back_populates="doctors")


class DoctorSchedule(BaseModel):
    """
    Weekly recurring schedule for a doctor at a specific clinic.
    Defines available time slots for each day of the week.
    """
    __tablename__ = "doctor_schedules"

    doctor_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False, index=True
    )
    clinic_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True
    )
    day_of_week: Mapped[str] = mapped_column(String(10), nullable=False)
    start_time: Mapped[str] = mapped_column(String(5), nullable=False)   # "HH:MM"
    end_time: Mapped[str] = mapped_column(String(5), nullable=False)     # "HH:MM"
    slot_duration: Mapped[int] = mapped_column(Integer, default=15)      # minutes
    break_start: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    break_end: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    max_appointments: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Valid date range for this schedule
    valid_from: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # YYYY-MM-DD
    valid_until: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)

    doctor: Mapped["Doctor"] = relationship("Doctor", back_populates="schedules")


class DoctorScheduleException(BaseModel):
    """
    One-off exceptions to the regular schedule:
    - Doctor leaves / sick day (unavailable)
    - Extra availability on a normally-off day
    - Early finish or late start
    """
    __tablename__ = "doctor_schedule_exceptions"

    doctor_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False, index=True
    )
    clinic_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False
    )
    exception_date: Mapped[str] = mapped_column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    exception_type: Mapped[str] = mapped_column(String(20), nullable=False)
    # Types: "day_off", "leave", "extra_hours", "modified_hours", "emergency_leave"

    # For modified hours
    start_time: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    end_time: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)

    reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notify_patients: Mapped[bool] = mapped_column(Boolean, default=True)
    substitute_doctor_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("doctors.id", ondelete="SET NULL"), nullable=True
    )

    doctor: Mapped["Doctor"] = relationship(
        "Doctor", foreign_keys=[doctor_id], back_populates="schedule_exceptions"
    )
    substitute_doctor: Mapped[Optional["Doctor"]] = relationship(
        "Doctor", foreign_keys=[substitute_doctor_id]
    )


class DoctorRating(BaseModel):
    """Patient rating/review for a doctor."""
    __tablename__ = "doctor_ratings"

    doctor_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False, index=True
    )
    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    appointment_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5
    review: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_anonymous: Mapped[bool] = mapped_column(Boolean, default=False)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=True)
