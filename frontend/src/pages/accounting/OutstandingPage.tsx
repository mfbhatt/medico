import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/services/api';

export default function OutstandingPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [reportType, setReportType] = useState<'receivables' | 'payables'>('receivables');
  const [asOf, setAsOf] = useState(today);

  const { data, isLoading } = useQuery({
    queryKey: ['accounting', 'outstanding', reportType, asOf],
    queryFn: () =>
      api.get('/accounting/reports/outstanding', { params: { report_type: reportType, as_of: asOf } })
        .then(r => r.data.data),
  });

  const fmt = (n?: number) =>
    n != null ? `₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—';

  const rows: any[] = data?.rows ?? [];
  const total: number = data?.total ?? 0;

  const exportCSV = () => {
    window.open(`/api/v1/accounting/reports/outstanding/export?report_type=${reportType}&as_of=${asOf}`, '_blank');
  };

  return (
    <div>
      <div className="page-header mb-6">
        <h1 className="page-title">Outstanding — Party Wise</h1>
        <div className="flex gap-2 items-end">
          <div>
            <label className="label">Type</label>
            <select className="input" value={reportType} onChange={e => setReportType(e.target.value as any)}>
              <option value="receivables">Receivables (Debtors)</option>
              <option value="payables">Payables (Creditors)</option>
            </select>
          </div>
          <div>
            <label className="label">As of</label>
            <input type="date" className="input" value={asOf} onChange={e => setAsOf(e.target.value)} />
          </div>
          <button className="btn-secondary" onClick={exportCSV}>Export CSV</button>
          <button className="print:hidden btn-secondary" onClick={() => window.print()}>Print</button>
        </div>
      </div>

      {/* Total banner */}
      <div className={`card p-4 mb-4 flex justify-between items-center text-sm font-semibold border-l-4 ${
        reportType === 'receivables' ? 'border-blue-500 bg-blue-50' : 'border-amber-500 bg-amber-50'
      }`}>
        <span className="text-gray-700">
          Total {reportType === 'receivables' ? 'Receivables' : 'Payables'} Outstanding
        </span>
        <span className={`text-lg font-bold ${reportType === 'receivables' ? 'text-blue-700' : 'text-amber-700'}`}>
          {fmt(total)}
        </span>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          No outstanding {reportType} as of {asOf}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Party</th>
                {reportType === 'receivables' ? (
                  <>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 w-28">Phone</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600 w-28">Invoices</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 w-28">Oldest Due</th>
                  </>
                ) : (
                  <>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Reference</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Narration</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 w-24">Oldest</th>
                  </>
                )}
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-32">Outstanding</th>
                {reportType === 'receivables' && (
                  <th className="w-20 px-4 py-3" />
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r: any, i: number) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{r.party_name}</td>
                  {reportType === 'receivables' ? (
                    <>
                      <td className="px-4 py-2.5 text-gray-500">{r.phone || '—'}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{r.invoice_count}</td>
                      <td className="px-4 py-2.5 text-gray-500">{r.oldest_due || '—'}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{r.reference || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-500 max-w-xs truncate">{r.narration || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-500">{r.oldest_date || '—'}</td>
                    </>
                  )}
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-800">
                    {fmt(r.total_outstanding)}
                  </td>
                  {reportType === 'receivables' && (
                    <td className="px-4 py-2.5 text-center">
                      <Link
                        to={`/accounting/reports/ar-aging`}
                        className="text-xs text-primary-600 hover:underline"
                      >
                        AR →
                      </Link>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-700 text-white font-bold">
                <td
                  colSpan={reportType === 'receivables' ? 5 : 4}
                  className="px-4 py-3 text-sm"
                >
                  Total Outstanding
                </td>
                <td className="px-4 py-3 text-right">{fmt(total)}</td>
                {reportType === 'receivables' && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
