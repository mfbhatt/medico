import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

export default function ProfitLossPage() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfYear = `${new Date().getFullYear()}-01-01`;
  const [dateFrom, setDateFrom] = useState(firstOfYear);
  const [dateTo, setDateTo] = useState(today);

  const { data, isLoading } = useQuery({
    queryKey: ['accounting', 'pl', dateFrom, dateTo],
    queryFn: () => api.get('/accounting/reports/profit-loss', {
      params: { date_from: dateFrom, date_to: dateTo },
    }).then(r => r.data.data),
  });

  const fmt = (n?: number) => n != null ? `₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00';

  return (
    <div>
      <div className="page-header mb-6">
        <h1 className="page-title">Profit & Loss Statement</h1>
        <div className="flex gap-3 items-center">
          <div>
            <label className="label">From</label>
            <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <button className="print:hidden btn-secondary mt-5" onClick={() => window.print()}>Print</button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : (
        <div className="max-w-2xl mx-auto card overflow-hidden">
          <div className="px-6 py-4 bg-slate-700 text-white text-center">
            <h2 className="font-bold text-lg">Profit & Loss Account</h2>
            <p className="text-slate-300 text-sm">For the period {dateFrom} to {dateTo}</p>
          </div>

          {/* Income */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-3 text-green-700">Income</h3>
            {(data?.income ?? []).length === 0 ? (
              <p className="text-sm text-gray-400">No income recorded</p>
            ) : (
              <div className="space-y-1.5">
                {data.income.map((r: any) => (
                  <div key={r.account_id} className="flex justify-between text-sm">
                    <span className="text-gray-600">{r.account_name}</span>
                    <span className="font-medium text-gray-800">{fmt(r.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between font-semibold text-sm border-t border-gray-200 pt-3 mt-3">
              <span className="text-green-700">Total Income</span>
              <span className="text-green-700">{fmt(data?.total_income)}</span>
            </div>
          </div>

          {/* Expenses */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-3 text-red-700">Expenses</h3>
            {(data?.expenses ?? []).length === 0 ? (
              <p className="text-sm text-gray-400">No expenses recorded</p>
            ) : (
              <div className="space-y-1.5">
                {data.expenses.map((r: any) => (
                  <div key={r.account_id} className="flex justify-between text-sm">
                    <span className="text-gray-600">{r.account_name}</span>
                    <span className="font-medium text-gray-800">{fmt(r.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between font-semibold text-sm border-t border-gray-200 pt-3 mt-3">
              <span className="text-red-700">Total Expenses</span>
              <span className="text-red-700">{fmt(data?.total_expenses)}</span>
            </div>
          </div>

          {/* Net Result */}
          <div className={`px-6 py-5 ${(data?.net_profit ?? 0) >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
            <div className={`flex justify-between text-xl font-bold ${(data?.net_profit ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              <span>Net {(data?.net_profit ?? 0) >= 0 ? 'Profit' : 'Loss'}</span>
              <span>{fmt(data?.net_profit)}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Gross Margin: {data?.total_income > 0 ? Math.round(((data.net_profit) / data.total_income) * 100) : 0}%
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
