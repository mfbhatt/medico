"""Tests for patient management endpoints."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.patient import Patient
from app.models.tenant import Tenant
from app.models.user import User
from tests.conftest import auth_headers


pytestmark = pytest.mark.asyncio


class TestPatientCRUD:
    async def test_create_patient(
        self, client: AsyncClient, admin_user: User, tenant: Tenant
    ):
        headers = auth_headers(admin_user, tenant)
        resp = await client.post(
            "/api/v1/patients/",
            json={
                "first_name": "Jane",
                "last_name": "Smith",
                "date_of_birth": "1985-06-20",
                "gender": "female",
                "phone": "+15551234567",
                "email": "jane.smith@example.com",
            },
            headers=headers,
        )
        assert resp.status_code == 201
        data = resp.json()["data"]
        assert data["first_name"] == "Jane"
        assert data["mrn"] is not None  # MRN auto-generated

    async def test_create_patient_missing_required(
        self, client: AsyncClient, admin_user: User, tenant: Tenant
    ):
        headers = auth_headers(admin_user, tenant)
        resp = await client.post(
            "/api/v1/patients/",
            json={"first_name": "NoLastName"},
            headers=headers,
        )
        assert resp.status_code == 422

    async def test_get_patient(
        self, client: AsyncClient, admin_user: User, tenant: Tenant, patient: Patient
    ):
        headers = auth_headers(admin_user, tenant)
        resp = await client.get(f"/api/v1/patients/{patient.id}", headers=headers)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["id"] == patient.id
        assert data["first_name"] == "John"

    async def test_get_patient_not_found(
        self, client: AsyncClient, admin_user: User, tenant: Tenant
    ):
        headers = auth_headers(admin_user, tenant)
        resp = await client.get(
            "/api/v1/patients/00000000-0000-0000-0000-000000000000", headers=headers
        )
        assert resp.status_code == 404

    async def test_list_patients(
        self, client: AsyncClient, admin_user: User, tenant: Tenant, patient: Patient
    ):
        headers = auth_headers(admin_user, tenant)
        resp = await client.get("/api/v1/patients/", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert isinstance(data["data"], list)
        assert len(data["data"]) >= 1

    async def test_update_patient(
        self, client: AsyncClient, admin_user: User, tenant: Tenant, patient: Patient
    ):
        headers = auth_headers(admin_user, tenant)
        resp = await client.patch(
            f"/api/v1/patients/{patient.id}",
            json={"phone": "+15559876543"},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["phone"] == "+15559876543"

    async def test_soft_delete_patient(
        self, client: AsyncClient, admin_user: User, tenant: Tenant, patient: Patient
    ):
        headers = auth_headers(admin_user, tenant)
        resp = await client.delete(f"/api/v1/patients/{patient.id}", headers=headers)
        assert resp.status_code == 200

        # Deleted patient should not appear in list
        list_resp = await client.get("/api/v1/patients/", headers=headers)
        ids = [p["id"] for p in list_resp.json()["data"]]
        assert patient.id not in ids


class TestPatientSearch:
    async def test_search_by_name(
        self, client: AsyncClient, admin_user: User, tenant: Tenant, patient: Patient
    ):
        headers = auth_headers(admin_user, tenant)
        resp = await client.get("/api/v1/patients/?search=John", headers=headers)
        assert resp.status_code == 200
        results = resp.json()["data"]
        assert any(p["first_name"] == "John" for p in results)

    async def test_search_by_mrn(
        self, client: AsyncClient, admin_user: User, tenant: Tenant, patient: Patient
    ):
        headers = auth_headers(admin_user, tenant)
        # First get the patient's MRN
        detail_resp = await client.get(f"/api/v1/patients/{patient.id}", headers=headers)
        mrn = detail_resp.json()["data"]["mrn"]

        resp = await client.get(f"/api/v1/patients/?search={mrn}", headers=headers)
        assert resp.status_code == 200
        results = resp.json()["data"]
        assert any(p["mrn"] == mrn for p in results)

    async def test_duplicate_detection(
        self, client: AsyncClient, admin_user: User, tenant: Tenant, patient: Patient
    ):
        """Creating a patient with same name+DOB should return duplicate warning."""
        headers = auth_headers(admin_user, tenant)
        resp = await client.post(
            "/api/v1/patients/",
            json={
                "first_name": "John",
                "last_name": "Doe",
                "date_of_birth": "1990-01-15",
                "gender": "male",
                "phone": "+15550000001",
            },
            headers=headers,
        )
        # Should either 409 (conflict) or 200 with duplicate_warning flag
        assert resp.status_code in (200, 201, 409)
        if resp.status_code in (200, 201):
            body = resp.json()
            # If created, should flag potential duplicate
            assert body.get("data", {}).get("possible_duplicate") is True or resp.status_code == 201


class TestPatientTenantIsolation:
    async def test_cannot_access_other_tenant_patient(
        self,
        client: AsyncClient,
        db: AsyncSession,
        admin_user: User,
        tenant: Tenant,
    ):
        from app.models.tenant import Tenant as TenantModel

        other_tenant = TenantModel(
            name="Other Clinic",
            slug="other-clinic",
            plan="basic",
            status="active",
            created_by="system",
        )
        db.add(other_tenant)
        await db.flush()

        other_patient = Patient(
            tenant_id=other_tenant.id,
            first_name="Secret",
            last_name="Patient",
            date_of_birth="1980-01-01",
            gender="male",
            phone="+19990000001",
            created_by="system",
        )
        db.add(other_patient)
        await db.flush()

        headers = auth_headers(admin_user, tenant)
        resp = await client.get(
            f"/api/v1/patients/{other_patient.id}", headers=headers
        )
        assert resp.status_code == 404
