import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

const TYPE_COLORS: Record<string, string> = {
  receipt: 'bg-green-100 text-green-800', payment: 'bg-red-100 text-red-800',
  journal: 'bg-blue-100 text-blue-800', contra: 'bg-yellow-100 text-yellow-800',
  sales: 'bg-indigo-100 text-indigo-800', purchase: 'bg-gray-100 text-gray-800',
  credit_note: 'bg-yellow-100 text-yellow-800', debit_note: 'bg-red-100 text-red-800',
};

export default function DayBookPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);

  const { data, isLoading } = useQuery({
    queryKey: ['accounting', 'daybook', date],
    queryFn: () => api.get('/accounting/reports/day-book', { params: { date } }).then(r => r.data.data),
    enabled: !!date,
  });

  const fmt = (n?: number) => n != null ? `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—';

  return (
    <div>
      <div className="page-header mb-6">
        <h1 className="page-title">Day Book</h1>
        <div className="flex items-center gap-3">
          <input type="date" className="input w-auto" value={date} onChange={e => setDate(e.target.value)} />
          <button className="print:hidden btn-secondary" onClick={() => window.print()}>Print</button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : !data?.vouchers?.length ? (
        <div className="card text-center py-12 text-gray-400">No transactions for {date}</div>
      ) : (
        <>
          <div className="space-y-4 mb-6">
            {data.vouchers.map((v: any, i: number) => (
              <div key={i} className="card overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-semibold text-primary-700">{v.voucher_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[v.voucher_type] ?? 'bg-gray-100 text-gray-700'}`}>
                      {v.voucher_type.replace(/_/g, ' ')}
                    </span>
                    {v.narration && <span className="text-sm text-gray-500">{v.narration}</span>}
                  </div>
                  <div className="text-sm font-semibold text-gray-700">{fmt(v.total_debit)}</div>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {v.lines.map((l: any, j: number) => (
                      <tr key={j} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                        <td className="px-6 py-2 text-gray-700 w-1/2">{l.account_name}</td>
                        <td className="px-4 py-2 text-right text-blue-700">{l.debit > 0 ? fmt(l.debit) : ''}</td>
                        <td className="px-4 py-2 text-right text-amber-700">{l.credit > 0 ? fmt(l.credit) : ''}</td>
                        <td className="px-4 py-2 text-gray-400 text-xs">{l.narration || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          {/* Day Totals */}
          <div className="card p-4 bg-slate-800 text-white">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Day Totals ({data.vouchers.length} voucher{data.vouchers.length !== 1 ? 's' : ''})</span>
              <div className="flex gap-8 text-sm">
                <div>
                  <span className="text-slate-400 mr-2">Total Debit:</span>
                  <span className="font-bold text-blue-300">{fmt(data.total_debit)}</span>
                </div>
                <div>
                  <span className="text-slate-400 mr-2">Total Credit:</span>
                  <span className="font-bold text-amber-300">{fmt(data.total_credit)}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
