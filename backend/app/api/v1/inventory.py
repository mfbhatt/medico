"""Pharmacy inventory management endpoints."""
import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, CurrentUser, require_perm
from app.core.exceptions import BadRequestException, NotFoundException, ConflictException
from app.models.inventory import DrugItem, StockBatch, StockTransaction, PurchaseOrder, PurchaseOrderItem

router = APIRouter()


def _success(data, message="Success", meta=None):
    return {"success": True, "message": message, "data": data, "meta": meta}


# ── Drug Catalog ─────────────────────────────────────────────────
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
        search = f"%{q}%"
        from sqlalchemy import or_
        query = query.where(
            or_(DrugItem.name.ilike(search), DrugItem.generic_name.ilike(search))
        )

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    query = query.order_by(DrugItem.name).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    drugs = result.scalars().all()

    # Calculate total stock for each drug
    drug_list = []
    for drug in drugs:
        stock_result = await db.execute(
            select(func.sum(StockBatch.quantity_remaining)).where(
                StockBatch.drug_item_id == drug.id,
                StockBatch.is_active == True,
                StockBatch.is_deleted == False,
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
            "requires_prescription": drug.requires_prescription,
            "is_controlled": drug.is_controlled,
            "selling_price": drug.selling_price,
            "reorder_level": drug.reorder_level,
            "total_stock": total_stock,
            "is_low_stock": total_stock <= drug.reorder_level,
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


# ── Stock Management ─────────────────────────────────────────────
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

    # Get current stock total for transaction record
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
    """
    Dispense drug from inventory (FEFO — First Expiry, First Out).
    Automatically picks the earliest-expiring non-expired batch.
    """
    qty = int(body.get("quantity", 0))
    if qty <= 0:
        raise BadRequestException(detail="Quantity must be positive")

    # Get non-expired batches ordered by expiry (FEFO)
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
        from app.core.exceptions import InsufficientInventoryException
        raise InsufficientInventoryException(
            detail=f"Only {total_available} units available, {qty} requested"
        )

    # Deduct from batches (FEFO)
    remaining = qty
    for batch in batches:
        if remaining <= 0:
            break
        deduct = min(batch.quantity_remaining, remaining)
        batch.quantity_remaining -= deduct
        remaining -= deduct
        if batch.quantity_remaining == 0:
            batch.is_active = False

    # Get stock totals for transaction record
    stock_before = total_available
    stock_after = stock_before - qty

    tx = StockTransaction(
        tenant_id=current_user.tenant_id,
        drug_item_id=drug_id,
        transaction_type="dispensed",
        quantity=qty,
        quantity_before=stock_before,
        quantity_after=stock_after,
        reference_id=body.get("prescription_id"),
        reference_type="prescription",
        performed_by=current_user.user_id,
        created_by=current_user.user_id,
    )
    db.add(tx)
    await db.commit()

    # Check if reorder needed
    drug_res = await db.execute(select(DrugItem).where(DrugItem.id == drug_id))
    drug = drug_res.scalar_one_or_none()
    if drug and stock_after <= drug.reorder_level:
        # Trigger low stock alert (background task)
        pass

    return _success({"dispensed": qty, "remaining_stock": stock_after})


# ── Purchase Orders ──────────────────────────────────────────────
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


@router.get("/stock-alerts")
async def get_stock_alerts(
    clinic_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_perm("inventory:read")),
):
    """
    Get all drugs that need attention:
    - Low stock (below reorder level)
    - Expiring within 30 days
    - Already expired
    """
    from datetime import timedelta
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
                "current_stock": total_stock,
                "reorder_level": drug.reorder_level,
                "reorder_quantity": drug.reorder_quantity,
                "is_low_stock": total_stock <= drug.reorder_level,
                "expiring_soon_qty": sum(b.quantity_remaining for b in expiring_batches),
                "expired_qty": expired_qty,
            })

    return _success(alerts, meta={"total_alerts": len(alerts)})
