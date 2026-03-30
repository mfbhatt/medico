"""Medical specialization catalog endpoints.

GET  /specializations/              — list (any authenticated user, for dropdowns)
POST /specializations/              — create (super_admin only)
PATCH /specializations/{id}         — update (super_admin only)
DELETE /specializations/{id}        — soft-delete (super_admin only)
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser, get_current_user, require_perm, require_roles
from app.core.exceptions import NotFoundException, ConflictException
from app.models.specialization import Specialization

router = APIRouter()


def _spec_out(s: Specialization) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "category": s.category,
        "description": s.description,
        "is_active": s.is_active,
        "sort_order": s.sort_order,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


def _success(data, message: str = "Success"):
    return {"success": True, "message": message, "data": data}


# ── READ (any authenticated user — needed for dropdowns in all role UIs) ──────

@router.get("/")
async def list_specializations(
    category: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Return the full specialization catalog, sorted by sort_order then name."""
    q = select(Specialization).where(Specialization.is_deleted == False)
    if category:
        q = q.where(Specialization.category == category)
    if is_active is not None:
        q = q.where(Specialization.is_active == is_active)
    q = q.order_by(Specialization.sort_order, Specialization.name)
    result = await db.execute(q)
    specs = result.scalars().all()
    return _success([_spec_out(s) for s in specs])


@router.get("/{spec_id}")
async def get_specialization(
    spec_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(
        select(Specialization).where(
            Specialization.id == spec_id,
            Specialization.is_deleted == False,
        )
    )
    spec = result.scalar_one_or_none()
    if not spec:
        raise NotFoundException(detail="Specialization not found")
    return _success(_spec_out(spec))


# ── WRITE (super_admin only) ──────────────────────────────────────────────────

@router.post("/")
async def create_specialization(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_roles("super_admin")),
):
    """Create a new specialization. Name must be unique."""
    name = (body.get("name") or "").strip()
    if not name:
        from app.core.exceptions import BadRequestException
        raise BadRequestException(detail="name is required")

    # Uniqueness check (case-insensitive)
    existing = await db.execute(
        select(Specialization).where(
            Specialization.name.ilike(name),
            Specialization.is_deleted == False,
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictException(detail=f"Specialization '{name}' already exists")

    spec = Specialization(
        name=name,
        category=body.get("category") or None,
        description=body.get("description") or None,
        is_active=bool(body.get("is_active", True)),
        sort_order=int(body.get("sort_order", 0)),
        created_by=current_user.user_id,
        updated_by=current_user.user_id,
    )
    db.add(spec)
    await db.commit()
    await db.refresh(spec)
    return _success(_spec_out(spec), message="Specialization created")


@router.patch("/{spec_id}")
async def update_specialization(
    spec_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_roles("super_admin")),
):
    result = await db.execute(
        select(Specialization).where(
            Specialization.id == spec_id,
            Specialization.is_deleted == False,
        )
    )
    spec = result.scalar_one_or_none()
    if not spec:
        raise NotFoundException(detail="Specialization not found")

    if "name" in body:
        new_name = (body["name"] or "").strip()
        if not new_name:
            from app.core.exceptions import BadRequestException
            raise BadRequestException(detail="name cannot be blank")
        # Uniqueness check (exclude self)
        dup = await db.execute(
            select(Specialization).where(
                Specialization.name.ilike(new_name),
                Specialization.id != spec_id,
                Specialization.is_deleted == False,
            )
        )
        if dup.scalar_one_or_none():
            raise ConflictException(detail=f"Specialization '{new_name}' already exists")
        spec.name = new_name

    for field in ("category", "description", "is_active", "sort_order"):
        if field in body:
            setattr(spec, field, body[field])

    spec.updated_by = current_user.user_id
    await db.commit()
    return _success(_spec_out(spec), message="Specialization updated")


@router.delete("/{spec_id}")
async def delete_specialization(
    spec_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_roles("super_admin")),
):
    result = await db.execute(
        select(Specialization).where(
            Specialization.id == spec_id,
            Specialization.is_deleted == False,
        )
    )
    spec = result.scalar_one_or_none()
    if not spec:
        raise NotFoundException(detail="Specialization not found")

    spec.is_deleted = True
    spec.deleted_at = datetime.now(timezone.utc)
    spec.deleted_by = current_user.user_id
    await db.commit()
    return _success(None, message="Specialization deleted")
