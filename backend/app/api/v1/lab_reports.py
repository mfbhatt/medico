"""Lab order and report endpoints."""
import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, CurrentUser, require_perm
from app.core.exceptions import BadRequestException, NotFoundException, ForbiddenException
from app.models.lab_report import LabOrder, LabOrderItem, LabReport, LabOrderStatus, LabTestCatalog

router = APIRouter()


def _success(data, message="Success", meta=None):
    return {"success": True, "message": message, "data": data, "meta": meta}


@router.get("/tests")
async def list_lab_tests(
    search: Optional[str] = None,
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List available lab tests from the catalog."""
    query = select(LabTestCatalog).where(LabTestCatalog.is_active == True)
    if search:
        query = query.where(LabTestCatalog.test_name.ilike(f"%{search}%"))
    if category:
        query = query.where(LabTestCatalog.category == category)
    query = query.order_by(LabTestCatalog.category, LabTestCatalog.test_name)
    result = await db.execute(query)
    tests = result.scalars().all()
    return _success([
        {
            "id": t.id,
            "test_name": t.test_name,
            "test_code": t.test_code,
            "loinc_code": t.loinc_code,
            "panel_name": t.panel_name,
            "category": t.category,
            "specimen_type": t.specimen_type,
            "is_fasting_required": t.is_fasting_required,
        }
        for t in tests
    ])


@router.post("/orders")
async def create_lab_order(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("lab_reports:create")),
):
    """Create a lab test order."""
    from app.models.doctor import Doctor

    # Resolve ordering doctor: prefer the logged-in doctor, fall back to explicit doctor_id in body
    doctor_res = await db.execute(
        select(Doctor).where(Doctor.user_id == current_user.user_id)
    )
    doctor = doctor_res.scalar_one_or_none()
    ordering_doctor_id = (doctor.id if doctor else None) or body.get("doctor_id")
    if not ordering_doctor_id:
        raise BadRequestException(detail="ordering_doctor_id is required")

    clinic_id = body.get("clinic_id") or current_user.clinic_id
    if not clinic_id:
        raise BadRequestException(detail="clinic_id is required")

    order_number = f"LAB-{date.today().strftime('%Y%m')}-{str(uuid.uuid4())[:8].upper()}"

    order = LabOrder(
        tenant_id=current_user.tenant_id,
        medical_record_id=body.get("medical_record_id"),
        patient_id=body["patient_id"],
        ordering_doctor_id=ordering_doctor_id,
        clinic_id=clinic_id,
        order_number=order_number,
        order_date=date.today().isoformat(),
        lab_name=body.get("lab_name"),
        is_external=body.get("is_external", False),
        specimen_type=body.get("specimen_type"),
        clinical_notes=body.get("clinical_notes"),
        is_urgent=body.get("is_urgent", False),
        is_fasting_required=body.get("is_fasting_required", False),
        created_by=current_user.user_id,
    )
    db.add(order)
    await db.flush()

    for test in body.get("tests", []):
        item = LabOrderItem(
            tenant_id=current_user.tenant_id,
            order_id=order.id,
            test_name=test["test_name"],
            test_code=test.get("test_code"),
            loinc_code=test.get("loinc_code"),
            panel_name=test.get("panel_name"),
            created_by=current_user.user_id,
        )
        db.add(item)

    await db.commit()
    return _success({"order_id": order.id, "order_number": order_number}, message="Lab order created")


@router.post("/orders/{order_id}/results")
async def submit_lab_results(
    order_id: str,
    body: dict,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("lab_reports:create")),
):
    """Submit lab results for an order."""
    result = await db.execute(
        select(LabOrder).where(
            LabOrder.id == order_id,
            LabOrder.tenant_id == current_user.tenant_id,
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        raise NotFoundException(detail="Lab order not found")

    results_data = body.get("results", [])
    has_critical = any(
        r.get("flag") in ("critical_high", "critical_low")
        for r in results_data
    )

    from datetime import datetime, timezone

    report = LabReport(
        tenant_id=current_user.tenant_id,
        order_id=order_id,
        patient_id=order.patient_id,
        ordering_doctor_id=order.ordering_doctor_id,
        report_date=date.today().isoformat(),
        status="final",
        results=results_data,
        has_critical_values=has_critical,
        overall_interpretation=body.get("overall_interpretation"),
        pathologist_notes=body.get("pathologist_notes"),
        report_pdf_url=body.get("report_pdf_url"),
        created_by=current_user.user_id,
    )
    db.add(report)

    order.status = LabOrderStatus.COMPLETED
    await db.commit()

    # Notify if critical values
    if has_critical:
        background_tasks.add_task(
            _notify_critical_values, report.id
        )

    # Notify patient
    background_tasks.add_task(_notify_patient_results, report.id)

    return _success({"report_id": report.id}, message="Lab results submitted")


@router.get("/my")
async def get_my_lab_reports(
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Return lab reports for the currently authenticated patient."""
    from app.models.patient import Patient

    patient_res = await db.execute(
        select(Patient).where(
            Patient.user_id == current_user.user_id,
            Patient.tenant_id == current_user.tenant_id,
            Patient.is_deleted.isnot(True),
        )
    )
    patient = patient_res.scalar_one_or_none()
    if not patient:
        return _success([], meta={"total": 0, "page": page, "page_size": page_size})

    # Join LabReport with LabOrder to get order metadata
    query = (
        select(LabReport, LabOrder)
        .join(LabOrder, LabReport.order_id == LabOrder.id)
        .where(
            LabReport.patient_id == patient.id,
            LabReport.tenant_id == current_user.tenant_id,
            LabReport.is_deleted == False,
        )
        .order_by(LabReport.report_date.desc())
    )

    total = (await db.execute(select(func.count()).select_from(
        select(LabReport).where(
            LabReport.patient_id == patient.id,
            LabReport.tenant_id == current_user.tenant_id,
            LabReport.is_deleted == False,
        ).subquery()
    ))).scalar()

    result = await db.execute(query.offset((page - 1) * page_size).limit(page_size))
    rows = result.all()

    # Also fetch ordering doctor names
    from app.models.doctor import Doctor
    from app.models.user import User

    reports = []
    for report, order in rows:
        doctor_name = ""
        if report.ordering_doctor_id:
            dr_res = await db.execute(
                select(Doctor, User)
                .join(User, Doctor.user_id == User.id)
                .where(Doctor.id == report.ordering_doctor_id)
            )
            dr_row = dr_res.first()
            if dr_row:
                doctor_name = dr_row[1].full_name or f"{dr_row[1].first_name or ''} {dr_row[1].last_name or ''}".strip()

        reports.append({
            "id": report.id,
            "order_id": report.order_id,
            "order_date": order.order_date,
            "lab_name": order.lab_name or "Lab",
            "doctor_name": doctor_name,
            "report_date": report.report_date,
            "status": report.status,
            "has_critical_values": report.has_critical_values,
            "results": report.results or [],
            "overall_interpretation": report.overall_interpretation,
            "report_pdf_url": report.report_pdf_url,
        })

    return _success(reports, meta={"total": total, "page": page, "page_size": page_size})


@router.get("/reports/patient/{patient_id}")
async def get_patient_lab_reports(
    patient_id: str,
    page: int = 1,
    page_size: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get lab reports for a patient."""
    query = select(LabReport).where(
        LabReport.patient_id == patient_id,
        LabReport.tenant_id == current_user.tenant_id,
        LabReport.is_deleted == False,
    ).order_by(LabReport.report_date.desc())

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)

    return _success(
        [
            {
                "id": r.id,
                "order_id": r.order_id,
                "report_date": r.report_date,
                "status": r.status,
                "has_critical_values": r.has_critical_values,
                "results": r.results,
                "overall_interpretation": r.overall_interpretation,
                "report_pdf_url": r.report_pdf_url,
                "reviewed_by_doctor": r.reviewed_by_doctor,
            }
            for r in result.scalars()
        ],
        meta={"total": total, "page": page, "page_size": page_size},
    )


async def _notify_critical_values(report_id: str):
    try:
        from app.tasks.notification_tasks import notify_critical_lab_result
        notify_critical_lab_result.delay(report_id)
    except Exception:
        pass


async def _notify_patient_results(report_id: str):
    try:
        from app.tasks.notification_tasks import send_appointment_confirmation
        # TODO: create lab result notification task
    except Exception:
        pass
