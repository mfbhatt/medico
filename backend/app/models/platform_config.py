"""Platform-wide configuration — single-row global settings managed by super admin."""
from sqlalchemy import String, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin


class PlatformConfig(Base, TimestampMixin):
    """
    Single-row table storing platform-level default settings.
    Tenant settings override these; if a tenant has no override the platform default applies.
    The only row ever used has id='default'.
    """
    __tablename__ = "platform_config"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default="default")
    settings: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
