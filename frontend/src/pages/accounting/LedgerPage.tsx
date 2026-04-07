import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

export default function LedgerPage() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const [accountId, setAccountId] = useState('');
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);

  const { data: accounts } = useQuery({
    queryKey: ['accounting', 'accounts'],
    queryFn: () => api.get('/accounting/accounts').then(r => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['accounting', 'ledger', accountId, dateFrom, dateTo],
    queryFn: () => api.get(`/accounting/accounts/${accountId}/ledger`, {
      params: { date_from: dateFrom || undefined, date_to: dateTo || undefined },
    }).then(r => r.data.data),
    enabled: !!accountId,
  });

  const fmt = (n?: number) => n != null ? `₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—';

  return (
    <div>
      <div className="page-header mb-6">
        <h1 className="page-title">Ledger</h1>
        <button className="print:hidden btn-secondary" onClick={() => window.print()}>Print</button>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <label className="label">Account *</label>
          <select className="input" value={accountId} onChange={e => setAccountId(e.target.value)}>
            <option value="">Select account…</option>
            {(accounts ?? []).map((a: any) => (
              <option key={a.id} value={a.id}>{a.code ? `${a.code} - ` : ''}{a.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">From</label>
          <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
      </div>

      {!accountId && (
        <div className="card text-center py-12 text-gray-400">Select an account to view the ledger</div>
      )}

      {accountId && isLoading && (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      )}

      {data && (
        <div className="card overflow-hidden">
          {/* Account Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-gray-100">
            <h2 className="font-bold text-gray-800 text-lg">{data.account_name}</h2>
            <p className="text-sm text-gray-500 capitalize">{data.account_type}</p>
          </div>

          {/* Opening Balance */}
          <div className="px-6 py-3 bg-yellow-50 border-b border-gray-100 flex justify-between text-sm">
            <span className="font-medium text-gray-700">Opening Balance</span>
            <span className={`font-semibold ${data.opening_balance >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>
              {fmt(data.opening_balance)} {data.opening_balance >= 0 ? 'Dr' : 'Cr'}
            </span>
          </div>

          {/* Transactions */}
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-24">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-28">Voucher</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Narration</th>
                <th className="text-right px-4 py-3 font-medium text-blue-600 w-28">Debit</th>
                <th className="text-right px-4 py-3 font-medium text-amber-600 w-28">Credit</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-32">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.transactions.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">No transactions in this period</td></tr>
              ) : (
                data.transactions.map((t: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-600">{t.date}</td>
                    <td className="px-4 py-2.5 font-mono text-primary-600 text-xs">{t.voucher_number}</td>
                    <td className="px-4 py-2.5 text-gray-500 capitalize text-xs">{t.voucher_type?.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-2.5 text-gray-600 max-w-xs truncate">{t.narration || '—'}</td>
                    <td className="px-4 py-2.5 text-right text-blue-700">{t.debit > 0 ? fmt(t.debit) : ''}</td>
                    <td className="px-4 py-2.5 text-right text-amber-700">{t.credit > 0 ? fmt(t.credit) : ''}</td>
                    <td className={`px-4 py-2.5 text-right font-medium ${t.balance >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>
                      {fmt(t.balance)} {t.balance >= 0 ? 'Dr' : 'Cr'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-blue-50 border-t-2 border-blue-200 font-semibold">
                <td colSpan={4} className="px-4 py-3 text-gray-700">Closing Balance</td>
                <td className="px-4 py-3 text-right text-blue-700">
                  {fmt(data.transactions.reduce((s: number, t: any) => s + t.debit, 0))}
                </td>
                <td className="px-4 py-3 text-right text-amber-700">
                  {fmt(data.transactions.reduce((s: number, t: any) => s + t.credit, 0))}
                </td>
                <td className={`px-4 py-3 text-right ${data.closing_balance >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>
                  {fmt(data.closing_balance)} {data.closing_balance >= 0 ? 'Dr' : 'Cr'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
