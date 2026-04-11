import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

const TYPE_COLORS: Record<string, string> = {
  receipt: 'badge-green', payment: 'badge-red', journal: 'badge-blue',
  contra: 'badge-yellow', sales: 'badge-blue', purchase: 'badge-gray',
  credit_note: 'badge-yellow', debit_note: 'badge-red',
};

export default function VoucherDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['accounting', 'voucher', id],
    queryFn: () => api.get(`/accounting/vouchers/${id}`).then(r => r.data.data),
    enabled: !!id,
  });

  if (isLoading) return <div className="text-center py-20 text-gray-400">Loading…</div>;
  if (!data) return <div className="text-center py-20 text-gray-400">Voucher not found</div>;

  const fmt = (n: number) => n > 0 ? `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—';

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate(-1)} className="print:hidden flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-5 text-sm font-medium">
        ← Back
      </button>

      <div className="bg-white rounded-xl border border-slate-200">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-slate-100 flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-500 font-mono mb-1">VOUCHER</p>
            <h1 className="text-2xl font-bold text-gray-900">{data.voucher_number}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className={TYPE_COLORS[data.voucher_type] ?? 'badge-gray'}>
                {data.voucher_type.replace(/_/g, ' ')}
              </span>
              <span className={data.is_posted ? 'badge-green' : 'badge-yellow'}>
                {data.is_posted ? 'Posted' : 'Draft'}
              </span>
              {data.source_type && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">auto-{data.source_type}</span>}
            </div>
          </div>
          <div className="text-right text-sm text-gray-600">
            <p className="font-semibold text-gray-900">{data.voucher_date}</p>
            {data.reference && <p className="text-xs text-gray-400 mt-1">Ref: {data.reference}</p>}
            {data.created_at && <p className="text-xs text-gray-400 mt-0.5">{new Date(data.created_at).toLocaleString()}</p>}
          </div>
        </div>

        {data.narration && (
          <div className="px-6 py-3 bg-blue-50 border-b border-slate-100 text-sm text-gray-600">
            <span className="font-medium">Narration:</span> {data.narration}
          </div>
        )}

        {/* Lines */}
        <div className="px-6 py-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 font-medium text-gray-600 w-1/2">Account</th>
                <th className="text-right py-2 font-medium text-gray-600">Debit (Dr)</th>
                <th className="text-right py-2 font-medium text-gray-600">Credit (Cr)</th>
                <th className="text-left py-2 font-medium text-gray-600 pl-4">Narration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.lines.map((l: any) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="py-2.5">
                    <div className="font-medium text-gray-800">{l.account_name}</div>
                    {l.account_code && <div className="text-xs text-gray-400 font-mono">{l.account_code}</div>}
                  </td>
                  <td className="py-2.5 text-right text-blue-700 font-medium">{fmt(l.debit_amount)}</td>
                  <td className="py-2.5 text-right text-amber-700 font-medium">{fmt(l.credit_amount)}</td>
                  <td className="py-2.5 pl-4 text-gray-500 text-xs">{l.narration || ''}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 font-bold">
                <td className="py-3 text-gray-700">Total</td>
                <td className="py-3 text-right text-blue-700">
                  ₹{data.lines.reduce((s: number, l: any) => s + l.debit_amount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3 text-right text-amber-700">
                  ₹{data.lines.reduce((s: number, l: any) => s + l.credit_amount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Actions */}
        <div className="print:hidden px-6 py-4 bg-gray-50 border-t border-slate-100 flex gap-3 flex-wrap">
          <button onClick={() => window.print()} className="btn-secondary text-sm">Print</button>
          {!data.source_type && (
            <Link to={`/accounting/vouchers/${data.id}/edit`} className="btn-primary text-sm">Edit</Link>
          )}
          <Link
            to={`/accounting/vouchers/${data.id}/edit`}
            state={{ clone: true }}
            onClick={async (e) => {
              e.preventDefault();
              try {
                const res = await import('@/services/api').then(m => m.default.post(`/accounting/vouchers/${data.id}/clone`));
                const newId = res.data?.data?.id;
                if (newId) window.location.href = `/accounting/vouchers/${newId}/edit`;
              } catch { alert('Clone failed'); }
            }}
            className="btn-secondary text-sm"
          >
            Clone Voucher
          </Link>
          <Link to="/accounting/vouchers" className="btn-secondary text-sm ml-auto">← All Vouchers</Link>
        </div>
      </div>
    </div>
  );
}
