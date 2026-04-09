import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { addToast } from '@/store/slices/uiSlice';
import api from '@/services/api';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

export default function BudgetPage() {
  const dispatch = useDispatch();
  const qc = useQueryClient();

  const [view, setView] = useState<'list' | 'variance' | 'editor'>('list');
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newForm, setNewForm] = useState({ name: '', fiscal_year_id: '' });

  const toast = {
    success: (m: string) => dispatch(addToast({ id: Date.now().toString(), type: 'success', message: m, duration: 3000 })),
    error: (m: string) => dispatch(addToast({ id: Date.now().toString(), type: 'error', message: m, duration: 5000 })),
  };

  const { data: budgets = [] } = useQuery({
    queryKey: ['accounting', 'budgets'],
    queryFn: () => api.get('/accounting/budgets').then(r => r.data.data),
  });

  const { data: fiscalYears = [] } = useQuery({
    queryKey: ['accounting', 'fiscal-years'],
    queryFn: () => api.get('/accounting/fiscal-years').then(r => r.data.data),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounting', 'accounts'],
    queryFn: () => api.get('/accounting/accounts').then(r =>
      (r.data.data as any[]).filter(a => a.account_type === 'expense' || a.account_type === 'income')
    ),
  });

  const { data: budgetDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['accounting', 'budget', selectedBudgetId],
    queryFn: () => api.get(`/accounting/budgets/${selectedBudgetId}`).then(r => r.data.data),
    enabled: !!selectedBudgetId && (view === 'editor' || view === 'variance'),
  });

  const { data: varianceData, isLoading: varianceLoading } = useQuery({
    queryKey: ['accounting', 'budget-variance', selectedBudgetId],
    queryFn: () => api.get('/accounting/reports/budget-variance', {
      params: { budget_id: selectedBudgetId }
    }).then(r => r.data.data),
    enabled: !!selectedBudgetId && view === 'variance',
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof newForm) => api.post('/accounting/budgets', data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['accounting', 'budgets'] });
      toast.success('Budget created');
      setShowNewModal(false);
      setSelectedBudgetId(res.data.data.id);
      setView('editor');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  // Local editor state: { [accountId]: { [monthKey]: amount } }
  const [editorData, setEditorData] = useState<Record<string, Record<string, number>>>({});
  const [editorYear, setEditorYear] = useState(new Date().getFullYear());
  const [editorAccounts, setEditorAccounts] = useState<string[]>([]);

  const loadEditorFromDetail = (detail: any) => {
    const data: Record<string, Record<string, number>> = {};
    const acctIds = new Set<string>();
    for (const line of detail.lines) {
      acctIds.add(line.account_id);
      const key = `${line.period_year}-${line.period_month}`;
      if (!data[line.account_id]) data[line.account_id] = {};
      data[line.account_id][key] = line.budgeted_amount;
    }
    setEditorData(data);
    setEditorAccounts(Array.from(acctIds));
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const lines: any[] = [];
      for (const accountId of editorAccounts) {
        for (let m = 1; m <= 12; m++) {
          const key = `${editorYear}-${m}`;
          const amount = editorData[accountId]?.[key] || 0;
          lines.push({ account_id: accountId, period_month: m, period_year: editorYear, budgeted_amount: amount });
        }
      }
      return api.put(`/accounting/budgets/${selectedBudgetId}/lines`, { lines });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounting', 'budget', selectedBudgetId] });
      toast.success('Budget saved');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Save failed'),
  });

  const addEditorAccount = (id: string) => {
    if (!editorAccounts.includes(id)) setEditorAccounts(prev => [...prev, id]);
  };

  const setAmount = (accountId: string, month: number, value: string) => {
    const key = `${editorYear}-${month}`;
    setEditorData(prev => ({
      ...prev,
      [accountId]: { ...(prev[accountId] || {}), [key]: parseFloat(value) || 0 },
    }));
  };

  const getAmount = (accountId: string, month: number) => {
    const key = `${editorYear}-${month}`;
    return editorData[accountId]?.[key] || 0;
  };

  const accountMap = Object.fromEntries((accounts as any[]).map((a: any) => [a.id, a]));

  return (
    <div>
      <div className="page-header mb-6 flex justify-between items-center">
        <div>
          <h1 className="page-title">Budgets</h1>
          <p className="text-sm text-slate-500 mt-0.5">Plan and track financial budgets by account</p>
        </div>
        <div className="flex gap-2">
          {selectedBudgetId && (
            <>
              <button
                className={`btn-secondary text-sm ${view === 'editor' ? 'bg-blue-50 border-blue-300' : ''}`}
                onClick={() => { setView('editor'); if (budgetDetail) loadEditorFromDetail(budgetDetail); }}
              >
                Editor
              </button>
              <button
                className={`btn-secondary text-sm ${view === 'variance' ? 'bg-blue-50 border-blue-300' : ''}`}
                onClick={() => setView('variance')}
              >
                Variance Report
              </button>
              <button className="btn-secondary text-sm" onClick={() => { setView('list'); setSelectedBudgetId(null); }}>
                ← Back
              </button>
            </>
          )}
          <button className="btn-primary text-sm" onClick={() => setShowNewModal(true)}>+ New Budget</button>
        </div>
      </div>

      {/* Budget List */}
      {view === 'list' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Budget Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Fiscal Year</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 w-32" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(budgets as any[]).length === 0 && (
                <tr><td colSpan={4} className="text-center py-10 text-gray-400">No budgets yet</td></tr>
              )}
              {(budgets as any[]).map((b: any) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{b.name}</td>
                  <td className="px-4 py-3 text-slate-600">{b.fiscal_year_name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${b.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {b.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => {
                        setSelectedBudgetId(b.id);
                        setView('editor');
                      }}
                    >
                      Open
                    </button>
                    <button
                      className="text-xs text-slate-500 hover:underline"
                      onClick={() => { setSelectedBudgetId(b.id); setView('variance'); }}
                    >
                      Variance
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Budget Editor */}
      {view === 'editor' && selectedBudgetId && (
        <div>
          <div className="flex gap-3 mb-4 items-end">
            <div>
              <label className="label">Year</label>
              <input type="number" className="input w-28" value={editorYear}
                onChange={e => setEditorYear(parseInt(e.target.value))} />
            </div>
            <div className="flex-1">
              <label className="label">Add Account</label>
              <select className="input" onChange={e => { if (e.target.value) addEditorAccount(e.target.value); e.target.value = ''; }}>
                <option value="">— select account to add —</option>
                {(accounts as any[]).filter((a: any) => !editorAccounts.includes(a.id)).map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <button
              className="btn-primary"
              disabled={editorAccounts.length === 0 || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? 'Saving…' : 'Save Budget'}
            </button>
          </div>

          {detailLoading ? (
            <div className="text-center py-8 text-gray-400">Loading…</div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: '900px' }}>
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-600 w-48">Account</th>
                    {MONTHS.map((m, i) => (
                      <th key={i} className="text-right px-2 py-2 font-medium text-gray-600 w-24">{m}</th>
                    ))}
                    <th className="text-right px-4 py-2 font-medium text-gray-600 w-28">Total</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {editorAccounts.length === 0 && (
                    <tr><td colSpan={15} className="text-center py-8 text-gray-400">Add accounts using the selector above</td></tr>
                  )}
                  {editorAccounts.map(accountId => {
                    const acct = accountMap[accountId];
                    const total = Array.from({ length: 12 }, (_, i) => getAmount(accountId, i + 1)).reduce((a, b) => a + b, 0);
                    return (
                      <tr key={accountId} className="hover:bg-gray-50">
                        <td className="px-4 py-1.5">
                          <p className="font-medium text-slate-800 text-xs">{acct?.name || accountId}</p>
                          <p className="text-[10px] text-gray-400">{acct?.account_type}</p>
                        </td>
                        {Array.from({ length: 12 }, (_, i) => (
                          <td key={i} className="px-1 py-1">
                            <input
                              type="number"
                              min="0"
                              step="100"
                              className="w-full px-1.5 py-1 text-right text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                              value={getAmount(accountId, i + 1) || ''}
                              placeholder="0"
                              onChange={e => setAmount(accountId, i + 1, e.target.value)}
                            />
                          </td>
                        ))}
                        <td className="px-4 py-1.5 text-right text-xs font-semibold text-slate-700">{fmt(total)}</td>
                        <td className="px-2 py-1.5">
                          <button
                            className="text-red-400 hover:text-red-600 text-xs"
                            onClick={() => setEditorAccounts(prev => prev.filter(id => id !== accountId))}
                          >×</button>
                        </td>
                      </tr>
                    );
                  })}
                  {editorAccounts.length > 0 && (
                    <tr className="bg-slate-800 text-white font-bold">
                      <td className="px-4 py-2 text-xs">Total</td>
                      {Array.from({ length: 12 }, (_, i) => (
                        <td key={i} className="px-1 py-2 text-right text-xs">
                          {fmt(editorAccounts.reduce((s, id) => s + getAmount(id, i + 1), 0))}
                        </td>
                      ))}
                      <td className="px-4 py-2 text-right text-xs">
                        {fmt(editorAccounts.reduce((s, id) =>
                          s + Array.from({ length: 12 }, (_, i) => getAmount(id, i + 1)).reduce((a, b) => a + b, 0), 0
                        ))}
                      </td>
                      <td />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Variance Report */}
      {view === 'variance' && selectedBudgetId && (
        <div>
          {varianceLoading && <div className="text-center py-12 text-gray-400">Loading…</div>}
          {varianceData && (
            <>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="card p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total Budgeted</p>
                  <p className="text-xl font-bold text-slate-800 mt-1">{fmt(varianceData.totals.budgeted)}</p>
                </div>
                <div className="card p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total Actual</p>
                  <p className="text-xl font-bold text-slate-800 mt-1">{fmt(varianceData.totals.actual)}</p>
                </div>
                <div className={`card p-4 border ${varianceData.totals.variance < 0 ? 'border-green-300' : 'border-red-300'}`}>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Variance</p>
                  <p className={`text-xl font-bold mt-1 ${varianceData.totals.variance < 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {fmt(Math.abs(varianceData.totals.variance))}
                    <span className="text-sm ml-1">{varianceData.totals.variance < 0 ? 'under' : 'over'}</span>
                  </p>
                </div>
              </div>

              <div className="card overflow-hidden">
                <div className="px-5 py-3 bg-slate-700 text-white text-sm font-medium">
                  {varianceData.budget_name} — {varianceData.fiscal_year}
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Account</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Period</th>
                      <th className="text-right px-4 py-2 font-medium text-gray-600">Budgeted</th>
                      <th className="text-right px-4 py-2 font-medium text-gray-600">Actual</th>
                      <th className="text-right px-4 py-2 font-medium text-gray-600">Variance</th>
                      <th className="text-right px-4 py-2 font-medium text-gray-600">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(varianceData.rows as any[]).map((r: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <p className="font-medium text-slate-800 text-xs">{r.account_name}</p>
                          <p className="text-[10px] text-gray-400">{r.account_code}</p>
                        </td>
                        <td className="px-4 py-2 text-slate-600 text-xs">
                          {MONTHS[r.period_month - 1]} {r.period_year}
                        </td>
                        <td className="px-4 py-2 text-right">{fmt(r.budgeted)}</td>
                        <td className="px-4 py-2 text-right">{fmt(r.actual)}</td>
                        <td className={`px-4 py-2 text-right font-medium ${r.variance > 0 ? 'text-red-600' : 'text-green-700'}`}>
                          {r.variance > 0 ? '+' : ''}{fmt(r.variance)}
                        </td>
                        <td className={`px-4 py-2 text-right text-xs ${Math.abs(r.variance_pct) > 20 ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
                          {r.variance_pct > 0 ? '+' : ''}{r.variance_pct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* New Budget Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">New Budget</h2>
            <div className="space-y-3">
              <div>
                <label className="label">Budget Name *</label>
                <input className="input" placeholder="e.g. Annual Budget 2025"
                  value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Fiscal Year *</label>
                <select className="input" value={newForm.fiscal_year_id}
                  onChange={e => setNewForm(f => ({ ...f, fiscal_year_id: e.target.value }))}>
                  <option value="">Select fiscal year</option>
                  {(fiscalYears as any[]).map((fy: any) => (
                    <option key={fy.id} value={fy.id}>{fy.name}</option>
                  ))}
                </select>
                {(fiscalYears as any[]).length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">No fiscal years found. Create one first.</p>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                className="btn-primary"
                disabled={!newForm.name || !newForm.fiscal_year_id || createMutation.isPending}
                onClick={() => createMutation.mutate(newForm)}
              >
                {createMutation.isPending ? 'Creating…' : 'Create'}
              </button>
              <button className="btn-secondary" onClick={() => setShowNewModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
