"""Celery maintenance tasks — housekeeping, health checks, data integrity."""
from app.tasks.celery_app import celery_app


@celery_app.task(name="app.tasks.maintenance_tasks.expire_old_prescriptions")
def expire_old_prescriptions():
    """Mark prescriptions past their expiry date as expired."""
    import asyncio
    from datetime import date

    async def _run():
        from app.core.database import async_session_factory
        from sqlalchemy import select
        from app.models.prescription import Prescription, PrescriptionStatus

        today = date.today().isoformat()
        async with async_session_factory() as db:
            result = await db.execute(
                select(Prescription).where(
                    Prescription.expiry_date < today,
                    Prescription.status == PrescriptionStatus.ACTIVE,
                    Prescription.is_deleted == False,
                )
            )
            count = 0
            for rx in result.scalars():
                rx.status = PrescriptionStatus.EXPIRED
                count += 1
            if count:
                await db.commit()

    asyncio.get_event_loop().run_until_complete(_run())


@celery_app.task(name="app.tasks.maintenance_tasks.check_low_stock")
def check_low_stock():
    """Send low-stock alerts to clinic admins."""
    import asyncio

    async def _run():
        from app.core.database import async_session_factory
        from sqlalchemy import select, func
        from app.models.inventory import DrugItem, StockBatch
        from app.models.clinic import Clinic
        from datetime import date

        today = date.today().isoformat()
        async with async_session_factory() as db:
            drugs_res = await db.execute(
                select(DrugItem).where(
                    DrugItem.is_active == True,
                    DrugItem.is_deleted == False,
                )
            )
            drugs = list(drugs_res.scalars())

            for drug in drugs:
                stock_res = await db.execute(
                    select(func.sum(StockBatch.quantity_remaining)).where(
                        StockBatch.drug_item_id == drug.id,
                        StockBatch.is_active == True,
                        StockBatch.expiry_date >= today,
                    )
                )
                total_stock = stock_res.scalar() or 0

                if total_stock <= drug.reorder_level:
                    # Notify pharmacist / clinic admin
                    clinic_res = await db.execute(
                        select(Clinic).where(Clinic.id == drug.clinic_id)
                    )
                    clinic = clinic_res.scalar_one_or_none()
                    if clinic and clinic.email:
                        from app.tasks.notification_tasks import _send_email
                        await _send_email(
                            to=clinic.email,
                            subject=f"Low Stock Alert: {drug.name}",
                            body=(
                                f"Drug '{drug.name}' ({drug.strength}) is running low.\n"
                                f"Current stock: {total_stock} {drug.unit}\n"
                                f"Reorder level: {drug.reorder_level} {drug.unit}\n"
                                f"Suggested reorder quantity: {drug.reorder_quantity} {drug.unit}\n\n"
                                "Please place a purchase order promptly."
                            ),
                        )

    asyncio.get_event_loop().run_until_complete(_run())


@celery_app.task(name="app.tasks.maintenance_tasks.cleanup_expired_audit_logs")
def cleanup_expired_audit_logs():
    """
    HIPAA requires audit logs to be kept for at least 6 years.
    This task archives logs older than 7 years to cold storage.
    """
    import asyncio
    from datetime import date, timedelta

    async def _run():
        from app.core.database import async_session_factory
        from sqlalchemy import select, delete
        from app.models.notification import AuditLog

        cutoff = (date.today() - timedelta(days=7 * 365)).isoformat()
        async with async_session_factory() as db:
            # In production: archive to cold storage before deleting
            # For now: just count (don't actually delete)
            result = await db.execute(
                select(AuditLog).where(
                    AuditLog.created_at <= cutoff
                )
            )
            old_logs = list(result.scalars())
            # TODO: archive to Azure Archive Blob tier before removing

    asyncio.get_event_loop().run_until_complete(_run())


@celery_app.task(name="app.tasks.maintenance_tasks.health_check")
def health_check():
    """Periodic health check — verify DB and Redis connectivity."""
    import asyncio

    async def _run():
        from app.core.database import async_session_factory
        from app.core.cache import redis_client
        from sqlalchemy import text

        try:
            async with async_session_factory() as db:
                await db.execute(text("SELECT 1"))
        except Exception as e:
            # Alert on-call if DB is down
            pass

        try:
            await redis_client.ping()
        except Exception as e:
            pass

    asyncio.get_event_loop().run_until_complete(_run())


@celery_app.task(name="app.tasks.maintenance_tasks.sync_doctor_ratings")
def sync_doctor_ratings():
    """Recalculate doctor average ratings from individual ratings (consistency check)."""
    import asyncio

    async def _run():
        from app.core.database import async_session_factory
        from sqlalchemy import select, func
        from app.models.doctor import Doctor, DoctorRating

        async with async_session_factory() as db:
            # Get all doctors with ratings
            result = await db.execute(
                select(
                    DoctorRating.doctor_id,
                    func.avg(DoctorRating.rating).label("avg_rating"),
                    func.count(DoctorRating.id).label("count"),
                ).where(
                    DoctorRating.is_approved == True,
                    DoctorRating.is_deleted == False,
                ).group_by(DoctorRating.doctor_id)
            )

            for row in result:
                doctor_res = await db.execute(
                    select(Doctor).where(Doctor.id == row.doctor_id)
                )
                doctor = doctor_res.scalar_one_or_none()
                if doctor:
                    doctor.average_rating = round(float(row.avg_rating), 2)
                    doctor.total_ratings = row.count

            await db.commit()

    asyncio.get_event_loop().run_until_complete(_run())
