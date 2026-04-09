import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { addToast } from '@/store/slices/uiSlice';
import api from '@/services/api';

const fmt = (n: number) => n ? `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—';

const STATUS_COLOR: Record<string, string> = {
  unmatched: 'bg-red-100 text-red-700',
  matched: 'bg-green-100 text-green-700',
  manual_match: 'bg-blue-100 text-blue-700',
  exception: 'bg-amber-100 text-amber-700',
};

export default function BankReconciliationPage() {
  const dispatch = useDispatch();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [accountId, setAccountId] = useState('');
  const [dateFrom, setDateFrom] = useState(today.slice(0, 8) + '01');
  const [dateTo, setDateTo] = useState(today);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedRecon, setSelectedRecon] = useState<string | null>(null);
  const [matchVlIds, setMatchVlIds] = useState('');

  const toast = {
    success: (m: string) => dispatch(addToast({ id: Date.now().toString(), type: 'success', message: m, duration: 3000 })),
    error: (m: string) => dispatch(addToast({ id: Date.now().toString(), type: 'error', message: m, duration: 5000 })),
  };

  // Fetch bank accounts
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['accounting', 'accounts'],
    queryFn: () => api.get('/accounting/accounts').then(r =>
      (r.data.data as any[]).filter(a => a.account_type === 'asset' && a.bank_name)
    ),
  });

  // Fetch reconciliation lines
  const { data: lines = [], isLoading } = useQuery({
    queryKey: ['accounting', 'reconciliation', accountId, dateFrom, dateTo, statusFilter],
    queryFn: () => api.get('/accounting/reconciliation', {
      params: { account_id: accountId, date_from: dateFrom, date_to: dateTo, status: statusFilter || undefined }
    }).then(r => r.data.data),
    enabled: !!accountId,
  });

  // Fetch summary
  const { data: summary } = useQuery({
    queryKey: ['accounting', 'reconciliation-summary', accountId, dateFrom, dateTo],
    queryFn: () => api.get('/accounting/reconciliation/summary', {
      params: { account_id: accountId, date_from: dateFrom, date_to: dateTo }
    }).then(r => r.data.data),
    enabled: !!accountId,
  });

  const importMutation = useMutation({
    mutationFn: (data: { account_id: string; lines: any[] }) =>
      api.post('/accounting/reconciliation/import', data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['accounting', 'reconciliation'] });
      const { created, skipped } = res.data.data;
      toast.success(`Imported ${created} lines${skipped ? `, skipped ${skipped} duplicates` : ''}`);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Import failed'),
  });

  const matchMutation = useMutation({
    mutationFn: ({ id, ids }: { id: string; ids: string[] }) =>
      api.post(`/accounting/reconciliation/${id}/match`, { voucher_line_ids: ids }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounting', 'reconciliation'] });
      toast.success('Matched');
      setSelectedRecon(null);
      setMatchVlIds('');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Match failed'),
  });

  const unmatchMutation = useMutation({
    mutationFn: (id: string) => api.post(`/accounting/reconciliation/${id}/unmatch`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounting', 'reconciliation'] });
      toast.success('Unmatched');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Unmatch failed'),
  });

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !accountId) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = text.trim().split('\n');
      const headers = rows[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
      const parseLines = rows.slice(1).map(row => {
        const cols = row.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = cols[i] || ''; });
        return {
          statement_date: obj['date'] || obj['statement_date'] || obj['txn_date'],
          description: obj['description'] || obj['narration'] || obj['particulars'] || '',
          ref_number: obj['ref'] || obj['reference'] || obj['cheque_no'] || obj['utr'] || '',
          debit_amount: parseFloat(obj['debit'] || obj['withdrawal'] || obj['debit_amount'] || '0') || 0,
          credit_amount: parseFloat(obj['credit'] || obj['deposit'] || obj['credit_amount'] || '0') || 0,
          balance: parseFloat(obj['balance'] || '0') || undefined,
          value_date: obj['value_date'] || obj['val_date'] || undefined,
        };
      }).filter(l => l.statement_date && l.description);
      importMutation.mutate({ account_id: accountId, lines: parseLines });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const unmatched = (lines as any[]).filter(l => l.status === 'unmatched').length;
  const matched = (lines as any[]).filter(l => l.status !== 'unmatched').length;

  return (
    <div>
      <div className="page-header mb-6">
        <h1 className="page-title">Bank Reconciliation</h1>
        <p className="text-sm text-slate-500 mt-0.5">Match bank statement lines to voucher entries</p>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 flex flex-wrap gap-4 items-end">
        <div>
          <label className="label">Bank Account *</label>
          <select className="input" value={accountId} onChange={e => setAccountId(e.target.value)}>
            <option value="">Select bank account</option>
            {(bankAccounts as any[]).map((a: any) => (
              <option key={a.id} value={a.id}>{a.name}{a.bank_name ? ` — ${a.bank_name}` : ''}</option>
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
        <div>
          <label className="label">Status</label>
          <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            <option value="unmatched">Unmatched</option>
            <option value="matched">Matched</option>
          </select>
        </div>
        <div className="flex gap-2 mt-auto">
          <button
            className="btn-secondary text-sm"
            onClick={() => fileRef.current?.click()}
            disabled={!accountId || importMutation.isPending}
            title="Import bank statement CSV"
          >
            {importMutation.isPending ? 'Importing…' : 'Import CSV'}
          </button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
        </div>
      </div>

      {/* Summary */}
      {accountId && summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="card p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Statement Lines</p>
            <p className="text-xl font-bold text-slate-800 mt-1">{summary.statement.total_lines}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Matched</p>
            <p className="text-xl font-bold text-green-700 mt-1">{matched}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Unmatched</p>
            <p className="text-xl font-bold text-red-600 mt-1">{unmatched}</p>
          </div>
          <div className={`card p-4 ${Math.abs(summary.difference) < 0.01 ? 'border-green-300' : 'border-red-300'} border`}>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Difference</p>
            <p className={`text-xl font-bold mt-1 ${Math.abs(summary.difference) < 0.01 ? 'text-green-700' : 'text-red-600'}`}>
              {fmt(Math.abs(summary.difference))}
            </p>
            <p className="text-xs text-gray-400">{Math.abs(summary.difference) < 0.01 ? 'Reconciled' : 'Not reconciled'}</p>
          </div>
        </div>
      )}

      {!accountId && (
        <div className="text-center py-16 text-gray-400">Select a bank account to start reconciliation</div>
      )}

      {accountId && isLoading && (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      )}

      {accountId && !isLoading && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Description</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Ref</th>
                <th className="text-right px-4 py-2 font-medium text-blue-600">Debit</th>
                <th className="text-right px-4 py-2 font-medium text-amber-600">Credit</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Balance</th>
                <th className="px-4 py-2 font-medium text-gray-600">Status</th>
                <th className="px-4 py-2 w-32" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(lines as any[]).length === 0 && (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">
                  No statement lines. Import a CSV to begin.
                </td></tr>
              )}
              {(lines as any[]).map((line: any) => (
                <>
                  <tr key={line.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-slate-600">{line.statement_date}</td>
                    <td className="px-4 py-2 text-slate-800 max-w-xs truncate">{line.description}</td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{line.ref_number || '—'}</td>
                    <td className="px-4 py-2 text-right text-blue-700">{fmt(line.debit_amount)}</td>
                    <td className="px-4 py-2 text-right text-amber-700">{fmt(line.credit_amount)}</td>
                    <td className="px-4 py-2 text-right text-slate-600">{line.balance != null ? fmt(line.balance) : '—'}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[line.status] || 'bg-gray-100 text-gray-600'}`}>
                        {line.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right space-x-2">
                      {line.status === 'unmatched' ? (
                        <button
                          className="text-xs text-blue-600 hover:underline"
                          onClick={() => setSelectedRecon(selectedRecon === line.id ? null : line.id)}
                        >
                          Match
                        </button>
                      ) : (
                        <button
                          className="text-xs text-red-500 hover:underline"
                          onClick={() => unmatchMutation.mutate(line.id)}
                        >
                          Unmatch
                        </button>
                      )}
                    </td>
                  </tr>
                  {selectedRecon === line.id && (
                    <tr key={line.id + '-match'}>
                      <td colSpan={8} className="px-6 py-3 bg-blue-50 border-b border-blue-100">
                        <div className="flex gap-3 items-center">
                          <div className="flex-1">
                            <label className="label text-xs">Voucher Line IDs (comma-separated)</label>
                            <input
                              className="input text-sm"
                              placeholder="vl-uuid-1, vl-uuid-2"
                              value={matchVlIds}
                              onChange={e => setMatchVlIds(e.target.value)}
                            />
                            <p className="text-xs text-gray-400 mt-1">
                              Go to Ledger, find the matching entries, and paste their IDs here.
                            </p>
                          </div>
                          <button
                            className="btn-primary text-sm mt-5"
                            disabled={!matchVlIds.trim() || matchMutation.isPending}
                            onClick={() => matchMutation.mutate({
                              id: line.id,
                              ids: matchVlIds.split(',').map(s => s.trim()).filter(Boolean),
                            })}
                          >
                            Confirm Match
                          </button>
                          <button className="btn-secondary text-sm mt-5" onClick={() => setSelectedRecon(null)}>Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
