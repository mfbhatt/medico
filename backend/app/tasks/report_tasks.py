"""Celery tasks for report generation."""
from app.tasks.celery_app import celery_app


@celery_app.task(name="app.tasks.report_tasks.generate_daily_analytics")
def generate_daily_analytics():
    """
    Aggregate daily metrics for all active tenants and cache them.
    Runs at 1 AM every day.
    """
    import asyncio
    from datetime import date, timedelta

    async def _run():
        from app.core.database import async_session_factory
        from sqlalchemy import select, func
        from app.models.tenant import Tenant, TenantStatus
        from app.models.appointment import Appointment, AppointmentStatus
        from app.models.billing import Payment
        from app.core.cache import cache_set, make_cache_key

        yesterday = (date.today() - timedelta(days=1)).isoformat()

        async with async_session_factory() as db:
            # Get all active tenants
            tenants_res = await db.execute(
                select(Tenant).where(Tenant.status == TenantStatus.ACTIVE)
            )
            tenants = list(tenants_res.scalars())

            for tenant in tenants:
                # Appointment stats
                appt_stats = await db.execute(
                    select(
                        Appointment.status,
                        func.count(Appointment.id).label("count"),
                    ).where(
                        Appointment.tenant_id == tenant.id,
                        Appointment.appointment_date == yesterday,
                        Appointment.is_deleted == False,
                    ).group_by(Appointment.status)
                )

                stats_by_status = {row.status: row.count for row in appt_stats}

                # Revenue
                revenue_res = await db.execute(
                    select(func.sum(Payment.amount)).where(
                        Payment.tenant_id == tenant.id,
                        Payment.payment_date == yesterday,
                        Payment.status == "completed",
                    )
                )
                revenue = float(revenue_res.scalar() or 0)

                # Cache the daily snapshot
                cache_key = make_cache_key("analytics", tenant.id, "daily", yesterday)
                await cache_set(
                    cache_key,
                    {
                        "date": yesterday,
                        "tenant_id": tenant.id,
                        "appointments": stats_by_status,
                        "revenue": revenue,
                    },
                    ttl=86400 * 90,  # Keep 90 days
                )

    asyncio.get_event_loop().run_until_complete(_run())


@celery_app.task(
    bind=True, max_retries=2,
    name="app.tasks.report_tasks.generate_monthly_report",
)
def generate_monthly_report(self, tenant_id: str, year: int, month: int):
    """Generate a comprehensive monthly report PDF for a tenant."""
    import asyncio

    async def _run():
        from app.core.database import async_session_factory
        from sqlalchemy import select, func
        import calendar
        from datetime import date
        from app.models.appointment import Appointment, AppointmentStatus
        from app.models.patient import Patient
        from app.models.billing import Invoice, Payment

        start_date = date(year, month, 1).isoformat()
        end_date = date(year, month, calendar.monthrange(year, month)[1]).isoformat()

        async with async_session_factory() as db:
            # Appointment summary
            appt_result = await db.execute(
                select(
                    Appointment.status,
                    func.count(Appointment.id).label("count"),
                ).where(
                    Appointment.tenant_id == tenant_id,
                    Appointment.appointment_date >= start_date,
                    Appointment.appointment_date <= end_date,
                    Appointment.is_deleted == False,
                ).group_by(Appointment.status)
            )
            appt_by_status = {r.status: r.count for r in appt_result}

            # New patients
            new_patients = (await db.execute(
                select(func.count(Patient.id)).where(
                    Patient.tenant_id == tenant_id,
                    Patient.created_at >= start_date,
                )
            )).scalar()

            # Revenue
            revenue = (await db.execute(
                select(func.sum(Payment.amount)).where(
                    Payment.tenant_id == tenant_id,
                    Payment.payment_date >= start_date,
                    Payment.payment_date <= end_date,
                    Payment.status == "completed",
                )
            )).scalar() or 0

            # Outstanding balance
            outstanding = (await db.execute(
                select(func.sum(Invoice.balance_due)).where(
                    Invoice.tenant_id == tenant_id,
                    Invoice.balance_due > 0,
                    Invoice.is_deleted == False,
                )
            )).scalar() or 0

            report_data = {
                "tenant_id": tenant_id,
                "period": f"{year}-{month:02d}",
                "appointments": appt_by_status,
                "total_appointments": sum(appt_by_status.values()),
                "new_patients": new_patients,
                "revenue": float(revenue),
                "outstanding_balance": float(outstanding),
            }

            # Cache report
            from app.core.cache import cache_set, make_cache_key
            await cache_set(
                make_cache_key("report", tenant_id, "monthly", f"{year}-{month:02d}"),
                report_data,
                ttl=86400 * 365,
            )

            return report_data

    try:
        return asyncio.get_event_loop().run_until_complete(_run())
    except Exception as exc:
        raise self.retry(exc=exc)
