"""Billing, invoicing, and payment endpoints."""
import uuid
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, CurrentUser, require_perm
from app.core.exceptions import BadRequestException, NotFoundException
from app.models.billing import Invoice, InvoiceItem, Payment, InsuranceClaim, InvoiceStatus
from app.models.tenant import Tenant
from app.models.platform_config import PlatformConfig

router = APIRouter()


def _success(data, message="Success", meta=None):
    return {"success": True, "message": message, "data": data, "meta": meta}


@router.post("/invoices")
async def create_invoice(
    body: dict,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("billing:create")),
):
    """Create an invoice for a patient visit."""
    # Calculate amounts
    items_data = body.get("items", [])
    if not items_data:
        raise BadRequestException(detail="Invoice must have at least one item")

    subtotal = sum(item.get("line_total", 0) for item in items_data)
    discount = body.get("discount_amount", 0)
    tax_rate = body.get("tax_rate", 0)
    tax_amount = (subtotal - discount) * (tax_rate / 100)
    total = subtotal - discount + tax_amount

    invoice_number = f"INV-{date.today().strftime('%Y%m')}-{str(uuid.uuid4())[:8].upper()}"
    due_date = (date.today() + timedelta(days=body.get("due_days", 30))).isoformat()

    # Resolve default currency: tenant setting → platform default → "USD"
    tenant_res = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
    tenant = tenant_res.scalar_one_or_none()
    platform_res = await db.execute(select(PlatformConfig).where(PlatformConfig.id == "default"))
    platform = platform_res.scalar_one_or_none()
    platform_currency = (platform.settings or {}).get("currency", "USD") if platform else "USD"
    default_currency = (tenant.settings or {}).get("currency") or platform_currency

    invoice = Invoice(
        tenant_id=current_user.tenant_id,
        invoice_number=invoice_number,
        patient_id=body["patient_id"],
        appointment_id=body.get("appointment_id"),
        clinic_id=body.get("clinic_id") or current_user.clinic_id,
        doctor_id=body.get("doctor_id"),
        status=InvoiceStatus.ISSUED,
        issue_date=date.today().isoformat(),
        due_date=due_date,
        subtotal=round(subtotal, 2),
        discount_amount=round(discount, 2),
        discount_reason=body.get("discount_reason"),
        tax_amount=round(tax_amount, 2),
        tax_rate=tax_rate,
        total_amount=round(total, 2),
        balance_due=round(total, 2),
        insurance_policy_id=body.get("insurance_policy_id"),
        copay_amount=body.get("copay_amount", 0),
        patient_responsibility=body.get("patient_responsibility", total),
        currency=body.get("currency", default_currency),
        notes=body.get("notes"),
        created_by=current_user.user_id,
    )
    db.add(invoice)
    await db.flush()

    for item_data in items_data:
        item = InvoiceItem(
            tenant_id=current_user.tenant_id,
            invoice_id=invoice.id,
            description=item_data["description"],
            item_type=item_data.get("item_type", "consultation"),
            cpt_code=item_data.get("cpt_code"),
            quantity=item_data.get("quantity", 1),
            unit_price=item_data["unit_price"],
            discount_percent=item_data.get("discount_percent", 0),
            tax_percent=item_data.get("tax_percent", 0),
            line_total=item_data["line_total"],
            created_by=current_user.user_id,
        )
        db.add(item)

    await db.commit()

    # Generate PDF in background
    background_tasks.add_task(_generate_invoice_pdf, invoice.id)

    return _success(
        {"invoice_id": invoice.id, "invoice_number": invoice_number, "total": round(total, 2)},
        message="Invoice created",
    )


@router.post("/payments")
async def record_payment(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("billing:create")),
):
    """Record a payment against an invoice."""
    invoice_res = await db.execute(
        select(Invoice).where(
            Invoice.id == body["invoice_id"],
            Invoice.tenant_id == current_user.tenant_id,
        )
    )
    invoice = invoice_res.scalar_one_or_none()
    if not invoice:
        raise NotFoundException(detail="Invoice not found")

    amount = float(body.get("amount", 0))
    if amount <= 0:
        raise BadRequestException(detail="Payment amount must be positive")
    if amount > invoice.balance_due:
        raise BadRequestException(
            detail=f"Payment amount ${amount} exceeds balance due ${invoice.balance_due}"
        )

    payment = Payment(
        tenant_id=current_user.tenant_id,
        invoice_id=invoice.id,
        patient_id=invoice.patient_id,
        payment_date=date.today().isoformat(),
        amount=amount,
        payment_method=body.get("payment_method", "cash"),
        currency=invoice.currency,
        transaction_id=body.get("transaction_id"),
        gateway=body.get("gateway"),
        status="completed",
        notes=body.get("notes"),
        received_by=current_user.user_id,
        created_by=current_user.user_id,
    )
    db.add(payment)

    # Update invoice
    invoice.paid_amount = round(invoice.paid_amount + amount, 2)
    invoice.balance_due = round(invoice.balance_due - amount, 2)
    if invoice.balance_due <= 0:
        invoice.status = InvoiceStatus.PAID
    else:
        invoice.status = InvoiceStatus.PARTIALLY_PAID

    await db.commit()

    return _success(
        {
            "payment_id": payment.id,
            "invoice_status": invoice.status,
            "balance_due": invoice.balance_due,
        },
        message="Payment recorded",
    )


@router.get("/invoices")
async def list_invoices(
    patient_id: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List invoices, optionally filtered by patient or status."""
    query = select(Invoice).where(
        Invoice.tenant_id == current_user.tenant_id,
        Invoice.is_deleted == False,
    )
    if patient_id:
        query = query.where(Invoice.patient_id == patient_id)
    if status:
        query = query.where(Invoice.status == status)

    query = query.order_by(Invoice.issue_date.desc())
    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)

    return _success(
        [
            {
                "id": inv.id,
                "invoice_number": inv.invoice_number,
                "patient_id": inv.patient_id,
                "issue_date": inv.issue_date,
                "due_date": inv.due_date,
                "status": inv.status,
                "total_amount": inv.total_amount,
                "paid_amount": inv.paid_amount,
                "balance_due": inv.balance_due,
                "currency": inv.currency,
            }
            for inv in result.scalars()
        ],
        meta={"total": total, "page": page, "page_size": page_size},
    )


@router.get("/invoices/{invoice_id}")
async def get_invoice(
    invoice_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get a single invoice with all line items and payments."""
    inv_res = await db.execute(
        select(Invoice).where(
            Invoice.id == invoice_id,
            Invoice.tenant_id == current_user.tenant_id,
            Invoice.is_deleted == False,
        )
    )
    inv = inv_res.scalar_one_or_none()
    if not inv:
        raise NotFoundException(detail="Invoice not found")

    items_res = await db.execute(
        select(InvoiceItem).where(InvoiceItem.invoice_id == inv.id)
    )
    items = items_res.scalars().all()

    payments_res = await db.execute(
        select(Payment).where(Payment.invoice_id == inv.id)
    )
    payments = payments_res.scalars().all()

    return _success({
        "id": inv.id,
        "invoice_number": inv.invoice_number,
        "patient_id": inv.patient_id,
        "appointment_id": inv.appointment_id,
        "clinic_id": inv.clinic_id,
        "doctor_id": inv.doctor_id,
        "issue_date": inv.issue_date,
        "due_date": inv.due_date,
        "status": inv.status,
        "subtotal": inv.subtotal,
        "discount_amount": inv.discount_amount,
        "tax_amount": inv.tax_amount,
        "tax_rate": inv.tax_rate,
        "total_amount": inv.total_amount,
        "paid_amount": inv.paid_amount,
        "balance_due": inv.balance_due,
        "currency": inv.currency,
        "notes": inv.notes,
        "items": [
            {
                "id": item.id,
                "description": item.description,
                "item_type": item.item_type,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "line_total": item.line_total,
            }
            for item in items
        ],
        "payments": [
            {
                "id": p.id,
                "amount": p.amount,
                "payment_method": p.payment_method,
                "payment_date": p.payment_date,
                "status": p.status,
            }
            for p in payments
        ],
    })


@router.get("/invoices/patient/{patient_id}")
async def get_patient_invoices(
    patient_id: str,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    query = select(Invoice).where(
        Invoice.patient_id == patient_id,
        Invoice.tenant_id == current_user.tenant_id,
        Invoice.is_deleted == False,
    )
    if status:
        query = query.where(Invoice.status == status)

    query = query.order_by(Invoice.issue_date.desc())
    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)

    return _success(
        [
            {
                "id": inv.id,
                "invoice_number": inv.invoice_number,
                "issue_date": inv.issue_date,
                "due_date": inv.due_date,
                "status": inv.status,
                "total_amount": inv.total_amount,
                "paid_amount": inv.paid_amount,
                "balance_due": inv.balance_due,
                "currency": inv.currency,
                "pdf_url": inv.pdf_url,
            }
            for inv in result.scalars()
        ],
        meta={"total": total, "page": page, "page_size": page_size},
    )


async def _generate_invoice_pdf(invoice_id: str):
    """Generate PDF for an invoice in the background."""
    try:
        from app.tasks.billing_tasks import generate_invoice_pdf
        generate_invoice_pdf.delay(invoice_id)
    except Exception:
        pass
