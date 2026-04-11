import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

export default function TrialBalancePage() {
  const today = new Date().toISOString().slice(0, 10);
  const [asOf, setAsOf] = useState(today);

  const { data, isLoading } = useQuery({
    queryKey: ['accounting', 'trial-balance', asOf],
    queryFn: () => api.get('/accounting/reports/trial-balance', { params: { as_of: asOf } }).then(r => r.data.data),
  });

  const fmt = (n: number) => n > 0 ? `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '';

  // Group rows by group_name
  const groupedRows: Record<string, any[]> = {};
  for (const row of (data?.rows ?? [])) {
    if (!groupedRows[row.group_name]) groupedRows[row.group_name] = [];
    groupedRows[row.group_name].push(row);
  }

  return (
    <div>
      <div className="page-header mb-6">
        <h1 className="page-title">Trial Balance</h1>
        <div className="flex gap-3 items-center">
          <div>
            <label className="label">As of</label>
            <input type="date" className="input" value={asOf} onChange={e => setAsOf(e.target.value)} />
          </div>
          <button className="btn-secondary mt-5" onClick={() => window.open(`/api/v1/accounting/reports/trial-balance/export?as_of=${asOf}`, '_blank')}>Export CSV</button>
          <button className="print:hidden btn-secondary mt-5" onClick={() => window.print()}>Print</button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-6 py-3 bg-slate-700 text-white text-sm font-medium flex justify-between">
            <span>Trial Balance as of {asOf}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Account</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-28">Opening Dr</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-28">Opening Cr</th>
                <th className="text-right px-4 py-3 font-medium text-blue-600 w-28">Period Dr</th>
                <th className="text-right px-4 py-3 font-medium text-amber-600 w-28">Period Cr</th>
                <th className="text-right px-4 py-3 font-medium text-blue-700 w-28">Closing Dr</th>
                <th className="text-right px-4 py-3 font-medium text-amber-700 w-28">Closing Cr</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedRows).map(([groupName, rows]) => {
                const grpDr = rows.reduce((s, r) => s + r.closing_dr, 0);
                const grpCr = rows.reduce((s, r) => s + r.closing_cr, 0);
                return (
                  <React.Fragment key={groupName}>
                    <tr className="bg-slate-50">
                      <td colSpan={7} className="px-4 py-2 font-semibold text-slate-700 text-xs uppercase tracking-wide">
                        {groupName}
                      </td>
                    </tr>
                    {rows.map(r => (
                      <tr key={r.account_id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-6 py-2 text-gray-700">
                          {r.account_name}
                          {r.account_code && <span className="ml-2 text-gray-400 font-mono text-xs">{r.account_code}</span>}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-500">{fmt(r.opening_dr)}</td>
                        <td className="px-4 py-2 text-right text-gray-500">{fmt(r.opening_cr)}</td>
                        <td className="px-4 py-2 text-right text-blue-600">{fmt(r.period_dr)}</td>
                        <td className="px-4 py-2 text-right text-amber-600">{fmt(r.period_cr)}</td>
                        <td className="px-4 py-2 text-right text-blue-700 font-medium">{fmt(r.closing_dr)}</td>
                        <td className="px-4 py-2 text-right text-amber-700 font-medium">{fmt(r.closing_cr)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100 border-b border-gray-200">
                      <td className="px-6 py-2 text-slate-600 font-semibold text-xs">Subtotal — {groupName}</td>
                      <td colSpan={4} />
                      <td className="px-4 py-2 text-right font-bold text-blue-700">{fmt(grpDr)}</td>
                      <td className="px-4 py-2 text-right font-bold text-amber-700">{fmt(grpCr)}</td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-800 text-white font-bold">
                <td className="px-4 py-3">Grand Total</td>
                <td colSpan={4} />
                <td className="px-4 py-3 text-right text-blue-300">
                  {fmt(data?.grand_total_dr ?? 0)}
                </td>
                <td className="px-4 py-3 text-right text-amber-300">
                  {fmt(data?.grand_total_cr ?? 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
