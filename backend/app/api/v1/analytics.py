"""Analytics and reporting endpoints."""
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_, cast, Date, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, CurrentUser, require_perm
from app.models.appointment import Appointment, AppointmentStatus
from app.models.patient import Patient
from app.models.billing import Invoice, Payment
from app.models.doctor import Doctor
from app.models.tenant import Tenant
from app.models.platform_config import PlatformConfig

router = APIRouter()


def _success(data, message="Success"):
    return {"success": True, "message": message, "data": data}


@router.get("/dashboard")
async def get_dashboard_stats(
    clinic_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("analytics:read")),
):
    """High-level dashboard statistics for today."""
    today = date.today().isoformat()
    tenant_id = current_user.tenant_id

    tenant = (await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )).scalar_one_or_none()
    platform = (await db.execute(
        select(PlatformConfig).where(PlatformConfig.id == "default")
    )).scalar_one_or_none()
    platform_currency = (platform.settings or {}).get("currency", "USD") if platform else "USD"
    currency = (tenant.settings or {}).get("currency") or platform_currency

    base_filters = [
        Appointment.tenant_id == tenant_id,
        Appointment.is_deleted == False,
    ]
    if clinic_id:
        base_filters.append(Appointment.clinic_id == clinic_id)

    # Today's appointments by status
    today_filter = base_filters + [Appointment.appointment_date == today]

    total_today = (await db.execute(
        select(func.count(Appointment.id)).where(*today_filter)
    )).scalar()

    scheduled = (await db.execute(
        select(func.count(Appointment.id)).where(
            *today_filter, Appointment.status == AppointmentStatus.SCHEDULED
        )
    )).scalar()

    completed = (await db.execute(
        select(func.count(Appointment.id)).where(
            *today_filter, Appointment.status == AppointmentStatus.COMPLETED
        )
    )).scalar()

    no_shows = (await db.execute(
        select(func.count(Appointment.id)).where(
            *today_filter, Appointment.status == AppointmentStatus.NO_SHOW
        )
    )).scalar()

    cancelled = (await db.execute(
        select(func.count(Appointment.id)).where(
            *today_filter, Appointment.status == AppointmentStatus.CANCELLED
        )
    )).scalar()

    in_progress = (await db.execute(
        select(func.count(Appointment.id)).where(
            *today_filter, Appointment.status == AppointmentStatus.IN_PROGRESS
        )
    )).scalar()

    # Total active patients
    total_patients = (await db.execute(
        select(func.count(Patient.id)).where(
            Patient.tenant_id == tenant_id,
            Patient.is_deleted == False,
        )
    )).scalar()

    # New patients this month
    today_date = date.today()
    month_start_dt = datetime(today_date.year, today_date.month, 1, tzinfo=timezone.utc)
    new_patients_month = (await db.execute(
        select(func.count(Patient.id)).where(
            Patient.tenant_id == tenant_id,
            Patient.created_at >= month_start_dt,
            Patient.is_deleted == False,
        )
    )).scalar()

    # Revenue today
    revenue_today = (await db.execute(
        select(func.sum(Payment.amount)).where(
            Payment.tenant_id == tenant_id,
            Payment.payment_date == today,
            Payment.status == "completed",
            Payment.is_deleted == False,
        )
    )).scalar() or 0

    # Revenue this month
    month_start_str = today_date.replace(day=1).isoformat()
    revenue_month = (await db.execute(
        select(func.sum(Payment.amount)).where(
            Payment.tenant_id == tenant_id,
            Payment.payment_date >= month_start_str,
            Payment.status == "completed",
            Payment.is_deleted == False,
        )
    )).scalar() or 0

    # No-show rate (last 30 days)
    thirty_days_ago = (date.today() - timedelta(days=30)).isoformat()
    total_30d = (await db.execute(
        select(func.count(Appointment.id)).where(
            *base_filters,
            Appointment.appointment_date >= thirty_days_ago,
            Appointment.status.in_([
                AppointmentStatus.COMPLETED,
                AppointmentStatus.NO_SHOW,
            ]),
        )
    )).scalar() or 1

    no_show_30d = (await db.execute(
        select(func.count(Appointment.id)).where(
            *base_filters,
            Appointment.appointment_date >= thirty_days_ago,
            Appointment.status == AppointmentStatus.NO_SHOW,
        )
    )).scalar() or 0

    no_show_rate = round((no_show_30d / total_30d) * 100, 1)

    return _success({
        "today": {
            "total_appointments": total_today,
            "scheduled": scheduled,
            "in_progress": in_progress,
            "completed": completed,
            "no_shows": no_shows,
            "cancelled": cancelled,
        },
        "patients": {
            "total": total_patients,
            "new_this_month": new_patients_month,
        },
        "revenue": {
            "today": round(revenue_today, 2),
            "this_month": round(revenue_month, 2),
            "currency": currency,
        },
        "no_show_rate_30d": no_show_rate,
    })


@router.get("/appointments/trend")
async def get_appointment_trend(
    days: int = Query(default=30, ge=7, le=365),
    clinic_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("analytics:read")),
):
    """Daily appointment counts for the last N days."""
    start_date = (date.today() - timedelta(days=days)).isoformat()

    filters = [
        Appointment.tenant_id == current_user.tenant_id,
        Appointment.appointment_date >= start_date,
        Appointment.is_deleted == False,
    ]
    if clinic_id:
        filters.append(Appointment.clinic_id == clinic_id)

    result = await db.execute(
        select(
            Appointment.appointment_date,
            Appointment.status,
            func.count(Appointment.id).label("count"),
        ).where(*filters)
        .group_by(Appointment.appointment_date, Appointment.status)
        .order_by(Appointment.appointment_date)
    )

    # Aggregate by date
    data = {}
    for row in result:
        d = row.appointment_date
        if d not in data:
            data[d] = {"date": d, "total": 0, "completed": 0, "cancelled": 0, "no_show": 0}
        data[d]["total"] += row.count
        if row.status == AppointmentStatus.COMPLETED:
            data[d]["completed"] += row.count
        elif row.status == AppointmentStatus.CANCELLED:
            data[d]["cancelled"] += row.count
        elif row.status == AppointmentStatus.NO_SHOW:
            data[d]["no_show"] += row.count

    return _success(list(data.values()))


@router.get("/revenue/summary")
async def get_revenue_summary(
    period: str = Query(default="month", pattern="^(day|week|month|year)$"),
    months: int = Query(default=6, ge=1, le=24),
    clinic_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("analytics:read")),
):
    """Revenue summary by period."""
    start_date = (date.today() - timedelta(days=months * 30)).isoformat()

    filters = [
        Payment.tenant_id == current_user.tenant_id,
        Payment.payment_date >= start_date,
        Payment.status == "completed",
        Payment.is_deleted == False,
    ]

    trunc_expr = func.date_trunc(period, cast(Payment.payment_date, Date)).label("period")
    result = await db.execute(
        select(
            trunc_expr,
            func.sum(Payment.amount).label("total"),
            func.count(Payment.id).label("count"),
        ).where(*filters)
        .group_by(text("1"))
        .order_by(text("1"))
    )

    return _success([
        {
            "period": str(row.period),
            "total_revenue": round(row.total or 0, 2),
            "transaction_count": row.count,
        }
        for row in result
    ])


@router.get("/doctors/performance")
async def get_doctor_performance(
    date_from: str = Query(default=None),
    date_to: str = Query(default=None),
    clinic_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("analytics:read")),
):
    """Per-doctor performance metrics."""
    date_from = date_from or (date.today() - timedelta(days=30)).isoformat()
    date_to = date_to or date.today().isoformat()

    filters = [
        Appointment.tenant_id == current_user.tenant_id,
        Appointment.appointment_date >= date_from,
        Appointment.appointment_date <= date_to,
        Appointment.is_deleted == False,
    ]
    if clinic_id:
        filters.append(Appointment.clinic_id == clinic_id)

    result = await db.execute(
        select(
            Appointment.doctor_id,
            func.count(Appointment.id).label("total"),
            func.count(Appointment.id).filter(
                Appointment.status == AppointmentStatus.COMPLETED
            ).label("completed"),
            func.count(Appointment.id).filter(
                Appointment.status == AppointmentStatus.NO_SHOW
            ).label("no_shows"),
        ).where(*filters)
        .group_by(Appointment.doctor_id)
        .order_by(func.count(Appointment.id).desc())
    )

    return _success([
        {
            "doctor_id": row.doctor_id,
            "total_appointments": row.total,
            "completed": row.completed or 0,
            "no_shows": row.no_shows or 0,
            "completion_rate": round(
                ((row.completed or 0) / row.total * 100) if row.total else 0, 1
            ),
            "no_show_rate": round(
                ((row.no_shows or 0) / row.total * 100) if row.total else 0, 1
            ),
        }
        for row in result
    ])
