import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useAppSelector } from '@/store/hooks';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, ArcElement,
  Title, Tooltip, Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  ShoppingCart, Package, BarChart2, AlertTriangle,
  Plus, X, Printer, Search, ChevronLeft, ChevronRight, CheckCircle,
  Minus, Trash2, AlertCircle, RefreshCw, FileText, ShieldAlert,
  TrendingUp, DollarSign, Boxes,
} from 'lucide-react';
import api from '@/services/api';
import { useDebounce } from '@/hooks/useDebounce';
import { useCurrency } from '@/hooks/useCurrency';
import { useNotification } from '@/hooks/useNotification';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'pos' | 'inventory' | 'orders' | 'sales' | 'reports' | 'expiry' | 'alerts';

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
  sig: string;
  batch_id?: string;
  batch_number?: string;
  batch_expiry?: string;
  requires_prescription: boolean;
  is_controlled: boolean;
  generic_name?: string;
}

interface SaleRecord {
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
  // { value: 'insurance', label: 'Insurance' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  // { value: 'wallet', label: 'Wallet' },
];

const DRUG_FORMS = [
  'tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops',
  'inhaler', 'patch', 'suppository', 'powder', 'gel', 'other',
];

// ─── Print Receipt ────────────────────────────────────────────────────────────

function printReceipt(sale: any, clinicName: string) {
  const w = window.open('', '_blank', 'width=420,height=800');
  if (!w) return;

  const itemRows = sale.items
    .map(
      (i: any) => `
        <tr>
          <td style="padding:3px 0 0">
            <b>${i.drug_name}</b>
            ${i.sig_instructions ? `<div style="font-size:10px;color:#444;margin-top:1px">Directions: ${i.sig_instructions}</div>` : ''}
            ${i.batch_number ? `<div style="font-size:10px;color:#777">Batch: ${i.batch_number}${i.expiry_date ? ` · Exp: ${i.expiry_date}` : ''}</div>` : ''}
          </td>
          <td style="text-align:right;padding:3px 4px 0;vertical-align:top">${i.quantity}</td>
          <td style="text-align:right;padding:3px 4px 0;vertical-align:top">${i.unit_price.toFixed(2)}</td>
          <td style="text-align:right;padding:3px 0 0;vertical-align:top">${i.line_total.toFixed(2)}</td>
        </tr>`,
    )
    .join('');

  w.document.write(`<!DOCTYPE html>
<html><head><title>Receipt ${sale.sale_number}</title>
<style>
  body{font-family:monospace;font-size:12px;margin:0;padding:16px;max-width:380px}
  h2{text-align:center;margin:0 0 2px;font-size:15px}
  .clinic-sub{text-align:center;font-size:11px;color:#555;margin-bottom:2px}
  .doc-title{text-align:center;font-size:11px;font-weight:bold;letter-spacing:1px;margin-bottom:8px}
  hr{border:none;border-top:1px dashed #999;margin:6px 0}
  table{width:100%;border-collapse:collapse}
  th{font-size:10px;text-align:left;border-bottom:1px solid #ccc;padding-bottom:3px}
  th:not(:first-child){text-align:right}
  .totals td{padding:1px 0}
  .total-row td{font-weight:bold;font-size:13px;padding-top:4px}
  .footer{text-align:center;margin-top:12px;font-size:11px;color:#666}
  .partial-note{text-align:center;font-size:11px;color:#b45309;font-weight:bold;margin:4px 0}
</style></head><body>
<h2>${clinicName}</h2>
<div class="clinic-sub">Pharmacy Department</div>
<div class="doc-title">DISPENSING RECEIPT</div>
<hr/>
<table>
  <tr><td>Receipt #:</td><td style="text-align:right"><b>${sale.sale_number}</b></td></tr>
  <tr><td>Date:</td><td style="text-align:right">${new Date(sale.created_at).toLocaleString()}</td></tr>
  ${sale.patient_name ? `<tr><td>Patient:</td><td style="text-align:right"><b>${sale.patient_name}</b></td></tr>` : ''}
  ${sale.patient_id ? `<tr><td>Patient ID:</td><td style="text-align:right">${sale.patient_id}</td></tr>` : ''}
  ${sale.prescription_number ? `<tr><td>Prescription #:</td><td style="text-align:right">${sale.prescription_number}</td></tr>` : ''}
  <tr><td>Payment:</td><td style="text-align:right;text-transform:capitalize">${sale.payment_method}</td></tr>
</table>
<hr/>
<table>
  <thead><tr>
    <th>Drug / Directions</th><th>Qty</th><th>Price</th><th>Total</th>
  </tr></thead>
  <tbody>${itemRows}</tbody>
</table>
<hr/>
${sale.is_partial ? '<div class="partial-note">⚠ PARTIAL DISPENSE — patient to return for balance</div><hr/>' : ''}
<table class="totals">
  <tr><td>Subtotal</td><td style="text-align:right">${sale.subtotal.toFixed(2)}</td></tr>
  ${sale.discount_amount > 0 ? `<tr><td>Discount${sale.discount_percent ? ` (${sale.discount_percent}%)` : ''}</td><td style="text-align:right">-${sale.discount_amount.toFixed(2)}</td></tr>` : ''}
  ${sale.tax_amount > 0 ? `<tr><td>Tax</td><td style="text-align:right">${sale.tax_amount.toFixed(2)}</td></tr>` : ''}
  <tr class="total-row"><td>TOTAL</td><td style="text-align:right">${sale.total_amount.toFixed(2)}</td></tr>
  <tr><td>Paid</td><td style="text-align:right">${sale.paid_amount.toFixed(2)}</td></tr>
  ${sale.change_amount > 0 ? `<tr><td>Change</td><td style="text-align:right">${sale.change_amount.toFixed(2)}</td></tr>` : ''}
</table>
<hr/>
<div class="footer">Thank you for your visit!<br/>Keep this receipt for your records.</div>
<script>window.onload=()=>{window.print();window.close();}</script>
</body></html>`);
  w.document.close();
}

// ─── Sig Selector (structured dosage instructions) ────────────────────────────

const DOSE_OPTIONS: Record<string, string[]> = {
  tablet:      ['½ tablet', '1 tablet', '1½ tablets', '2 tablets', '3 tablets'],
  capsule:     ['1 capsule', '2 capsules'],
  syrup:       ['2.5 ml', '5 ml', '7.5 ml', '10 ml', '15 ml', '20 ml'],
  injection:   ['1 ampule', '½ vial', '1 vial'],
  cream:       ['thin layer', 'small amount'],
  gel:         ['thin layer', 'small amount'],
  drops:       ['1 drop', '2 drops', '3 drops', '4 drops', '5 drops'],
  inhaler:     ['1 puff', '2 puffs'],
  patch:       ['1 patch'],
  suppository: ['1 suppository'],
  powder:      ['1 sachet', '½ sachet'],
};

const FREQ_OPTIONS = [
  'once daily', 'twice daily', 'three times daily', 'four times daily',
  'every 4 hours', 'every 6 hours', 'every 8 hours', 'every 12 hours',
  'at bedtime', 'once weekly', 'as needed',
];

const TIMING_OPTIONS = [
  { value: '',                 label: '—' },
  { value: 'before food',      label: 'before food' },
  { value: 'after food',       label: 'after food' },
  { value: 'with food',        label: 'with food' },
  { value: 'on empty stomach', label: 'on empty stomach' },
  { value: 'with water',       label: 'with water' },
  { value: 'at bedtime',       label: 'at bedtime' },
  { value: 'in the morning',   label: 'in the morning' },
];

function SigSelector({ form, value, onChange }: { form: string; value: string; onChange: (sig: string) => void }) {
  const doses = DOSE_OPTIONS[form.toLowerCase()] ?? ['1 unit', '2 units'];
  const [dose, setDose] = useState(doses[0]);
  const [freq, setFreq] = useState('twice daily');
  const [timing, setTiming] = useState('after food');

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!value) {
      onChangeRef.current(`Take ${doses[0]} twice daily after food`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = (d: string, f: string, t: string) =>
    onChange(`Take ${d} ${f}${t ? ' ' + t : ''}`);

  return (
    <div className="flex items-center gap-0.5 flex-1 min-w-0">
      <select
        value={dose}
        onChange={(e) => { const v = e.target.value; setDose(v); emit(v, freq, timing); }}
        className="input text-[10px] py-0 h-6 px-1 min-w-0 flex-1"
        title="Dose"
      >
        {doses.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
      <select
        value={freq}
        onChange={(e) => { const v = e.target.value; setFreq(v); emit(dose, v, timing); }}
        className="input text-[10px] py-0 h-6 px-1 min-w-0 flex-[1.4]"
        title="Frequency"
      >
        {FREQ_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
      </select>
      <select
        value={timing}
        onChange={(e) => { const v = e.target.value; setTiming(v); emit(dose, freq, v); }}
        className="input text-[10px] py-0 h-6 px-1 min-w-0 flex-[1.2]"
        title="Timing"
      >
        {TIMING_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
    </div>
  );
}

// ─── Batch Selector (cart item) ───────────────────────────────────────────────

function CartBatchRow({
  item,
  clinicId,
  onBatchChange,
}: {
  item: CartItem;
  clinicId: string;
  onBatchChange: (drugId: string, batchId: string, batchNumber: string, batchExpiry: string) => void;
}) {
  const { data } = useQuery({
    queryKey: ['drug-batches', item.drug_id, clinicId],
    queryFn: () =>
      api
        .get('/inventory/batches', { params: { drug_id: item.drug_id, status: 'active', clinic_id: clinicId, page_size: 20 } })
        .then((r) => r.data.data ?? []),
    staleTime: 60_000,
  });
  const batches: any[] = data ?? [];

  const onBatchChangeRef = useRef(onBatchChange);
  onBatchChangeRef.current = onBatchChange;

  useEffect(() => {
    if (batches.length > 0 && !item.batch_id) {
      const first = batches[0];
      onBatchChangeRef.current(item.drug_id, first.id, first.batch_number ?? '—', first.expiry_date ?? '');
    }
  }, [batches, item.batch_id, item.drug_id]);

  if (!batches.length) return <span className="text-[10px] text-gray-400 italic">No batch info</span>;

  return (
    <select
      className="input text-[10px] py-0 px-1.5 h-6 flex-1"
      value={item.batch_id ?? ''}
      onChange={(e) => {
        const b = batches.find((b: any) => b.id === e.target.value);
        if (b) onBatchChange(item.drug_id, b.id, b.batch_number ?? '—', b.expiry_date ?? '');
      }}
    >
      {batches.map((b: any) => (
        <option key={b.id} value={b.id}>
          {b.batch_number ?? '—'} · exp {b.expiry_date} · {b.quantity_remaining} left
        </option>
      ))}
    </select>
  );
}

// ─── Add Drug Modal ────────────────────────────────────────────────────────────

function AddDrugModal({ onClose, clinics, defaultClinicId }: { onClose: () => void; clinics: { id: string; name: string }[]; defaultClinicId?: string }) {
  const qc = useQueryClient();
  const { success: notify } = useNotification();
  const [form, setForm] = useState({
    name: '', generic_name: '', brand_name: '', form: 'tablet',
    strength: '', unit: 'mg', category: '', manufacturer: '',
    clinic_id: defaultClinicId || (clinics[0]?.id ?? ''), selling_price: '',
    unit_cost: '', reorder_level: '10', reorder_quantity: '100',
    requires_prescription: true, is_controlled: false,
    storage_conditions: '', initial_quantity: '', initial_expiry_date: '',
  });
  const [error, setError] = useState('');

  const stockMutation = useMutation({
    mutationFn: ({ drugId, qty, expiry }: { drugId: string; qty: number; expiry: string }) =>
      api.post(`/inventory/drugs/${drugId}/stock`, { quantity: qty, expiry_date: expiry }),
  });

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/inventory/drugs', data),
    onSuccess: async (res: any, variables: any) => {
      const drugId = res.data?.data?.id;
      if (drugId && variables.initial_quantity > 0) {
        try {
          await stockMutation.mutateAsync({ drugId, qty: variables.initial_quantity, expiry: variables.initial_expiry_date });
        } catch {
          // stock add failed — drug still created
        }
      }
      qc.invalidateQueries({ queryKey: ['pharmacy-drugs'] });
      notify(`${variables.name} added to catalog successfully`);
      onClose();
    },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Failed to add drug'),
  });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">Add Drug to Catalog</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            const iqty = Number(form.initial_quantity) || 0;
            if (iqty > 0 && !form.initial_expiry_date) {
              setError('Expiry date is required when adding initial stock');
              return;
            }
            mutation.mutate({
              ...form,
              selling_price: Number(form.selling_price) || 0,
              unit_cost: Number(form.unit_cost) || 0,
              reorder_level: Number(form.reorder_level),
              reorder_quantity: Number(form.reorder_quantity),
              initial_quantity: iqty,
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
            <div>
              <label className="label">Opening Quantity</label>
              <input className="input" type="number" min={0} placeholder="0" value={form.initial_quantity} onChange={set('initial_quantity')} />
            </div>
            <div>
              <label className="label">
                Expiry Date{Number(form.initial_quantity) > 0 && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <input
                className="input"
                type="date"
                value={form.initial_expiry_date}
                onChange={set('initial_expiry_date')}
                required={Number(form.initial_quantity) > 0}
              />
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
  const [form, setForm] = useState({
    quantity: '', expiry_date: '', batch_number: '', unit_cost: '',
    supplier_name: '', sku_code: '', barcode: '', manufacturing_date: '',
  });
  const [error, setError] = useState('');

  const shelfLifeDays = form.manufacturing_date && form.expiry_date
    ? Math.max(0, Math.round(
        (new Date(form.expiry_date).getTime() - new Date(form.manufacturing_date).getTime()) / 86_400_000,
      ))
    : null;

  const mutation = useMutation({
    mutationFn: (data: any) => api.post(`/inventory/drugs/${drug.id}/stock`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pharmacy-drugs'] });
      qc.invalidateQueries({ queryKey: ['pharmacy-alerts'] });
      qc.invalidateQueries({ queryKey: ['pharmacy-alerts-count'] });
      onClose();
    },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Failed to add stock'),
  });

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, [f]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Receive Stock</h2>
            <p className="text-sm text-gray-500">{drug.name} · {drug.form} {drug.strength}{drug.category ? ` · ${drug.category}` : ''}</p>
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
              sku_code: form.sku_code || undefined,
              barcode: form.barcode || undefined,
              manufacturing_date: form.manufacturing_date || undefined,
            });
          }}
          className="p-5 space-y-5"
        >
          {/* Product Identification */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Product Identification</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Medicine</label>
                <input className="input bg-gray-50 text-gray-600" value={`${drug.name}${drug.generic_name ? ` (${drug.generic_name})` : ''}`} readOnly />
              </div>
              <div>
                <label className="label">SKU / Item Code</label>
                <input className="input" value={form.sku_code} onChange={set('sku_code')} placeholder="Internal SKU" />
              </div>
              <div>
                <label className="label">Barcode / UPC</label>
                <input className="input" value={form.barcode} onChange={set('barcode')} placeholder="Scan or type barcode" />
              </div>
              <div>
                <label className="label">Category</label>
                <input className="input bg-gray-50 text-gray-600" value={drug.category || '—'} readOnly />
              </div>
              <div>
                <label className="label">Supplier / Manufacturer</label>
                <input className="input" value={form.supplier_name} onChange={set('supplier_name')} placeholder="Company name" />
              </div>
            </div>
          </div>

          {/* Batch & Expiry */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Batch &amp; Expiry</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Batch / Lot Number</label>
                <input className="input" value={form.batch_number} onChange={set('batch_number')} placeholder="Auto-generated if blank" />
              </div>
              <div>
                <label className="label">Manufacturing Date</label>
                <input className="input" type="date" value={form.manufacturing_date} onChange={set('manufacturing_date')} />
              </div>
              <div>
                <label className="label">Expiry Date *</label>
                <input className="input" type="date" value={form.expiry_date} onChange={set('expiry_date')} required />
              </div>
              <div>
                <label className="label">Shelf Life</label>
                <input
                  className="input bg-gray-50 text-gray-600"
                  value={shelfLifeDays !== null ? `${shelfLifeDays} days` : 'Set mfg & expiry dates'}
                  readOnly
                />
              </div>
            </div>
          </div>

          {/* Quantity & Pricing */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Quantity &amp; Pricing</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Quantity *</label>
                <input className="input" type="number" min={1} value={form.quantity} onChange={set('quantity')} required />
              </div>
              <div>
                <label className="label">Unit Cost</label>
                <input className="input" type="number" min={0} step="0.01" value={form.unit_cost} onChange={set('unit_cost')} placeholder="0.00" />
              </div>
            </div>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
          <div className="flex gap-3 pt-1">
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pharmacy-drugs'] });
      qc.invalidateQueries({ queryKey: ['pharmacy-alerts'] });
      qc.invalidateQueries({ queryKey: ['pharmacy-alerts-count'] });
      onClose();
    },
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
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

// Fallback suppliers — replace with API data once /inventory/suppliers endpoint exists
const FALLBACK_SUPPLIERS: { name: string; contact: string }[] = [
  { name: 'MedLine Pharmaceuticals',   contact: '+92-21-3456-7890' },
  { name: 'PharmaCare Distributors',   contact: '+92-42-3512-6600' },
  { name: 'NovaMed Supplies',          contact: '+92-51-2871-4400' },
  { name: 'HealthBridge Logistics',    contact: '+92-21-3890-1122' },
  { name: 'CureMed Wholesale',         contact: '+92-41-8723-5500' },
];

interface POItem { drug_id: string; drug_name: string; quantity: number; unit_cost: number }

function PurchaseOrderModal({ onClose, clinics, drugs, defaultClinicId }: { onClose: () => void; clinics: { id: string; name: string }[]; drugs: Drug[]; defaultClinicId?: string }) {
  const qc = useQueryClient();
  const { success: notify } = useNotification();
  const [form, setForm] = useState({
    clinic_id: defaultClinicId || (clinics[0]?.id ?? ''),
    supplier_name: '', supplier_contact: '', expected_delivery_date: '', notes: '',
  });
  const [items, setItems] = useState<POItem[]>([]);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validate = (f = form, its = items) => {
    const errs: Record<string, string> = {};
    if (!f.supplier_name.trim())        errs.supplier_name        = 'Supplier name is required';
    if (!f.supplier_contact.trim())     errs.supplier_contact     = 'Supplier contact is required';
    if (!f.expected_delivery_date)      errs.expected_delivery_date = 'Expected delivery date is required';
    else if (f.expected_delivery_date < new Date().toISOString().slice(0, 10))
                                        errs.expected_delivery_date = 'Date must be today or in the future';
    if (its.length === 0)               errs.items                = 'Add at least one order item';
    else {
      its.forEach((item, idx) => {
        if (item.quantity < 1)   errs[`item_qty_${idx}`]  = 'Qty must be ≥ 1';
        if (item.unit_cost <= 0) errs[`item_cost_${idx}`] = 'Unit cost must be > 0';
      });
    }
    return errs;
  };

  const touch = (field: string) =>
    setTouched((t) => ({ ...t, [field]: true }));

  const err = (field: string) =>
    touched[field] ? fieldErrors[field] : undefined;

  // ── Supplier combobox state ──────────────────────────────────────────────────
  const [supplierQuery, setSupplierQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [supplierLocked, setSupplierLocked] = useState(false); // contact auto-filled from known supplier
  const supplierRef = useRef<HTMLDivElement>(null);

  const { data: posData } = useQuery({
    queryKey: ['pharmacy-pos-all'],
    queryFn: () => api.get('/inventory/purchase-orders', { params: { page: 1, page_size: 200 } }).then((r) => r.data),
  });

  // Build unique supplier map: name → contact (fallbacks first, real PO data overrides)
  const supplierMap = useMemo(() => {
    const map = new Map<string, string>();
    FALLBACK_SUPPLIERS.forEach((s) => map.set(s.name, s.contact));
    (posData?.data ?? []).forEach((po: any) => {
      if (po.supplier_name) map.set(po.supplier_name, po.supplier_contact ?? '');
    });
    return map;
  }, [posData]);

  const suggestions = useMemo(() => {
    if (!supplierQuery.trim()) return [];
    const q = supplierQuery.toLowerCase();
    return Array.from(supplierMap.keys()).filter((name) => name.toLowerCase().includes(q)).slice(0, 8);
  }, [supplierQuery, supplierMap]);

  const selectSupplier = (name: string) => {
    setSupplierQuery(name);
    const updated = { ...form, supplier_name: name, supplier_contact: supplierMap.get(name) ?? '' };
    setForm(updated);
    setFieldErrors(validate(updated, items));
    setSupplierLocked(true);
    setShowSuggestions(false);
  };

  const clearSupplier = () => {
    setSupplierQuery('');
    const updated = { ...form, supplier_name: '', supplier_contact: '' };
    setForm(updated);
    setFieldErrors(validate(updated, items));
    setSupplierLocked(false);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (supplierRef.current && !supplierRef.current.contains(e.target as Node))
        setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const addItem = () => {
    const drug = drugs[0];
    if (!drug) return;
    const next = [...items, { drug_id: drug.id, drug_name: drug.name, quantity: 1, unit_cost: drug.unit_cost }];
    setItems(next);
    setFieldErrors(validate(form, next));
  };

  const removeItem = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    setItems(next);
    setFieldErrors(validate(form, next));
  };

  const updateItem = (idx: number, field: keyof POItem, value: string | number) => {
    const next = items.map((item, i) => {
      if (i !== idx) return item;
      if (field === 'drug_id') {
        const d = drugs.find((dr) => dr.id === value);
        return { ...item, drug_id: String(value), drug_name: d?.name ?? '', unit_cost: d?.unit_cost ?? 0 };
      }
      return { ...item, [field]: Number(value) };
    });
    setItems(next);
    setFieldErrors(validate(form, next));
  };

  const total = items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/inventory/purchase-orders', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pharmacy-pos'] });
      qc.invalidateQueries({ queryKey: ['pharmacy-pos-all'] });
      notify(`Purchase order for ${form.supplier_name} submitted successfully`);
      onClose();
    },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Failed to create PO'),
  });

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const updated = { ...form, [f]: e.target.value };
    setForm(updated);
    setFieldErrors(validate(updated, items));
  };

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
            const errs = validate();
            setFieldErrors(errs);
            setTouched({ supplier_name: true, supplier_contact: true, expected_delivery_date: true, items: true,
              ...Object.fromEntries(items.flatMap((_, i) => [`item_qty_${i}`, `item_cost_${i}`].map((k) => [k, true]))) });
            if (Object.keys(errs).length) return;
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
            <div ref={supplierRef} className="relative">
              <label className="label">Supplier *</label>
              <div className="relative">
                <input
                  className={`input pr-7 ${err('supplier_name') ? 'border-red-400 focus:ring-red-400' : ''}`}
                  value={supplierQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSupplierQuery(val);
                    const updated = { ...form, supplier_name: val };
                    setForm(updated);
                    setSupplierLocked(false);
                    setShowSuggestions(true);
                    setFieldErrors(validate(updated, items));
                  }}
                  onFocus={() => { if (supplierQuery) setShowSuggestions(true); }}
                  onBlur={() => touch('supplier_name')}
                  placeholder="Search or enter supplier name"
                  autoComplete="off"
                />
                {supplierQuery && (
                  <button type="button" onClick={clearSupplier}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {suggestions.map((name) => (
                    <li key={name}
                      onMouseDown={() => selectSupplier(name)}
                      className="px-3 py-2 text-sm cursor-pointer hover:bg-primary-50 hover:text-primary-700 flex items-center justify-between gap-2">
                      <span>{name}</span>
                      {supplierMap.get(name) && (
                        <span className="text-xs text-gray-400">{supplierMap.get(name)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {err('supplier_name') && <p className="mt-1 text-xs text-red-500">{err('supplier_name')}</p>}
            </div>
            <div>
              <label className="label">
                Supplier Contact *
                {supplierLocked && <span className="ml-1 text-xs text-primary-600">(auto-filled)</span>}
              </label>
              <input
                className={`input ${supplierLocked ? 'bg-gray-50 text-gray-500' : ''} ${err('supplier_contact') ? 'border-red-400 focus:ring-red-400' : ''}`}
                value={form.supplier_contact}
                onChange={set('supplier_contact')}
                onBlur={() => touch('supplier_contact')}
                placeholder="Phone or email"
                readOnly={supplierLocked}
              />
              {err('supplier_contact') && <p className="mt-1 text-xs text-red-500">{err('supplier_contact')}</p>}
            </div>
            <div>
              <label className="label">Expected Delivery *</label>
              <input
                className={`input ${err('expected_delivery_date') ? 'border-red-400 focus:ring-red-400' : ''}`}
                type="date"
                value={form.expected_delivery_date}
                onChange={set('expected_delivery_date')}
                onBlur={() => touch('expected_delivery_date')}
                min={new Date().toISOString().slice(0, 10)}
              />
              {err('expected_delivery_date') && <p className="mt-1 text-xs text-red-500">{err('expected_delivery_date')}</p>}
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
              <div>
                <p className={`text-sm text-center py-4 border border-dashed rounded-lg ${err('items') ? 'border-red-300 text-red-400 bg-red-50' : 'border-gray-200 text-gray-400'}`}>
                  Click "Add Item" to add drugs to this order
                </p>
                {err('items') && <p className="mt-1 text-xs text-red-500">{err('items')}</p>}
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <select className="input text-xs" value={item.drug_id} onChange={(e) => updateItem(idx, 'drug_id', e.target.value)}>
                          {drugs.map((d) => <option key={d.id} value={d.id}>{d.name} {d.strength}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <input
                          className={`input text-xs ${err(`item_qty_${idx}`) ? 'border-red-400' : ''}`}
                          type="number" min={1} placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                          onBlur={() => touch(`item_qty_${idx}`)}
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          className={`input text-xs ${err(`item_cost_${idx}`) ? 'border-red-400' : ''}`}
                          type="number" min={0} step="0.01" placeholder="Unit cost"
                          value={item.unit_cost}
                          onChange={(e) => updateItem(idx, 'unit_cost', e.target.value)}
                          onBlur={() => touch(`item_cost_${idx}`)}
                        />
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
                    {(err(`item_qty_${idx}`) || err(`item_cost_${idx}`)) && (
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-5" />
                        <div className="col-span-2">
                          {err(`item_qty_${idx}`) && <p className="text-xs text-red-500">{err(`item_qty_${idx}`)}</p>}
                        </div>
                        <div className="col-span-2">
                          {err(`item_cost_${idx}`) && <p className="text-xs text-red-500">{err(`item_cost_${idx}`)}</p>}
                        </div>
                      </div>
                    )}
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

function SaleDetailModal({ saleId, onClose, clinicName }: { saleId: string; onClose: () => void; clinicName: string }) {
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Sale Receipt</h2>
            <p className="text-sm text-gray-500">{data.sale_number}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => printReceipt(data, clinicName)} className="btn-secondary flex items-center gap-1.5 text-sm py-1.5">
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

// ─── POS helpers ─────────────────────────────────────────────────────────────

const FORM_COLOR: Record<string, string> = {
  tablet:      'bg-blue-100 text-blue-700',
  capsule:     'bg-violet-100 text-violet-700',
  syrup:       'bg-emerald-100 text-emerald-700',
  injection:   'bg-red-100 text-red-700',
  cream:       'bg-pink-100 text-pink-700',
  gel:         'bg-fuchsia-100 text-fuchsia-700',
  drops:       'bg-cyan-100 text-cyan-700',
  inhaler:     'bg-sky-100 text-sky-700',
  patch:       'bg-orange-100 text-orange-700',
  suppository: 'bg-amber-100 text-amber-700',
  powder:      'bg-lime-100 text-lime-700',
};

// ─── POS Panel ────────────────────────────────────────────────────────────────

function POSPanel({ clinicId, clinicName }: { clinicId: string; clinicName: string }) {
  const fmt = useCurrency();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const debouncedPatientSearch = useDebounce(patientSearch, 350);
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; name: string } | null>(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const patientRef = useRef<HTMLDivElement>(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discountAmount, setDiscountAmount] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [error, setError] = useState('');
  const [selectedPrescription, setSelectedPrescription] = useState<{ id: string; rx_number: string; doctor_name?: string } | null>(null);
  const [isPartialDispense, setIsPartialDispense] = useState(false);

  const { data: drugsData, isLoading, isFetching, isError: drugsError, error: drugsErrorObj } = useQuery({
    queryKey: ['pharmacy-pos-drugs', debouncedSearch, clinicId],
    queryFn: () =>
      api.get('/inventory/drugs', { params: { q: debouncedSearch || undefined, page_size: 50, ...(clinicId ? { clinic_id: clinicId } : {}) } })
        .then((r) => r.data.data ?? []),
    enabled: !!clinicId,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const drugs: Drug[] = drugsData ?? [];
  const posErrorMsg = drugsError ? ((drugsErrorObj as any)?.response?.data?.detail ?? (drugsErrorObj as any)?.message ?? 'Failed to load drugs') : null;

  const { data: patientSearchData, isFetching: searchingPatients } = useQuery({
    queryKey: ['pharmacy-patient-search', debouncedPatientSearch],
    queryFn: () =>
      api.get('/patients/', { params: { q: debouncedPatientSearch, page_size: 10 } })
        .then((r) => {
          const raw = r.data.data;
          return Array.isArray(raw) ? raw : raw?.patients ?? [];
        }),
    enabled: debouncedPatientSearch.trim().length >= 2 && !selectedPatient,
    staleTime: 30_000,
  });
  const patientList: any[] = patientSearchData ?? [];

  const { data: patientDetail } = useQuery({
    queryKey: ['patient-detail-pharmacy', selectedPatient?.id],
    queryFn: () => api.get(`/patients/${selectedPatient!.id}`).then((r) => r.data.data),
    enabled: !!selectedPatient?.id,
    staleTime: 300_000,
  });
  const patientAllergies = useMemo<string[]>(() => {
    if (!patientDetail) return [];
    const raw = patientDetail.allergies ?? patientDetail.medical_history?.allergies ?? [];
    return raw.map((a: any) => (typeof a === 'string' ? a : (a.allergen ?? a.name ?? '')).toLowerCase()).filter(Boolean);
  }, [patientDetail]);

  const { data: prescriptionsData } = useQuery({
    queryKey: ['patient-prescriptions', selectedPatient?.id],
    queryFn: () =>
      api.get('/prescriptions/', { params: { patient_id: selectedPatient!.id, status: 'active', page_size: 20 } })
        .then((r) => r.data.data ?? []),
    enabled: !!selectedPatient?.id,
    staleTime: 60_000,
  });
  const prescriptions: any[] = prescriptionsData ?? [];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (patientRef.current && !patientRef.current.contains(e.target as Node)) {
        setShowPatientDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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
          sig: '',
          requires_prescription: drug.requires_prescription,
          is_controlled: drug.is_controlled,
          generic_name: drug.generic_name,
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

  const updateCartSig = useCallback((drug_id: string, sig: string) => {
    setCart((prev) => prev.map((i) => (i.drug_id !== drug_id ? i : { ...i, sig })));
  }, []);

  const updateCartBatch = useCallback((drug_id: string, batch_id: string, batch_number: string, batch_expiry: string) => {
    setCart((prev) => prev.map((i) => (i.drug_id !== drug_id ? i : { ...i, batch_id, batch_number, batch_expiry })));
  }, []);

  const allergyWarnings = useMemo(
    () =>
      cart.filter((item) => {
        if (!patientAllergies.length) return false;
        const drugText = `${item.drug_name} ${item.generic_name ?? ''}`.toLowerCase();
        return patientAllergies.some((a) => a.length > 2 && drugText.includes(a));
      }),
    [cart, patientAllergies],
  );

  const subtotal = cart.reduce((s, i) => s + i.line_total, 0);
  const discPct = Math.min(100, Math.max(0, parseFloat(discountAmount) || 0));
  const disc = subtotal * discPct / 100;
  const tax = parseFloat(taxAmount) || 0;
  const total = Math.max(0, subtotal - disc + tax);
  const paid = parseFloat(paidAmount) || total;
  const change = paymentMethod === 'cash' ? Math.max(0, paid - total) : 0;

  const saleMutation = useMutation({
    mutationFn: (data: any) => api.post('/inventory/sales', data),
    onSuccess: (res) => {
      setCompletedSale(res.data.data);
      setCart([]);
      setSelectedPatient(null);
      setPatientSearch('');
      setShowPatientDropdown(false);
      setSelectedPrescription(null);
      setIsPartialDispense(false);
      setDiscountAmount('');
      setTaxAmount('');
      setPaidAmount('');
      setNotes('');
      setError('');
      qc.invalidateQueries({ queryKey: ['pharmacy-drugs'] });
      qc.invalidateQueries({ queryKey: ['pharmacy-pos-drugs'] });
      qc.invalidateQueries({ queryKey: ['pharmacy-sales'] });
      qc.invalidateQueries({ queryKey: ['pharmacy-analytics'] });
      qc.invalidateQueries({ queryKey: ['pharmacy-alerts'] });
      qc.invalidateQueries({ queryKey: ['pharmacy-alerts-count'] });
    },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Sale failed'),
  });

  const processSale = () => {
    if (!cart.length) return;
    if (paymentMethod === 'cash' && paid < total) {
      setError('Cash paid is less than total amount');
      return;
    }
    const rxUnlinked = cart.filter((i) => i.requires_prescription && !selectedPrescription);
    if (rxUnlinked.length) {
      const names = rxUnlinked.map((i) => i.drug_name).join(', ');
      if (!window.confirm(`${names} require(s) a prescription. Proceed without linking one?`)) return;
    }
    setError('');
    saleMutation.mutate({
      clinic_id: clinicId,
      items: cart.map((i) => ({
        drug_item_id: i.drug_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount_percent: i.discount_percent,
        sig_instructions: i.sig || undefined,
        batch_id: i.batch_id || undefined,
      })),
      patient_id: selectedPatient?.id || (patientSearch.trim() ? patientSearch.trim() : undefined),
      patient_name: selectedPatient?.name || undefined,
      prescription_id: selectedPrescription?.id || undefined,
      prescription_number: selectedPrescription?.rx_number || undefined,
      payment_method: paymentMethod,
      paid_amount: paymentMethod === 'cash' ? paid : total,
      discount_percent: discPct || undefined,
      discount_amount: disc,
      tax_amount: tax,
      notes: notes || undefined,
      is_partial: isPartialDispense || undefined,
    });
  };

  return (
    <div className="flex h-[calc(100vh-170px)] min-h-[580px] rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-white">

      {/* ── LEFT: Drug catalog ─────────────────────────────────────────── */}
      <div className="flex flex-col w-[55%] border-r border-gray-100">

        {/* Search bar */}
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              className="input pl-9 pr-9 bg-white"
              placeholder="Search drugs by name, generic or category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {isFetching && !isLoading && (
              <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" />
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5 px-0.5">
            {drugs.length > 0 ? `${drugs.length} drug${drugs.length !== 1 ? 's' : ''} available` : ''}
          </p>
        </div>

        {/* Drug list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
              <RefreshCw className="w-6 h-6 text-gray-300 animate-spin" />
              <p className="text-sm text-gray-400">Loading drugs…</p>
            </div>
          ) : posErrorMsg ? (
            <div className="flex flex-col items-center gap-2 py-16 text-red-500">
              <AlertCircle className="w-8 h-8 opacity-60" />
              <span className="text-sm font-medium px-4 text-center">{posErrorMsg}</span>
            </div>
          ) : drugs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 px-4 py-16">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                <Package className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-400">No drugs found</p>
              <p className="text-xs text-gray-300 text-center">Add drugs in the Inventory tab first</p>
            </div>
          ) : (
            drugs.map((drug) => {
              const inCart = cart.find((c) => c.drug_id === drug.id);
              const isOut = drug.total_stock === 0;
              const formColor = FORM_COLOR[drug.form?.toLowerCase()] ?? 'bg-gray-100 text-gray-600';
              return (
                <button
                  key={drug.id}
                  onClick={() => addToCart(drug)}
                  disabled={isOut}
                  className={`group w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    isOut
                      ? 'opacity-40 cursor-not-allowed bg-gray-50 border-gray-100'
                      : inCart
                      ? 'bg-primary-50 border-primary-200 shadow-sm'
                      : 'bg-white border-gray-100 hover:border-primary-200 hover:bg-primary-50/40 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md capitalize ${formColor}`}>
                          {drug.form}
                        </span>
                        {drug.requires_prescription && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md">
                            <FileText className="w-2.5 h-2.5" /> Rx
                          </span>
                        )}
                        {drug.is_controlled && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-md">
                            <ShieldAlert className="w-2.5 h-2.5" /> CD
                          </span>
                        )}
                      </div>
                      <p className={`font-semibold text-sm leading-snug ${inCart ? 'text-primary-900' : 'text-gray-900'}`}>
                        {drug.name}{' '}
                        <span className="font-normal text-gray-400 text-xs">{drug.strength}{drug.unit}</span>
                      </p>
                      {drug.generic_name && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">{drug.generic_name}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <p className={`font-bold text-sm ${inCart ? 'text-primary-700' : 'text-gray-900'}`}>
                        {fmt(drug.selling_price)}
                      </p>
                      <div className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${isOut ? 'bg-red-400' : drug.is_low_stock ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                        <p className={`text-[11px] ${isOut ? 'text-red-500' : drug.is_low_stock ? 'text-amber-600' : 'text-gray-400'}`}>
                          {drug.total_stock} left
                        </p>
                      </div>
                      {inCart && (
                        <span className="text-[11px] font-bold bg-primary-600 text-white px-2 py-0.5 rounded-full">
                          ✓ {inCart.quantity} in cart
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── RIGHT: Cart ────────────────────────────────────────────────── */}
      <div className="w-[45%] flex flex-col bg-white">

        {/* Cart header */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary-600 rounded-xl flex items-center justify-center shadow-sm">
              <ShoppingCart className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 leading-tight">Cart</h3>
              <p className="text-[11px] text-gray-400">{cart.length === 0 ? 'Empty' : `${cart.length} item${cart.length !== 1 ? 's' : ''}`}</p>
            </div>
          </div>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="text-xs text-gray-400 hover:text-red-500 transition-colors font-medium">
              Clear
            </button>
          )}
        </div>

        {/* Alerts */}
        {(allergyWarnings.length > 0 || cart.length >= 2) && (
          <div className="px-4 pt-3 space-y-1.5">
            {allergyWarnings.length > 0 && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-800">
                <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-500" />
                <span><strong>Allergy alert:</strong> {allergyWarnings.map((i) => i.drug_name).join(', ')} may conflict.</span>
              </div>
            )}
            {cart.length >= 2 && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                <span>Multiple drugs — verify interactions before dispensing.</span>
              </div>
            )}
          </div>
        )}

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center">
                <ShoppingCart className="w-7 h-7 text-gray-200" />
              </div>
              <p className="text-sm font-medium text-gray-400">Cart is empty</p>
              <p className="text-xs text-gray-300">Click a drug on the left to add it</p>
            </div>
          ) : (
            cart.map((item) => {
              const hasAllergyWarn = allergyWarnings.some((w) => w.drug_id === item.drug_id);
              return (
                <div
                  key={item.drug_id}
                  className={`rounded-xl border p-3 space-y-2 ${hasAllergyWarn ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}
                >
                  {/* Name row */}
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <p className={`font-semibold text-sm truncate ${hasAllergyWarn ? 'text-red-700' : 'text-gray-900'}`}>{item.drug_name}</p>
                        {item.requires_prescription && <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1 py-0.5 rounded">Rx</span>}
                        {item.is_controlled && <span className="text-[9px] font-bold bg-purple-100 text-purple-700 px-1 py-0.5 rounded">CD</span>}
                        {hasAllergyWarn && <ShieldAlert className="w-3 h-3 text-red-500 shrink-0" />}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{fmt(item.unit_price)} × {item.quantity} = <span className="font-semibold text-gray-700">{fmt(item.line_total)}</span></p>
                    </div>
                    <button onClick={() => removeFromCart(item.drug_id)} className="text-gray-300 hover:text-red-500 transition-colors shrink-0 mt-0.5">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {/* Controls row */}
                  <div className="flex items-center gap-2">
                    {/* Qty stepper */}
                    <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden shrink-0">
                      <button onClick={() => updateCartQty(item.drug_id, -1)}
                        className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-primary-600 hover:bg-primary-50 transition-colors">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-gray-800">{item.quantity}</span>
                      <button onClick={() => updateCartQty(item.drug_id, 1)}
                        disabled={item.quantity >= item.available_stock}
                        className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-primary-600 hover:bg-primary-50 transition-colors disabled:opacity-30">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    {/* Discount */}
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      <span className="text-[10px] text-gray-400 shrink-0">Disc%</span>
                      <input
                        type="number" min={0} max={100} step={0.5}
                        value={item.discount_percent}
                        onChange={(e) => updateCartDiscount(item.drug_id, parseFloat(e.target.value) || 0)}
                        className="w-14 text-center text-xs border border-gray-200 rounded-lg py-1 bg-white focus:outline-none focus:border-primary-400"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  {/* Sig + Batch */}
                  <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                    <SigSelector form={item.form} value={item.sig} onChange={(sig) => updateCartSig(item.drug_id, sig)} />
                    <div className="flex items-center gap-1 shrink-0 max-w-[140px]">
                      <span className="text-[10px] text-gray-300 shrink-0">Batch</span>
                      <CartBatchRow item={item} clinicId={clinicId} onBatchChange={updateCartBatch} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Checkout footer ─────────────────────────────────────────── */}
        <div className="border-t border-gray-100 px-4 py-2.5 space-y-2 bg-gray-50/40">

          {/* Patient search */}
          <div className="relative" ref={patientRef}>
            {selectedPatient ? (
              <div className="flex items-center gap-3 bg-primary-50 border border-primary-200 rounded-xl px-3 py-2">
                <div className="w-8 h-8 rounded-full bg-primary-200 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary-700">{selectedPatient.name[0]?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-primary-900 truncate">{selectedPatient.name}</p>
                  <p className="text-[10px] text-primary-500">Patient ID: {selectedPatient.id.slice(0, 8)}…</p>
                </div>
                <button onClick={() => { setSelectedPatient(null); setPatientSearch(''); }}
                  className="text-primary-300 hover:text-red-500 transition-colors shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  className="input pl-9 text-sm py-2"
                  placeholder="Search patient (optional — walk-in if blank)"
                  value={patientSearch}
                  onChange={(e) => { setPatientSearch(e.target.value); setShowPatientDropdown(true); }}
                  onFocus={() => { if (patientSearch.length >= 2) setShowPatientDropdown(true); }}
                />
                {searchingPatients && <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" />}
                {showPatientDropdown && patientSearch.trim().length >= 2 && (
                  <div className="absolute left-0 right-0 bottom-full mb-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-44 overflow-y-auto">
                    {searchingPatients ? (
                      <div className="px-4 py-3 text-sm text-gray-400">Searching…</div>
                    ) : patientList.length > 0 ? (
                      patientList.map((p: any) => (
                        <button key={p.id} type="button"
                          onMouseDown={() => {
                            setSelectedPatient({ id: p.id, name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() });
                            setPatientSearch(''); setShowPatientDropdown(false);
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-primary-50 border-b border-gray-50 last:border-0 transition-colors">
                          <p className="text-sm font-medium text-gray-900">{p.first_name} {p.last_name}</p>
                          <p className="text-xs text-gray-400">{p.patient_id || p.id?.slice(0, 8)}</p>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-gray-400 italic">No patient found — will be saved as walk-in</div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Prescription */}
          {selectedPatient && prescriptions.length > 0 && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5">
              <FileText className="w-3 h-3 text-blue-500 shrink-0" />
              <select className="flex-1 text-xs bg-transparent border-0 text-blue-900 focus:outline-none"
                value={selectedPrescription?.id ?? ''}
                onChange={(e) => {
                  const rx = prescriptions.find((p: any) => p.id === e.target.value);
                  setSelectedPrescription(rx ? { id: rx.id, rx_number: rx.prescription_number ?? rx.id.slice(0, 8), doctor_name: rx.doctor_name } : null);
                }}>
                <option value="">— No linked prescription —</option>
                {prescriptions.map((rx: any) => (
                  <option key={rx.id} value={rx.id}>
                    Rx #{rx.prescription_number ?? rx.id.slice(0, 8)}{rx.doctor_name ? ` · Dr. ${rx.doctor_name}` : ''} · {new Date(rx.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Totals — discount & tax inline with subtotal row */}
          <div className="bg-white border border-gray-100 rounded-xl px-3 py-2.5 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-400 shrink-0">Subtotal</span>
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-[10px] text-gray-300">Disc%</span>
                <input type="number" min={0} max={100} step={0.5} placeholder="0"
                  value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)}
                  className="w-10 text-[11px] text-center border border-gray-200 rounded-md py-0.5 focus:outline-none focus:border-primary-400 bg-white" />
                <span className="text-[10px] text-gray-300">Tax</span>
                <input type="number" min={0} step={0.01} placeholder="0"
                  value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)}
                  className="w-12 text-[11px] text-center border border-gray-200 rounded-md py-0.5 focus:outline-none focus:border-primary-400 bg-white" />
                <span className="text-xs text-gray-500 w-14 text-right">{fmt(subtotal)}</span>
              </div>
            </div>
            {discPct > 0 && <div className="flex justify-between text-xs text-emerald-600"><span>Discount ({discPct}%)</span><span>−{fmt(disc)}</span></div>}
            {tax > 0 && <div className="flex justify-between text-xs text-gray-400"><span>Tax</span><span>{fmt(tax)}</span></div>}
            <div className="flex justify-between items-baseline pt-1.5 border-t border-gray-100">
              <span className="font-bold text-gray-800 text-sm">Total</span>
              <span className="font-bold text-xl text-gray-900">{fmt(total)}</span>
            </div>
          </div>

          {/* Payment method + cash paid on same row */}
          <div className="flex items-center gap-1.5">
            {PAYMENT_METHODS.map((m) => (
              <button key={m.value} type="button" onClick={() => setPaymentMethod(m.value)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  paymentMethod === m.value
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'border-gray-200 text-gray-500 bg-white hover:border-primary-300 hover:text-primary-600'
                }`}>
                {m.label}
              </button>
            ))}
          </div>

          {paymentMethod === 'cash' && (
            <div className="flex items-center gap-2">
              <input className="input text-sm py-1.5 flex-1" type="number" min={total} step={0.01}
                placeholder={`Cash paid (${total.toFixed(2)})`}
                value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
              {change > 0 && (
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-gray-400">Change</p>
                  <p className="text-base font-bold text-emerald-600">{fmt(change)}</p>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 px-2.5 py-1.5 rounded-lg">
              <AlertCircle className="w-3 h-3 shrink-0" /> {error}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer select-none flex-1">
              <input type="checkbox" checked={isPartialDispense} onChange={(e) => setIsPartialDispense(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              <span className="text-xs text-gray-400">Partial dispense</span>
            </label>
          </div>

          <button
            onClick={processSale}
            disabled={cart.length === 0 || saleMutation.isPending}
            className="w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all
              bg-primary-600 text-white hover:bg-primary-700 shadow-sm hover:shadow-md
              disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {saleMutation.isPending ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Processing…</>
            ) : (
              <><CheckCircle className="w-5 h-5" />{isPartialDispense ? 'Partial Dispense' : 'Process Sale'} · {fmt(total)}</>
            )}
          </button>
        </div>
      </div>

      {/* ── Sale success modal ────────────────────────────────────────── */}
      {completedSale && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Green header */}
            <div className="bg-gradient-to-br from-emerald-500 to-green-600 px-6 pt-8 pb-6 text-center relative">
              <button onClick={() => setCompletedSale(null)}
                className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-9 h-9 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">Sale Complete!</h2>
              <p className="text-emerald-100 text-sm mt-1">Receipt #{completedSale.sale_number}</p>
            </div>

            {/* Sale details */}
            <div className="p-5 space-y-2 text-sm">
              {[
                { label: 'Total', value: fmt(completedSale.total_amount), bold: true },
                { label: 'Paid', value: fmt(completedSale.paid_amount) },
                ...(completedSale.change_amount > 0 ? [{ label: 'Change', value: fmt(completedSale.change_amount), green: true }] : []),
                { label: 'Payment Method', value: completedSale.payment_method, capitalize: true },
                ...(completedSale.patient_name ? [{ label: 'Patient', value: completedSale.patient_name }] : []),
              ].map((row: any) => (
                <div key={row.label} className="flex justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-gray-500">{row.label}</span>
                  <span className={`${row.bold ? 'font-bold text-gray-900' : ''} ${row.green ? 'font-semibold text-emerald-600' : ''} ${row.capitalize ? 'capitalize' : ''}`}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => printReceipt(completedSale, clinicName)}
                className="flex-1 btn-secondary flex items-center justify-center gap-2 py-2.5">
                <Printer className="w-4 h-4" /> Print Receipt
              </button>
              <button onClick={() => setCompletedSale(null)} className="flex-1 btn-primary py-2.5 font-semibold">
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

function InventoryTab({ clinics, clinicId, alertsMap }: { clinics: { id: string; name: string }[]; clinicId: string; alertsMap: Record<string, any> }) {
  const fmt = useCurrency();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [addDrugOpen, setAddDrugOpen] = useState(false);
  const [stockDrug, setStockDrug] = useState<Drug | null>(null);
  const [adjustDrug, setAdjustDrug] = useState<Drug | null>(null);
  const limit = 25;
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['pharmacy-drugs', debouncedSearch, page, clinicId],
    queryFn: () =>
      api.get('/inventory/drugs', { params: { q: debouncedSearch || undefined, page: page + 1, page_size: limit, ...(clinicId ? { clinic_id: clinicId } : {}) } })
        .then((r) => r.data),
    enabled: !!clinicId,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const drugs: Drug[] = data?.data ?? [];
  const meta = data?.meta ?? {};
  const errorMsg = isError ? ((error as any)?.response?.data?.detail ?? (error as any)?.message ?? 'Failed to load inventory') : null;

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
              <th className="text-left px-4 py-3 font-medium text-gray-600 w-36">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : errorMsg ? (
              <tr><td colSpan={8} className="text-center py-12">
                <div className="flex flex-col items-center gap-2 text-red-600">
                  <AlertCircle className="w-6 h-6" />
                  <span className="text-sm font-medium">{errorMsg}</span>
                </div>
              </td></tr>
            ) : drugs.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">No drugs found. Use "Add Drug" to add your first drug.</td></tr>
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
                      <div className="flex flex-col gap-1">
                        {isOut ? <span className="badge-red">Out of Stock</span> : isLow ? <span className="badge-yellow">Low Stock</span> : <span className="badge-green">In Stock</span>}
                        {alertsMap[drug.id]?.expired_qty > 0 && (
                          <span className="badge-red text-xs flex items-center gap-0.5">
                            <AlertCircle className="w-3 h-3" /> {alertsMap[drug.id].expired_qty} expired
                          </span>
                        )}
                        {alertsMap[drug.id]?.expiring_soon_qty > 0 && (
                          <span className="badge-yellow text-xs flex items-center gap-0.5">
                            <AlertTriangle className="w-3 h-3" /> {alertsMap[drug.id].expiring_soon_qty} expiring
                          </span>
                        )}
                      </div>
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

      {addDrugOpen && <AddDrugModal onClose={() => setAddDrugOpen(false)} clinics={clinics} defaultClinicId={clinicId} />}
      {stockDrug && <AddStockModal drug={stockDrug} onClose={() => setStockDrug(null)} />}
      {adjustDrug && <AdjustmentModal drug={adjustDrug} onClose={() => setAdjustDrug(null)} />}
    </>
  );
}

// ─── Purchase Orders Tab ──────────────────────────────────────────────────────

function PurchaseOrdersTab({ clinics, clinicId, drugs }: { clinics: { id: string; name: string }[]; clinicId: string; drugs: Drug[] }) {
  const fmt = useCurrency();
  const [page, setPage] = useState(0);
  const [poOpen, setPoOpen] = useState(false);
  const [receiveItem, setReceiveItem] = useState<any>(null);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['pharmacy-pos', page, clinicId],
    queryFn: () =>
      api.get('/inventory/purchase-orders', { params: { page: page + 1, page_size: limit, ...(clinicId ? { clinic_id: clinicId } : {}) } })
        .then((r) => r.data),
    enabled: !!clinicId,
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

      {poOpen && <PurchaseOrderModal onClose={() => setPoOpen(false)} clinics={clinics} drugs={drugs} defaultClinicId={clinicId} />}
      {receiveItem && poDetail && <ReceivePOModal po={poDetail} onClose={() => setReceiveItem(null)} />}
    </>
  );
}

// ─── Sales History Tab ────────────────────────────────────────────────────────

function SalesTab({ clinicId, clinicName }: { clinicId: string; clinicName: string }) {
  const fmt = useCurrency();
  const [page, setPage] = useState(0);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedSale, setSelectedSale] = useState<string | null>(null);
  const limit = 25;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['pharmacy-sales', page, dateFrom, dateTo, clinicId],
    queryFn: () =>
      api.get('/inventory/sales', {
        params: {
          page: page + 1, page_size: limit,
          ...(dateFrom ? { date_from: dateFrom } : {}),
          ...(dateTo ? { date_to: dateTo } : {}),
          ...(clinicId ? { clinic_id: clinicId } : {}),
        },
      }).then((r) => r.data),
    enabled: !!clinicId,
    retry: 1,
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
            ) : isError ? (
              <tr><td colSpan={7} className="text-center py-12 text-red-500 text-sm">
                Failed to load sales: {(error as any)?.response?.data?.detail ?? (error as any)?.message ?? 'Unknown error'}
              </td></tr>
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

      {selectedSale && <SaleDetailModal saleId={selectedSale} onClose={() => setSelectedSale(null)} clinicName={clinicName} />}
    </>
  );
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────

const CHART_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6',
];

function ReportsTab({ clinicId }: { clinicId: string }) {
  const fmt = useCurrency();

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['pharmacy-analytics', clinicId],
    queryFn: () => api.get('/inventory/reports/analytics', { params: clinicId ? { clinic_id: clinicId } : {} }).then((r) => r.data.data),
    enabled: !!clinicId,
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

// ─── Expiry Tab ───────────────────────────────────────────────────────────────

interface ExpiryBatch {
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

const EXPIRY_FILTERS = [
  { value: 'expired', label: 'Expired' },
  { value: 'expiring', label: 'Expiring Soon (≤60d)' },
  { value: '', label: 'All Batches' },
] as const;

function ExpiryTab({ clinicId }: { clinicId: string }) {
  const fmt = useCurrency();
  const [statusFilter, setStatusFilter] = useState('expired');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const limit = 50;
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['pharmacy-all-batches', clinicId, statusFilter, debouncedSearch, page],
    queryFn: () =>
      api.get('/inventory/batches', {
        params: {
          clinic_id: clinicId || undefined,
          status: statusFilter || undefined,
          q: debouncedSearch || undefined,
          page: page + 1,
          page_size: limit,
        },
      }).then((r) => r.data),
    enabled: !!clinicId,
    staleTime: 60_000,
  });

  const batches: ExpiryBatch[] = data?.data ?? [];
  const meta = data?.meta ?? {};

  const rowBg = (status: ExpiryBatch['status']) => {
    switch (status) {
      case 'expired': return 'bg-red-50 hover:bg-red-100';
      case 'expiring_soon': return 'bg-amber-50 hover:bg-amber-100';
      case 'depleted': return 'bg-gray-50 hover:bg-gray-100';
      default: return 'hover:bg-gray-50';
    }
  };

  const statusBadge = (status: ExpiryBatch['status']) => {
    switch (status) {
      case 'expired': return <span className="badge-red">Expired</span>;
      case 'expiring_soon': return <span className="badge-yellow">Expiring Soon</span>;
      case 'depleted': return <span className="badge text-gray-500">Depleted</span>;
      case 'active': return <span className="badge-green">Active</span>;
    }
  };

  const daysCell = (days: number) => {
    if (days < 0) return <span className="font-semibold text-red-600">{Math.abs(days)}d ago</span>;
    if (days <= 30) return <span className="font-semibold text-amber-600">{days}d left</span>;
    if (days <= 60) return <span className="font-medium text-amber-500">{days}d left</span>;
    return <span className="text-gray-600">{days}d left</span>;
  };

  const expiredCount = statusFilter === 'expired' ? (meta.total ?? 0) : undefined;

  return (
    <div className="space-y-4">
      {/* Header summary */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-800">Expiry Tracking</h3>
          <p className="text-sm text-gray-500 mt-0.5">Monitor batch expiry across all drugs · FEFO dispensing active</p>
        </div>
        {expiredCount !== undefined && expiredCount > 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {expiredCount} expired {expiredCount === 1 ? 'batch' : 'batches'} — remove from shelf
          </div>
        )}
      </div>

      {/* Filter tabs + search */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 border-b border-gray-200 flex-1">
          {EXPIRY_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(0); }}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                statusFilter === f.value
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9 w-64"
            placeholder="Search drug or batch…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Drug</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Form / Strength</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Batch #</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Received</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Mfg Date</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Expiry Date</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Days Left</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Qty In</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Used</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Remaining</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Supplier</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Unit Cost</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={14} className="text-center py-12 text-gray-400">Loading batches…</td></tr>
            ) : batches.length === 0 ? (
              <tr>
                <td colSpan={14} className="text-center py-16">
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">No batches found</p>
                  <p className="text-sm text-gray-400 mt-1">
                    {statusFilter === 'expired' ? 'No expired stock — well managed!' : 'No results for this filter'}
                  </p>
                </td>
              </tr>
            ) : (
              batches.map((b) => (
                <tr key={b.id} className={rowBg(b.status)}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 whitespace-nowrap">{b.drug_name}</p>
                    <p className="text-xs text-gray-400">{b.generic_name}</p>
                    {b.is_controlled && <span className="text-xs text-purple-600 font-medium">Controlled</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{b.form} · {b.strength}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs capitalize">{b.category}</td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-800 whitespace-nowrap">{b.batch_number}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{b.received_date}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{b.manufacture_date ?? '—'}</td>
                  <td className={`px-4 py-3 font-medium whitespace-nowrap ${
                    b.status === 'expired' ? 'text-red-700' :
                    b.status === 'expiring_soon' ? 'text-amber-700' : 'text-gray-800'
                  }`}>
                    {b.expiry_date}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{daysCell(b.days_to_expiry)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{b.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{b.quantity_used}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${
                    b.quantity_remaining === 0 ? 'text-gray-400' :
                    b.status === 'expired' ? 'text-red-700' : 'text-gray-900'
                  }`}>
                    {b.quantity_remaining}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[120px] truncate">{b.supplier_name ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">{fmt(b.unit_cost)}</td>
                  <td className="px-4 py-3">{statusBadge(b.status)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {(meta.total ?? 0) > limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 text-sm text-gray-600">
            <span>Showing {page * limit + 1}–{Math.min((page + 1) * limit, meta.total)} of {meta.total} batches</span>
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
    </div>
  );
}

// ─── Alerts Tab ───────────────────────────────────────────────────────────────

function AlertsTab({ clinicId }: { clinicId: string }) {
  const [stockDrug, setStockDrug] = useState<Drug | null>(null);

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['pharmacy-alerts', clinicId],
    queryFn: () => api.get('/inventory/stock-alerts', { params: clinicId ? { clinic_id: clinicId } : {} }).then((r) => r.data.data ?? []),
    enabled: !!clinicId,
    refetchInterval: 300_000,
  });

  const openAddStock = (alert: any) => {
    setStockDrug({
      id: alert.drug_id,
      name: alert.drug_name,
      generic_name: alert.generic_name ?? '',
      brand_name: alert.brand_name ?? '',
      form: alert.form,
      strength: alert.strength,
      unit: alert.unit ?? '',
      category: alert.category ?? '',
      selling_price: alert.selling_price ?? 0,
      unit_cost: alert.unit_cost ?? 0,
      requires_prescription: false,
      is_controlled: false,
      total_stock: alert.current_stock,
      reorder_level: alert.reorder_level,
      is_low_stock: true,
      is_active: true,
      clinic_id: alert.clinic_id ?? '',
    });
  };

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
              <div className="flex flex-col gap-2 items-end shrink-0 ml-4">
                {alert.expired_qty > 0 && <span className="badge-red flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Expired Stock</span>}
                {alert.expiring_soon_qty > 0 && <span className="badge-yellow flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Expiring Soon</span>}
                {alert.is_low_stock && (
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="badge-blue flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Low Stock</span>
                    <button
                      onClick={() => openAddStock(alert)}
                      className="flex items-center gap-1 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Add Stock
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))
      )}
      {stockDrug && <AddStockModal drug={stockDrug} onClose={() => setStockDrug(null)} />}
    </div>
  );
}

// ─── Overview Panel ───────────────────────────────────────────────────────────

const OVERVIEW_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

function OverviewPanel({ clinicId, onNavigate }: { clinicId: string; onNavigate: (tab: Tab) => void }) {
  const fmt = useCurrency();

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['pharmacy-analytics', clinicId],
    queryFn: () =>
      api.get('/inventory/reports/analytics', { params: clinicId ? { clinic_id: clinicId } : {} })
        .then((r) => r.data.data),
    enabled: !!clinicId,
    staleTime: 60_000,
  });

  const { data: recentSalesData } = useQuery({
    queryKey: ['pharmacy-sales-recent', clinicId],
    queryFn: () =>
      api.get('/inventory/sales', { params: { page: 1, page_size: 6, ...(clinicId ? { clinic_id: clinicId } : {}) } })
        .then((r) => r.data),
    enabled: !!clinicId,
    staleTime: 30_000,
  });
  const recentSales: SaleRecord[] = recentSalesData?.data ?? [];

  const { data: alertsData } = useQuery({
    queryKey: ['pharmacy-alerts', clinicId],
    queryFn: () =>
      api.get('/inventory/stock-alerts', { params: clinicId ? { clinic_id: clinicId } : {} })
        .then((r) => r.data.data ?? []),
    enabled: !!clinicId,
    staleTime: 60_000,
  });
  const alerts: any[] = alertsData ?? [];

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card h-28 bg-gray-100 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card h-64 bg-gray-100 rounded-xl" />
          <div className="card h-64 bg-gray-100 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card h-72 bg-gray-100 rounded-xl" />
          <div className="card h-72 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  const last7 = (analytics?.daily_trend ?? []).slice(-7);
  const trendLabels = last7.map((d: any) => {
    const dt = new Date(d.date);
    return dt.toLocaleDateString('en', { weekday: 'short', day: 'numeric' });
  });
  const trendRevenue = last7.map((d: any) => d.revenue);

  const paymentLabels = (analytics?.payment_breakdown ?? []).map((p: any) =>
    p.method.charAt(0).toUpperCase() + p.method.slice(1)
  );
  const paymentRevenue = (analytics?.payment_breakdown ?? []).map((p: any) => p.revenue);
  const topDrugs: any[] = (analytics?.top_drugs ?? []).slice(0, 5);
  const maxDrugRevenue = topDrugs[0]?.revenue ?? 1;

  const lowStock = analytics?.low_stock_count ?? 0;
  const kpis = [
    {
      label: "Today's Revenue",
      value: fmt(analytics?.today?.revenue ?? 0),
      sub: `${analytics?.today?.count ?? 0} sales today`,
      Icon: DollarSign,
      gradientFrom: '#6366f1', gradientTo: '#818cf8',
    },
    {
      label: 'This Week',
      value: fmt(analytics?.this_week?.revenue ?? 0),
      sub: `${analytics?.this_week?.count ?? 0} transactions`,
      Icon: TrendingUp,
      gradientFrom: '#8b5cf6', gradientTo: '#a78bfa',
    },
    {
      label: 'This Month',
      value: fmt(analytics?.this_month?.revenue ?? 0),
      sub: `${analytics?.this_month?.count ?? 0} transactions`,
      Icon: BarChart2,
      gradientFrom: '#0ea5e9', gradientTo: '#38bdf8',
    },
    {
      label: 'Stock Value',
      value: fmt(analytics?.stock_retail_value ?? 0),
      sub: `${analytics?.total_drugs ?? 0} drugs`,
      Icon: Boxes,
      gradientFrom: '#10b981', gradientTo: '#34d399',
    },
    {
      label: 'Low Stock',
      value: String(lowStock),
      sub: lowStock > 0 ? 'Needs reorder' : 'All sufficient',
      Icon: AlertTriangle,
      gradientFrom: lowStock > 0 ? '#f59e0b' : '#10b981',
      gradientTo: lowStock > 0 ? '#fbbf24' : '#34d399',
      onClick: () => onNavigate('alerts'),
    },
    {
      label: 'Active Alerts',
      value: String(alerts.length),
      sub: alerts.length > 0 ? 'Needs attention' : 'No issues',
      Icon: ShieldAlert,
      gradientFrom: alerts.length > 0 ? '#ef4444' : '#10b981',
      gradientTo: alerts.length > 0 ? '#f87171' : '#34d399',
      onClick: () => onNavigate('alerts'),
    },
  ];

  return (
    <div className="space-y-6">

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            onClick={kpi.onClick}
            className={`card p-4 flex flex-col gap-3 group ${
              kpi.onClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200' : ''
            }`}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
              style={{ background: `linear-gradient(135deg, ${kpi.gradientFrom}, ${kpi.gradientTo})` }}
            >
              <kpi.Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">{kpi.label}</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5 leading-tight">{kpi.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{kpi.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue trend */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold text-gray-800">Revenue Trend</h3>
              <p className="text-xs text-gray-400 mt-0.5">Last 7 days performance</p>
            </div>
            <button onClick={() => onNavigate('reports')} className="text-xs font-medium text-primary-600 hover:text-primary-800 border border-primary-200 hover:border-primary-300 px-2.5 py-1 rounded-lg transition-colors">
              Full report →
            </button>
          </div>
          {trendRevenue.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-300 gap-2">
              <BarChart2 className="w-12 h-12 opacity-30" />
              <p className="text-sm text-gray-400">No sales data yet</p>
            </div>
          ) : (
            <Bar
              data={{
                labels: trendLabels,
                datasets: [{
                  label: 'Revenue',
                  data: trendRevenue,
                  backgroundColor: trendRevenue.map((_: number, i: number) =>
                    i === trendRevenue.length - 1 ? 'rgba(99,102,241,0.9)' : 'rgba(99,102,241,0.25)'
                  ),
                  borderColor: '#6366f1',
                  borderWidth: 1.5,
                  borderRadius: 8,
                  borderSkipped: false,
                  hoverBackgroundColor: 'rgba(99,102,241,0.85)',
                }],
              }}
              options={{
                responsive: true,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    backgroundColor: '#1e293b',
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: { label: (ctx) => `  Revenue: ${fmt(ctx.raw as number)}` },
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.04)' },
                    border: { display: false },
                    ticks: { callback: (v) => fmt(Number(v)), font: { size: 11 }, color: '#9ca3af' },
                  },
                  x: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: { font: { size: 11 }, color: '#9ca3af' },
                  },
                },
              }}
            />
          )}
        </div>

        {/* Payment methods */}
        <div className="card p-5">
          <div className="mb-5">
            <h3 className="font-semibold text-gray-800">Payment Methods</h3>
            <p className="text-xs text-gray-400 mt-0.5">This month's breakdown</p>
          </div>
          {paymentRevenue.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-36 gap-2 text-gray-300">
              <p className="text-sm text-gray-400">No payment data</p>
            </div>
          ) : (
            <>
              <div className="relative mb-4">
                <Doughnut
                  data={{
                    labels: paymentLabels,
                    datasets: [{
                      data: paymentRevenue,
                      backgroundColor: OVERVIEW_COLORS.slice(0, paymentRevenue.length),
                      borderWidth: 3,
                      borderColor: '#fff',
                      hoverBorderColor: '#fff',
                      hoverOffset: 6,
                    }],
                  }}
                  options={{
                    responsive: true,
                    cutout: '68%',
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        backgroundColor: '#1e293b',
                        padding: 10,
                        cornerRadius: 8,
                        callbacks: { label: (ctx) => `  ${fmt(ctx.raw as number)}` },
                      },
                    },
                  }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-lg font-bold text-gray-800">{fmt(paymentRevenue.reduce((a: number, b: number) => a + b, 0))}</p>
                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Total</p>
                </div>
              </div>
              <div className="space-y-2 mt-2">
                {(analytics?.payment_breakdown ?? []).map((p: any, i: number) => (
                  <div key={p.method} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: OVERVIEW_COLORS[i] }} />
                      <span className="capitalize font-medium">{p.method}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{p.count} sales</span>
                      <span className="text-xs font-semibold text-gray-800">{fmt(p.revenue)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent sales */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h3 className="font-semibold text-gray-800">Recent Sales</h3>
              <p className="text-xs text-gray-400 mt-0.5">Latest transactions</p>
            </div>
            <button onClick={() => onNavigate('sales')} className="text-xs font-medium text-primary-600 hover:text-primary-800 border border-primary-200 hover:border-primary-300 px-2.5 py-1 rounded-lg transition-colors">
              View all →
            </button>
          </div>
          {recentSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-2">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-gray-300" />
              </div>
              <p className="text-sm text-gray-400">No sales recorded yet</p>
            </div>
          ) : (
            <div>
              {recentSales.map((sale, idx) => (
                <div
                  key={sale.id}
                  className={`flex items-center px-5 py-3.5 gap-4 hover:bg-gray-50 transition-colors ${idx !== recentSales.length - 1 ? 'border-b border-gray-50' : ''}`}
                >
                  <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center shrink-0">
                    <ShoppingCart className="w-3.5 h-3.5 text-primary-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-800">{sale.sale_number}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        sale.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : sale.status === 'voided'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-amber-100 text-amber-700'
                      }`}>{sale.status}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {sale.patient_name || 'Walk-in'} · {sale.item_count} item{sale.item_count !== 1 ? 's' : ''} · <span className="capitalize">{sale.payment_method}</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-900">{fmt(sale.total_amount)}</p>
                    <p className="text-xs text-gray-400">{new Date(sale.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Top drugs */}
          {topDrugs.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-800">Top Drugs</h3>
                  <p className="text-xs text-gray-400 mt-0.5">By revenue this month</p>
                </div>
                <button onClick={() => onNavigate('reports')} className="text-xs text-primary-600 hover:text-primary-800 font-medium">Reports →</button>
              </div>
              <div className="space-y-3">
                {topDrugs.map((drug: any, i: number) => (
                  <div key={drug.drug_id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-gray-700 truncate flex-1 mr-2 flex items-center gap-1.5">
                        <span
                          className="w-4 h-4 rounded text-white text-[9px] font-bold flex items-center justify-center shrink-0"
                          style={{ background: OVERVIEW_COLORS[i] }}
                        >
                          {i + 1}
                        </span>
                        {drug.drug_name}
                      </span>
                      <span className="text-xs font-bold text-gray-900 shrink-0">{fmt(drug.revenue)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(drug.revenue / maxDrugRevenue) * 100}%`,
                          background: `linear-gradient(90deg, ${OVERVIEW_COLORS[i]}99, ${OVERVIEW_COLORS[i]})`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stock alerts */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-800">Stock Alerts</h3>
                <p className="text-xs text-gray-400 mt-0.5">Issues requiring action</p>
              </div>
              {alerts.length > 0 && (
                <button onClick={() => onNavigate('alerts')} className="text-xs text-primary-600 hover:text-primary-800 font-medium">
                  View all →
                </button>
              )}
            </div>
            {alerts.length === 0 ? (
              <div className="flex items-center gap-2.5 bg-emerald-50 rounded-lg px-3 py-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-sm text-emerald-700 font-medium">All stock levels OK</span>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.slice(0, 5).map((alert: any) => {
                  const critical = alert.expired_qty > 0;
                  return (
                    <div
                      key={alert.drug_id}
                      className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${
                        critical
                          ? 'bg-red-50 border-red-100'
                          : 'bg-amber-50 border-amber-100'
                      }`}
                    >
                      <div className={`w-1.5 h-full rounded-full shrink-0 self-stretch mt-0.5 min-h-[32px] ${critical ? 'bg-red-400' : 'bg-amber-400'}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{alert.drug_name}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {[
                            critical && `${alert.expired_qty} units expired`,
                            alert.is_low_stock && `${alert.current_stock ?? 0} units left`,
                            alert.expiring_soon_qty > 0 && `${alert.expiring_soon_qty} expiring soon`,
                          ].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {alerts.length > 5 && (
                  <button
                    onClick={() => onNavigate('alerts')}
                    className="w-full text-center text-xs text-primary-600 hover:text-primary-800 font-medium py-1.5 hover:bg-primary-50 rounded-lg transition-colors"
                  >
                    +{alerts.length - 5} more alerts →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main PharmacyPage ────────────────────────────────────────────────────────

export default function PharmacyPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');
  const [selectedClinicId, setSelectedClinicId] = useState('');

  const userClinicId = useAppSelector((s) => (s.auth.user as any)?.clinic_id as string | undefined);
  const role = useAppSelector((s) => s.auth.user?.role);
  const isAdminRole = role === 'super_admin' || role === 'tenant_admin' || role === 'clinic_admin';

  const { data: clinicsData } = useQuery({
    queryKey: ['clinics-list'],
    queryFn: () => api.get('/clinics/', { params: { limit: 50 } }).then((r) => r.data.data),
  });
  const clinics: { id: string; name: string }[] = Array.isArray(clinicsData)
    ? clinicsData
    : (clinicsData?.clinics ?? []);

  const effectiveClinicId = isAdminRole
    ? (selectedClinicId || clinics[0]?.id || '')
    : (userClinicId || clinics[0]?.id || '');
  const effectiveClinicName = clinics.find((c) => c.id === effectiveClinicId)?.name ?? 'Pharmacy';

  const setTabFromQuery = useCallback((newTab: Tab) => {
    setTab(newTab);
    navigate(`/pharmacy?tab=${newTab}`, { replace: true });
  }, [navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedTab = params.get('tab');
    if (requestedTab && ['overview', 'pos', 'inventory', 'orders', 'sales', 'reports', 'expiry', 'alerts'].includes(requestedTab)) {
      setTab(requestedTab as Tab);
    }
  }, [location.search]);

  const { data: drugsData } = useQuery({
    queryKey: ['pharmacy-drugs-all', effectiveClinicId],
    queryFn: () =>
      api.get('/inventory/drugs', { params: { page_size: 200, ...(effectiveClinicId ? { clinic_id: effectiveClinicId } : {}) } })
        .then((r) => r.data.data ?? []),
    enabled: !!effectiveClinicId,
  });
  const allDrugs: Drug[] = drugsData ?? [];

  const { data: alertsData } = useQuery({
    queryKey: ['pharmacy-alerts-count', effectiveClinicId],
    queryFn: () =>
      api.get('/inventory/stock-alerts', { params: effectiveClinicId ? { clinic_id: effectiveClinicId } : {} })
        .then((r) => r.data.data ?? []),
    enabled: !!effectiveClinicId,
    refetchInterval: 300_000,
  });
  const alertsMap: Record<string, any> = Object.fromEntries(
    (alertsData ?? []).map((a: any) => [a.drug_id, a])
  );

  return (
    <div>
      <div className="page-header flex items-center justify-between flex-wrap gap-3">
        <h1 className="page-title">Pharmacy</h1>
        {isAdminRole && clinics.length > 1 && (
          <select
            className="input w-52"
            value={effectiveClinicId}
            onChange={(e) => setSelectedClinicId(e.target.value)}
          >
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {tab === 'overview' && <OverviewPanel clinicId={effectiveClinicId} onNavigate={setTabFromQuery} />}
      {tab === 'pos' && <POSPanel clinicId={effectiveClinicId} clinicName={effectiveClinicName} />}
      {tab === 'inventory' && <InventoryTab clinics={clinics} clinicId={effectiveClinicId} alertsMap={alertsMap} />}
      {tab === 'orders' && <PurchaseOrdersTab clinics={clinics} clinicId={effectiveClinicId} drugs={allDrugs} />}
      {tab === 'sales' && <SalesTab clinicId={effectiveClinicId} clinicName={effectiveClinicName} />}
      {tab === 'reports' && <ReportsTab clinicId={effectiveClinicId} />}
      {tab === 'expiry' && <ExpiryTab clinicId={effectiveClinicId} />}
      {tab === 'alerts' && <AlertsTab clinicId={effectiveClinicId} />}
    </div>
  );
}
