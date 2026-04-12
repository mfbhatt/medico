import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, ArcElement,
  Title, Tooltip, Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  ShoppingCart, Package, ClipboardList, BarChart2, AlertTriangle,
  Plus, X, Printer, Search, ChevronLeft, ChevronRight, CheckCircle,
  Minus, Trash2, AlertCircle, RefreshCw,
} from 'lucide-react';
import api from '@/services/api';
import { useDebounce } from '@/hooks/useDebounce';
import { useCurrency } from '@/hooks/useCurrency';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'pos' | 'inventory' | 'orders' | 'sales' | 'reports' | 'alerts';

interface Drug {
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

interface CartItem {
  drug_id: string;
  drug_name: string;
  form: string;
  strength: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  line_total: number;
  available_stock: number;
}

interface SaleRecord {
  id: string;
  sale_number: string;
  clinic_id: string;
  patient_name: string | null;
  payment_method: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  item_count: number;
  created_at: string;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_name: string;
  status: string;
  order_date: string;
  expected_delivery_date: string | null;
  total_amount: number;
  clinic_id: string;
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'wallet', label: 'Wallet' },
];

const DRUG_FORMS = [
  'tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops',
  'inhaler', 'patch', 'suppository', 'powder', 'gel', 'other',
];

// ─── Print Receipt ────────────────────────────────────────────────────────────

function printReceipt(sale: any, clinicName: string) {
  const w = window.open('', '_blank', 'width=420,height=700');
  if (!w) return;
  const itemRows = sale.items
    .map(
      (i: any) =>
        `<tr>
          <td style="padding:2px 0">${i.drug_name}</td>
          <td style="text-align:right;padding:2px 4px">${i.quantity}</td>
          <td style="text-align:right;padding:2px 4px">${i.unit_price.toFixed(2)}</td>
          <td style="text-align:right;padding:2px 0">${i.line_total.toFixed(2)}</td>
        </tr>`,
    )
    .join('');

  w.document.write(`<!DOCTYPE html>
<html><head><title>Receipt ${sale.sale_number}</title>
<style>
  body{font-family:monospace;font-size:12px;margin:0;padding:16px;max-width:380px}
  h2{text-align:center;margin:0 0 4px;font-size:14px}
  .sub{text-align:center;font-size:11px;color:#555;margin-bottom:8px}
  hr{border:none;border-top:1px dashed #999;margin:6px 0}
  table{width:100%;border-collapse:collapse}
  th{font-size:10px;text-align:left;border-bottom:1px solid #ccc;padding-bottom:3px}
  th:not(:first-child){text-align:right}
  .totals td{padding:1px 0}
  .total-row{font-weight:bold;font-size:13px}
  .footer{text-align:center;margin-top:12px;font-size:11px;color:#666}
</style></head><body>
<h2>${clinicName}</h2>
<div class="sub">Pharmacy Receipt</div>
<hr/>
<table><tr>
  <td>Receipt #:</td><td style="text-align:right"><b>${sale.sale_number}</b></td>
</tr><tr>
  <td>Date:</td><td style="text-align:right">${new Date(sale.created_at).toLocaleString()}</td>
</tr>${sale.patient_name ? `<tr><td>Patient:</td><td style="text-align:right">${sale.patient_name}</td></tr>` : ''}
</table>
<hr/>
<table>
  <thead><tr>
    <th>Item</th><th>Qty</th><th>Price</th><th>Total</th>
  </tr></thead>
  <tbody>${itemRows}</tbody>
</table>
<hr/>
<table class="totals">
  <tr><td>Subtotal</td><td style="text-align:right">${sale.subtotal.toFixed(2)}</td></tr>
  ${sale.discount_amount > 0 ? `<tr><td>Discount</td><td style="text-align:right">-${sale.discount_amount.toFixed(2)}</td></tr>` : ''}
  ${sale.tax_amount > 0 ? `<tr><td>Tax</td><td style="text-align:right">${sale.tax_amount.toFixed(2)}</td></tr>` : ''}
  <tr class="total-row"><td>TOTAL</td><td style="text-align:right">${sale.total_amount.toFixed(2)}</td></tr>
  <tr><td>Payment (${sale.payment_method})</td><td style="text-align:right">${sale.paid_amount.toFixed(2)}</td></tr>
  ${sale.change_amount > 0 ? `<tr><td>Change</td><td style="text-align:right">${sale.change_amount.toFixed(2)}</td></tr>` : ''}
</table>
<hr/>
<div class="footer">Thank you for your visit!<br/>Please keep this receipt for your records.</div>
<script>window.onload=()=>{window.print();window.close();}</script>
</body></html>`);
  w.document.close();
}

// ─── Add Drug Modal ────────────────────────────────────────────────────────────

function AddDrugModal({ onClose, clinics }: { onClose: () => void; clinics: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '', generic_name: '', brand_name: '', form: 'tablet',
    strength: '', unit: 'mg', category: '', manufacturer: '',
    clinic_id: clinics[0]?.id ?? '', selling_price: '',
    unit_cost: '', reorder_level: '10', reorder_quantity: '100',
    requires_prescription: true, is_controlled: false,
    storage_conditions: '',
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/inventory/drugs', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pharmacy-drugs'] }); onClose(); },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Failed to add drug'),
  });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">Add Drug to Catalog</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            mutation.mutate({
              ...form,
              selling_price: Number(form.selling_price) || 0,
              unit_cost: Number(form.unit_cost) || 0,
              reorder_level: Number(form.reorder_level),
              reorder_quantity: Number(form.reorder_quantity),
            });
          }}
          className="p-5 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Drug Name *</label>
              <input className="input" value={form.name} onChange={set('name')} required />
            </div>
            <div>
              <label className="label">Generic Name</label>
              <input className="input" value={form.generic_name} onChange={set('generic_name')} />
            </div>
            <div>
              <label className="label">Brand Name</label>
              <input className="input" value={form.brand_name} onChange={set('brand_name')} />
            </div>
            <div>
              <label className="label">Form *</label>
              <select className="input" value={form.form} onChange={set('form')}>
                {DRUG_FORMS.map((f) => <option key={f} value={f} className="capitalize">{f}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Strength *</label>
              <input className="input" value={form.strength} onChange={set('strength')} placeholder="e.g. 500" required />
            </div>
            <div>
              <label className="label">Unit *</label>
              <input className="input" value={form.unit} onChange={set('unit')} placeholder="mg, ml, IU…" required />
            </div>
            <div>
              <label className="label">Category</label>
              <input className="input" value={form.category} onChange={set('category')} placeholder="antibiotic, analgesic…" />
            </div>
            <div>
              <label className="label">Manufacturer</label>
              <input className="input" value={form.manufacturer} onChange={set('manufacturer')} />
            </div>
            <div>
              <label className="label">Clinic *</label>
              <select className="input" value={form.clinic_id} onChange={set('clinic_id')} required>
                {clinics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Reorder Level</label>
              <input className="input" type="number" min={0} value={form.reorder_level} onChange={set('reorder_level')} />
            </div>
            <div>
              <label className="label">Unit Cost</label>
              <input className="input" type="number" min={0} step="0.01" value={form.unit_cost} onChange={set('unit_cost')} />
            </div>
            <div>
              <label className="label">Selling Price</label>
              <input className="input" type="number" min={0} step="0.01" value={form.selling_price} onChange={set('selling_price')} />
            </div>
            <div className="col-span-2">
              <label className="label">Storage Conditions</label>
              <input className="input" value={form.storage_conditions} onChange={set('storage_conditions')} placeholder="e.g. Store below 25°C" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="req_rx" checked={form.requires_prescription}
                onChange={(e) => setForm((f) => ({ ...f, requires_prescription: e.target.checked }))} className="w-4 h-4" />
              <label htmlFor="req_rx" className="text-sm text-gray-700">Requires Prescription</label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_ctrl" checked={form.is_controlled}
                onChange={(e) => setForm((f) => ({ ...f, is_controlled: e.target.checked }))} className="w-4 h-4" />
              <label htmlFor="is_ctrl" className="text-sm text-gray-700">Controlled Substance</label>
            </div>
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1">
              {mutation.isPending ? 'Adding…' : 'Add Drug'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Stock Modal ────────────────────────────────────────────────────────────

function AddStockModal({ drug, onClose }: { drug: Drug; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ quantity: '', expiry_date: '', batch_number: '', unit_cost: '', supplier_name: '' });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: any) => api.post(`/inventory/drugs/${drug.id}/stock`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pharmacy-drugs'] }); onClose(); },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Failed to add stock'),
  });

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, [f]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Receive Stock</h2>
            <p className="text-sm text-gray-500">{drug.name} · {drug.form} {drug.strength}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            mutation.mutate({
              quantity: Number(form.quantity),
              expiry_date: form.expiry_date,
              batch_number: form.batch_number || undefined,
              unit_cost: form.unit_cost ? Number(form.unit_cost) : undefined,
              supplier_name: form.supplier_name || undefined,
            });
          }}
          className="p-5 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Quantity *</label>
              <input className="input" type="number" min={1} value={form.quantity} onChange={set('quantity')} required />
            </div>
            <div>
              <label className="label">Expiry Date *</label>
              <input className="input" type="date" value={form.expiry_date} onChange={set('expiry_date')} required />
            </div>
            <div>
              <label className="label">Batch Number</label>
              <input className="input" value={form.batch_number} onChange={set('batch_number')} placeholder="Auto-generated if blank" />
            </div>
            <div>
              <label className="label">Unit Cost</label>
              <input className="input" type="number" min={0} step="0.01" value={form.unit_cost} onChange={set('unit_cost')} />
            </div>
            <div className="col-span-2">
              <label className="label">Supplier</label>
              <input className="input" value={form.supplier_name} onChange={set('supplier_name')} />
            </div>
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1">
              {mutation.isPending ? 'Receiving…' : 'Receive Stock'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Stock Adjustment Modal ────────────────────────────────────────────────────

function AdjustmentModal({ drug, onClose }: { drug: Drug; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ quantity: '', adjustment_type: 'adjustment', reason: '' });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/inventory/adjustments', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pharmacy-drugs'] }); onClose(); },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Adjustment failed'),
  });

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));

  const types = [
    { value: 'adjustment', label: 'Correction / Count Adjustment' },
    { value: 'damaged', label: 'Damaged / Write-off' },
    { value: 'expired', label: 'Expired Stock Removal' },
    { value: 'return', label: 'Supplier Return / Add Back' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Stock Adjustment</h2>
            <p className="text-sm text-gray-500">{drug.name} · Current stock: {drug.total_stock}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            mutation.mutate({
              drug_item_id: drug.id,
              adjustment_type: form.adjustment_type,
              quantity: Number(form.quantity),
              reason: form.reason || undefined,
            });
          }}
          className="p-5 space-y-4"
        >
          <div>
            <label className="label">Type *</label>
            <select className="input" value={form.adjustment_type} onChange={set('adjustment_type')}>
              {types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Quantity * (positive = add, negative = remove)</label>
            <input className="input" type="number" value={form.quantity} onChange={set('quantity')} placeholder="e.g. -10 or 50" required />
          </div>
          <div>
            <label className="label">Reason</label>
            <textarea className="input" rows={2} value={form.reason} onChange={set('reason')} placeholder="Optional reason / notes" />
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1">
              {mutation.isPending ? 'Saving…' : 'Apply Adjustment'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Purchase Order Modal ──────────────────────────────────────────────────────

interface POItem { drug_id: string; drug_name: string; quantity: number; unit_cost: number }

function PurchaseOrderModal({ onClose, clinics, drugs }: { onClose: () => void; clinics: { id: string; name: string }[]; drugs: Drug[] }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    clinic_id: clinics[0]?.id ?? '',
    supplier_name: '', supplier_contact: '', expected_delivery_date: '', notes: '',
  });
  const [items, setItems] = useState<POItem[]>([]);
  const [error, setError] = useState('');

  const addItem = () => {
    const drug = drugs[0];
    if (!drug) return;
    setItems((p) => [...p, { drug_id: drug.id, drug_name: drug.name, quantity: 1, unit_cost: drug.unit_cost }]);
  };

  const removeItem = (idx: number) => setItems((p) => p.filter((_, i) => i !== idx));

  const updateItem = (idx: number, field: keyof POItem, value: string | number) =>
    setItems((p) =>
      p.map((item, i) => {
        if (i !== idx) return item;
        if (field === 'drug_id') {
          const d = drugs.find((dr) => dr.id === value);
          return { ...item, drug_id: String(value), drug_name: d?.name ?? '', unit_cost: d?.unit_cost ?? 0 };
        }
        return { ...item, [field]: Number(value) };
      }),
    );

  const total = items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/inventory/purchase-orders', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pharmacy-pos'] }); onClose(); },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Failed to create PO'),
  });

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">New Purchase Order</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!items.length) { setError('Add at least one item'); return; }
            setError('');
            mutation.mutate({
              ...form,
              items: items.map((i) => ({
                drug_item_id: i.drug_id,
                quantity: i.quantity,
                unit_cost: i.unit_cost,
                line_total: i.quantity * i.unit_cost,
              })),
            });
          }}
          className="p-5 space-y-5"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Clinic *</label>
              <select className="input" value={form.clinic_id} onChange={set('clinic_id')} required>
                {clinics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Supplier *</label>
              <input className="input" value={form.supplier_name} onChange={set('supplier_name')} required />
            </div>
            <div>
              <label className="label">Supplier Contact</label>
              <input className="input" value={form.supplier_contact} onChange={set('supplier_contact')} />
            </div>
            <div>
              <label className="label">Expected Delivery</label>
              <input className="input" type="date" value={form.expected_delivery_date} onChange={set('expected_delivery_date')} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-gray-900 text-sm">Order Items</h3>
              <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-medium">
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>
            {items.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-lg">Click "Add Item" to add drugs to this order</p>
            ) : (
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <select className="input text-xs" value={item.drug_id} onChange={(e) => updateItem(idx, 'drug_id', e.target.value)}>
                        {drugs.map((d) => <option key={d.id} value={d.id}>{d.name} {d.strength}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input className="input text-xs" type="number" min={1} placeholder="Qty"
                        value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} />
                    </div>
                    <div className="col-span-2">
                      <input className="input text-xs" type="number" min={0} step="0.01" placeholder="Unit cost"
                        value={item.unit_cost} onChange={(e) => updateItem(idx, 'unit_cost', e.target.value)} />
                    </div>
                    <div className="col-span-2 text-right text-sm font-medium text-gray-700">
                      {(item.quantity * item.unit_cost).toFixed(2)}
                    </div>
                    <div className="col-span-1 text-right">
                      <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-end pt-2 border-t border-gray-100">
                  <span className="text-sm font-semibold text-gray-900">Total: {total.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={set('notes')} />
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
          <div className="flex gap-3">
            <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1">
              {mutation.isPending ? 'Submitting…' : 'Submit Purchase Order'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Receive PO Modal ──────────────────────────────────────────────────────────

function ReceivePOModal({ po, onClose }: { po: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [receiveItems, setReceiveItems] = useState<Record<string, { qty: string; expiry: string; batch: string }>>({});
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: any) => api.patch(`/inventory/purchase-orders/${po.id}/receive`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pharmacy-pos'] }); onClose(); },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Failed to receive items'),
  });

  const updateItem = (id: string, field: string, value: string) =>
    setReceiveItems((p) => ({ ...p, [id]: { ...(p[id] ?? { qty: '', expiry: '', batch: '' }), [field]: value } }));

  const pendingItems = (po.items ?? []).filter((i: any) => i.quantity_ordered > i.quantity_received);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Receive Items</h2>
            <p className="text-sm text-gray-500">PO# {po.po_number} · {po.supplier_name}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            const items = pendingItems
              .filter((i: any) => receiveItems[i.id]?.qty && Number(receiveItems[i.id].qty) > 0)
              .map((i: any) => ({
                item_id: i.id,
                quantity_received: Number(receiveItems[i.id].qty),
                expiry_date: receiveItems[i.id].expiry,
                batch_number: receiveItems[i.id].batch || undefined,
              }));
            if (!items.length) { setError('Enter quantity for at least one item'); return; }
            const missing = items.filter((i: any) => !i.expiry_date);
            if (missing.length) { setError('Expiry date is required for all received items'); return; }
            mutation.mutate({ items });
          }}
          className="p-5 space-y-4"
        >
          {pendingItems.length === 0 ? (
            <p className="text-gray-500 text-center py-6">All items have been received.</p>
          ) : (
            <div className="space-y-4">
              {pendingItems.map((item: any) => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-medium text-gray-900">{item.drug_name}</p>
                      <p className="text-xs text-gray-500">{item.form} {item.strength} · Ordered: {item.quantity_ordered} · Received: {item.quantity_received}</p>
                    </div>
                    <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                      Pending: {item.quantity_ordered - item.quantity_received}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="label">Qty Received</label>
                      <input className="input" type="number" min={0} max={item.quantity_ordered - item.quantity_received}
                        value={receiveItems[item.id]?.qty ?? ''}
                        onChange={(e) => updateItem(item.id, 'qty', e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Expiry Date *</label>
                      <input className="input" type="date" value={receiveItems[item.id]?.expiry ?? ''}
                        onChange={(e) => updateItem(item.id, 'expiry', e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Batch #</label>
                      <input className="input" placeholder="Optional" value={receiveItems[item.id]?.batch ?? ''}
                        onChange={(e) => updateItem(item.id, 'batch', e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
          {pendingItems.length > 0 && (
            <div className="flex gap-3">
              <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1">
                {mutation.isPending ? 'Receiving…' : 'Confirm Receipt'}
              </button>
              <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

// ─── Receipt View Modal ────────────────────────────────────────────────────────

function SaleDetailModal({ saleId, onClose }: { saleId: string; onClose: () => void }) {
  const fmt = useCurrency();
  const { data } = useQuery({
    queryKey: ['pharmacy-sale', saleId],
    queryFn: () => api.get(`/inventory/sales/${saleId}`).then((r) => r.data.data),
  });

  const qc = useQueryClient();
  const voidMutation = useMutation({
    mutationFn: () => api.post(`/inventory/sales/${saleId}/void`, { reason: 'Manually voided' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pharmacy-sales'] }); onClose(); },
  });

  if (!data) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Sale Receipt</h2>
            <p className="text-sm text-gray-500">{data.sale_number}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => printReceipt(data, 'Pharmacy')} className="btn-secondary flex items-center gap-1.5 text-sm py-1.5">
              <Printer className="w-4 h-4" /> Print
            </button>
            <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-gray-500">Date</span>
            <span className="text-right">{new Date(data.created_at).toLocaleString()}</span>
            <span className="text-gray-500">Patient</span>
            <span className="text-right">{data.patient_name || '—'}</span>
            <span className="text-gray-500">Payment</span>
            <span className="text-right capitalize">{data.payment_method}</span>
            <span className="text-gray-500">Status</span>
            <span className={`text-right font-medium capitalize ${data.status === 'voided' ? 'text-red-600' : 'text-green-600'}`}>{data.status}</span>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-600 font-medium">Item</th>
                  <th className="text-right px-3 py-2 text-gray-600 font-medium">Qty</th>
                  <th className="text-right px-3 py-2 text-gray-600 font-medium">Price</th>
                  <th className="text-right px-3 py-2 text-gray-600 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((item: any) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2">{item.drug_name}</td>
                    <td className="px-3 py-2 text-right">{item.quantity}</td>
                    <td className="px-3 py-2 text-right">{fmt(item.unit_price)}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmt(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-1.5 text-sm border-t border-gray-200 pt-3">
            <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>{fmt(data.subtotal)}</span></div>
            {data.discount_amount > 0 && <div className="flex justify-between"><span className="text-gray-600">Discount</span><span className="text-red-600">−{fmt(data.discount_amount)}</span></div>}
            {data.tax_amount > 0 && <div className="flex justify-between"><span className="text-gray-600">Tax</span><span>{fmt(data.tax_amount)}</span></div>}
            <div className="flex justify-between font-semibold text-base border-t border-gray-200 pt-1.5">
              <span>Total</span><span>{fmt(data.total_amount)}</span>
            </div>
            <div className="flex justify-between text-gray-600"><span>Paid</span><span>{fmt(data.paid_amount)}</span></div>
            {data.change_amount > 0 && <div className="flex justify-between text-gray-600"><span>Change</span><span>{fmt(data.change_amount)}</span></div>}
          </div>

          {data.status === 'completed' && (
            <button
              onClick={() => { if (confirm('Void this sale? Stock will be returned.')) voidMutation.mutate(); }}
              disabled={voidMutation.isPending}
              className="w-full btn-secondary text-red-600 border-red-200 hover:bg-red-50 text-sm"
            >
              {voidMutation.isPending ? 'Voiding…' : 'Void Sale'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── POS Panel ────────────────────────────────────────────────────────────────

function POSPanel({ clinics }: { clinics: { id: string; name: string }[] }) {
  const fmt = useCurrency();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [patientName, setPatientName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discountAmount, setDiscountAmount] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [error, setError] = useState('');

  const clinicId = clinics[0]?.id ?? '';

  const { data: drugsData, isLoading, isFetching } = useQuery({
    queryKey: ['pharmacy-pos-drugs', debouncedSearch],
    queryFn: () =>
      api.get('/inventory/drugs', { params: { q: debouncedSearch || undefined, page_size: 30 } })
        .then((r) => r.data.data ?? []),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const drugs: Drug[] = drugsData ?? [];

  const addToCart = useCallback((drug: Drug) => {
    if (drug.total_stock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.drug_id === drug.id);
      if (existing) {
        if (existing.quantity >= drug.total_stock) return prev;
        return prev.map((i) =>
          i.drug_id === drug.id
            ? { ...i, quantity: i.quantity + 1, line_total: (i.quantity + 1) * i.unit_price * (1 - i.discount_percent / 100) }
            : i,
        );
      }
      return [
        ...prev,
        {
          drug_id: drug.id,
          drug_name: `${drug.name} ${drug.strength}`,
          form: drug.form,
          strength: drug.strength,
          quantity: 1,
          unit_price: drug.selling_price,
          discount_percent: 0,
          line_total: drug.selling_price,
          available_stock: drug.total_stock,
        },
      ];
    });
  }, []);

  const updateCartQty = (drug_id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.drug_id !== drug_id) return i;
          const newQty = Math.max(0, Math.min(i.quantity + delta, i.available_stock));
          if (newQty === 0) return null as any;
          return { ...i, quantity: newQty, line_total: newQty * i.unit_price * (1 - i.discount_percent / 100) };
        })
        .filter(Boolean),
    );
  };

  const updateCartDiscount = (drug_id: string, pct: number) => {
    setCart((prev) =>
      prev.map((i) =>
        i.drug_id !== drug_id ? i : { ...i, discount_percent: pct, line_total: i.quantity * i.unit_price * (1 - pct / 100) },
      ),
    );
  };

  const removeFromCart = (drug_id: string) => setCart((prev) => prev.filter((i) => i.drug_id !== drug_id));

  const subtotal = cart.reduce((s, i) => s + i.line_total, 0);
  const disc = parseFloat(discountAmount) || 0;
  const tax = parseFloat(taxAmount) || 0;
  const total = Math.max(0, subtotal - disc + tax);
  const paid = parseFloat(paidAmount) || total;
  const change = paymentMethod === 'cash' ? Math.max(0, paid - total) : 0;

  const saleMutation = useMutation({
    mutationFn: (data: any) => api.post('/inventory/sales', data),
    onSuccess: (res) => {
      setCompletedSale(res.data.data);
      setCart([]);
      setPatientName('');
      setDiscountAmount('');
      setTaxAmount('');
      setPaidAmount('');
      setNotes('');
      setError('');
      qc.invalidateQueries({ queryKey: ['pharmacy-drugs'] });
      qc.invalidateQueries({ queryKey: ['pharmacy-sales'] });
      qc.invalidateQueries({ queryKey: ['pharmacy-analytics'] });
    },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Sale failed'),
  });

  const processSale = () => {
    if (!cart.length) return;
    if (paymentMethod === 'cash' && paid < total) {
      setError('Cash paid is less than total amount');
      return;
    }
    setError('');
    saleMutation.mutate({
      clinic_id: clinicId,
      items: cart.map((i) => ({
        drug_item_id: i.drug_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount_percent: i.discount_percent,
      })),
      patient_name: patientName || undefined,
      payment_method: paymentMethod,
      paid_amount: paymentMethod === 'cash' ? paid : total,
      discount_amount: disc,
      tax_amount: tax,
      notes: notes || undefined,
    });
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-200px)] min-h-[500px]">
      {/* Drug search – left panel */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            className="input pl-9"
            placeholder="Search drugs by name or generic…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className={`flex-1 overflow-y-auto border border-gray-200 rounded-xl transition-opacity ${isFetching ? 'opacity-60' : 'opacity-100'}`}>
          {isLoading ? (
            <div className="text-center py-12 text-gray-400">Loading drugs…</div>
          ) : drugs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No drugs found</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {drugs.map((drug) => {
                const inCart = cart.find((c) => c.drug_id === drug.id);
                const isOut = drug.total_stock === 0;
                return (
                  <button
                    key={drug.id}
                    onClick={() => addToCart(drug)}
                    disabled={isOut}
                    className={`w-full text-left px-4 py-3 transition-colors ${isOut ? 'opacity-40 cursor-not-allowed bg-gray-50' : 'hover:bg-primary-50 cursor-pointer'} ${inCart ? 'bg-primary-50' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{drug.name}</p>
                        <p className="text-xs text-gray-500">{drug.form} · {drug.strength} {drug.unit}</p>
                        {drug.generic_name && <p className="text-xs text-gray-400">{drug.generic_name}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-gray-900 text-sm">{fmt(drug.selling_price)}</p>
                        <p className={`text-xs ${isOut ? 'text-red-500' : drug.is_low_stock ? 'text-amber-600' : 'text-gray-400'}`}>
                          Stock: {drug.total_stock}
                        </p>
                        {inCart && <span className="text-xs text-primary-600 font-medium">In cart ({inCart.quantity})</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cart – right panel */}
      <div className="w-96 shrink-0 flex flex-col border border-gray-200 rounded-xl bg-white overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" /> Cart
            {cart.length > 0 && <span className="ml-auto text-xs font-normal text-gray-500">{cart.length} item{cart.length !== 1 ? 's' : ''}</span>}
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">Add drugs from the list</p>
          ) : (
            cart.map((item) => (
              <div key={item.drug_id} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-medium text-sm text-gray-900 leading-snug">{item.drug_name}</p>
                  <button onClick={() => removeFromCart(item.drug_id)} className="text-gray-400 hover:text-red-500 shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center border border-gray-200 rounded-lg bg-white">
                    <button onClick={() => updateCartQty(item.drug_id, -1)} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-800">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <button onClick={() => updateCartQty(item.drug_id, 1)} disabled={item.quantity >= item.available_stock}
                      className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-800 disabled:opacity-30">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Disc%</span>
                    <input
                      type="number" min={0} max={100} step={0.5}
                      value={item.discount_percent}
                      onChange={(e) => updateCartDiscount(item.drug_id, parseFloat(e.target.value) || 0)}
                      className="w-14 input text-xs py-1 px-2"
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-900 text-right">{fmt(item.line_total)}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{fmt(item.unit_price)} × {item.quantity}</p>
              </div>
            ))
          )}
        </div>

        {/* Cart footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 space-y-3">
          {/* Patient name */}
          <input className="input text-sm" placeholder="Patient name (optional)" value={patientName} onChange={(e) => setPatientName(e.target.value)} />

          {/* Discount + Tax */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label text-xs">Discount</label>
              <input className="input text-sm py-1" type="number" min={0} step={0.01} placeholder="0.00"
                value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Tax</label>
              <input className="input text-sm py-1" type="number" min={0} step={0.01} placeholder="0.00"
                value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} />
            </div>
          </div>

          {/* Totals */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
            {disc > 0 && <div className="flex justify-between text-red-500"><span>Discount</span><span>−{fmt(disc)}</span></div>}
            {tax > 0 && <div className="flex justify-between text-gray-500"><span>Tax</span><span>{fmt(tax)}</span></div>}
            <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-1">
              <span>Total</span><span>{fmt(total)}</span>
            </div>
          </div>

          {/* Payment method */}
          <div className="flex flex-wrap gap-1">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setPaymentMethod(m.value)}
                className={`flex-1 min-w-[60px] px-2 py-1.5 text-xs font-medium rounded-lg border transition-colors
                  ${paymentMethod === m.value ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Cash tendered */}
          {paymentMethod === 'cash' && (
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="label text-xs">Cash Paid</label>
                <input className="input text-sm py-1" type="number" min={total} step={0.01} placeholder={total.toFixed(2)}
                  value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
              </div>
              {change > 0 && (
                <div className="text-right">
                  <p className="text-xs text-gray-500">Change</p>
                  <p className="text-lg font-bold text-green-600">{fmt(change)}</p>
                </div>
              )}
            </div>
          )}

          {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-1.5 rounded">{error}</div>}

          <button
            onClick={processSale}
            disabled={cart.length === 0 || saleMutation.isPending}
            className="w-full btn-primary py-2.5 font-semibold flex items-center justify-center gap-2"
          >
            {saleMutation.isPending ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Processing…</>
            ) : (
              <><CheckCircle className="w-4 h-4" /> Process Sale · {fmt(total)}</>
            )}
          </button>
        </div>
      </div>

      {/* Sale success modal */}
      {completedSale && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-9 h-9 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Sale Complete!</h2>
              <p className="text-gray-500 text-sm mt-1">Receipt #{completedSale.sale_number}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1.5 text-left">
              <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-semibold">{fmt(completedSale.total_amount)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Paid</span><span>{fmt(completedSale.paid_amount)}</span></div>
              {completedSale.change_amount > 0 && <div className="flex justify-between"><span className="text-gray-500">Change</span><span className="font-semibold text-green-600">{fmt(completedSale.change_amount)}</span></div>}
              <div className="flex justify-between"><span className="text-gray-500">Method</span><span className="capitalize">{completedSale.payment_method}</span></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => printReceipt(completedSale, 'Pharmacy')}
                className="flex-1 btn-secondary flex items-center justify-center gap-2">
                <Printer className="w-4 h-4" /> Print Receipt
              </button>
              <button onClick={() => setCompletedSale(null)} className="flex-1 btn-primary">
                New Sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Inventory Tab ────────────────────────────────────────────────────────────

function InventoryTab({ clinics }: { clinics: { id: string; name: string }[] }) {
  const fmt = useCurrency();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [addDrugOpen, setAddDrugOpen] = useState(false);
  const [stockDrug, setStockDrug] = useState<Drug | null>(null);
  const [adjustDrug, setAdjustDrug] = useState<Drug | null>(null);
  const limit = 25;
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['pharmacy-drugs', debouncedSearch, page],
    queryFn: () =>
      api.get('/inventory/drugs', { params: { q: debouncedSearch || undefined, page: page + 1, page_size: limit } })
        .then((r) => r.data),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const drugs: Drug[] = data?.data ?? [];
  const meta = data?.meta ?? {};

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9" placeholder="Search drugs…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <button onClick={() => setAddDrugOpen(true)} className="btn-primary flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Add Drug
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Drug</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Form / Strength</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Unit Cost</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Selling</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Stock</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : drugs.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">No drugs found</td></tr>
            ) : (
              drugs.map((drug) => {
                const isOut = drug.total_stock === 0;
                const isLow = !isOut && drug.is_low_stock;
                return (
                  <tr key={drug.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{drug.name}</p>
                      <p className="text-xs text-gray-400">{drug.generic_name}</p>
                      {drug.is_controlled && <span className="text-xs text-purple-600 font-medium">Controlled</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{drug.form} · {drug.strength}</td>
                    <td className="px-4 py-3 text-gray-500 capitalize text-xs">{drug.category}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmt(drug.unit_cost)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(drug.selling_price)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-900'}`}>
                      {drug.total_stock}
                    </td>
                    <td className="px-4 py-3">
                      {isOut ? <span className="badge-red">Out of Stock</span> : isLow ? <span className="badge-yellow">Low Stock</span> : <span className="badge-green">In Stock</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => setStockDrug(drug)} className="text-xs text-primary-600 hover:text-primary-800 font-medium">Add Stock</button>
                        <button onClick={() => setAdjustDrug(drug)} className="text-xs text-gray-500 hover:text-gray-700 font-medium">Adjust</button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {(meta.total ?? 0) > limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 text-sm text-gray-600">
            <span>Showing {page * limit + 1}–{Math.min((page + 1) * limit, meta.total)} of {meta.total}</span>
            <div className="flex gap-2">
              <button className="btn-secondary py-1 px-3 flex items-center gap-1" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <button className="btn-secondary py-1 px-3 flex items-center gap-1" disabled={(page + 1) * limit >= meta.total} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {addDrugOpen && <AddDrugModal onClose={() => setAddDrugOpen(false)} clinics={clinics} />}
      {stockDrug && <AddStockModal drug={stockDrug} onClose={() => setStockDrug(null)} />}
      {adjustDrug && <AdjustmentModal drug={adjustDrug} onClose={() => setAdjustDrug(null)} />}
    </>
  );
}

// ─── Purchase Orders Tab ──────────────────────────────────────────────────────

function PurchaseOrdersTab({ clinics, drugs }: { clinics: { id: string; name: string }[]; drugs: Drug[] }) {
  const fmt = useCurrency();
  const [page, setPage] = useState(0);
  const [poOpen, setPoOpen] = useState(false);
  const [receiveItem, setReceiveItem] = useState<any>(null);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['pharmacy-pos', page],
    queryFn: () =>
      api.get('/inventory/purchase-orders', { params: { page: page + 1, page_size: limit } })
        .then((r) => r.data),
  });

  const { data: poDetail } = useQuery({
    queryKey: ['pharmacy-po-detail', receiveItem?.id],
    queryFn: () => receiveItem ? api.get(`/inventory/purchase-orders/${receiveItem.id}`).then((r) => r.data.data) : null,
    enabled: !!receiveItem,
  });

  const pos: PurchaseOrder[] = data?.data ?? [];
  const meta = data?.meta ?? {};

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      submitted: 'badge-blue',
      partially_received: 'badge-yellow',
      received: 'badge-green',
      cancelled: 'badge-red',
      draft: 'badge',
    };
    return <span className={map[s] ?? 'badge'}>{s.replace('_', ' ')}</span>;
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-gray-800">Purchase Orders</h3>
        <button onClick={() => setPoOpen(true)} className="btn-primary flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> New Purchase Order
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">PO Number</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Supplier</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Order Date</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Expected</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : pos.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">No purchase orders yet</td></tr>
            ) : (
              pos.map((po) => (
                <tr key={po.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-primary-700">{po.po_number}</td>
                  <td className="px-4 py-3 text-gray-800">{po.supplier_name}</td>
                  <td className="px-4 py-3 text-gray-500">{po.order_date}</td>
                  <td className="px-4 py-3 text-gray-500">{po.expected_delivery_date ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-medium">{fmt(po.total_amount)}</td>
                  <td className="px-4 py-3">{statusBadge(po.status)}</td>
                  <td className="px-4 py-3 text-right">
                    {(po.status === 'submitted' || po.status === 'partially_received') && (
                      <button onClick={() => setReceiveItem(po)} className="text-xs text-primary-600 hover:text-primary-800 font-medium">
                        Receive Items
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {(meta.total ?? 0) > limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 text-sm text-gray-600">
            <span>{meta.total} orders</span>
            <div className="flex gap-2">
              <button className="btn-secondary py-1 px-3 flex items-center gap-1" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <button className="btn-secondary py-1 px-3 flex items-center gap-1" disabled={(page + 1) * limit >= meta.total} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {poOpen && <PurchaseOrderModal onClose={() => setPoOpen(false)} clinics={clinics} drugs={drugs} />}
      {receiveItem && poDetail && <ReceivePOModal po={poDetail} onClose={() => setReceiveItem(null)} />}
    </>
  );
}

// ─── Sales History Tab ────────────────────────────────────────────────────────

function SalesTab() {
  const fmt = useCurrency();
  const [page, setPage] = useState(0);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedSale, setSelectedSale] = useState<string | null>(null);
  const limit = 25;

  const { data, isLoading } = useQuery({
    queryKey: ['pharmacy-sales', page, dateFrom, dateTo],
    queryFn: () =>
      api.get('/inventory/sales', {
        params: {
          page: page + 1, page_size: limit,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        },
      }).then((r) => r.data),
  });

  const sales: SaleRecord[] = data?.data ?? [];
  const meta = data?.meta ?? {};

  return (
    <>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h3 className="font-semibold text-gray-800 mr-auto">Sales History</h3>
        <div className="flex items-center gap-2 text-sm">
          <label className="text-gray-500">From</label>
          <input type="date" className="input py-1 px-2" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} />
          <label className="text-gray-500">To</label>
          <input type="date" className="input py-1 px-2" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); setPage(0); }} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Receipt #</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Date &amp; Time</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Patient</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Items</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Payment</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : sales.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">No sales found</td></tr>
            ) : (
              sales.map((sale) => (
                <tr
                  key={sale.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedSale(sale.id)}
                >
                  <td className="px-4 py-3 font-medium text-primary-700">{sale.sale_number}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(sale.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-700">{sale.patient_name || <span className="text-gray-400">Walk-in</span>}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{sale.item_count}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(sale.total_amount)}</td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{sale.payment_method}</td>
                  <td className="px-4 py-3">
                    {sale.status === 'completed' ? (
                      <span className="badge-green">Completed</span>
                    ) : (
                      <span className="badge-red">{sale.status}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {(meta.total ?? 0) > limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 text-sm text-gray-600">
            <span>Showing {page * limit + 1}–{Math.min((page + 1) * limit, meta.total)} of {meta.total}</span>
            <div className="flex gap-2">
              <button className="btn-secondary py-1 px-3 flex items-center gap-1" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <button className="btn-secondary py-1 px-3 flex items-center gap-1" disabled={(page + 1) * limit >= meta.total} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedSale && <SaleDetailModal saleId={selectedSale} onClose={() => setSelectedSale(null)} />}
    </>
  );
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────

const CHART_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6',
];

function ReportsTab() {
  const fmt = useCurrency();

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['pharmacy-analytics'],
    queryFn: () => api.get('/inventory/reports/analytics').then((r) => r.data.data),
    refetchInterval: 60_000,
  });

  if (isLoading) return <div className="text-center py-20 text-gray-400">Loading analytics…</div>;
  if (!analytics) return null;

  const dailyLabels = analytics.daily_trend.map((d: any) => {
    const dt = new Date(d.date);
    return `${dt.getMonth() + 1}/${dt.getDate()}`;
  });
  const dailyRevenue = analytics.daily_trend.map((d: any) => d.revenue);

  const paymentLabels = analytics.payment_breakdown.map((p: any) => p.method);
  const paymentRevenue = analytics.payment_breakdown.map((p: any) => p.revenue);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Today's Revenue", value: fmt(analytics.today.revenue), sub: `${analytics.today.count} sales` },
          { label: 'This Week', value: fmt(analytics.this_week.revenue), sub: `${analytics.this_week.count} sales` },
          { label: 'This Month', value: fmt(analytics.this_month.revenue), sub: `${analytics.this_month.count} sales` },
          { label: 'Stock (Retail)', value: fmt(analytics.stock_retail_value), sub: `${analytics.total_drugs} drugs · ${analytics.low_stock_count} low` },
        ].map((card) => (
          <div key={card.label} className="card p-5">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily revenue bar chart */}
        <div className="lg:col-span-2 card p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Daily Revenue (Last 30 Days)</h3>
          {dailyRevenue.length === 0 ? (
            <p className="text-center text-gray-400 py-12">No sales data yet</p>
          ) : (
            <Bar
              data={{
                labels: dailyLabels,
                datasets: [{
                  label: 'Revenue',
                  data: dailyRevenue,
                  backgroundColor: '#6366f1cc',
                  borderColor: '#6366f1',
                  borderWidth: 1,
                  borderRadius: 4,
                }],
              }}
              options={{
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                  y: { beginAtZero: true, ticks: { callback: (v) => fmt(Number(v)) } },
                  x: { ticks: { maxRotation: 45, font: { size: 10 } } },
                },
              }}
            />
          )}
        </div>

        {/* Payment method doughnut */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Payment Methods (This Month)</h3>
          {paymentRevenue.length === 0 ? (
            <p className="text-center text-gray-400 py-12">No data</p>
          ) : (
            <>
              <Doughnut
                data={{
                  labels: paymentLabels.map((l: string) => l.charAt(0).toUpperCase() + l.slice(1)),
                  datasets: [{
                    data: paymentRevenue,
                    backgroundColor: CHART_COLORS.slice(0, paymentRevenue.length),
                    borderWidth: 2,
                    borderColor: '#fff',
                  }],
                }}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { position: 'bottom', labels: { font: { size: 11 } } },
                    tooltip: { callbacks: { label: (ctx) => ` ${fmt(ctx.raw as number)}` } },
                  },
                }}
              />
              <div className="mt-3 space-y-1">
                {analytics.payment_breakdown.map((p: any, i: number) => (
                  <div key={p.method} className="flex justify-between text-xs text-gray-600">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: CHART_COLORS[i] }} />
                      {p.method.charAt(0).toUpperCase() + p.method.slice(1)}
                    </span>
                    <span>{fmt(p.revenue)} ({p.count})</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Top drugs */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-800">Top 10 Drugs by Revenue</h3>
        </div>
        {analytics.top_drugs.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No sales data yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">#</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Drug</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-600">Qty Sold</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-600">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {analytics.top_drugs.map((drug: any, i: number) => (
                <tr key={drug.drug_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-400 font-medium">{i + 1}</td>
                  <td className="px-4 py-2.5 text-gray-900 font-medium">{drug.drug_name}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{drug.qty_sold.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{fmt(drug.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Alerts Tab ───────────────────────────────────────────────────────────────

function AlertsTab() {
  const { data: alerts, isLoading } = useQuery({
    queryKey: ['pharmacy-alerts'],
    queryFn: () => api.get('/inventory/stock-alerts').then((r) => r.data.data ?? []),
    refetchInterval: 300_000,
  });

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Checking alerts…</div>
      ) : !alerts?.length ? (
        <div className="card p-12 text-center">
          <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No stock alerts</p>
          <p className="text-sm text-gray-400 mt-1">All drugs are within acceptable stock levels</p>
        </div>
      ) : (
        alerts.map((alert: any) => (
          <div
            key={alert.drug_id}
            className={`card p-4 border-l-4 ${
              alert.expired_qty > 0 ? 'border-red-500 bg-red-50' :
              alert.expiring_soon_qty > 0 ? 'border-amber-500 bg-amber-50' :
              'border-blue-500 bg-blue-50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900">{alert.drug_name}</p>
                <p className="text-sm text-gray-500 mt-0.5">{alert.form} · {alert.strength}</p>
                <p className="text-sm text-gray-600 mt-1">
                  Stock: <strong>{alert.current_stock}</strong> (reorder at {alert.reorder_level})
                  {alert.expiring_soon_qty > 0 && <> · <span className="text-amber-700">{alert.expiring_soon_qty} units expiring soon</span></>}
                  {alert.expired_qty > 0 && <> · <span className="text-red-700">{alert.expired_qty} units expired</span></>}
                </p>
                {alert.expiring_batches?.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {alert.expiring_batches.map((b: any) => (
                      <span key={b.batch_number} className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                        Batch {b.batch_number}: {b.qty} units · expires {b.expiry_date}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1 items-end shrink-0 ml-4">
                {alert.expired_qty > 0 && <span className="badge-red flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Expired Stock</span>}
                {alert.expiring_soon_qty > 0 && <span className="badge-yellow flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Expiring Soon</span>}
                {alert.is_low_stock && <span className="badge-blue flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Low Stock</span>}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Main PharmacyPage ────────────────────────────────────────────────────────

export default function PharmacyPage() {
  const [tab, setTab] = useState<Tab>('pos');

  const { data: clinicsData } = useQuery({
    queryKey: ['clinics-list'],
    queryFn: () => api.get('/clinics/', { params: { limit: 50 } }).then((r) => r.data.data),
  });
  const clinics: { id: string; name: string }[] = Array.isArray(clinicsData)
    ? clinicsData
    : (clinicsData?.clinics ?? []);

  const { data: drugsData } = useQuery({
    queryKey: ['pharmacy-drugs-all'],
    queryFn: () => api.get('/inventory/drugs', { params: { page_size: 200 } }).then((r) => r.data.data ?? []),
  });
  const allDrugs: Drug[] = drugsData ?? [];

  const { data: alertsData } = useQuery({
    queryKey: ['pharmacy-alerts-count'],
    queryFn: () => api.get('/inventory/stock-alerts').then((r) => r.data.data ?? []),
    refetchInterval: 300_000,
  });
  const alertCount = alertsData?.length ?? 0;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'pos', label: 'Point of Sale', icon: <ShoppingCart className="w-4 h-4" /> },
    { id: 'inventory', label: 'Inventory', icon: <Package className="w-4 h-4" /> },
    { id: 'orders', label: 'Purchase Orders', icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'sales', label: 'Sales History', icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'reports', label: 'Reports', icon: <BarChart2 className="w-4 h-4" /> },
    { id: 'alerts', label: 'Alerts', icon: <AlertTriangle className="w-4 h-4" /> },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Pharmacy</h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-0.5 -mb-px overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors
                ${tab === t.id
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t.icon}
              {t.label}
              {t.id === 'alerts' && alertCount > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 text-xs bg-red-500 text-white rounded-full">
                  {alertCount > 99 ? '99+' : alertCount}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'pos' && <POSPanel clinics={clinics} />}
      {tab === 'inventory' && <InventoryTab clinics={clinics} />}
      {tab === 'orders' && <PurchaseOrdersTab clinics={clinics} drugs={allDrugs} />}
      {tab === 'sales' && <SalesTab />}
      {tab === 'reports' && <ReportsTab />}
      {tab === 'alerts' && <AlertsTab />}
    </div>
  );
}
