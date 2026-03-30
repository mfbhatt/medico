"""Base SQLAlchemy model with common audit fields."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.core.database import Base


class TimestampMixin:
    """Adds created_at and updated_at columns."""
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class AuditMixin(TimestampMixin):
    """Adds full audit fields: created_by, updated_by, soft delete."""
    created_by: Mapped[str] = mapped_column(String(36), nullable=True)
    updated_by: Mapped[str] = mapped_column(String(36), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    deleted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_by: Mapped[str] = mapped_column(String(36), nullable=True)


class TenantMixin:
    """Adds tenant_id for multi-tenancy row-level filtering."""
    tenant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )


class BaseModel(Base, AuditMixin, TenantMixin):
    """
    Abstract base for all tenant-aware models.
    - UUID primary key
    - Audit fields
    - Soft delete
    - Tenant isolation
    """
    __abstract__ = True

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    def soft_delete(self, deleted_by: str) -> None:
        self.is_deleted = True
        self.deleted_at = datetime.now(timezone.utc)
        self.deleted_by = deleted_by

    def to_dict(self) -> dict:
        """Convert model to dictionary (excluding internal fields)."""
        return {
            col.name: getattr(self, col.name)
            for col in self.__table__.columns
            if col.name not in ("is_deleted", "deleted_at", "deleted_by")
        }


class TenantFreeModel(Base, AuditMixin):
    """
    Abstract base for global entities that are NOT scoped to a single tenant.
    Example: User (a person can belong to multiple tenants).
    - UUID primary key
    - Audit fields (created_at, updated_at, soft delete)
    - No tenant_id column
    """
    __abstract__ = True

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    def soft_delete(self, deleted_by: str) -> None:
        self.is_deleted = True
        self.deleted_at = datetime.now(timezone.utc)
        self.deleted_by = deleted_by

    def to_dict(self) -> dict:
        return {
            col.name: getattr(self, col.name)
            for col in self.__table__.columns
            if col.name not in ("is_deleted", "deleted_at", "deleted_by")
        }
