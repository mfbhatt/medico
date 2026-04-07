import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

const BUCKET_LABELS: Record<string, string> = {
  '0_30': '0–30 days',
  '31_60': '31–60 days',
  '61_90': '61–90 days',
  'over_90': '90+ days',
};

const BUCKET_COLORS: Record<string, string> = {
  '0_30': 'badge-green',
  '31_60': 'badge-yellow',
  '61_90': 'text-orange-700 bg-orange-100 rounded-full px-2 py-0.5 text-xs font-medium',
  'over_90': 'badge-red',
};

export default function ARAgingPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [asOf, setAsOf] = useState(today);
  const [bucket, setBucket] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['accounting', 'ar-aging', asOf],
    queryFn: () => api.get('/accounting/reports/ar-aging', { params: { as_of: asOf } }).then(r => r.data.data),
  });

  const fmt = (n?: number) => n != null ? `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—';
  const rows = (data?.rows ?? []).filter((r: any) => !bucket || r.bucket === bucket);

  return (
    <div>
      <div className="page-header mb-6">
        <h1 className="page-title">Accounts Receivable Aging</h1>
        <div className="flex gap-3 items-center">
          <div>
            <label className="label">As of</label>
            <input type="date" className="input" value={asOf} onChange={e => setAsOf(e.target.value)} />
          </div>
          <button className="print:hidden btn-secondary mt-5" onClick={() => window.print()}>Print</button>
        </div>
      </div>

      {/* Summary Cards */}
      {data?.summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          {[
            { key: '0_30_days', label: '0–30 days', bucket: '0_30', color: 'border-green-500' },
            { key: '31_60_days', label: '31–60 days', bucket: '31_60', color: 'border-yellow-500' },
            { key: '61_90_days', label: '61–90 days', bucket: '61_90', color: 'border-orange-500' },
            { key: 'over_90_days', label: '90+ days', bucket: 'over_90', color: 'border-red-600' },
            { key: 'total_outstanding', label: 'Total Outstanding', bucket: '', color: 'border-slate-600' },
          ].map(({ key, label, bucket: b, color }) => (
            <button
              key={key}
              onClick={() => setBucket(prev => prev === b ? '' : b)}
              className={`card p-4 border-l-4 text-left hover:shadow-md transition-shadow ${color} ${bucket === b ? 'ring-2 ring-primary-400' : ''}`}
            >
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{fmt(data.summary[key])}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {data.rows.filter((r: any) => !b || r.bucket === b).length} invoices
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Invoice #</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Patient</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Due Date</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Days Overdue</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Age Bucket</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Balance Due</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">
                  {bucket ? 'No invoices in this bucket' : 'No outstanding invoices'}
                </td></tr>
              ) : (
                rows.map((r: any) => (
                  <tr key={r.invoice_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-primary-600 font-medium">{r.invoice_number}</td>
                    <td className="px-4 py-3 text-gray-800">{r.patient_name}</td>
                    <td className="px-4 py-3 text-gray-600">{r.due_date}</td>
                    <td className="px-4 py-3 text-right font-medium text-red-600">{r.days_overdue}</td>
                    <td className="px-4 py-3">
                      <span className={BUCKET_COLORS[r.bucket] ?? 'badge-gray'}>
                        {BUCKET_LABELS[r.bucket]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(r.balance_due)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/billing/invoices/${r.invoice_id}`} className="text-primary-600 hover:text-primary-800 text-sm font-medium">
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-semibold border-t border-gray-200">
                  <td colSpan={5} className="px-4 py-3 text-gray-700">
                    Total ({rows.length} invoices)
                  </td>
                  <td className="px-4 py-3 text-right text-red-700">
                    {fmt(rows.reduce((s: number, r: any) => s + r.balance_due, 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
