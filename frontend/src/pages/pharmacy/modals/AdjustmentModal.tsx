import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import api from '@/services/api';
import type { Drug } from '../types';

// ─── Stock Adjustment Modal ────────────────────────────────────────────────────

export function AdjustmentModal({ drug, onClose }: { drug: Drug; onClose: () => void }) {
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
