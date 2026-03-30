"""Base Pydantic schemas: API response envelope, pagination, common types."""
from typing import Any, Generic, List, Optional, TypeVar

from pydantic import BaseModel, ConfigDict

DataT = TypeVar("DataT")


class APIResponse(BaseModel, Generic[DataT]):
    """Standard API response envelope."""
    success: bool = True
    data: Optional[DataT] = None
    message: Optional[str] = None
    meta: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)


class PaginatedResponse(BaseModel, Generic[DataT]):
    """Paginated list response."""
    success: bool = True
    data: List[DataT] = []
    message: Optional[str] = None
    meta: dict = {}

    model_config = ConfigDict(from_attributes=True)


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int
    has_next: bool
    has_prev: bool

    @classmethod
    def build(cls, page: int, page_size: int, total: int) -> "PaginationMeta":
        total_pages = max(1, (total + page_size - 1) // page_size)
        return cls(
            page=page,
            page_size=page_size,
            total=total,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1,
        )


class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TimestampSchema(BaseSchema):
    created_at: Optional[Any] = None
    updated_at: Optional[Any] = None


class AuditSchema(TimestampSchema):
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
