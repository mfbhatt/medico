import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '@/services/api';
import { useCurrency } from '@/hooks/useCurrency';
import SkeletonTable from '@/components/common/SkeletonTable';
import type { SaleRecord } from '../types';
import { SaleDetailModal } from '../modals/SaleDetailModal';

// ─── Sales History Tab ────────────────────────────────────────────────────────

export function SalesTab({ clinicId, clinicName }: { clinicId: string; clinicName: string }) {
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
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex items-center gap-3 mb-4 flex-shrink-0 flex-wrap">
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

      <div className="card flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="overflow-y-auto flex-1 min-h-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
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
              <SkeletonTable rows={6} columns={7} />
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
        </div>

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
    </div>
  );
}
