import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

const BUCKET_COLS = [
  { key: '0_30_days',   label: '0–30 days',   color: 'text-green-600' },
  { key: '31_60_days',  label: '31–60 days',  color: 'text-yellow-600' },
  { key: '61_90_days',  label: '61–90 days',  color: 'text-orange-500' },
  { key: 'over_90_days', label: '90+ days',   color: 'text-red-600' },
];

export default function APAgingPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [asOf, setAsOf] = useState(today);

  const { data, isLoading } = useQuery({
    queryKey: ['accounting', 'ap-aging', asOf],
    queryFn: () => api.get('/accounting/reports/ap-aging', { params: { as_of: asOf } }).then(r => r.data.data),
  });

  const fmt = (n?: number) => n != null ? `₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—';

  const exportCSV = () => {
    const url = `/api/v1/accounting/reports/ap-aging/export?as_of=${asOf}`;
    window.open(url, '_blank');
  };

  const rows: any[] = data?.rows ?? [];
  const summary = data?.summary ?? {};

  // Group rows by bucket for the bar chart
  const total = summary.total_outstanding || 1;

  return (
    <div>
      <div className="page-header mb-6">
        <h1 className="page-title">AP Aging — Accounts Payable</h1>
        <div className="flex gap-2 items-end">
          <div>
            <label className="label">As of</label>
            <input type="date" className="input" value={asOf} onChange={e => setAsOf(e.target.value)} />
          </div>
          <button className="btn-secondary" onClick={exportCSV}>Export CSV</button>
          <button className="print:hidden btn-secondary" onClick={() => window.print()}>Print</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {BUCKET_COLS.map(({ key, label, color }) => (
          <div key={key} className="card p-4">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{fmt(summary[key])}</p>
            <div className="mt-2 h-1.5 bg-gray-100 rounded-full">
              <div
                className={`h-full rounded-full ${color.replace('text-', 'bg-')}`}
                style={{ width: `${Math.min(100, ((summary[key] || 0) / total) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="card p-4 mb-3 flex justify-between text-sm font-semibold text-gray-700 bg-amber-50 border border-amber-200 rounded-xl">
        <span>Total Payables Outstanding</span>
        <span className="text-amber-700 text-base">{fmt(summary.total_outstanding)}</span>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">No outstanding payables as of {asOf}</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Account</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-32">Voucher</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-24">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-24">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Narration</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-28">Amount</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-20">Days</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-24">Bucket</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r: any, i: number) => {
                const bucketColor: Record<string, string> = {
                  '0_30_days': 'text-green-600 bg-green-50',
                  '31_60_days': 'text-yellow-700 bg-yellow-50',
                  '61_90_days': 'text-orange-600 bg-orange-50',
                  'over_90_days': 'text-red-600 bg-red-50',
                };
                return (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-700 font-medium">{r.account_name}</td>
                    <td className="px-4 py-2.5 font-mono text-primary-600 text-xs">{r.voucher_number}</td>
                    <td className="px-4 py-2.5 text-gray-500">{r.voucher_date}</td>
                    <td className="px-4 py-2.5 text-gray-500 capitalize text-xs">{r.voucher_type?.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-2.5 text-gray-500 max-w-xs truncate">{r.narration || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-800">{fmt(r.amount)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{r.days_old}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${bucketColor[r.bucket] ?? ''}`}>
                        {r.bucket?.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
