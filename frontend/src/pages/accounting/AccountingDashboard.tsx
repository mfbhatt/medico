import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/services/api';

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className={`card p-5 border-l-4 ${color}`}>
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function AccountingDashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().slice(0, 10);

  const { data: pl } = useQuery({
    queryKey: ['accounting', 'pl', firstOfMonth, today],
    queryFn: () => api.get('/accounting/reports/profit-loss', { params: { date_from: firstOfMonth, date_to: today } }).then(r => r.data.data),
  });

  const { data: bs } = useQuery({
    queryKey: ['accounting', 'bs', today],
    queryFn: () => api.get('/accounting/reports/balance-sheet', { params: { as_of: today } }).then(r => r.data.data),
  });

  const { data: ar } = useQuery({
    queryKey: ['accounting', 'ar', today],
    queryFn: () => api.get('/accounting/reports/ar-aging', { params: { as_of: today } }).then(r => r.data.data),
  });

  const { data: dayBook } = useQuery({
    queryKey: ['accounting', 'daybook', today],
    queryFn: () => api.get('/accounting/reports/day-book', { params: { date: today } }).then(r => r.data.data),
  });

  const fmt = (n?: number) => n != null ? `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—';

  // Find cash balance from balance sheet
  const cashAccount = bs?.assets?.find((a: any) => a.account_name === 'Cash in Hand');
  const bankAccount = bs?.assets?.find((a: any) => a.account_name === 'Primary Bank Account');

  return (
    <div>
      <div className="page-header mb-6">
        <h1 className="page-title">Accounting Dashboard</h1>
        <Link to="/accounting/vouchers/new" className="btn-primary">+ New Voucher</Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Cash in Hand"
          value={fmt(cashAccount?.amount)}
          sub="Current balance"
          color="border-green-500"
        />
        <KpiCard
          label="Bank Balance"
          value={fmt(bankAccount?.amount)}
          sub="Primary account"
          color="border-blue-500"
        />
        <KpiCard
          label="Total Receivables"
          value={fmt(ar?.summary?.total_outstanding)}
          sub="Outstanding invoices"
          color="border-orange-500"
        />
        <KpiCard
          label={`Net P&L (${new Date().toLocaleString('default', { month: 'short' })})`}
          value={fmt(pl?.net_profit)}
          sub={pl?.net_profit >= 0 ? 'Profit' : 'Loss'}
          color={pl?.net_profit >= 0 ? 'border-emerald-500' : 'border-red-500'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Transactions */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Today's Transactions</h2>
            <Link to="/accounting/day-book" className="text-sm text-primary-600 hover:text-primary-800">
              Day Book →
            </Link>
          </div>
          {!dayBook?.vouchers?.length ? (
            <p className="text-sm text-gray-400 py-4 text-center">No transactions today</p>
          ) : (
            <div className="space-y-2">
              {dayBook.vouchers.slice(0, 8).map((v: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                  <div>
                    <span className="font-medium text-gray-800">{v.voucher_number}</span>
                    <span className="ml-2 text-gray-400 capitalize text-xs">{v.voucher_type.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-green-600 font-medium">{fmt(v.total_debit)}</div>
                  </div>
                </div>
              ))}
              {dayBook.vouchers.length > 8 && (
                <p className="text-xs text-gray-400 text-center pt-1">+{dayBook.vouchers.length - 8} more</p>
              )}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs font-semibold text-gray-600">
            <span>Total DR: {fmt(dayBook?.total_debit)}</span>
            <span>Total CR: {fmt(dayBook?.total_credit)}</span>
          </div>
        </div>

        {/* AR Aging Summary */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Receivables Aging</h2>
            <Link to="/accounting/reports/ar-aging" className="text-sm text-primary-600 hover:text-primary-800">
              Full Report →
            </Link>
          </div>
          <div className="space-y-3">
            {[
              { label: '0–30 days', key: '0_30_days', color: 'bg-green-500' },
              { label: '31–60 days', key: '31_60_days', color: 'bg-yellow-500' },
              { label: '61–90 days', key: '61_90_days', color: 'bg-orange-500' },
              { label: '90+ days', key: 'over_90_days', color: 'bg-red-500' },
            ].map(({ label, key, color }) => {
              const val = ar?.summary?.[key] ?? 0;
              const total = ar?.summary?.total_outstanding || 1;
              const pct = Math.round((val / total) * 100);
              return (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-medium">{fmt(val)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between text-sm font-semibold">
            <span className="text-gray-600">Total Outstanding</span>
            <span className="text-red-600">{fmt(ar?.summary?.total_outstanding)}</span>
          </div>
        </div>

        {/* P&L Summary */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">P&L — This Month</h2>
            <Link to="/accounting/reports/profit-loss" className="text-sm text-primary-600 hover:text-primary-800">
              Full P&L →
            </Link>
          </div>
          <div className="space-y-2">
            {pl?.income?.map((r: any) => (
              <div key={r.account_id} className="flex justify-between text-sm">
                <span className="text-gray-600">{r.account_name}</span>
                <span className="text-green-600">{fmt(r.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-2 mt-2">
              <span>Total Income</span>
              <span className="text-green-700">{fmt(pl?.total_income)}</span>
            </div>
            {pl?.expenses?.map((r: any) => (
              <div key={r.account_id} className="flex justify-between text-sm">
                <span className="text-gray-600">{r.account_name}</span>
                <span className="text-red-500">{fmt(r.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-2 mt-2">
              <span>Total Expenses</span>
              <span className="text-red-600">{fmt(pl?.total_expenses)}</span>
            </div>
            <div className={`flex justify-between text-base font-bold border-t-2 border-gray-200 pt-3 mt-2 ${(pl?.net_profit ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              <span>Net {(pl?.net_profit ?? 0) >= 0 ? 'Profit' : 'Loss'}</span>
              <span>{fmt(Math.abs(pl?.net_profit ?? 0))}</span>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Quick Access</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Chart of Accounts', href: '/accounting/chart-of-accounts', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
              { label: 'Voucher Entry', href: '/accounting/vouchers/new', color: 'bg-green-50 text-green-700 hover:bg-green-100' },
              { label: 'Day Book', href: '/accounting/day-book', color: 'bg-purple-50 text-purple-700 hover:bg-purple-100' },
              { label: 'Ledger', href: '/accounting/ledger', color: 'bg-orange-50 text-orange-700 hover:bg-orange-100' },
              { label: 'Trial Balance', href: '/accounting/reports/trial-balance', color: 'bg-teal-50 text-teal-700 hover:bg-teal-100' },
              { label: 'Balance Sheet', href: '/accounting/reports/balance-sheet', color: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' },
              { label: 'Cash Book', href: '/accounting/reports/cash-book', color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
              { label: 'AR Aging', href: '/accounting/reports/ar-aging', color: 'bg-red-50 text-red-700 hover:bg-red-100' },
            ].map(({ label, href, color }) => (
              <Link key={href} to={href} className={`${color} rounded-lg p-3 text-sm font-medium text-center transition-colors`}>
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
