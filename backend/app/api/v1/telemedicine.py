"""Telemedicine endpoints — Azure Communication Services WebRTC."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, CurrentUser
from app.core.exceptions import NotFoundException, BadRequestException, ForbiddenException
from app.core.config import settings
from app.models.appointment import Appointment, AppointmentStatus, AppointmentType

router = APIRouter()


def _success(data, message="Success"):
    return {"success": True, "message": message, "data": data}


@router.post("/{appointment_id}/join")
async def join_telemedicine_session(
    appointment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Generate a video call token for a telemedicine appointment.
    Returns Azure Communication Services user token and room URL.
    """
    result = await db.execute(
        select(Appointment).where(
            Appointment.id == appointment_id,
            Appointment.tenant_id == current_user.tenant_id,
            Appointment.is_deleted == False,
        )
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise NotFoundException(detail="Appointment not found")

    if appt.appointment_type != AppointmentType.TELEMEDICINE:
        raise BadRequestException(detail="This is not a telemedicine appointment")

    if appt.status not in (AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS):
        raise BadRequestException(
            detail=f"Cannot join appointment with status: {appt.status}"
        )

    # Check patient/doctor is authorized
    # (Patient can only join their own appointment)
    if current_user.role == "patient":
        from app.models.patient import Patient
        patient_res = await db.execute(
            select(Patient).where(Patient.user_id == current_user.user_id)
        )
        patient = patient_res.scalar_one_or_none()
        if not patient or appt.patient_id != patient.id:
            raise ForbiddenException()
    elif current_user.role == "doctor":
        from app.models.doctor import Doctor
        doctor_res = await db.execute(
            select(Doctor).where(Doctor.user_id == current_user.user_id)
        )
        doctor = doctor_res.scalar_one_or_none()
        if not doctor or appt.doctor_id != doctor.id:
            raise ForbiddenException()

    # Create or reuse ACS room
    room_id = appt.video_room_id
    if not room_id:
        room_id = await _create_acs_room(appointment_id)
        appt.video_room_id = room_id
        appt.video_room_url = f"https://app.clinicmanagement.com/telemedicine/{appointment_id}"
        await db.commit()

    # Generate ACS user token
    user_token = await _get_acs_token(current_user.user_id)

    # Mark as in progress if doctor joins
    if current_user.role == "doctor" and appt.status == AppointmentStatus.SCHEDULED:
        appt.status = AppointmentStatus.IN_PROGRESS
        appt.consultation_started_at = datetime.now(timezone.utc).isoformat()
        appt.video_session_started = True
        await db.commit()

    return _success({
        "room_id": room_id,
        "room_url": appt.video_room_url,
        "acs_token": user_token,
        "appointment_id": appointment_id,
        "duration_minutes": appt.duration_minutes,
    })


@router.post("/{appointment_id}/end")
async def end_telemedicine_session(
    appointment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """End a telemedicine session (called by doctor)."""
    result = await db.execute(
        select(Appointment).where(
            Appointment.id == appointment_id,
            Appointment.tenant_id == current_user.tenant_id,
        )
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise NotFoundException()

    if current_user.role == "doctor":
        appt.status = AppointmentStatus.COMPLETED
        appt.consultation_ended_at = datetime.now(timezone.utc).isoformat()
        await db.commit()

    return _success({}, message="Session ended")


async def _create_acs_room(appointment_id: str) -> str:
    """Create an Azure Communication Services room for the appointment."""
    if not settings.ACS_ENDPOINT:
        # Return mock room ID for development
        import uuid
        return str(uuid.uuid4())

    try:
        from azure.communication.rooms import RoomsClient
        from azure.core.credentials import AzureKeyCredential

        client = RoomsClient(
            settings.ACS_ENDPOINT,
            AzureKeyCredential(settings.ACS_ACCESS_KEY or ""),
        )
        room = client.create_room()
        return room.id
    except Exception:
        import uuid
        return str(uuid.uuid4())


async def _get_acs_token(user_id: str) -> str:
    """Get an Azure Communication Services user token."""
    if not settings.AZURE_COMMUNICATION_CONNECTION_STRING:
        return "mock-acs-token-for-development"

    try:
        from azure.communication.identity import CommunicationIdentityClient

        client = CommunicationIdentityClient.from_connection_string(
            settings.AZURE_COMMUNICATION_CONNECTION_STRING
        )
        identity = client.create_user()
        token_result = client.get_token(
            identity, scopes=["voip"]
        )
        return token_result.token
    except Exception:
        return "error-generating-token"
