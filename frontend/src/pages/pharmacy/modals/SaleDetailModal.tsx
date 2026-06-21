import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Printer } from 'lucide-react';
import api from '@/services/api';
import { useCurrency } from '@/hooks/useCurrency';
import { printReceipt } from '../utils/printReceipt';

// ─── Receipt View Modal ────────────────────────────────────────────────────────

export function SaleDetailModal({ saleId, onClose, clinicName }: { saleId: string; onClose: () => void; clinicName: string }) {
  const fmt = useCurrency();
  const { data } = useQuery({
    queryKey: ['pharmacy-sale', saleId],
    queryFn: () => api.get(`/inventory/sales/${saleId}`).then((r) => r.data.data),
  });

  const qc = useQueryClient();
  const voidMutation = useMutation({
    mutationFn: () => api.post(`/inventory/sales/${saleId}/void`, { reason: 'Manually voided' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pharmacy-sales'] }); onClose(); },
  });

  if (!data) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Sale Receipt</h2>
            <p className="text-sm text-gray-500">{data.sale_number}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => printReceipt(data, clinicName)} className="btn-secondary flex items-center gap-1.5 text-sm py-1.5">
              <Printer className="w-4 h-4" /> Print
            </button>
            <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-gray-500">Date</span>
            <span className="text-right">{new Date(data.created_at).toLocaleString()}</span>
            <span className="text-gray-500">Patient</span>
            <span className="text-right">{data.patient_name || '—'}</span>
            <span className="text-gray-500">Payment</span>
            <span className="text-right capitalize">{data.payment_method}</span>
            <span className="text-gray-500">Status</span>
            <span className={`text-right font-medium capitalize ${data.status === 'voided' ? 'text-red-600' : 'text-green-600'}`}>{data.status}</span>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-600 font-medium">Item</th>
                  <th className="text-right px-3 py-2 text-gray-600 font-medium">Qty</th>
                  <th className="text-right px-3 py-2 text-gray-600 font-medium">Price</th>
                  <th className="text-right px-3 py-2 text-gray-600 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((item: any) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2">{item.drug_name}</td>
                    <td className="px-3 py-2 text-right">{item.quantity}</td>
                    <td className="px-3 py-2 text-right">{fmt(item.unit_price)}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmt(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-1.5 text-sm border-t border-gray-200 pt-3">
            <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>{fmt(data.subtotal)}</span></div>
            {data.discount_amount > 0 && <div className="flex justify-between"><span className="text-gray-600">Discount</span><span className="text-red-600">−{fmt(data.discount_amount)}</span></div>}
            {data.tax_amount > 0 && <div className="flex justify-between"><span className="text-gray-600">Tax</span><span>{fmt(data.tax_amount)}</span></div>}
            <div className="flex justify-between font-semibold text-base border-t border-gray-200 pt-1.5">
              <span>Total</span><span>{fmt(data.total_amount)}</span>
            </div>
            <div className="flex justify-between text-gray-600"><span>Paid</span><span>{fmt(data.paid_amount)}</span></div>
            {data.change_amount > 0 && <div className="flex justify-between text-gray-600"><span>Change</span><span>{fmt(data.change_amount)}</span></div>}
          </div>

          {data.status === 'completed' && (
            <button
              onClick={() => { if (confirm('Void this sale? Stock will be returned.')) voidMutation.mutate(); }}
              disabled={voidMutation.isPending}
              className="w-full btn-secondary text-red-600 border-red-200 hover:bg-red-50 text-sm"
            >
              {voidMutation.isPending ? 'Voiding…' : 'Void Sale'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
