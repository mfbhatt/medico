import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import api from '@/services/api';

// ─── Receive PO Modal ──────────────────────────────────────────────────────────

export function ReceivePOModal({ po, onClose }: { po: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [receiveItems, setReceiveItems] = useState<Record<string, { qty: string; expiry: string; batch: string }>>({});
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: any) => api.patch(`/inventory/purchase-orders/${po.id}/receive`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pharmacy-pos'] }); onClose(); },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Failed to receive items'),
  });

  const updateItem = (id: string, field: string, value: string) =>
    setReceiveItems((p) => ({ ...p, [id]: { ...(p[id] ?? { qty: '', expiry: '', batch: '' }), [field]: value } }));

  const pendingItems = (po.items ?? []).filter((i: any) => i.quantity_ordered > i.quantity_received);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Receive Items</h2>
            <p className="text-sm text-gray-500">PO# {po.po_number} · {po.supplier_name}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            const items = pendingItems
              .filter((i: any) => receiveItems[i.id]?.qty && Number(receiveItems[i.id].qty) > 0)
              .map((i: any) => ({
                item_id: i.id,
                quantity_received: Number(receiveItems[i.id].qty),
                expiry_date: receiveItems[i.id].expiry,
                batch_number: receiveItems[i.id].batch || undefined,
              }));
            if (!items.length) { setError('Enter quantity for at least one item'); return; }
            const missing = items.filter((i: any) => !i.expiry_date);
            if (missing.length) { setError('Expiry date is required for all received items'); return; }
            mutation.mutate({ items });
          }}
          className="p-5 space-y-4"
        >
          {pendingItems.length === 0 ? (
            <p className="text-gray-500 text-center py-6">All items have been received.</p>
          ) : (
            <div className="space-y-4">
              {pendingItems.map((item: any) => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-medium text-gray-900">{item.drug_name}</p>
                      <p className="text-xs text-gray-500">{item.form} {item.strength} · Ordered: {item.quantity_ordered} · Received: {item.quantity_received}</p>
                    </div>
                    <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                      Pending: {item.quantity_ordered - item.quantity_received}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="label">Qty Received</label>
                      <input className="input" type="number" min={0} max={item.quantity_ordered - item.quantity_received}
                        value={receiveItems[item.id]?.qty ?? ''}
                        onChange={(e) => updateItem(item.id, 'qty', e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Expiry Date *</label>
                      <input className="input" type="date" value={receiveItems[item.id]?.expiry ?? ''}
                        onChange={(e) => updateItem(item.id, 'expiry', e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Batch #</label>
                      <input className="input" placeholder="Optional" value={receiveItems[item.id]?.batch ?? ''}
                        onChange={(e) => updateItem(item.id, 'batch', e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
          {pendingItems.length > 0 && (
            <div className="flex gap-3">
              <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1">
                {mutation.isPending ? 'Receiving…' : 'Confirm Receipt'}
              </button>
              <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
