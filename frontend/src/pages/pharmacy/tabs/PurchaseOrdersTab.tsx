import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '@/services/api';
import { useCurrency } from '@/hooks/useCurrency';
import SkeletonTable from '@/components/common/SkeletonTable';
import type { Drug, PurchaseOrder } from '../types';
import { PurchaseOrderModal } from '../modals/PurchaseOrderModal';
import { ReceivePOModal } from '../modals/ReceivePOModal';

// ─── Purchase Orders Tab ──────────────────────────────────────────────────────

export function PurchaseOrdersTab({ clinics, clinicId, drugs }: { clinics: { id: string; name: string }[]; clinicId: string; drugs: Drug[] }) {
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
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="font-semibold text-gray-800">Purchase Orders</h3>
        <button onClick={() => setPoOpen(true)} className="btn-primary flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> New Purchase Order
        </button>
      </div>

      <div className="card flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="overflow-y-auto flex-1 min-h-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
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
              <SkeletonTable rows={6} columns={7} />
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
        </div>

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
    </div>
  );
}
