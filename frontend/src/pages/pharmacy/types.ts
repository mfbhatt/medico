// ─── Pharmacy Types ────────────────────────────────────────────────────────────

export type Tab = 'overview' | 'pos' | 'inventory' | 'orders' | 'sales' | 'reports' | 'expiry' | 'alerts' | 'suppliers';

export interface Drug {
  id: string;
  name: string;
  generic_name: string;
  brand_name: string;
  form: string;
  strength: string;
  unit: string;
  category: string;
  selling_price: number;
  unit_cost: number;
  requires_prescription: boolean;
  is_controlled: boolean;
  total_stock: number;
  reorder_level: number;
  is_low_stock: boolean;
  is_active: boolean;
  clinic_id: string;
}

export interface CartItem {
  drug_id: string;
  drug_name: string;
  form: string;
  strength: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  line_total: number;
  available_stock: number;
  sig: string;
  batch_id?: string;
  batch_number?: string;
  batch_expiry?: string;
  requires_prescription: boolean;
  is_controlled: boolean;
  generic_name?: string;
}

export interface SaleRecord {
  id: string;
  sale_number: string;
  clinic_id: string;
  patient_name: string | null;
  patient_id: string | null;
  payment_method: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  item_count: number;
  created_at: string;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_name: string;
  status: string;
  order_date: string;
  expected_delivery_date: string | null;
  total_amount: number;
  clinic_id: string;
}

export interface POItem {
  drug_id: string;
  drug_name: string;
  quantity: number;
  unit_cost: number;
}

export interface ExpiryBatch {
  id: string;
  batch_number: string;
  drug_id: string;
  drug_name: string;
  generic_name: string;
  form: string;
  strength: string;
  category: string;
  is_controlled: boolean;
  quantity: number;
  quantity_remaining: number;
  quantity_used: number;
  expiry_date: string;
  manufacture_date: string | null;
  received_date: string;
  supplier_name: string | null;
  sku_code: string | null;
  unit_cost: number;
  status: 'active' | 'expiring_soon' | 'expired' | 'depleted';
  days_to_expiry: number;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  payment_terms: string | null;
  outstanding_balance: number;
  is_active: boolean;
}

export interface SupplierFormData {
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  payment_terms: string;
  outstanding_balance: number;
  is_active: boolean;
}
