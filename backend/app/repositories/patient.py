"""Patient repository."""
from typing import List, Optional, Tuple

from sqlalchemy import func, or_, select

from app.models.patient import (
    ChronicCondition,
    EmergencyContact,
    InsurancePolicy,
    Patient,
    PatientAllergy,
    PatientFamilyLink,
)
from app.repositories.base import BaseRepository
from sqlalchemy.ext.asyncio import AsyncSession


class PatientRepository(BaseRepository[Patient]):
    def __init__(self, db: AsyncSession, tenant_id: str):
        super().__init__(Patient, db, tenant_id)

    async def get_by_mrn(self, mrn: str) -> Optional[Patient]:
        result = await self.db.execute(
            self._base_query().where(Patient.mrn == mrn)
        )
        return result.scalar_one_or_none()

    async def get_by_phone(self, phone: str) -> Optional[Patient]:
        result = await self.db.execute(
            self._base_query().where(Patient.phone == phone)
        )
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Optional[Patient]:
        result = await self.db.execute(
            self._base_query().where(Patient.email == email)
        )
        return result.scalar_one_or_none()

    async def get_by_user_id(self, user_id: str) -> Optional[Patient]:
        result = await self.db.execute(
            self._base_query().where(Patient.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def search(
        self,
        query: str,
        clinic_id: Optional[str] = None,
        offset: int = 0,
        limit: int = 20,
    ) -> Tuple[List[Patient], int]:
        search_filter = or_(
            Patient.first_name.ilike(f"%{query}%"),
            Patient.last_name.ilike(f"%{query}%"),
            Patient.mrn.ilike(f"%{query}%"),
            Patient.phone.ilike(f"%{query}%"),
            Patient.email.ilike(f"%{query}%"),
        )
        base = self._base_query().where(search_filter)
        if clinic_id:
            base = base.where(Patient.preferred_clinic_id == clinic_id)

        count_q = select(func.count()).select_from(base.subquery())
        total = (await self.db.execute(count_q)).scalar_one()

        result = await self.db.execute(
            base.order_by(Patient.last_name, Patient.first_name)
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all()), total

    async def get_next_mrn(self) -> str:
        """Generate next sequential MRN for this tenant."""
        result = await self.db.execute(
            select(func.count())
            .select_from(Patient)
            .where(Patient.tenant_id == self.tenant_id)
        )
        count = result.scalar_one()
        return f"MRN{count + 1:07d}"

    # ── Emergency Contacts ─────────────────────────────────────────────────

    async def get_emergency_contacts(self, patient_id: str) -> List[EmergencyContact]:
        result = await self.db.execute(
            select(EmergencyContact)
            .where(EmergencyContact.patient_id == patient_id)
            .where(EmergencyContact.is_deleted == False)  # noqa: E712
        )
        return list(result.scalars().all())

    async def add_emergency_contact(
        self, patient_id: str, data: dict, created_by: Optional[str] = None
    ) -> EmergencyContact:
        contact = EmergencyContact(
            **{**data, "patient_id": patient_id, "tenant_id": self.tenant_id}
        )
        if created_by:
            contact.created_by = created_by
        self.db.add(contact)
        await self.db.flush()
        await self.db.refresh(contact)
        return contact

    # ── Allergies ──────────────────────────────────────────────────────────

    async def get_allergies(self, patient_id: str) -> List[PatientAllergy]:
        result = await self.db.execute(
            select(PatientAllergy)
            .where(PatientAllergy.patient_id == patient_id)
            .where(PatientAllergy.is_deleted == False)  # noqa: E712
        )
        return list(result.scalars().all())

    async def add_allergy(
        self, patient_id: str, data: dict, created_by: Optional[str] = None
    ) -> PatientAllergy:
        allergy = PatientAllergy(
            **{**data, "patient_id": patient_id, "tenant_id": self.tenant_id}
        )
        if created_by:
            allergy.created_by = created_by
        self.db.add(allergy)
        await self.db.flush()
        await self.db.refresh(allergy)
        return allergy

    # ── Chronic Conditions ─────────────────────────────────────────────────

    async def get_conditions(self, patient_id: str) -> List[ChronicCondition]:
        result = await self.db.execute(
            select(ChronicCondition)
            .where(ChronicCondition.patient_id == patient_id)
            .where(ChronicCondition.is_deleted == False)  # noqa: E712
        )
        return list(result.scalars().all())

    async def add_condition(
        self, patient_id: str, data: dict, created_by: Optional[str] = None
    ) -> ChronicCondition:
        condition = ChronicCondition(
            **{**data, "patient_id": patient_id, "tenant_id": self.tenant_id}
        )
        if created_by:
            condition.created_by = created_by
        self.db.add(condition)
        await self.db.flush()
        await self.db.refresh(condition)
        return condition

    # ── Insurance Policies ─────────────────────────────────────────────────

    async def get_insurance_policies(self, patient_id: str) -> List[InsurancePolicy]:
        result = await self.db.execute(
            select(InsurancePolicy)
            .where(InsurancePolicy.patient_id == patient_id)
            .where(InsurancePolicy.is_deleted == False)  # noqa: E712
            .where(InsurancePolicy.is_active == True)  # noqa: E712
        )
        return list(result.scalars().all())

    async def add_insurance_policy(
        self, patient_id: str, data: dict, created_by: Optional[str] = None
    ) -> InsurancePolicy:
        policy = InsurancePolicy(
            **{**data, "patient_id": patient_id, "tenant_id": self.tenant_id}
        )
        if created_by:
            policy.created_by = created_by
        self.db.add(policy)
        await self.db.flush()
        await self.db.refresh(policy)
        return policy
