"""Doctor service: profile management, schedule, ratings."""
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictException, NotFoundException, ValidationException
from app.repositories.doctor import DoctorRepository
from app.repositories.user import UserRepository
from app.schemas.doctor import (
    DoctorClinicAssignmentCreate,
    DoctorCreate,
    DoctorRatingCreate,
    DoctorScheduleCreate,
    DoctorScheduleExceptionCreate,
    DoctorUpdate,
)


class DoctorService:
    def __init__(self, db: AsyncSession, tenant_id: str):
        self.db = db
        self.tenant_id = tenant_id
        self.repo = DoctorRepository(db, tenant_id)
        self.user_repo = UserRepository(db, tenant_id)

    async def create(self, payload: DoctorCreate, created_by: str):
        # Verify the user exists and has doctor role
        user = await self.user_repo.get_by_id(payload.user_id)
        if not user:
            raise NotFoundException("User not found")

        existing = await self.repo.get_by_user_id(payload.user_id)
        if existing:
            raise ConflictException("A doctor profile already exists for this user")

        return await self.repo.create(payload.model_dump(), created_by=created_by)

    async def update(self, doctor_id: str, payload: DoctorUpdate, updated_by: str):
        doctor = await self.get_or_404(doctor_id)
        data = payload.model_dump(exclude_unset=True)
        return await self.repo.update(doctor_id, data, updated_by=updated_by)

    async def get_or_404(self, doctor_id: str):
        doctor = await self.repo.get_by_id(doctor_id)
        if not doctor:
            raise NotFoundException("Doctor not found")
        return doctor

    async def assign_clinic(
        self, doctor_id: str, payload: DoctorClinicAssignmentCreate, created_by: str
    ):
        await self.get_or_404(doctor_id)
        return await self.repo.add_clinic_assignment(
            doctor_id, payload.model_dump(), created_by=created_by
        )

    async def add_schedule(
        self, doctor_id: str, payload: DoctorScheduleCreate, created_by: str
    ):
        await self.get_or_404(doctor_id)
        return await self.repo.add_schedule(
            doctor_id, payload.model_dump(), created_by=created_by
        )

    async def add_schedule_exception(
        self, doctor_id: str, payload: DoctorScheduleExceptionCreate, created_by: str
    ):
        await self.get_or_404(doctor_id)
        return await self.repo.add_schedule_exception(
            doctor_id, payload.model_dump(), created_by=created_by
        )

    async def add_rating(self, payload: DoctorRatingCreate, rated_by_patient_id: str):
        doctor = await self.get_or_404(payload.doctor_id)
        if payload.rating < 1 or payload.rating > 5:
            raise ValidationException("Rating must be between 1 and 5")

        rating = await self.repo.add_rating(
            {**payload.model_dump(), "patient_id": rated_by_patient_id},
        )

        # Update aggregated doctor rating
        new_total = doctor.total_ratings + 1
        new_avg = round(
            (doctor.average_rating * doctor.total_ratings + payload.rating) / new_total, 2
        )
        await self.repo.update(
            payload.doctor_id,
            {"average_rating": new_avg, "total_ratings": new_total},
        )
        return rating
