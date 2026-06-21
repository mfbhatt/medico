import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import type { CartItem } from '../types';

// ─── Batch Selector (cart item) ───────────────────────────────────────────────

export function CartBatchRow({
  item,
  clinicId,
  onBatchChange,
}: {
  item: CartItem;
  clinicId: string;
  onBatchChange: (drugId: string, batchId: string, batchNumber: string, batchExpiry: string) => void;
}) {
  const { data } = useQuery({
    queryKey: ['drug-batches', item.drug_id, clinicId],
    queryFn: () =>
      api
        .get('/inventory/batches', { params: { drug_id: item.drug_id, status: 'active', clinic_id: clinicId, page_size: 20 } })
        .then((r) => r.data.data ?? []),
    staleTime: 60_000,
  });
  const batches: any[] = data ?? [];

  const onBatchChangeRef = useRef(onBatchChange);
  onBatchChangeRef.current = onBatchChange;

  useEffect(() => {
    if (batches.length > 0 && !item.batch_id) {
      const first = batches[0];
      onBatchChangeRef.current(item.drug_id, first.id, first.batch_number ?? '—', first.expiry_date ?? '');
    }
  }, [batches, item.batch_id, item.drug_id]);

  if (!batches.length) return <span className="text-[10px] text-gray-400 italic">No batch info</span>;

  return (
    <select
      className="input text-[10px] py-0 px-1.5 h-6 flex-1"
      value={item.batch_id ?? ''}
      onChange={(e) => {
        const b = batches.find((b: any) => b.id === e.target.value);
        if (b) onBatchChange(item.drug_id, b.id, b.batch_number ?? '—', b.expiry_date ?? '');
      }}
    >
      {batches.map((b: any) => (
        <option key={b.id} value={b.id}>
          {b.batch_number ?? '—'} · exp {b.expiry_date} · {b.quantity_remaining} left
        </option>
      ))}
    </select>
  );
}
