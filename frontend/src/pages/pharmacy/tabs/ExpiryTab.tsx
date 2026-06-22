import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronLeft, ChevronRight, AlertCircle, CheckCircle } from 'lucide-react';
import api from '@/services/api';
import { useDebounce } from '@/hooks/useDebounce';
import { useCurrency } from '@/hooks/useCurrency';
import SkeletonTable from '@/components/common/SkeletonTable';
import type { ExpiryBatch } from '../types';
import { EXPIRY_FILTERS } from '../constants';

// ─── Expiry Tab ───────────────────────────────────────────────────────────────

export function ExpiryTab({ clinicId }: { clinicId: string }) {
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
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header summary */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
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
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4 flex-shrink-0">
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
      <div className="card flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="overflow-y-auto flex-1 min-h-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
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
              <SkeletonTable rows={6} columns={14} />
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
        </div>

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
