"""Celery tasks for billing — invoice PDF generation, no-show charges."""
from app.tasks.celery_app import celery_app


@celery_app.task(
    bind=True, max_retries=3,
    name="app.tasks.billing_tasks.generate_invoice_pdf",
)
def generate_invoice_pdf(self, invoice_id: str):
    """Generate PDF for an invoice and save to Azure Blob Storage."""
    import asyncio

    async def _run():
        from app.core.database import async_session_factory
        from sqlalchemy import select
        from app.models.billing import Invoice, InvoiceItem
        from app.models.patient import Patient

        async with async_session_factory() as db:
            inv_res = await db.execute(
                select(Invoice).where(Invoice.id == invoice_id)
            )
            invoice = inv_res.scalar_one_or_none()
            if not invoice or invoice.pdf_url:
                return

            items_res = await db.execute(
                select(InvoiceItem).where(InvoiceItem.invoice_id == invoice_id)
            )
            items = list(items_res.scalars())

            patient_res = await db.execute(
                select(Patient).where(Patient.id == invoice.patient_id)
            )
            patient = patient_res.scalar_one_or_none()

            # Generate PDF using reportlab
            pdf_bytes = _build_invoice_pdf(invoice, items, patient)

            # Upload to Azure Blob Storage
            blob_name = (
                f"{invoice.tenant_id}/invoices/{invoice_id}/"
                f"invoice_{invoice.invoice_number}.pdf"
            )
            pdf_url = await _upload_pdf(blob_name, pdf_bytes)

            invoice.pdf_url = pdf_url
            await db.commit()

    try:
        asyncio.get_event_loop().run_until_complete(_run())
    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task(name="app.tasks.billing_tasks.process_no_show_charge")
def process_no_show_charge(appointment_id: str):
    """Apply a no-show charge if clinic policy requires it."""
    import asyncio

    async def _run():
        from app.core.database import async_session_factory
        from sqlalchemy import select
        from app.models.appointment import Appointment
        from app.models.clinic import Clinic
        from app.models.billing import Invoice, InvoiceItem, InvoiceStatus
        from datetime import date
        import uuid

        async with async_session_factory() as db:
            appt_res = await db.execute(
                select(Appointment).where(Appointment.id == appointment_id)
            )
            appt = appt_res.scalar_one_or_none()
            if not appt:
                return

            clinic_res = await db.execute(
                select(Clinic).where(Clinic.id == appt.clinic_id)
            )
            clinic = clinic_res.scalar_one_or_none()
            if not clinic or not clinic.no_show_charge_enabled:
                return

            charge = clinic.no_show_charge_amount or 0
            if charge <= 0:
                return

            # Create invoice for no-show charge
            invoice_number = f"NS-{date.today().strftime('%Y%m')}-{str(uuid.uuid4())[:8].upper()}"
            invoice = Invoice(
                tenant_id=appt.tenant_id,
                invoice_number=invoice_number,
                patient_id=appt.patient_id,
                appointment_id=appointment_id,
                clinic_id=appt.clinic_id,
                status=InvoiceStatus.ISSUED,
                issue_date=date.today().isoformat(),
                due_date=date.today().isoformat(),
                subtotal=charge,
                total_amount=charge,
                balance_due=charge,
                notes="No-show charge",
                created_by="system",
            )
            db.add(invoice)
            await db.flush()

            item = InvoiceItem(
                tenant_id=appt.tenant_id,
                invoice_id=invoice.id,
                description="No-show cancellation fee",
                item_type="misc",
                quantity=1,
                unit_price=charge,
                line_total=charge,
                created_by="system",
            )
            db.add(item)

            appt.cancellation_fee_charged = True
            await db.commit()

    asyncio.get_event_loop().run_until_complete(_run())


@celery_app.task(name="app.tasks.billing_tasks.mark_overdue_invoices")
def mark_overdue_invoices():
    """Mark unpaid invoices past due date as overdue."""
    import asyncio
    from datetime import date

    async def _run():
        from app.core.database import async_session_factory
        from sqlalchemy import select
        from app.models.billing import Invoice, InvoiceStatus

        today = date.today().isoformat()
        async with async_session_factory() as db:
            result = await db.execute(
                select(Invoice).where(
                    Invoice.due_date < today,
                    Invoice.status.in_([
                        InvoiceStatus.ISSUED,
                        InvoiceStatus.PARTIALLY_PAID,
                    ]),
                    Invoice.balance_due > 0,
                    Invoice.is_deleted == False,
                )
            )
            count = 0
            for inv in result.scalars():
                inv.status = InvoiceStatus.OVERDUE
                count += 1
            if count:
                await db.commit()

    asyncio.get_event_loop().run_until_complete(_run())


# ── Helpers ───────────────────────────────────────────────────────
def _build_invoice_pdf(invoice, items, patient) -> bytes:
    """Build a PDF invoice using reportlab."""
    try:
        from io import BytesIO
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.platypus import (
            SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        )
        from reportlab.lib.styles import getSampleStyleSheet

        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        styles = getSampleStyleSheet()
        story = []

        # Title
        story.append(Paragraph(f"INVOICE — {invoice.invoice_number}", styles["Title"]))
        story.append(Spacer(1, 12))

        # Patient details
        patient_name = patient.full_name if patient else "N/A"
        story.append(Paragraph(f"Patient: {patient_name}", styles["Normal"]))
        story.append(Paragraph(f"Date: {invoice.issue_date}", styles["Normal"]))
        story.append(Paragraph(f"Due: {invoice.due_date}", styles["Normal"]))
        story.append(Spacer(1, 12))

        # Items table
        table_data = [["Description", "Qty", "Unit Price", "Total"]]
        for item in items:
            table_data.append([
                item.description,
                str(item.quantity),
                f"${item.unit_price:.2f}",
                f"${item.line_total:.2f}",
            ])

        table_data.append(["", "", "Subtotal:", f"${invoice.subtotal:.2f}"])
        if invoice.discount_amount:
            table_data.append(["", "", "Discount:", f"-${invoice.discount_amount:.2f}"])
        if invoice.tax_amount:
            table_data.append(["", "", f"Tax ({invoice.tax_rate}%):", f"${invoice.tax_amount:.2f}"])
        table_data.append(["", "", "TOTAL:", f"${invoice.total_amount:.2f}"])

        table = Table(table_data, colWidths=[250, 50, 100, 100])
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e40af")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -4), [colors.white, colors.HexColor("#f8fafc")]),
            ("FONTNAME", (2, -1), (-1, -1), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -5), 0.5, colors.HexColor("#e2e8f0")),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ]))
        story.append(table)

        doc.build(story)
        return buffer.getvalue()
    except Exception:
        return b""


async def _upload_pdf(blob_name: str, content: bytes) -> str:
    """Upload PDF to Azure Blob Storage."""
    from app.core.config import settings
    if not settings.AZURE_STORAGE_CONNECTION_STRING or not content:
        return ""
    try:
        from azure.storage.blob import BlobServiceClient, ContentSettings
        client = BlobServiceClient.from_connection_string(
            settings.AZURE_STORAGE_CONNECTION_STRING
        )
        blob_client = client.get_container_client(
            settings.AZURE_STORAGE_CONTAINER_NAME
        ).get_blob_client(blob_name)
        blob_client.upload_blob(
            content, overwrite=True,
            content_settings=ContentSettings(content_type="application/pdf"),
        )
        return blob_client.url
    except Exception:
        return ""
