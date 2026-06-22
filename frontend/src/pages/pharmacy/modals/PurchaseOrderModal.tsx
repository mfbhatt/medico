import { useState, useMemo, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Plus } from 'lucide-react';
import api from '@/services/api';
import { useNotification } from '@/hooks/useNotification';
import type { Drug, POItem } from '../types';

// ─── Purchase Order Modal ──────────────────────────────────────────────────────

export function PurchaseOrderModal({ onClose, clinics, drugs, defaultClinicId }: { onClose: () => void; clinics: { id: string; name: string }[]; drugs: Drug[]; defaultClinicId?: string }) {
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

  const { data: suppliersData = [] } = useQuery<{ id: string; name: string; phone: string | null }[]>({
    queryKey: ['pharmacy-suppliers'],
    queryFn: () => api.get('/inventory/suppliers').then((r) => r.data.data ?? []),
  });

  const supplierMap = useMemo(() => {
    const map = new Map<string, string>();
    suppliersData.forEach((s) => map.set(s.name, s.phone ?? ''));
    return map;
  }, [suppliersData]);

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
