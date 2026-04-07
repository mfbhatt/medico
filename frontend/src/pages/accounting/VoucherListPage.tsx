import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { addToast } from '@/store/slices/uiSlice';
import api from '@/services/api';

const VOUCHER_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'payment', label: 'Payment' },
  { value: 'journal', label: 'Journal' },
  { value: 'contra', label: 'Contra' },
  { value: 'sales', label: 'Sales' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'credit_note', label: 'Credit Note' },
  { value: 'debit_note', label: 'Debit Note' },
];

const TYPE_COLORS: Record<string, string> = {
  receipt: 'badge-green',
  payment: 'badge-red',
  journal: 'badge-blue',
  contra: 'badge-yellow',
  sales: 'badge-blue',
  purchase: 'badge-gray',
  credit_note: 'badge-yellow',
  debit_note: 'badge-red',
};

export default function VoucherListPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const qc = useQueryClient();

  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [voucherType, setVoucherType] = useState('');
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const [page, setPage] = useState(1);
  const limit = 25;

  const toast = {
    success: (m: string) => dispatch(addToast({ id: Date.now().toString(), type: 'success', message: m, duration: 3000 })),
    error: (m: string) => dispatch(addToast({ id: Date.now().toString(), type: 'error', message: m, duration: 5000 })),
  };

  const { data } = useQuery({
    queryKey: ['accounting', 'vouchers', voucherType, dateFrom, dateTo, page],
    queryFn: () => api.get('/accounting/vouchers', {
      params: {
        voucher_type: voucherType || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        page,
        page_size: limit,
      },
    }).then(r => r.data),
  });

  const vouchers = data?.data ?? [];
  const meta = data?.meta ?? {};

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/accounting/vouchers/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounting', 'vouchers'] }); toast.success('Voucher deleted'); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Cannot delete auto-posted vouchers'),
  });

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return (
    <div>
      <div className="page-header mb-6">
        <h1 className="page-title">Vouchers</h1>
        <Link to="/accounting/vouchers/new" className="btn-primary">+ New Voucher</Link>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Type</label>
          <select className="input" value={voucherType} onChange={e => { setVoucherType(e.target.value); setPage(1); }}>
            {VOUCHER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">From</label>
          <input type="date" className="input" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Number</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Narration</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {vouchers.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">No vouchers found</td></tr>
            ) : (
              vouchers.map((v: any) => (
                <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-primary-600 font-medium">
                    <Link to={`/accounting/vouchers/${v.id}`} className="hover:underline">{v.voucher_number}</Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={TYPE_COLORS[v.voucher_type] ?? 'badge-gray'}>
                      {v.voucher_type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{v.voucher_date}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{v.narration || '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-800">{fmt(v.total_amount)}</td>
                  <td className="px-4 py-3">
                    {v.is_posted ? (
                      <span className="badge-green">Posted</span>
                    ) : (
                      <span className="badge-yellow">Draft</span>
                    )}
                    {v.source_type && <span className="ml-1 text-xs text-gray-400">auto</span>}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Link to={`/accounting/vouchers/${v.id}`} className="text-primary-600 hover:text-primary-800 text-sm font-medium">View</Link>
                    {!v.source_type && (
                      <>
                        <button onClick={() => navigate(`/accounting/vouchers/${v.id}/edit`)} className="text-blue-500 hover:text-blue-700 text-sm font-medium">Edit</button>
                        <button onClick={() => { if (confirm('Delete this voucher?')) deleteMutation.mutate(v.id); }} className="text-red-500 hover:text-red-700 text-sm font-medium">Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {meta.total > limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 text-sm text-gray-600">
            <span>Showing {(page - 1) * limit + 1}–{Math.min(page * limit, meta.total)} of {meta.total}</span>
            <div className="flex gap-2">
              <button className="btn-secondary py-1 px-3" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
              <button className="btn-secondary py-1 px-3" disabled={page * limit >= meta.total} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
