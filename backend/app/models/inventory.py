"""Pharmacy inventory and supply management models."""
from typing import List, Optional

from sqlalchemy import Boolean, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class DrugItem(BaseModel):
    """Drug/medicine catalog item."""
    __tablename__ = "drug_items"

    clinic_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    generic_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    brand_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    drug_code: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)  # NDC
    form: Mapped[str] = mapped_column(String(50), nullable=False)  # tablet, capsule, liquid, etc.
    strength: Mapped[str] = mapped_column(String(50), nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)  # tablet, ml, mg, etc.

    is_controlled: Mapped[bool] = mapped_column(Boolean, default=False)
    schedule_class: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)  # II, III, IV, V

    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    manufacturer: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    unit_cost: Mapped[float] = mapped_column(Float, default=0.0)
    selling_price: Mapped[float] = mapped_column(Float, default=0.0)

    reorder_level: Mapped[int] = mapped_column(Integer, default=10)
    reorder_quantity: Mapped[int] = mapped_column(Integer, default=100)
    max_stock_level: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    requires_prescription: Mapped[bool] = mapped_column(Boolean, default=True)
    storage_conditions: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    stock_batches: Mapped[List["StockBatch"]] = relationship(
        "StockBatch", back_populates="drug_item", cascade="all, delete-orphan"
    )
    stock_transactions: Mapped[List["StockTransaction"]] = relationship(
        "StockTransaction", back_populates="drug_item"
    )


class StockBatch(BaseModel):
    """A batch of drugs received from a supplier."""
    __tablename__ = "stock_batches"

    drug_item_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("drug_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    batch_number: Mapped[str] = mapped_column(String(50), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_remaining: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_cost: Mapped[float] = mapped_column(Float, nullable=False)
    expiry_date: Mapped[str] = mapped_column(String(10), nullable=False)
    manufacture_date: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    supplier_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    purchase_order_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True
    )
    received_date: Mapped[str] = mapped_column(String(10), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    drug_item: Mapped["DrugItem"] = relationship("DrugItem", back_populates="stock_batches")

    @property
    def is_expired(self) -> bool:
        from datetime import date
        return date.fromisoformat(self.expiry_date) < date.today()


class StockTransaction(BaseModel):
    """Tracks every stock movement (in/out)."""
    __tablename__ = "stock_transactions"

    drug_item_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("drug_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    batch_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("stock_batches.id", ondelete="SET NULL"), nullable=True
    )
    transaction_type: Mapped[str] = mapped_column(String(20), nullable=False)
    # purchase, dispensed, return, adjustment, expired, damaged, transfer

    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_before: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_after: Mapped[int] = mapped_column(Integer, nullable=False)

    unit_cost: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    reference_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    # Could be prescription_id, purchase_order_id, etc.
    reference_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    notes: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    performed_by: Mapped[str] = mapped_column(String(36), nullable=False)

    drug_item: Mapped["DrugItem"] = relationship("DrugItem", back_populates="stock_transactions")


class PurchaseOrder(BaseModel):
    """Purchase order to a drug supplier."""
    __tablename__ = "purchase_orders"

    clinic_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False
    )
    po_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    supplier_name: Mapped[str] = mapped_column(String(200), nullable=False)
    supplier_contact: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    # draft, submitted, partially_received, received, cancelled

    order_date: Mapped[str] = mapped_column(String(10), nullable=False)
    expected_delivery_date: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    received_date: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)

    total_amount: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    items: Mapped[List["PurchaseOrderItem"]] = relationship(
        "PurchaseOrderItem", back_populates="order", cascade="all, delete-orphan"
    )


class PurchaseOrderItem(BaseModel):
    __tablename__ = "purchase_order_items"

    order_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False
    )
    drug_item_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("drug_items.id", ondelete="CASCADE"), nullable=False
    )
    quantity_ordered: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_received: Mapped[int] = mapped_column(Integer, default=0)
    unit_cost: Mapped[float] = mapped_column(Float, nullable=False)
    line_total: Mapped[float] = mapped_column(Float, nullable=False)

    order: Mapped["PurchaseOrder"] = relationship("PurchaseOrder", back_populates="items")


class PharmacySale(BaseModel):
    """Point-of-sale dispensing record."""
    __tablename__ = "pharmacy_sales"

    sale_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    clinic_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True
    )
    patient_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("patients.id", ondelete="SET NULL"), nullable=True
    )
    patient_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    cashier_id: Mapped[str] = mapped_column(String(36), nullable=False)
    payment_method: Mapped[str] = mapped_column(String(20), nullable=False, default="cash")
    subtotal: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    discount_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    tax_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    total_amount: Mapped[float] = mapped_column(Float, nullable=False)
    paid_amount: Mapped[float] = mapped_column(Float, nullable=False)
    change_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="completed")
    # completed, voided, refunded
    notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    items: Mapped[List["PharmacySaleItem"]] = relationship(
        "PharmacySaleItem", back_populates="sale", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<PharmacySale {self.sale_number} ${self.total_amount}>"


class PharmacySaleItem(BaseModel):
    """Line item within a pharmacy POS sale."""
    __tablename__ = "pharmacy_sale_items"

    sale_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("pharmacy_sales.id", ondelete="CASCADE"), nullable=False, index=True
    )
    drug_item_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("drug_items.id", ondelete="RESTRICT"), nullable=False
    )
    drug_name: Mapped[str] = mapped_column(String(200), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[float] = mapped_column(Float, nullable=False)
    discount_percent: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    line_total: Mapped[float] = mapped_column(Float, nullable=False)

    sale: Mapped["PharmacySale"] = relationship("PharmacySale", back_populates="items")
