import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Building2, RefreshCw } from 'lucide-react';
import api from '@/services/api';
import { useNotification } from '@/hooks/useNotification';
import type { Supplier, SupplierFormData } from '../types';

// ─── Supplier Modal ────────────────────────────────────────────────────────────

export function SupplierModal({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { success, error: notifyError } = useNotification();
  const isEdit = !!supplier;

  const [form, setForm] = useState<SupplierFormData>({
    name: supplier?.name ?? '',
    contact_person: supplier?.contact_person ?? '',
    phone: supplier?.phone ?? '',
    email: supplier?.email ?? '',
    address: supplier?.address ?? '',
    payment_terms: supplier?.payment_terms ?? '',
    outstanding_balance: supplier?.outstanding_balance ?? 0,
    is_active: supplier?.is_active ?? true,
  });

  const saveMutation = useMutation({
    mutationFn: (data: SupplierFormData) =>
      isEdit
        ? api.put(`/inventory/suppliers/${supplier!.id}`, data).then((r) => r.data)
        : api.post('/inventory/suppliers', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pharmacy-suppliers'] });
      qc.invalidateQueries({ queryKey: ['pharmacy-supplier-stats'] });
      success(isEdit ? 'Supplier updated' : 'Supplier added');
      onClose();
    },
    onError: () => notifyError('Failed to save supplier'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header banner ── */}
        <div className="bg-gradient-to-r from-indigo-600 to-teal-500 px-6 py-5 flex items-start justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white leading-tight">
                {isEdit ? 'Edit Supplier' : 'New Supplier'}
              </h2>
              <p className="text-indigo-100 text-xs mt-0.5">
                {isEdit ? 'Update supplier information' : 'Add a supplier to your pharmacy network'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Form body ── */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-6 space-y-5">

            {/* Section: Company */}
            <div>
              <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-widest mb-3">
                Company Info
              </p>
              <div className="space-y-3">
                <div>
                  <label className="label">Supplier / Company Name <span className="text-red-500">*</span></label>
                  <input
                    className="input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. MedSupply Corp"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="label">Address</label>
                  <textarea
                    className="input resize-none"
                    rows={2}
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="123 Warehouse Road, City, State"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100" />

            {/* Section: Contact */}
            <div>
              <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-widest mb-3">
                Contact Details
              </p>
              <div className="space-y-3">
                <div>
                  <label className="label">Contact Person</label>
                  <input
                    className="input"
                    value={form.contact_person}
                    onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                    placeholder="Full name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Phone</label>
                    <input
                      className="input"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+1 555 000 0000"
                      type="tel"
                    />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input
                      className="input"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="orders@supplier.com"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100" />

            {/* Section: Financial */}
            <div>
              <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-widest mb-3">
                Financial
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Payment Terms</label>
                  <select
                    className="input"
                    value={form.payment_terms ?? ''}
                    onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
                  >
                    <option value="">— Select —</option>
                    <option value="Immediate">Immediate</option>
                    <option value="Net 7">Net 7</option>
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 45">Net 45</option>
                    <option value="Net 60">Net 60</option>
                    <option value="Net 90">Net 90</option>
                  </select>
                </div>
                <div>
                  <label className="label">Outstanding Balance</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
                    <input
                      className="input pl-7"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.outstanding_balance}
                      onChange={(e) => setForm({ ...form, outstanding_balance: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100" />

            {/* Status toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Active Supplier</p>
                <p className="text-xs text-gray-400 mt-0.5">Inactive suppliers won't appear in purchase orders</p>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, is_active: !form.is_active })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  form.is_active ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    form.is_active ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending || !form.name.trim()}
              className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
            >
              {saveMutation.isPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  {isEdit ? <RefreshCw className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  {isEdit ? 'Update Supplier' : 'Add Supplier'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
