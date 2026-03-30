"""pytest configuration and shared fixtures."""
import asyncio
import uuid
from collections.abc import AsyncGenerator
from datetime import date, datetime, timezone
from typing import Any

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.database import Base, get_db
from app.core.security import create_access_token, get_password_hash
from app.main import app
from app.models.clinic import Clinic
from app.models.doctor import Doctor, DoctorClinicAssignment, DoctorSchedule
from app.models.patient import Patient
from app.models.tenant import Tenant
from app.models.user import User, UserRole

# ---------------------------------------------------------------------------
# Engine — use a separate test database
# ---------------------------------------------------------------------------
TEST_DATABASE_URL = settings.DATABASE_URL.replace(
    "/clinic_db", "/clinic_test_db"
).replace("postgresql+asyncpg", "postgresql+asyncpg")

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


# ---------------------------------------------------------------------------
# Event loop (session-scoped)
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ---------------------------------------------------------------------------
# DB lifecycle
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture(scope="session", autouse=True)
async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    """Provide a transactional test session that rolls back after each test."""
    async with engine.begin() as conn:
        async with TestSessionLocal(bind=conn) as session:
            yield session
            await session.rollback()


# ---------------------------------------------------------------------------
# Override FastAPI dependency
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture
async def client(db: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Seed helpers
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture
async def tenant(db: AsyncSession) -> Tenant:
    t = Tenant(
        name="Test Clinic Group",
        slug="test-clinic",
        plan="professional",
        status="active",
        created_by="system",
    )
    db.add(t)
    await db.flush()
    return t


@pytest_asyncio.fixture
async def clinic(db: AsyncSession, tenant: Tenant) -> Clinic:
    c = Clinic(
        tenant_id=tenant.id,
        name="Main Test Clinic",
        code="MAIN",
        timezone="UTC",
        slot_duration_minutes=30,
        created_by="system",
    )
    db.add(c)
    await db.flush()
    return c


@pytest_asyncio.fixture
async def admin_user(db: AsyncSession, tenant: Tenant) -> User:
    u = User(
        tenant_id=tenant.id,
        email="admin@test.com",
        phone="+10000000001",
        full_name="Test Admin",
        role=UserRole.CLINIC_ADMIN,
        hashed_password=get_password_hash("AdminPass123!"),
        is_active=True,
        created_by="system",
    )
    db.add(u)
    await db.flush()
    return u


@pytest_asyncio.fixture
async def doctor_user(db: AsyncSession, tenant: Tenant) -> User:
    u = User(
        tenant_id=tenant.id,
        email="doctor@test.com",
        phone="+10000000002",
        full_name="Dr. Test Doctor",
        role=UserRole.DOCTOR,
        hashed_password=get_password_hash("DoctorPass123!"),
        is_active=True,
        created_by="system",
    )
    db.add(u)
    await db.flush()
    return u


@pytest_asyncio.fixture
async def doctor(db: AsyncSession, tenant: Tenant, doctor_user: User, clinic: Clinic) -> Doctor:
    d = Doctor(
        tenant_id=tenant.id,
        user_id=doctor_user.id,
        registration_number="REG-001",
        specialization="General Practice",
        consultation_fee=100.00,
        created_by="system",
    )
    db.add(d)
    await db.flush()
    # Assign to clinic
    assignment = DoctorClinicAssignment(
        tenant_id=tenant.id,
        doctor_id=d.id,
        clinic_id=clinic.id,
        is_primary=True,
        created_by="system",
    )
    db.add(assignment)
    # Add Mon–Fri 9–17 schedule
    for weekday in range(5):
        schedule = DoctorSchedule(
            tenant_id=tenant.id,
            doctor_id=d.id,
            clinic_id=clinic.id,
            weekday=weekday,
            start_time="09:00",
            end_time="17:00",
            slot_duration_minutes=30,
            is_active=True,
            created_by="system",
        )
        db.add(schedule)
    await db.flush()
    return d


@pytest_asyncio.fixture
async def patient(db: AsyncSession, tenant: Tenant) -> Patient:
    p = Patient(
        tenant_id=tenant.id,
        first_name="John",
        last_name="Doe",
        date_of_birth=date(1990, 1, 15),
        gender="male",
        phone="+10000000099",
        email="patient@test.com",
        created_by="system",
    )
    db.add(p)
    await db.flush()
    return p


# ---------------------------------------------------------------------------
# Auth header helpers
# ---------------------------------------------------------------------------
def auth_headers(user: User, tenant: Tenant) -> dict[str, str]:
    token = create_access_token(
        subject=user.id,
        tenant_id=tenant.id,
        role=user.role.value,
        additional_data={"clinic_id": None},
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Tenant-ID": tenant.id,
    }


@pytest.fixture
def admin_headers(admin_user: User, tenant: Tenant) -> dict[str, str]:
    return auth_headers(admin_user, tenant)


@pytest.fixture
def doctor_headers(doctor_user: User, tenant: Tenant) -> dict[str, str]:
    return auth_headers(doctor_user, tenant)
