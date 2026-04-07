import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

type BookType = 'cash' | 'bank';

export default function CashBankBookPage() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const [bookType, setBookType] = useState<BookType>('cash');
  const [accountId, setAccountId] = useState('');
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);

  // Get all accounts to let the user pick a bank account
  const { data: accounts } = useQuery({
    queryKey: ['accounting', 'accounts'],
    queryFn: () => api.get('/accounting/accounts').then(r => r.data.data),
  });

  const bankAccounts = (accounts ?? []).filter((a: any) => a.account_type === 'asset' && (a.bank_name || a.account_name?.toLowerCase().includes('bank')));

  const { data, isLoading } = useQuery({
    queryKey: ['accounting', bookType, accountId, dateFrom, dateTo],
    queryFn: () => api.get(`/accounting/reports/${bookType === 'cash' ? 'cash-book' : 'bank-book'}`, {
      params: {
        account_id: accountId || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      },
    }).then(r => r.data.data),
  });

  const fmt = (n?: number) => n != null ? `₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—';

  return (
    <div>
      <div className="page-header mb-6">
        <h1 className="page-title">{bookType === 'cash' ? 'Cash Book' : 'Bank Book'}</h1>
        <button className="print:hidden btn-secondary" onClick={() => window.print()}>Print</button>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Book Type</label>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {(['cash', 'bank'] as BookType[]).map(t => (
              <button
                key={t}
                className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${bookType === t ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                onClick={() => { setBookType(t); setAccountId(''); }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        {bookType === 'bank' && (
          <div>
            <label className="label">Bank Account</label>
            <select className="input" value={accountId} onChange={e => setAccountId(e.target.value)}>
              <option value="">Default (Primary Bank)</option>
              {bankAccounts.map((a: any) => (
                <option key={a.id} value={a.id}>{a.name}{a.bank_name ? ` — ${a.bank_name}` : ''}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label">From</label>
          <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : data ? (
        <div className="card overflow-hidden">
          <div className="px-6 py-3 bg-slate-700 text-white flex justify-between items-center">
            <span className="font-semibold">{data.account_name}</span>
            <span className={`font-bold ${data.opening_balance >= 0 ? 'text-blue-300' : 'text-amber-300'}`}>
              Opening: {fmt(data.opening_balance)} {data.opening_balance >= 0 ? 'Dr' : 'Cr'}
            </span>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Voucher</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Narration</th>
                <th className="text-right px-4 py-3 font-medium text-green-600">Receipts (Dr)</th>
                <th className="text-right px-4 py-3 font-medium text-red-600">Payments (Cr)</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.transactions.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">No transactions in this period</td></tr>
              ) : (
                data.transactions.map((t: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-600">{t.date}</td>
                    <td className="px-4 py-2.5 font-mono text-primary-600 text-xs">{t.voucher_number}</td>
                    <td className="px-4 py-2.5 text-gray-600 max-w-xs truncate">{t.narration || '—'}</td>
                    <td className="px-4 py-2.5 text-right text-green-700 font-medium">{t.debit > 0 ? fmt(t.debit) : ''}</td>
                    <td className="px-4 py-2.5 text-right text-red-600 font-medium">{t.credit > 0 ? fmt(t.credit) : ''}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${t.balance >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>
                      {fmt(t.balance)} {t.balance >= 0 ? 'Dr' : 'Cr'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-800 text-white font-bold">
                <td colSpan={3} className="px-4 py-3">Closing Balance</td>
                <td className="px-4 py-3 text-right text-green-300">
                  {fmt(data.transactions.reduce((s: number, t: any) => s + t.debit, 0))}
                </td>
                <td className="px-4 py-3 text-right text-red-300">
                  {fmt(data.transactions.reduce((s: number, t: any) => s + t.credit, 0))}
                </td>
                <td className={`px-4 py-3 text-right ${data.closing_balance >= 0 ? 'text-blue-300' : 'text-amber-300'}`}>
                  {fmt(data.closing_balance)} {data.closing_balance >= 0 ? 'Dr' : 'Cr'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}
    </div>
  );
}
