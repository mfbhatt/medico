import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Building2, CheckCircle, DollarSign } from 'lucide-react';
import api from '@/services/api';
import { useNotification } from '@/hooks/useNotification';
import { useCurrency } from '@/hooks/useCurrency';
import SkeletonTable from '@/components/common/SkeletonTable';
import type { Supplier } from '../types';
import { SupplierModal } from '../modals/SupplierModal';

// ─── Suppliers Tab ────────────────────────────────────────────────────────────

export function SuppliersTab() {
  const qc = useQueryClient();
  const { success, error: notifyError } = useNotification();
  const fmt = useCurrency();
  const [search, setSearch] = useState('');
  const [modalSupplier, setModalSupplier] = useState<Supplier | null | 'new'>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: stats } = useQuery({
    queryKey: ['pharmacy-supplier-stats'],
    queryFn: () => api.get('/inventory/suppliers/stats').then((r) => r.data.data),
    staleTime: 30_000,
  });

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ['pharmacy-suppliers'],
    queryFn: () => api.get('/inventory/suppliers').then((r) => r.data.data ?? []),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/suppliers/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pharmacy-suppliers'] });
      qc.invalidateQueries({ queryKey: ['pharmacy-supplier-stats'] });
      success('Supplier removed');
      setDeletingId(null);
    },
    onError: () => notifyError('Failed to remove supplier'),
  });

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.contact_person ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (s.email ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-4">

      {/* ── Widgets ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total Suppliers */}
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Total Suppliers</p>
            <p className="text-2xl font-bold text-gray-900 leading-tight">{stats?.total ?? '—'}</p>
          </div>
        </div>

        {/* Active */}
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Active</p>
            <p className="text-2xl font-bold text-gray-900 leading-tight">{stats?.active ?? '—'}</p>
            {stats && stats.inactive > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">{stats.inactive} inactive</p>
            )}
          </div>
        </div>

        {/* Outstanding Balance */}
        <div className="card p-4 flex items-center gap-3 sm:col-span-2">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Total Outstanding</p>
            <p className="text-2xl font-bold text-gray-900 leading-tight">
              {stats ? fmt(stats.total_outstanding) : '—'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Amount owed across all suppliers</p>
          </div>
        </div>
      </div>

      {/* ── Search + Add ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search suppliers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setModalSupplier('new')}>
          <Plus className="w-4 h-4" /> Add Supplier
        </button>
      </div>

      {/* ── Table ── */}
      {isLoading ? (
        <SkeletonTable rows={6} columns={6} />
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {search ? 'No suppliers match your search' : 'No suppliers yet'}
          </p>
          {!search && (
            <button className="btn-primary mt-4" onClick={() => setModalSupplier('new')}>
              <Plus className="w-4 h-4 mr-1 inline" /> Add First Supplier
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Supplier</th>
                <th className="px-4 py-3 text-left">Contact Person</th>
                <th className="px-4 py-3 text-left">Phone</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-right">Outstanding</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{supplier.name}</p>
                    {supplier.address && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[180px]">{supplier.address}</p>
                    )}
                    {supplier.payment_terms && (
                      <p className="text-xs text-indigo-500 mt-0.5">{supplier.payment_terms}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{supplier.contact_person || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{supplier.phone || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{supplier.email || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {supplier.outstanding_balance > 0 ? (
                      <span className="font-semibold text-amber-700">{fmt(supplier.outstanding_balance)}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${supplier.is_active ? 'badge-green' : 'badge-gray'}`}>
                      {supplier.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                        onClick={() => setModalSupplier(supplier)}
                      >
                        Edit
                      </button>
                      {deletingId === supplier.id ? (
                        <>
                          <button
                            className="text-xs text-red-600 hover:text-red-800 font-medium"
                            onClick={() => deleteMutation.mutate(supplier.id)}
                            disabled={deleteMutation.isPending}
                          >
                            {deleteMutation.isPending ? 'Removing…' : 'Confirm'}
                          </button>
                          <button className="text-xs text-gray-500" onClick={() => setDeletingId(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          className="text-xs text-red-500 hover:text-red-700"
                          onClick={() => setDeletingId(supplier.id)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalSupplier !== null && (
        <SupplierModal
          supplier={modalSupplier === 'new' ? null : modalSupplier}
          onClose={() => {
            setModalSupplier(null);
            qc.invalidateQueries({ queryKey: ['pharmacy-supplier-stats'] });
          }}
        />
      )}
    </div>
  );
}
