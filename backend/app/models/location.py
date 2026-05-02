"""Platform-level country, state, and city reference data."""
import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class Country(Base, TimestampMixin):
    """Global country catalog — not tenant-scoped."""
    __tablename__ = "countries"

    code: Mapped[str] = mapped_column(String(10), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    state_label: Mapped[str] = mapped_column(String(50), default="State / Region", nullable=False)
    postal_label: Mapped[str] = mapped_column(String(50), default="Postal Code", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    states: Mapped[list["State"]] = relationship(
        "State", back_populates="country", lazy="select", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Country {self.code}: {self.name}>"


class State(Base, TimestampMixin):
    """State/province/territory/emirate — child of Country."""
    __tablename__ = "states"
    __table_args__ = (UniqueConstraint("country_code", "code", name="uq_states_country_code"),)

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    country_code: Mapped[str] = mapped_column(
        String(10), ForeignKey("countries.code", ondelete="CASCADE"), nullable=False, index=True
    )
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    country: Mapped["Country"] = relationship("Country", back_populates="states")
    cities: Mapped[list["City"]] = relationship(
        "City", back_populates="state", lazy="select", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<State {self.country_code}-{self.code}: {self.name}>"


class City(Base, TimestampMixin):
    """City — child of State."""
    __tablename__ = "cities"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    state_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("states.id", ondelete="CASCADE"), nullable=False, index=True
    )
    country_code: Mapped[str] = mapped_column(
        String(10), ForeignKey("countries.code", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    state: Mapped["State"] = relationship("State", back_populates="cities")

    def __repr__(self) -> str:
        return f"<City {self.name} ({self.country_code})>"
