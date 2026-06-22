import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import api from '@/services/api';
import type { Drug } from '../types';

// ─── Add Stock Modal ────────────────────────────────────────────────────────────

export function AddStockModal({ drug, onClose }: { drug: Drug; onClose: () => void }) {
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
