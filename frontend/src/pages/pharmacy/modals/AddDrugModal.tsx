import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import api from '@/services/api';
import { useNotification } from '@/hooks/useNotification';
import { DRUG_FORMS } from '../constants';

// ─── Add Drug Modal ────────────────────────────────────────────────────────────

export function AddDrugModal({ onClose, clinics, defaultClinicId }: { onClose: () => void; clinics: { id: string; name: string }[]; defaultClinicId?: string }) {
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
