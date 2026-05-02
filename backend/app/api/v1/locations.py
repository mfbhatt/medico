"""Location reference data — countries, states, cities (no auth required)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.location import City, Country, State

router = APIRouter()


def _success(data):
    return {"success": True, "message": "Success", "data": data}


@router.get("/countries")
async def list_countries(db: AsyncSession = Depends(get_db)):
    """All active countries ordered by sort_order then name."""
    result = await db.execute(
        select(Country)
        .where(Country.is_active == True)
        .order_by(Country.sort_order, Country.name)
    )
    countries = result.scalars().all()
    return _success([
        {
            "code": c.code,
            "name": c.name,
            "state_label": c.state_label,
            "postal_label": c.postal_label,
        }
        for c in countries
    ])


@router.get("/countries/{country_code}/states")
async def list_states(country_code: str, db: AsyncSession = Depends(get_db)):
    """States/provinces for a given country code."""
    result = await db.execute(
        select(State)
        .where(
            State.country_code == country_code.upper(),
            State.is_active == True,
        )
        .order_by(State.sort_order, State.name)
    )
    states = result.scalars().all()
    return _success([
        {"id": s.id, "code": s.code, "name": s.name, "country_code": s.country_code}
        for s in states
    ])


@router.get("/countries/{country_code}/states/{state_code}/cities")
async def list_cities(
    country_code: str,
    state_code: str,
    db: AsyncSession = Depends(get_db),
):
    """Cities for a given country + state code pair."""
    state_result = await db.execute(
        select(State).where(
            State.country_code == country_code.upper(),
            State.code == state_code.upper(),
            State.is_active == True,
        )
    )
    state = state_result.scalar_one_or_none()
    if not state:
        return _success([])

    result = await db.execute(
        select(City)
        .where(City.state_id == state.id, City.is_active == True)
        .order_by(City.sort_order, City.name)
    )
    cities = result.scalars().all()
    return _success([
        {"id": c.id, "name": c.name, "state_id": c.state_id, "country_code": c.country_code}
        for c in cities
    ])
