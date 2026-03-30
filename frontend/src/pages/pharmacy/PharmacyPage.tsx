import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Package } from 'lucide-react';
import api from '@/services/api';
import { useDebounce } from '@/hooks/useDebounce';

type PharmacyTab = 'inventory' | 'alerts';

interface Drug {
  id: string;
  name: string;
  generic_name: string;
  category: string;
  form: string;
  strength: string;
  total_stock: number;
  reorder_level: number;
  is_active: boolean;
}

// ─── Add Drug Modal ─────────────────────────────────────────────

const DRUG_FORMS = ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'inhaler', 'patch', 'suppository', 'other'];

function AddDrugModal({
  onClose,
  clinics,
}: {
  onClose: () => void;
  clinics: { id: string; name: string }[];
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '', generic_name: '', brand_name: '', form: 'tablet',
    strength: '', unit: 'mg', category: '',
    clinic_id: clinics[0]?.id ?? '', selling_price: '',
    unit_cost: '', reorder_level: '10', requires_prescription: true,
    is_controlled: false,
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/inventory/drugs', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); onClose(); },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Failed to add drug'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    mutation.mutate({
      ...form,
      selling_price: form.selling_price ? Number(form.selling_price) : 0,
      unit_cost: form.unit_cost ? Number(form.unit_cost) : 0,
      reorder_level: Number(form.reorder_level),
    });
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">Add Drug to Catalog</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
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
              <label className="label">Clinic *</label>
              <select className="input" value={form.clinic_id} onChange={set('clinic_id')} required>
                {clinics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Unit Cost ($)</label>
              <input className="input" type="number" min={0} step="0.01" value={form.unit_cost} onChange={set('unit_cost')} />
            </div>
            <div>
              <label className="label">Selling Price ($)</label>
              <input className="input" type="number" min={0} step="0.01" value={form.selling_price} onChange={set('selling_price')} />
            </div>
            <div>
              <label className="label">Reorder Level</label>
              <input className="input" type="number" min={0} value={form.reorder_level} onChange={set('reorder_level')} />
            </div>
            <div className="flex items-center gap-3 pt-5">
              <input
                type="checkbox"
                id="req_rx"
                checked={form.requires_prescription}
                onChange={(e) => setForm((f) => ({ ...f, requires_prescription: e.target.checked }))}
                className="w-4 h-4"
              />
              <label htmlFor="req_rx" className="text-sm text-gray-700">Requires Prescription</label>
            </div>
            <div className="flex items-center gap-3 pt-5">
              <input
                type="checkbox"
                id="is_ctrl"
                checked={form.is_controlled}
                onChange={(e) => setForm((f) => ({ ...f, is_controlled: e.target.checked }))}
                className="w-4 h-4"
              />
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

// ─── Add Stock Modal ────────────────────────────────────────────

function AddStockModal({ drug, onClose }: { drug: Drug; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    quantity: '', expiry_date: '', batch_number: '',
    unit_cost: '', supplier_name: '',
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: any) => api.post(`/inventory/drugs/${drug.id}/stock`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); onClose(); },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Failed to add stock'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    mutation.mutate({
      quantity: Number(form.quantity),
      expiry_date: form.expiry_date,
      batch_number: form.batch_number || undefined,
      unit_cost: form.unit_cost ? Number(form.unit_cost) : undefined,
      supplier_name: form.supplier_name || undefined,
    });
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Receive Stock</h2>
            <p className="text-sm text-gray-500">{drug.name} · {drug.form} {drug.strength}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
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
              <label className="label">Unit Cost ($)</label>
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

// ─── Purchase Order Modal ───────────────────────────────────────

interface POItem { drug_id: string; drug_name: string; quantity: number; unit_cost: number }

function PurchaseOrderModal({
  onClose,
  clinics,
  drugs,
}: {
  onClose: () => void;
  clinics: { id: string; name: string }[];
  drugs: Drug[];
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    clinic_id: clinics[0]?.id ?? '',
    supplier_name: '',
    supplier_contact: '',
    expected_delivery_date: '',
    notes: '',
  });
  const [items, setItems] = useState<POItem[]>([]);
  const [error, setError] = useState('');

  const addItem = () => {
    const drug = drugs[0];
    if (!drug) return;
    setItems((prev) => [...prev, { drug_id: drug.id, drug_name: drug.name, quantity: 1, unit_cost: 0 }]);
  };

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const updateItem = (idx: number, field: keyof POItem, value: string | number) =>
    setItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      if (field === 'drug_id') {
        const drug = drugs.find((d) => d.id === value);
        return { ...item, drug_id: String(value), drug_name: drug?.name ?? '' };
      }
      return { ...item, [field]: Number(value) };
    }));

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/inventory/purchase-orders', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); onClose(); },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Failed to create purchase order'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!items.length) { setError('Add at least one item'); return; }
    setError('');
    mutation.mutate({
      ...form,
      items: items.map((item) => ({
        drug_item_id: item.drug_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        line_total: item.quantity * item.unit_cost,
      })),
    });
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">New Purchase Order</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
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

          {/* Order Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-gray-900 text-sm">Order Items</h3>
              <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-medium">
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>
            {items.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-lg">
                Click "Add Item" to add drugs to this order
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <select
                        className="input text-xs"
                        value={item.drug_id}
                        onChange={(e) => updateItem(idx, 'drug_id', e.target.value)}
                      >
                        {drugs.map((d) => <option key={d.id} value={d.id}>{d.name} {d.strength}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input
                        className="input text-xs"
                        type="number"
                        min={1}
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        className="input text-xs"
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Unit cost"
                        value={item.unit_cost}
                        onChange={(e) => updateItem(idx, 'unit_cost', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2 text-right text-sm font-medium text-gray-700">
                      ${(item.quantity * item.unit_cost).toFixed(2)}
                    </div>
                    <div className="col-span-1 text-right">
                      <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-end pt-2 border-t border-gray-100">
                  <span className="text-sm font-semibold text-gray-900">Total: ${totalAmount.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea
              className="input"
              rows={2}
              value={form.notes}
              onChange={set('notes')}
              placeholder="Optional notes for this order"
            />
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

// ─── PharmacyPage ───────────────────────────────────────────────

export default function PharmacyPage() {
  const [tab, setTab] = useState<PharmacyTab>('inventory');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const limit = 25;
  const debouncedSearch = useDebounce(search, 300);

  const [addDrugOpen, setAddDrugOpen] = useState(false);
  const [stockDrug, setStockDrug] = useState<Drug | null>(null);
  const [poOpen, setPoOpen] = useState(false);

  const { data: inventoryData, isLoading } = useQuery({
    queryKey: ['inventory', debouncedSearch, page],
    queryFn: () =>
      api
        .get('/inventory/drugs', {
          params: { q: debouncedSearch || undefined, page: page + 1, page_size: limit },
        })
        .then((r) => r.data),
    enabled: tab === 'inventory',
  });

  const { data: alerts } = useQuery({
    queryKey: ['inventory-alerts'],
    queryFn: () => api.get('/inventory/stock-alerts').then((r) => r.data.data),
    enabled: tab === 'alerts',
  });

  const { data: clinicsData } = useQuery({
    queryKey: ['clinics-list'],
    queryFn: () => api.get('/clinics/', { params: { limit: 50 } }).then((r) => r.data.data),
  });
  const clinics = clinicsData?.clinics ?? clinicsData ?? [];

  const drugs: Drug[] = inventoryData?.data ?? [];
  const meta = inventoryData?.meta ?? {};

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Pharmacy & Inventory</h1>
        <div className="flex gap-2">
          <button onClick={() => setAddDrugOpen(true)} className="btn-secondary flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add Drug
          </button>
          <button onClick={() => setPoOpen(true)} className="btn-primary flex items-center gap-1.5">
            <Package className="w-4 h-4" /> New Purchase Order
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-1 -mb-px">
          {(['inventory', 'alerts'] as PharmacyTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 capitalize transition-colors
                ${tab === t ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t === 'alerts' ? (
                <span className="flex items-center gap-1.5">
                  Alerts
                  {(alerts?.length ?? 0) > 0 && (
                    <span className="inline-flex items-center justify-center w-5 h-5 text-xs bg-red-500 text-white rounded-full">
                      {alerts?.length}
                    </span>
                  )}
                </span>
              ) : (
                'Drug Inventory'
              )}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'inventory' && (
        <>
          <div className="card p-4 mb-6">
            <div className="relative max-w-md">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                className="input pl-9"
                placeholder="Search drugs by name, category…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              />
            </div>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Drug Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Form / Strength</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Stock</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Reorder</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading…</td></tr>
                ) : drugs.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">No drugs found</td></tr>
                ) : (
                  drugs.map((drug) => {
                    const isLow = drug.total_stock <= drug.reorder_level;
                    const isOut = drug.total_stock === 0;
                    return (
                      <tr key={drug.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{drug.name}</p>
                          <p className="text-xs text-gray-400">{drug.generic_name}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600 capitalize">{drug.category}</td>
                        <td className="px-4 py-3 text-gray-600">{drug.form} · {drug.strength}</td>
                        <td className={`px-4 py-3 text-right font-medium ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-900'}`}>
                          {drug.total_stock}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">{drug.reorder_level}</td>
                        <td className="px-4 py-3">
                          {isOut ? (
                            <span className="badge-red">Out of Stock</span>
                          ) : isLow ? (
                            <span className="badge-yellow">Low Stock</span>
                          ) : (
                            <span className="badge-green">In Stock</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setStockDrug(drug)}
                            className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                          >
                            Add Stock
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {meta.total > limit && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 text-sm text-gray-600">
                <span>Showing {page * limit + 1}–{Math.min((page + 1) * limit, meta.total)} of {meta.total}</span>
                <div className="flex gap-2">
                  <button className="btn-secondary py-1 px-3" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
                  <button className="btn-secondary py-1 px-3" disabled={(page + 1) * limit >= meta.total} onClick={() => setPage((p) => p + 1)}>Next</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'alerts' && (
        <div className="space-y-3">
          {!alerts?.length ? (
            <div className="card p-12 text-center text-gray-400">No stock alerts</div>
          ) : (
            alerts.map((alert: { drug_id: string; drug_name: string; current_stock: number; reorder_level: number; is_low_stock: boolean; expiring_soon_qty: number; expired_qty: number }) => (
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
                    <p className="font-medium text-gray-900">{alert.drug_name}</p>
                    <p className="text-sm text-gray-600 mt-0.5">
                      Stock: {alert.current_stock} (reorder at {alert.reorder_level})
                      {alert.expiring_soon_qty > 0 && ` · ${alert.expiring_soon_qty} units expiring soon`}
                      {alert.expired_qty > 0 && ` · ${alert.expired_qty} units expired`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {alert.expired_qty > 0 && <span className="badge-red">Expired Stock</span>}
                    {alert.expiring_soon_qty > 0 && <span className="badge-yellow">Expiring Soon</span>}
                    {alert.is_low_stock && <span className="badge-blue">Low Stock</span>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modals */}
      {addDrugOpen && (
        <AddDrugModal onClose={() => setAddDrugOpen(false)} clinics={clinics} />
      )}
      {stockDrug && (
        <AddStockModal drug={stockDrug} onClose={() => setStockDrug(null)} />
      )}
      {poOpen && (
        <PurchaseOrderModal onClose={() => setPoOpen(false)} clinics={clinics} drugs={drugs} />
      )}
    </div>
  );
}
