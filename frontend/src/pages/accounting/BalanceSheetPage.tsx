import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

export default function BalanceSheetPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [asOf, setAsOf] = useState(today);

  const { data, isLoading } = useQuery({
    queryKey: ['accounting', 'balance-sheet', asOf],
    queryFn: () => api.get('/accounting/reports/balance-sheet', { params: { as_of: asOf } }).then(r => r.data.data),
  });

  const fmt = (n?: number) => n != null ? `₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00';

  function Section({ title, rows, total, color }: { title: string; rows: any[]; total: number; color: string }) {
    return (
      <div>
        <h3 className={`font-semibold text-sm uppercase tracking-wide mb-3 ${color}`}>{title}</h3>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-400">No entries</p>
        ) : (
          <div className="space-y-1.5">
            {rows.map((r: any) => (
              <div key={r.account_id} className="flex justify-between text-sm">
                <div>
                  <span className="text-gray-700">{r.account_name}</span>
                  {r.account_code && <span className="ml-1 text-gray-400 font-mono text-xs">{r.account_code}</span>}
                </div>
                <span className="font-medium text-gray-800">{fmt(r.amount)}</span>
              </div>
            ))}
          </div>
        )}
        <div className={`flex justify-between font-bold text-sm border-t border-gray-200 pt-3 mt-3 ${color}`}>
          <span>Total {title}</span>
          <span>{fmt(total)}</span>
        </div>
      </div>
    );
  }

  const totalLiabEq = (data?.total_liabilities_equity ?? 0);
  const balanced = Math.abs((data?.total_assets ?? 0) - totalLiabEq) < 1;

  return (
    <div>
      <div className="page-header mb-6">
        <h1 className="page-title">Balance Sheet</h1>
        <div className="flex gap-3 items-center">
          <div>
            <label className="label">As of</label>
            <input type="date" className="input" value={asOf} onChange={e => setAsOf(e.target.value)} />
          </div>
          <button className="btn-secondary mt-5" onClick={() => window.open(`/api/v1/accounting/reports/balance-sheet/export?as_of=${asOf}`, '_blank')}>Export CSV</button>
          <button className="print:hidden btn-secondary mt-5" onClick={() => window.print()}>Print</button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 bg-slate-700 text-white text-center">
            <h2 className="font-bold text-lg">Balance Sheet</h2>
            <p className="text-slate-300 text-sm">As of {asOf}</p>
            {!balanced && (
              <p className="text-red-300 text-xs mt-1">⚠ Sheet is not balanced — check for missing vouchers</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
            {/* Left: Assets */}
            <div className="px-6 py-5 space-y-6">
              <Section title="Assets" rows={data?.assets ?? []} total={data?.total_assets ?? 0} color="text-blue-700" />
            </div>

            {/* Right: Liabilities + Equity */}
            <div className="px-6 py-5 space-y-6">
              <Section title="Liabilities" rows={data?.liabilities ?? []} total={data?.liabilities?.reduce((s: number, r: any) => s + r.amount, 0) ?? 0} color="text-red-700" />
              <Section title="Equity" rows={data?.equity ?? []} total={data?.equity?.reduce((s: number, r: any) => s + r.amount, 0) ?? 0} color="text-emerald-700" />

              {/* Retained Earnings */}
              <div className="flex justify-between text-sm border-t border-gray-200 pt-3">
                <span className="text-gray-600">Retained Earnings (Net P&L)</span>
                <span className={`font-medium ${(data?.retained_earnings ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {fmt(data?.retained_earnings)}
                </span>
              </div>

              <div className="flex justify-between font-bold text-sm border-t-2 border-gray-300 pt-3 text-amber-700">
                <span>Total Liabilities & Equity</span>
                <span>{fmt(totalLiabEq)}</span>
              </div>
            </div>
          </div>

          {/* Footer balance check */}
          <div className={`px-6 py-3 border-t border-gray-200 text-center text-sm font-semibold ${balanced ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {balanced
              ? `✓ Balance Sheet is balanced — Total Assets = Total Liabilities & Equity = ${fmt(data?.total_assets)}`
              : `Balance Sheet difference: ${fmt(Math.abs((data?.total_assets ?? 0) - totalLiabEq))}`}
          </div>
        </div>
      )}
    </div>
  );
}
