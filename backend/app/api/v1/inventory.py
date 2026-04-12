"""Pharmacy inventory management — drug catalog, stock, POS sales, purchase orders, analytics."""
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, CurrentUser, require_perm
from app.core.exceptions import (
    BadRequestException, NotFoundException, ConflictException,
    InsufficientInventoryException,
)
from app.models.inventory import (
    DrugItem, StockBatch, StockTransaction,
    PurchaseOrder, PurchaseOrderItem,
    PharmacySale, PharmacySaleItem,
)

router = APIRouter()


def _success(data, message="Success", meta=None):
    return {"success": True, "message": message, "data": data, "meta": meta}


# ══════════════════════════════════════════════════════════════════
#  Drug Catalog
# ══════════════════════════════════════════════════════════════════

@router.get("/drugs")
async def list_drugs(
    clinic_id: Optional[str] = None,
    q: Optional[str] = None,
    low_stock: bool = False,
    page: int = 1,
    page_size: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("inventory:read")),
):
    """List drug catalog with optional low-stock filter."""
    query = select(DrugItem).where(
        DrugItem.tenant_id == current_user.tenant_id,
        DrugItem.is_active == True,
        DrugItem.is_deleted == False,
    )
    if clinic_id:
        query = query.where(DrugItem.clinic_id == clinic_id)
    if q:
        pattern = f"%{q}%"
        query = query.where(
            or_(
                DrugItem.name.ilike(pattern),
                DrugItem.generic_name.ilike(pattern),
                DrugItem.brand_name.ilike(pattern),
                DrugItem.drug_code.ilike(pattern),
            )
        )

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    query = query.order_by(DrugItem.name).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    drugs = result.scalars().all()

    drug_list = []
    for drug in drugs:
        stock_result = await db.execute(
            select(func.sum(StockBatch.quantity_remaining)).where(
                StockBatch.drug_item_id == drug.id,
                StockBatch.is_active == True,
                StockBatch.is_deleted == False,
                StockBatch.expiry_date >= date.today().isoformat(),
            )
        )
        total_stock = stock_result.scalar() or 0

        if low_stock and total_stock > drug.reorder_level:
            continue

        drug_list.append({
            "id": drug.id,
            "name": drug.name,
            "generic_name": drug.generic_name,
            "brand_name": drug.brand_name,
            "form": drug.form,
            "strength": drug.strength,
            "unit": drug.unit,
            "category": drug.category,
            "manufacturer": drug.manufacturer,
            "requires_prescription": drug.requires_prescription,
            "is_controlled": drug.is_controlled,
            "selling_price": drug.selling_price,
            "unit_cost": drug.unit_cost,
            "reorder_level": drug.reorder_level,
            "reorder_quantity": drug.reorder_quantity,
            "total_stock": total_stock,
            "is_low_stock": total_stock <= drug.reorder_level,
            "is_active": drug.is_active,
            "clinic_id": drug.clinic_id,
        })

    return _success(drug_list, meta={"total": total, "page": page, "page_size": page_size})


@router.post("/drugs")
async def create_drug(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("inventory:create")),
):
    """Add a new drug to the catalog."""
    required = ["name", "form", "strength", "unit", "clinic_id"]
    for f in required:
        if not body.get(f):
            raise BadRequestException(detail=f"Missing required field: {f}")

    drug = DrugItem(
        tenant_id=current_user.tenant_id,
        clinic_id=body["clinic_id"],
        name=body["name"],
        generic_name=body.get("generic_name"),
        brand_name=body.get("brand_name"),
        drug_code=body.get("drug_code"),
        form=body["form"],
        strength=body["strength"],
        unit=body["unit"],
        category=body.get("category"),
        manufacturer=body.get("manufacturer"),
        unit_cost=body.get("unit_cost", 0),
        selling_price=body.get("selling_price", 0),
        reorder_level=body.get("reorder_level", 10),
        reorder_quantity=body.get("reorder_quantity", 100),
        requires_prescription=body.get("requires_prescription", True),
        is_controlled=body.get("is_controlled", False),
        schedule_class=body.get("schedule_class"),
        storage_conditions=body.get("storage_conditions"),
        created_by=current_user.user_id,
    )
    db.add(drug)
    await db.commit()
    return _success({"drug_id": drug.id}, message="Drug added to catalog")


@router.get("/drugs/{drug_id}")
async def get_drug(
    drug_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("inventory:read")),
):
    """Get a single drug with current stock and batch info."""
    drug_res = await db.execute(
        select(DrugItem).where(
            DrugItem.id == drug_id,
            DrugItem.tenant_id == current_user.tenant_id,
            DrugItem.is_deleted == False,
        )
    )
    drug = drug_res.scalar_one_or_none()
    if not drug:
        raise NotFoundException(detail="Drug not found")

    today = date.today().isoformat()
    batches_res = await db.execute(
        select(StockBatch).where(
            StockBatch.drug_item_id == drug_id,
            StockBatch.is_active == True,
            StockBatch.is_deleted == False,
            StockBatch.quantity_remaining > 0,
        ).order_by(StockBatch.expiry_date)
    )
    batches = batches_res.scalars().all()
    total_stock = sum(b.quantity_remaining for b in batches if b.expiry_date >= today)

    return _success({
        "id": drug.id,
        "name": drug.name,
        "generic_name": drug.generic_name,
        "brand_name": drug.brand_name,
        "form": drug.form,
        "strength": drug.strength,
        "unit": drug.unit,
        "category": drug.category,
        "manufacturer": drug.manufacturer,
        "requires_prescription": drug.requires_prescription,
        "is_controlled": drug.is_controlled,
        "schedule_class": drug.schedule_class,
        "selling_price": drug.selling_price,
        "unit_cost": drug.unit_cost,
        "reorder_level": drug.reorder_level,
        "reorder_quantity": drug.reorder_quantity,
        "storage_conditions": drug.storage_conditions,
        "total_stock": total_stock,
        "is_active": drug.is_active,
        "clinic_id": drug.clinic_id,
        "batches": [
            {
                "id": b.id,
                "batch_number": b.batch_number,
                "quantity": b.quantity,
                "quantity_remaining": b.quantity_remaining,
                "expiry_date": b.expiry_date,
                "manufacture_date": b.manufacture_date,
                "supplier_name": b.supplier_name,
                "received_date": b.received_date,
                "unit_cost": b.unit_cost,
                "is_expired": b.expiry_date < today,
            }
            for b in batches
        ],
    })


@router.patch("/drugs/{drug_id}")
async def update_drug(
    drug_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("inventory:create")),
):
    """Update drug catalog entry."""
    drug_res = await db.execute(
        select(DrugItem).where(
            DrugItem.id == drug_id,
            DrugItem.tenant_id == current_user.tenant_id,
            DrugItem.is_deleted == False,
        )
    )
    drug = drug_res.scalar_one_or_none()
    if not drug:
        raise NotFoundException(detail="Drug not found")

    updatable = [
        "name", "generic_name", "brand_name", "form", "strength", "unit",
        "category", "manufacturer", "unit_cost", "selling_price",
        "reorder_level", "reorder_quantity", "requires_prescription",
        "is_controlled", "storage_conditions", "is_active",
    ]
    for field in updatable:
        if field in body:
            setattr(drug, field, body[field])
    drug.updated_by = current_user.user_id
    await db.commit()
    return _success({"drug_id": drug_id}, message="Drug updated")


# ══════════════════════════════════════════════════════════════════
#  Stock Management
# ══════════════════════════════════════════════════════════════════

@router.post("/drugs/{drug_id}/stock")
async def add_stock(
    drug_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("inventory:create")),
):
    """Receive a new stock batch."""
    drug_res = await db.execute(
        select(DrugItem).where(
            DrugItem.id == drug_id,
            DrugItem.tenant_id == current_user.tenant_id,
        )
    )
    drug = drug_res.scalar_one_or_none()
    if not drug:
        raise NotFoundException(detail="Drug not found")

    qty = int(body.get("quantity", 0))
    if qty <= 0:
        raise BadRequestException(detail="Quantity must be positive")

    batch = StockBatch(
        tenant_id=current_user.tenant_id,
        drug_item_id=drug_id,
        batch_number=body.get("batch_number", f"BATCH-{str(uuid.uuid4())[:8].upper()}"),
        quantity=qty,
        quantity_remaining=qty,
        unit_cost=body.get("unit_cost", drug.unit_cost),
        expiry_date=body["expiry_date"],
        manufacture_date=body.get("manufacture_date"),
        supplier_name=body.get("supplier_name"),
        purchase_order_id=body.get("purchase_order_id"),
        received_date=date.today().isoformat(),
        created_by=current_user.user_id,
    )
    db.add(batch)
    await db.flush()

    stock_res = await db.execute(
        select(func.sum(StockBatch.quantity_remaining)).where(
            StockBatch.drug_item_id == drug_id,
            StockBatch.is_active == True,
            StockBatch.id != batch.id,
        )
    )
    prev_total = stock_res.scalar() or 0

    tx = StockTransaction(
        tenant_id=current_user.tenant_id,
        drug_item_id=drug_id,
        batch_id=batch.id,
        transaction_type="purchase",
        quantity=qty,
        quantity_before=prev_total,
        quantity_after=prev_total + qty,
        unit_cost=batch.unit_cost,
        reference_id=body.get("purchase_order_id"),
        reference_type="purchase_order",
        performed_by=current_user.user_id,
        created_by=current_user.user_id,
    )
    db.add(tx)
    await db.commit()
    return _success({"batch_id": batch.id}, message="Stock received")


@router.post("/drugs/{drug_id}/dispense")
async def dispense_drug(
    drug_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("prescriptions:dispense")),
):
    """Dispense drug from inventory (FEFO). Used for prescription-linked dispensing."""
    qty = int(body.get("quantity", 0))
    if qty <= 0:
        raise BadRequestException(detail="Quantity must be positive")

    batches_res = await db.execute(
        select(StockBatch).where(
            StockBatch.drug_item_id == drug_id,
            StockBatch.tenant_id == current_user.tenant_id,
            StockBatch.is_active == True,
            StockBatch.quantity_remaining > 0,
            StockBatch.expiry_date >= date.today().isoformat(),
        ).order_by(StockBatch.expiry_date)
    )
    batches = list(batches_res.scalars())

    total_available = sum(b.quantity_remaining for b in batches)
    if total_available < qty:
        raise InsufficientInventoryException(
            detail=f"Only {total_available} units available, {qty} requested"
        )

    remaining = qty
    for batch in batches:
        if remaining <= 0:
            break
        deduct = min(batch.quantity_remaining, remaining)
        batch.quantity_remaining -= deduct
        remaining -= deduct
        if batch.quantity_remaining == 0:
            batch.is_active = False

    tx = StockTransaction(
        tenant_id=current_user.tenant_id,
        drug_item_id=drug_id,
        transaction_type="dispensed",
        quantity=qty,
        quantity_before=total_available,
        quantity_after=total_available - qty,
        reference_id=body.get("prescription_id"),
        reference_type="prescription",
        performed_by=current_user.user_id,
        created_by=current_user.user_id,
    )
    db.add(tx)
    await db.commit()

    return _success({"dispensed": qty, "remaining_stock": total_available - qty})


@router.post("/adjustments")
async def create_adjustment(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("inventory:create")),
):
    """
    Manual stock adjustment (write-off, damage, correction, etc.).
    body: { drug_item_id, adjustment_type, quantity, reason, batch_id? }
    adjustment_type: adjustment, damaged, expired, return
    quantity: positive = add stock, negative = remove stock
    """
    drug_id = body.get("drug_item_id")
    if not drug_id:
        raise BadRequestException(detail="drug_item_id is required")

    adjustment_type = body.get("adjustment_type", "adjustment")
    qty = int(body.get("quantity", 0))
    if qty == 0:
        raise BadRequestException(detail="Quantity cannot be zero")

    drug_res = await db.execute(
        select(DrugItem).where(
            DrugItem.id == drug_id,
            DrugItem.tenant_id == current_user.tenant_id,
            DrugItem.is_deleted == False,
        )
    )
    drug = drug_res.scalar_one_or_none()
    if not drug:
        raise NotFoundException(detail="Drug not found")

    today = date.today().isoformat()
    stock_res = await db.execute(
        select(func.sum(StockBatch.quantity_remaining)).where(
            StockBatch.drug_item_id == drug_id,
            StockBatch.is_active == True,
            StockBatch.expiry_date >= today,
        )
    )
    current_stock = stock_res.scalar() or 0

    if qty < 0 and abs(qty) > current_stock:
        raise BadRequestException(
            detail=f"Cannot remove {abs(qty)} units; only {current_stock} available"
        )

    # For removal (negative qty): deduct from FEFO batches
    if qty < 0:
        batches_res = await db.execute(
            select(StockBatch).where(
                StockBatch.drug_item_id == drug_id,
                StockBatch.tenant_id == current_user.tenant_id,
                StockBatch.is_active == True,
                StockBatch.quantity_remaining > 0,
                StockBatch.expiry_date >= today,
            ).order_by(StockBatch.expiry_date)
        )
        batches = list(batches_res.scalars())
        remaining = abs(qty)
        for batch in batches:
            if remaining <= 0:
                break
            deduct = min(batch.quantity_remaining, remaining)
            batch.quantity_remaining -= deduct
            remaining -= deduct
            if batch.quantity_remaining == 0:
                batch.is_active = False
    else:
        # For additions: create a new batch with today as expiry (12 months out)
        batch = StockBatch(
            tenant_id=current_user.tenant_id,
            drug_item_id=drug_id,
            batch_number=f"ADJ-{str(uuid.uuid4())[:8].upper()}",
            quantity=qty,
            quantity_remaining=qty,
            unit_cost=drug.unit_cost,
            expiry_date=(date.today().replace(year=date.today().year + 1)).isoformat(),
            received_date=today,
            created_by=current_user.user_id,
        )
        db.add(batch)

    tx = StockTransaction(
        tenant_id=current_user.tenant_id,
        drug_item_id=drug_id,
        transaction_type=adjustment_type,
        quantity=qty,
        quantity_before=current_stock,
        quantity_after=current_stock + qty,
        notes=body.get("reason"),
        performed_by=current_user.user_id,
        created_by=current_user.user_id,
    )
    db.add(tx)
    await db.commit()
    return _success(
        {"new_stock": current_stock + qty},
        message=f"Stock adjusted by {qty:+d}",
    )


@router.get("/stock-alerts")
async def get_stock_alerts(
    clinic_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("inventory:read")),
):
    """Get drugs needing attention: low stock, expiring soon, already expired."""
    expiry_threshold = (date.today() + timedelta(days=30)).isoformat()
    today = date.today().isoformat()

    query = select(DrugItem).where(
        DrugItem.tenant_id == current_user.tenant_id,
        DrugItem.is_active == True,
        DrugItem.is_deleted == False,
    )
    if clinic_id:
        query = query.where(DrugItem.clinic_id == clinic_id)

    drugs = (await db.execute(query)).scalars().all()

    alerts = []
    for drug in drugs:
        stock_res = await db.execute(
            select(func.sum(StockBatch.quantity_remaining)).where(
                StockBatch.drug_item_id == drug.id,
                StockBatch.is_active == True,
                StockBatch.expiry_date >= today,
            )
        )
        total_stock = stock_res.scalar() or 0

        expiring_res = await db.execute(
            select(StockBatch).where(
                StockBatch.drug_item_id == drug.id,
                StockBatch.expiry_date >= today,
                StockBatch.expiry_date <= expiry_threshold,
                StockBatch.quantity_remaining > 0,
            )
        )
        expiring_batches = list(expiring_res.scalars())

        expired_res = await db.execute(
            select(func.sum(StockBatch.quantity_remaining)).where(
                StockBatch.drug_item_id == drug.id,
                StockBatch.expiry_date < today,
                StockBatch.quantity_remaining > 0,
            )
        )
        expired_qty = expired_res.scalar() or 0

        if total_stock <= drug.reorder_level or expiring_batches or expired_qty:
            alerts.append({
                "drug_id": drug.id,
                "drug_name": drug.name,
                "form": drug.form,
                "strength": drug.strength,
                "current_stock": total_stock,
                "reorder_level": drug.reorder_level,
                "reorder_quantity": drug.reorder_quantity,
                "is_low_stock": total_stock <= drug.reorder_level,
                "expiring_soon_qty": sum(b.quantity_remaining for b in expiring_batches),
                "expired_qty": expired_qty,
                "expiring_batches": [
                    {"batch_number": b.batch_number, "qty": b.quantity_remaining, "expiry_date": b.expiry_date}
                    for b in expiring_batches
                ],
            })

    return _success(alerts, meta={"total_alerts": len(alerts)})


# ══════════════════════════════════════════════════════════════════
#  Purchase Orders
# ══════════════════════════════════════════════════════════════════

@router.get("/purchase-orders")
async def list_purchase_orders(
    clinic_id: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 25,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("inventory:read")),
):
    """List purchase orders."""
    query = select(PurchaseOrder).where(
        PurchaseOrder.tenant_id == current_user.tenant_id,
        PurchaseOrder.is_deleted == False,
    )
    if clinic_id:
        query = query.where(PurchaseOrder.clinic_id == clinic_id)
    if status:
        query = query.where(PurchaseOrder.status == status)

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    query = (
        query.order_by(PurchaseOrder.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    pos = (await db.execute(query)).scalars().all()

    return _success(
        [
            {
                "id": po.id,
                "po_number": po.po_number,
                "clinic_id": po.clinic_id,
                "supplier_name": po.supplier_name,
                "supplier_contact": po.supplier_contact,
                "status": po.status,
                "order_date": po.order_date,
                "expected_delivery_date": po.expected_delivery_date,
                "received_date": po.received_date,
                "total_amount": po.total_amount,
                "notes": po.notes,
                "created_at": po.created_at.isoformat() if po.created_at else None,
            }
            for po in pos
        ],
        meta={"total": total, "page": page, "page_size": page_size},
    )


@router.post("/purchase-orders")
async def create_purchase_order(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("inventory:create")),
):
    """Create a purchase order to a supplier."""
    items_data = body.get("items", [])
    if not items_data:
        raise BadRequestException(detail="Purchase order must have at least one item")

    total = sum(item.get("line_total", 0) for item in items_data)
    po_number = f"PO-{date.today().strftime('%Y%m')}-{str(uuid.uuid4())[:8].upper()}"

    po = PurchaseOrder(
        tenant_id=current_user.tenant_id,
        clinic_id=body["clinic_id"],
        po_number=po_number,
        supplier_name=body["supplier_name"],
        supplier_contact=body.get("supplier_contact"),
        status="submitted",
        order_date=date.today().isoformat(),
        expected_delivery_date=body.get("expected_delivery_date"),
        total_amount=total,
        notes=body.get("notes"),
        created_by=current_user.user_id,
    )
    db.add(po)
    await db.flush()

    for item_data in items_data:
        item = PurchaseOrderItem(
            tenant_id=current_user.tenant_id,
            order_id=po.id,
            drug_item_id=item_data["drug_item_id"],
            quantity_ordered=item_data["quantity"],
            unit_cost=item_data["unit_cost"],
            line_total=item_data["line_total"],
            created_by=current_user.user_id,
        )
        db.add(item)

    await db.commit()
    return _success({"po_id": po.id, "po_number": po_number}, message="Purchase order created")


@router.get("/purchase-orders/{po_id}")
async def get_purchase_order(
    po_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("inventory:read")),
):
    """Get a purchase order with its line items."""
    po_res = await db.execute(
        select(PurchaseOrder).where(
            PurchaseOrder.id == po_id,
            PurchaseOrder.tenant_id == current_user.tenant_id,
            PurchaseOrder.is_deleted == False,
        )
    )
    po = po_res.scalar_one_or_none()
    if not po:
        raise NotFoundException(detail="Purchase order not found")

    items_res = await db.execute(
        select(PurchaseOrderItem, DrugItem.name, DrugItem.form, DrugItem.strength).join(
            DrugItem, PurchaseOrderItem.drug_item_id == DrugItem.id
        ).where(
            PurchaseOrderItem.order_id == po_id,
            PurchaseOrderItem.is_deleted == False,
        )
    )
    rows = items_res.all()

    return _success({
        "id": po.id,
        "po_number": po.po_number,
        "clinic_id": po.clinic_id,
        "supplier_name": po.supplier_name,
        "supplier_contact": po.supplier_contact,
        "status": po.status,
        "order_date": po.order_date,
        "expected_delivery_date": po.expected_delivery_date,
        "received_date": po.received_date,
        "total_amount": po.total_amount,
        "notes": po.notes,
        "items": [
            {
                "id": row.PurchaseOrderItem.id,
                "drug_item_id": row.PurchaseOrderItem.drug_item_id,
                "drug_name": row.name,
                "form": row.form,
                "strength": row.strength,
                "quantity_ordered": row.PurchaseOrderItem.quantity_ordered,
                "quantity_received": row.PurchaseOrderItem.quantity_received,
                "unit_cost": row.PurchaseOrderItem.unit_cost,
                "line_total": row.PurchaseOrderItem.line_total,
            }
            for row in rows
        ],
        "created_at": po.created_at.isoformat() if po.created_at else None,
    })


@router.patch("/purchase-orders/{po_id}/receive")
async def receive_purchase_order(
    po_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("inventory:create")),
):
    """
    Receive items from a purchase order.
    body: { items: [{ item_id, quantity_received, expiry_date, batch_number? }] }
    Creates stock batches for each received item and updates PO status.
    """
    po_res = await db.execute(
        select(PurchaseOrder).where(
            PurchaseOrder.id == po_id,
            PurchaseOrder.tenant_id == current_user.tenant_id,
            PurchaseOrder.is_deleted == False,
        )
    )
    po = po_res.scalar_one_or_none()
    if not po:
        raise NotFoundException(detail="Purchase order not found")
    if po.status in ("received", "cancelled"):
        raise BadRequestException(detail=f"Cannot receive a PO with status '{po.status}'")

    receive_items = body.get("items", [])
    if not receive_items:
        raise BadRequestException(detail="No items provided to receive")

    for receive in receive_items:
        item_id = receive.get("item_id")
        qty_received = int(receive.get("quantity_received", 0))
        if qty_received <= 0:
            continue

        item_res = await db.execute(
            select(PurchaseOrderItem).where(
                PurchaseOrderItem.id == item_id,
                PurchaseOrderItem.order_id == po_id,
            )
        )
        item = item_res.scalar_one_or_none()
        if not item:
            continue

        item.quantity_received += qty_received

        batch = StockBatch(
            tenant_id=current_user.tenant_id,
            drug_item_id=item.drug_item_id,
            batch_number=receive.get("batch_number", f"PO-{str(uuid.uuid4())[:8].upper()}"),
            quantity=qty_received,
            quantity_remaining=qty_received,
            unit_cost=item.unit_cost,
            expiry_date=receive["expiry_date"],
            supplier_name=po.supplier_name,
            purchase_order_id=po_id,
            received_date=date.today().isoformat(),
            created_by=current_user.user_id,
        )
        db.add(batch)
        await db.flush()

        # Get existing stock total for the transaction record
        existing_res = await db.execute(
            select(func.sum(StockBatch.quantity_remaining)).where(
                StockBatch.drug_item_id == item.drug_item_id,
                StockBatch.is_active == True,
                StockBatch.id != batch.id,
            )
        )
        prev = existing_res.scalar() or 0

        tx = StockTransaction(
            tenant_id=current_user.tenant_id,
            drug_item_id=item.drug_item_id,
            batch_id=batch.id,
            transaction_type="purchase",
            quantity=qty_received,
            quantity_before=prev,
            quantity_after=prev + qty_received,
            unit_cost=item.unit_cost,
            reference_id=po_id,
            reference_type="purchase_order",
            performed_by=current_user.user_id,
            created_by=current_user.user_id,
        )
        db.add(tx)

    # Determine new PO status
    all_items_res = await db.execute(
        select(PurchaseOrderItem).where(PurchaseOrderItem.order_id == po_id)
    )
    all_items = all_items_res.scalars().all()
    fully_received = all(i.quantity_received >= i.quantity_ordered for i in all_items)
    po.status = "received" if fully_received else "partially_received"
    if fully_received:
        po.received_date = date.today().isoformat()

    await db.commit()
    return _success({"po_id": po_id, "status": po.status}, message="Items received")


# ══════════════════════════════════════════════════════════════════
#  POS Sales
# ══════════════════════════════════════════════════════════════════

@router.post("/sales")
async def create_sale(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("inventory:create")),
):
    """
    Process a POS sale. Automatically dispenses stock using FEFO.
    body: {
      clinic_id, items: [{drug_item_id, quantity, unit_price, discount_percent}],
      patient_id?, patient_name?, payment_method, paid_amount,
      discount_amount?, tax_amount?, notes?
    }
    """
    items_data = body.get("items", [])
    if not items_data:
        raise BadRequestException(detail="Sale must have at least one item")

    today = date.today().isoformat()

    # Pre-validate all items have sufficient stock before committing anything
    for item_data in items_data:
        drug_id = item_data.get("drug_item_id")
        qty = int(item_data.get("quantity", 0))
        if qty <= 0:
            raise BadRequestException(detail="Quantity must be positive for all items")

        avail_res = await db.execute(
            select(func.sum(StockBatch.quantity_remaining)).where(
                StockBatch.drug_item_id == drug_id,
                StockBatch.tenant_id == current_user.tenant_id,
                StockBatch.is_active == True,
                StockBatch.quantity_remaining > 0,
                StockBatch.expiry_date >= today,
            )
        )
        available = avail_res.scalar() or 0
        if available < qty:
            drug_res = await db.execute(select(DrugItem).where(DrugItem.id == drug_id))
            drug = drug_res.scalar_one_or_none()
            name = drug.name if drug else drug_id
            raise InsufficientInventoryException(
                detail=f"Insufficient stock for '{name}': {available} available, {qty} requested"
            )

    # Calculate totals
    subtotal = sum(
        item["unit_price"] * item["quantity"] * (1 - item.get("discount_percent", 0) / 100)
        for item in items_data
    )
    discount_amount = float(body.get("discount_amount", 0))
    tax_amount = float(body.get("tax_amount", 0))
    total_amount = round(subtotal - discount_amount + tax_amount, 2)
    paid_amount = float(body.get("paid_amount", total_amount))
    change_amount = round(max(0.0, paid_amount - total_amount), 2)

    sale_number = f"PHM-{date.today().strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"

    sale = PharmacySale(
        tenant_id=current_user.tenant_id,
        sale_number=sale_number,
        clinic_id=body.get("clinic_id", ""),
        patient_id=body.get("patient_id"),
        patient_name=body.get("patient_name"),
        cashier_id=current_user.user_id,
        payment_method=body.get("payment_method", "cash"),
        subtotal=round(subtotal, 2),
        discount_amount=discount_amount,
        tax_amount=tax_amount,
        total_amount=total_amount,
        paid_amount=paid_amount,
        change_amount=change_amount,
        status="completed",
        notes=body.get("notes"),
        created_by=current_user.user_id,
    )
    db.add(sale)
    await db.flush()

    # Dispense stock (FEFO) and create sale items
    sale_items_out = []
    for item_data in items_data:
        drug_id = item_data["drug_item_id"]
        qty = int(item_data["quantity"])
        unit_price = float(item_data.get("unit_price", 0))
        discount_pct = float(item_data.get("discount_percent", 0))
        line_total = round(unit_price * qty * (1 - discount_pct / 100), 2)

        # Fetch drug name
        drug_res = await db.execute(
            select(DrugItem).where(DrugItem.id == drug_id)
        )
        drug = drug_res.scalar_one_or_none()
        drug_name = f"{drug.name} {drug.strength}" if drug else drug_id

        # FEFO dispensing
        batches_res = await db.execute(
            select(StockBatch).where(
                StockBatch.drug_item_id == drug_id,
                StockBatch.tenant_id == current_user.tenant_id,
                StockBatch.is_active == True,
                StockBatch.quantity_remaining > 0,
                StockBatch.expiry_date >= today,
            ).order_by(StockBatch.expiry_date)
        )
        batches = list(batches_res.scalars())
        stock_before = sum(b.quantity_remaining for b in batches)

        remaining = qty
        for batch in batches:
            if remaining <= 0:
                break
            deduct = min(batch.quantity_remaining, remaining)
            batch.quantity_remaining -= deduct
            remaining -= deduct
            if batch.quantity_remaining == 0:
                batch.is_active = False

        tx = StockTransaction(
            tenant_id=current_user.tenant_id,
            drug_item_id=drug_id,
            transaction_type="dispensed",
            quantity=qty,
            quantity_before=stock_before,
            quantity_after=stock_before - qty,
            unit_cost=unit_price,
            reference_id=sale.id,
            reference_type="pharmacy_sale",
            performed_by=current_user.user_id,
            created_by=current_user.user_id,
        )
        db.add(tx)

        sale_item = PharmacySaleItem(
            tenant_id=current_user.tenant_id,
            sale_id=sale.id,
            drug_item_id=drug_id,
            drug_name=drug_name,
            quantity=qty,
            unit_price=unit_price,
            discount_percent=discount_pct,
            line_total=line_total,
            created_by=current_user.user_id,
        )
        db.add(sale_item)
        sale_items_out.append({
            "drug_item_id": drug_id,
            "drug_name": drug_name,
            "quantity": qty,
            "unit_price": unit_price,
            "discount_percent": discount_pct,
            "line_total": line_total,
        })

    await db.commit()

    return _success(
        {
            "sale_id": sale.id,
            "sale_number": sale_number,
            "clinic_id": sale.clinic_id,
            "patient_name": sale.patient_name,
            "cashier_id": sale.cashier_id,
            "payment_method": sale.payment_method,
            "subtotal": sale.subtotal,
            "discount_amount": sale.discount_amount,
            "tax_amount": sale.tax_amount,
            "total_amount": sale.total_amount,
            "paid_amount": sale.paid_amount,
            "change_amount": sale.change_amount,
            "status": sale.status,
            "items": sale_items_out,
            "created_at": sale.created_at.isoformat() if sale.created_at else None,
        },
        message="Sale processed successfully",
    )


@router.get("/sales")
async def list_sales(
    clinic_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    payment_method: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 25,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("inventory:read")),
):
    """List POS sales with filters."""
    query = select(PharmacySale).where(
        PharmacySale.tenant_id == current_user.tenant_id,
        PharmacySale.is_deleted == False,
    )
    if clinic_id:
        query = query.where(PharmacySale.clinic_id == clinic_id)
    if date_from:
        query = query.where(func.date(PharmacySale.created_at) >= date_from)
    if date_to:
        query = query.where(func.date(PharmacySale.created_at) <= date_to)
    if payment_method:
        query = query.where(PharmacySale.payment_method == payment_method)
    if status:
        query = query.where(PharmacySale.status == status)

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    query = (
        query.order_by(PharmacySale.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    sales = (await db.execute(query)).scalars().all()

    # Fetch item counts per sale
    result = []
    for s in sales:
        item_count_res = await db.execute(
            select(func.count()).where(
                PharmacySaleItem.sale_id == s.id,
                PharmacySaleItem.is_deleted == False,
            )
        )
        item_count = item_count_res.scalar() or 0
        result.append({
            "id": s.id,
            "sale_number": s.sale_number,
            "clinic_id": s.clinic_id,
            "patient_name": s.patient_name,
            "payment_method": s.payment_method,
            "total_amount": s.total_amount,
            "paid_amount": s.paid_amount,
            "status": s.status,
            "item_count": item_count,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        })

    return _success(result, meta={"total": total, "page": page, "page_size": page_size})


@router.get("/sales/{sale_id}")
async def get_sale(
    sale_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("inventory:read")),
):
    """Get a sale with all its line items."""
    sale_res = await db.execute(
        select(PharmacySale).where(
            PharmacySale.id == sale_id,
            PharmacySale.tenant_id == current_user.tenant_id,
            PharmacySale.is_deleted == False,
        )
    )
    sale = sale_res.scalar_one_or_none()
    if not sale:
        raise NotFoundException(detail="Sale not found")

    items_res = await db.execute(
        select(PharmacySaleItem).where(
            PharmacySaleItem.sale_id == sale_id,
            PharmacySaleItem.is_deleted == False,
        )
    )
    items = items_res.scalars().all()

    return _success({
        "id": sale.id,
        "sale_number": sale.sale_number,
        "clinic_id": sale.clinic_id,
        "patient_id": sale.patient_id,
        "patient_name": sale.patient_name,
        "cashier_id": sale.cashier_id,
        "payment_method": sale.payment_method,
        "subtotal": sale.subtotal,
        "discount_amount": sale.discount_amount,
        "tax_amount": sale.tax_amount,
        "total_amount": sale.total_amount,
        "paid_amount": sale.paid_amount,
        "change_amount": sale.change_amount,
        "status": sale.status,
        "notes": sale.notes,
        "items": [
            {
                "id": i.id,
                "drug_item_id": i.drug_item_id,
                "drug_name": i.drug_name,
                "quantity": i.quantity,
                "unit_price": i.unit_price,
                "discount_percent": i.discount_percent,
                "line_total": i.line_total,
            }
            for i in items
        ],
        "created_at": sale.created_at.isoformat() if sale.created_at else None,
    })


@router.post("/sales/{sale_id}/void")
async def void_sale(
    sale_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("inventory:create")),
):
    """
    Void a completed sale. Returns stock back to inventory.
    body: { reason? }
    """
    sale_res = await db.execute(
        select(PharmacySale).where(
            PharmacySale.id == sale_id,
            PharmacySale.tenant_id == current_user.tenant_id,
            PharmacySale.is_deleted == False,
        )
    )
    sale = sale_res.scalar_one_or_none()
    if not sale:
        raise NotFoundException(detail="Sale not found")
    if sale.status != "completed":
        raise BadRequestException(detail=f"Only completed sales can be voided (status: {sale.status})")

    items_res = await db.execute(
        select(PharmacySaleItem).where(
            PharmacySaleItem.sale_id == sale_id,
            PharmacySaleItem.is_deleted == False,
        )
    )
    items = items_res.scalars().all()

    today = date.today().isoformat()
    for item in items:
        # Get current stock
        stock_res = await db.execute(
            select(func.sum(StockBatch.quantity_remaining)).where(
                StockBatch.drug_item_id == item.drug_item_id,
                StockBatch.is_active == True,
                StockBatch.expiry_date >= today,
            )
        )
        current_stock = stock_res.scalar() or 0

        # Add back a return batch
        return_batch = StockBatch(
            tenant_id=current_user.tenant_id,
            drug_item_id=item.drug_item_id,
            batch_number=f"RET-{str(uuid.uuid4())[:8].upper()}",
            quantity=item.quantity,
            quantity_remaining=item.quantity,
            unit_cost=item.unit_price,
            expiry_date=(date.today() + timedelta(days=365)).isoformat(),
            received_date=today,
            created_by=current_user.user_id,
        )
        db.add(return_batch)

        tx = StockTransaction(
            tenant_id=current_user.tenant_id,
            drug_item_id=item.drug_item_id,
            transaction_type="return",
            quantity=item.quantity,
            quantity_before=current_stock,
            quantity_after=current_stock + item.quantity,
            reference_id=sale_id,
            reference_type="pharmacy_sale_void",
            notes=body.get("reason", "Sale voided"),
            performed_by=current_user.user_id,
            created_by=current_user.user_id,
        )
        db.add(tx)

    sale.status = "voided"
    sale.notes = (sale.notes or "") + f"\nVoided: {body.get('reason', 'No reason')}"
    sale.updated_by = current_user.user_id
    await db.commit()
    return _success({"sale_id": sale_id, "status": "voided"}, message="Sale voided and stock returned")


# ══════════════════════════════════════════════════════════════════
#  Reports & Analytics
# ══════════════════════════════════════════════════════════════════

@router.get("/reports/analytics")
async def get_analytics(
    clinic_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("inventory:read")),
):
    """
    Pharmacy analytics dashboard data:
    - Revenue summary (today / this week / this month)
    - Daily revenue trend (last 30 days)
    - Top 10 drugs by revenue
    - Payment method breakdown
    - Stock value, drug count, low-stock count
    """
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = today_start.replace(day=1)
    thirty_days_ago = today_start - timedelta(days=30)

    base_filter = [
        PharmacySale.tenant_id == current_user.tenant_id,
        PharmacySale.status == "completed",
        PharmacySale.is_deleted == False,
    ]
    if clinic_id:
        base_filter.append(PharmacySale.clinic_id == clinic_id)

    async def period_stats(since: datetime) -> dict:
        res = await db.execute(
            select(
                func.coalesce(func.sum(PharmacySale.total_amount), 0).label("revenue"),
                func.count().label("count"),
            ).where(*base_filter, PharmacySale.created_at >= since)
        )
        row = res.one()
        return {"revenue": float(row.revenue), "count": int(row.count)}

    today_stats = await period_stats(today_start)
    week_stats = await period_stats(week_start)
    month_stats = await period_stats(month_start)

    # Daily trend — last 30 days
    daily_res = await db.execute(
        select(
            func.date(PharmacySale.created_at).label("day"),
            func.sum(PharmacySale.total_amount).label("revenue"),
            func.count().label("count"),
        ).where(*base_filter, PharmacySale.created_at >= thirty_days_ago)
        .group_by(func.date(PharmacySale.created_at))
        .order_by(func.date(PharmacySale.created_at))
    )
    daily_trend = [
        {"date": str(row.day), "revenue": float(row.revenue), "count": int(row.count)}
        for row in daily_res.all()
    ]

    # Top 10 drugs by revenue
    item_filter = [
        PharmacySale.tenant_id == current_user.tenant_id,
        PharmacySale.status == "completed",
        PharmacySale.is_deleted == False,
        PharmacySaleItem.is_deleted == False,
    ]
    if clinic_id:
        item_filter.append(PharmacySale.clinic_id == clinic_id)

    top_drugs_res = await db.execute(
        select(
            PharmacySaleItem.drug_item_id,
            PharmacySaleItem.drug_name,
            func.sum(PharmacySaleItem.quantity).label("qty_sold"),
            func.sum(PharmacySaleItem.line_total).label("revenue"),
        )
        .join(PharmacySale, PharmacySaleItem.sale_id == PharmacySale.id)
        .where(*item_filter)
        .group_by(PharmacySaleItem.drug_item_id, PharmacySaleItem.drug_name)
        .order_by(func.sum(PharmacySaleItem.line_total).desc())
        .limit(10)
    )
    top_drugs = [
        {
            "drug_id": row.drug_item_id,
            "drug_name": row.drug_name,
            "qty_sold": int(row.qty_sold),
            "revenue": float(row.revenue),
        }
        for row in top_drugs_res.all()
    ]

    # Payment method breakdown (this month)
    payment_res = await db.execute(
        select(
            PharmacySale.payment_method,
            func.sum(PharmacySale.total_amount).label("revenue"),
            func.count().label("count"),
        ).where(*base_filter, PharmacySale.created_at >= month_start)
        .group_by(PharmacySale.payment_method)
    )
    payment_breakdown = [
        {"method": row.payment_method, "revenue": float(row.revenue), "count": int(row.count)}
        for row in payment_res.all()
    ]

    # Stock value
    drug_filter = [
        DrugItem.tenant_id == current_user.tenant_id,
        DrugItem.is_active == True,
        DrugItem.is_deleted == False,
        StockBatch.is_active == True,
        StockBatch.is_deleted == False,
        StockBatch.expiry_date >= date.today().isoformat(),
    ]
    if clinic_id:
        drug_filter.append(DrugItem.clinic_id == clinic_id)

    stock_val_res = await db.execute(
        select(
            func.coalesce(
                func.sum(StockBatch.quantity_remaining * DrugItem.unit_cost), 0
            ).label("cost_value"),
            func.coalesce(
                func.sum(StockBatch.quantity_remaining * DrugItem.selling_price), 0
            ).label("retail_value"),
        )
        .join(DrugItem, StockBatch.drug_item_id == DrugItem.id)
        .where(*drug_filter)
    )
    stock_row = stock_val_res.one()

    # Drug catalog stats
    drug_query_filter = [
        DrugItem.tenant_id == current_user.tenant_id,
        DrugItem.is_active == True,
        DrugItem.is_deleted == False,
    ]
    if clinic_id:
        drug_query_filter.append(DrugItem.clinic_id == clinic_id)

    total_drugs = (await db.execute(
        select(func.count()).where(*drug_query_filter)
    )).scalar() or 0

    # Low stock count
    low_stock_count = 0
    drugs_res = await db.execute(select(DrugItem).where(*drug_query_filter))
    for drug in drugs_res.scalars().all():
        st = (await db.execute(
            select(func.sum(StockBatch.quantity_remaining)).where(
                StockBatch.drug_item_id == drug.id,
                StockBatch.is_active == True,
                StockBatch.expiry_date >= date.today().isoformat(),
            )
        )).scalar() or 0
        if st <= drug.reorder_level:
            low_stock_count += 1

    return _success({
        "today": today_stats,
        "this_week": week_stats,
        "this_month": month_stats,
        "daily_trend": daily_trend,
        "top_drugs": top_drugs,
        "payment_breakdown": payment_breakdown,
        "stock_cost_value": float(stock_row.cost_value),
        "stock_retail_value": float(stock_row.retail_value),
        "total_drugs": total_drugs,
        "low_stock_count": low_stock_count,
    })
