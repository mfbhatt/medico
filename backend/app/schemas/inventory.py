"""Inventory schemas: drug items, stock batches, transactions, purchase orders."""
from typing import List, Optional

from app.schemas.base import AuditSchema, BaseSchema


class DrugItemCreate(BaseSchema):
    clinic_id: str
    name: str
    generic_name: Optional[str] = None
    brand_name: Optional[str] = None
    drug_code: Optional[str] = None
    form: str
    strength: str
    unit: str
    is_controlled: bool = False
    schedule_class: Optional[str] = None
    category: Optional[str] = None
    manufacturer: Optional[str] = None
    unit_cost: float = 0.0
    selling_price: float = 0.0
    reorder_level: int = 10
    reorder_quantity: int = 100
    max_stock_level: Optional[int] = None
    requires_prescription: bool = True
    storage_conditions: Optional[str] = None


class DrugItemUpdate(BaseSchema):
    name: Optional[str] = None
    generic_name: Optional[str] = None
    brand_name: Optional[str] = None
    form: Optional[str] = None
    strength: Optional[str] = None
    unit: Optional[str] = None
    category: Optional[str] = None
    manufacturer: Optional[str] = None
    unit_cost: Optional[float] = None
    selling_price: Optional[float] = None
    reorder_level: Optional[int] = None
    reorder_quantity: Optional[int] = None
    max_stock_level: Optional[int] = None
    requires_prescription: Optional[bool] = None
    storage_conditions: Optional[str] = None
    is_active: Optional[bool] = None


class DrugItemResponse(AuditSchema):
    id: str
    tenant_id: str
    clinic_id: str
    name: str
    generic_name: Optional[str] = None
    brand_name: Optional[str] = None
    drug_code: Optional[str] = None
    form: str
    strength: str
    unit: str
    is_controlled: bool
    schedule_class: Optional[str] = None
    category: Optional[str] = None
    manufacturer: Optional[str] = None
    unit_cost: float
    selling_price: float
    reorder_level: int
    reorder_quantity: int
    max_stock_level: Optional[int] = None
    requires_prescription: bool
    storage_conditions: Optional[str] = None
    is_active: bool


class StockBatchCreate(BaseSchema):
    drug_item_id: str
    batch_number: str
    quantity: int
    unit_cost: float
    expiry_date: str   # YYYY-MM-DD
    manufacture_date: Optional[str] = None
    supplier_name: Optional[str] = None
    purchase_order_id: Optional[str] = None
    received_date: str


class StockBatchResponse(AuditSchema):
    id: str
    tenant_id: str
    drug_item_id: str
    batch_number: str
    quantity: int
    quantity_remaining: int
    unit_cost: float
    expiry_date: str
    manufacture_date: Optional[str] = None
    supplier_name: Optional[str] = None
    purchase_order_id: Optional[str] = None
    received_date: str
    is_active: bool
    is_expired: bool


class StockAdjustmentCreate(BaseSchema):
    drug_item_id: str
    batch_id: Optional[str] = None
    transaction_type: str  # purchase, dispensed, return, adjustment, expired, damaged, transfer
    quantity: int
    unit_cost: Optional[float] = None
    reference_id: Optional[str] = None
    reference_type: Optional[str] = None
    notes: Optional[str] = None


class StockTransactionResponse(AuditSchema):
    id: str
    tenant_id: str
    drug_item_id: str
    batch_id: Optional[str] = None
    transaction_type: str
    quantity: int
    quantity_before: int
    quantity_after: int
    unit_cost: Optional[float] = None
    reference_id: Optional[str] = None
    reference_type: Optional[str] = None
    notes: Optional[str] = None
    performed_by: str


class PurchaseOrderItemCreate(BaseSchema):
    drug_item_id: str
    quantity_ordered: int
    unit_cost: float


class PurchaseOrderItemResponse(AuditSchema):
    id: str
    order_id: str
    drug_item_id: str
    quantity_ordered: int
    quantity_received: int
    unit_cost: float
    line_total: float


class PurchaseOrderCreate(BaseSchema):
    clinic_id: str
    supplier_name: str
    supplier_contact: Optional[str] = None
    order_date: str
    expected_delivery_date: Optional[str] = None
    notes: Optional[str] = None
    items: List[PurchaseOrderItemCreate]


class PurchaseOrderUpdate(BaseSchema):
    status: Optional[str] = None
    expected_delivery_date: Optional[str] = None
    received_date: Optional[str] = None
    notes: Optional[str] = None


class PurchaseOrderResponse(AuditSchema):
    id: str
    tenant_id: str
    clinic_id: str
    po_number: str
    supplier_name: str
    supplier_contact: Optional[str] = None
    status: str
    order_date: str
    expected_delivery_date: Optional[str] = None
    received_date: Optional[str] = None
    total_amount: float
    notes: Optional[str] = None
    items: List[PurchaseOrderItemResponse] = []


class LowStockAlert(BaseSchema):
    drug_item_id: str
    name: str
    current_stock: int
    reorder_level: int
    reorder_quantity: int
    clinic_id: str
