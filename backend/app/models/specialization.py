"""Platform-level medical specialization catalog."""
import uuid

from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import AuditMixin


class Specialization(Base, AuditMixin):
    """
    Global (platform-level) list of medical specializations.
    Managed exclusively by super_admin.
    Not tenant-scoped — all tenants share the same catalog.
    """
    __tablename__ = "specializations"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    # e.g. "Medical", "Surgical", "Allied Health", "Mental Health", "Diagnostic"
    category: Mapped[str] = mapped_column(String(50), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    def __repr__(self) -> str:
        return f"<Specialization {self.name}>"
