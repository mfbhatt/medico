"""Tests for authentication endpoints."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.models.tenant import Tenant
from app.models.user import User, UserRole
from tests.conftest import auth_headers


pytestmark = pytest.mark.asyncio


class TestStaffLogin:
    async def test_login_success(
        self, client: AsyncClient, admin_user: User, tenant: Tenant
    ):
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "AdminPass123!"},
            headers={"X-Tenant-ID": tenant.id},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "access_token" in data["data"]
        assert "refresh_token" in data["data"]

    async def test_login_wrong_password(
        self, client: AsyncClient, admin_user: User, tenant: Tenant
    ):
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "WrongPassword!"},
            headers={"X-Tenant-ID": tenant.id},
        )
        assert resp.status_code == 401

    async def test_login_unknown_email(
        self, client: AsyncClient, tenant: Tenant
    ):
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@test.com", "password": "Whatever123!"},
            headers={"X-Tenant-ID": tenant.id},
        )
        assert resp.status_code == 401

    async def test_login_inactive_user(
        self, client: AsyncClient, db: AsyncSession, tenant: Tenant
    ):
        inactive = User(
            tenant_id=tenant.id,
            email="inactive@test.com",
            phone="+19999999999",
            full_name="Inactive User",
            role=UserRole.RECEPTIONIST,
            hashed_password=get_password_hash("Pass123!"),
            is_active=False,
            created_by="system",
        )
        db.add(inactive)
        await db.flush()

        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "inactive@test.com", "password": "Pass123!"},
            headers={"X-Tenant-ID": tenant.id},
        )
        assert resp.status_code == 401

    async def test_login_missing_tenant_header(
        self, client: AsyncClient, admin_user: User
    ):
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "AdminPass123!"},
        )
        # Should return 400 or 422 — no tenant context
        assert resp.status_code in (400, 422)


class TestTokenRefresh:
    async def test_refresh_success(
        self, client: AsyncClient, admin_user: User, tenant: Tenant
    ):
        # Log in first
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "AdminPass123!"},
            headers={"X-Tenant-ID": tenant.id},
        )
        tokens = login_resp.json()["data"]
        refresh_token = tokens["refresh_token"]

        resp = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token},
            headers={"X-Tenant-ID": tenant.id},
        )
        assert resp.status_code == 200
        new_data = resp.json()["data"]
        assert "access_token" in new_data

    async def test_refresh_invalid_token(
        self, client: AsyncClient, tenant: Tenant
    ):
        resp = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "not-a-valid-jwt"},
            headers={"X-Tenant-ID": tenant.id},
        )
        assert resp.status_code == 401


class TestProtectedEndpoints:
    async def test_me_authenticated(
        self, client: AsyncClient, admin_user: User, tenant: Tenant
    ):
        headers = auth_headers(admin_user, tenant)
        resp = await client.get("/api/v1/auth/me", headers=headers)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["email"] == "admin@test.com"

    async def test_me_unauthenticated(self, client: AsyncClient, tenant: Tenant):
        resp = await client.get(
            "/api/v1/auth/me", headers={"X-Tenant-ID": tenant.id}
        )
        assert resp.status_code == 401

    async def test_me_expired_token(self, client: AsyncClient, tenant: Tenant):
        # Craft an obviously invalid token
        resp = await client.get(
            "/api/v1/auth/me",
            headers={
                "Authorization": "Bearer eyJhbGciOiJSUzI1NiJ9.invalid.sig",
                "X-Tenant-ID": tenant.id,
            },
        )
        assert resp.status_code == 401
