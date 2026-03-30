"""UserTenant — join table linking a User to a Tenant.

One User can belong to multiple Tenants. This record holds all
tenant-specific attributes: role, status, clinic assignment, and
the per-session refresh token hash.
"""
from typing import Optional

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.user import UserRole, UserStatus


class UserTenant(BaseModel):
    """Represents a user's membership in a specific tenant."""

    __tablename__ = "user_tenants"
    __table_args__ = (
        UniqueConstraint("user_id", "tenant_id", name="uq_user_tenant"),
    )

    # user_id links to the global User record
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # tenant_id is inherited from BaseModel → TenantMixin

    # Tenant-specific role for this user
    role: Mapped[str] = mapped_column(
        String(30), nullable=False, default=UserRole.RECEPTIONIST
    )

    # Tenant-specific account status
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default=UserStatus.PENDING_VERIFICATION
    )

    # Clinic assignment within this tenant (nullable — tenant-wide staff have no specific clinic)
    clinic_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("clinics.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Per-tenant session token (hashed); allows independent sessions per tenant
    refresh_token_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="tenant_memberships")
    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="memberships")
    clinic: Mapped[Optional["Clinic"]] = relationship(
        "Clinic", foreign_keys=[clinic_id]
    )

    def __repr__(self) -> str:
        return f"<UserTenant user={self.user_id} tenant={self.tenant_id} role={self.role}>"
