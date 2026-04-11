import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { addToast } from '@/store/slices/uiSlice';
import { Link } from 'react-router-dom';
import api from '@/services/api';

export default function ClosingEntryPage() {
  const dispatch = useDispatch();
  const qc = useQueryClient();
  const [selectedFY, setSelectedFY] = useState('');
  const [confirm, setConfirm] = useState(false);

  const toast = {
    success: (m: string) => dispatch(addToast({ id: Date.now().toString(), type: 'success', message: m, duration: 5000 })),
    error: (m: string) => dispatch(addToast({ id: Date.now().toString(), type: 'error', message: m, duration: 6000 })),
  };

  const { data: fyData } = useQuery({
    queryKey: ['accounting', 'fiscal-years'],
    queryFn: () => api.get('/accounting/fiscal-years').then(r => r.data.data),
  });

  const fiscalYears: any[] = (fyData ?? []).filter((fy: any) => !fy.is_closed);

  const closingMutation = useMutation({
    mutationFn: () => api.post(`/accounting/fiscal-years/${selectedFY}/closing-entry`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['accounting'] });
      const d = res.data?.data;
      const netStr = d?.net_profit != null
        ? ` — Net ${d.net_profit >= 0 ? 'Profit' : 'Loss'}: ₹${Math.abs(d.net_profit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
        : '';
      toast.success(`${res.data?.message ?? 'Closing entry created'}${netStr}`);
      setConfirm(false);
      setSelectedFY('');
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.message ?? 'Failed to create closing entry');
      setConfirm(false);
    },
  });

  const fy = fiscalYears.find((f: any) => f.id === selectedFY);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="page-header mb-6">
        <h1 className="page-title">Year-End Closing Entry</h1>
      </div>

      {/* Explanation */}
      <div className="card p-5 mb-6 bg-blue-50 border border-blue-200">
        <h2 className="font-semibold text-blue-800 mb-2">What is a Closing Entry?</h2>
        <p className="text-sm text-blue-700 leading-relaxed">
          At year-end, income and expense accounts are zeroed out and the net profit (or loss)
          is transferred to <strong>Owner's Equity</strong>. This resets temporary accounts for
          the new fiscal year while preserving the cumulative equity balance.
        </p>
        <ul className="mt-3 text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>Debits all income accounts (zeroing them out)</li>
          <li>Credits all expense accounts (zeroing them out)</li>
          <li>Posts the net difference to Owner's Equity / Retained Earnings</li>
          <li>Marks the fiscal year as <strong>closed</strong> — no further vouchers can be posted</li>
        </ul>
        <p className="mt-3 text-xs text-blue-600">
          ⚠ This action is <strong>irreversible</strong>. Ensure all entries for the year are posted
          before proceeding.
        </p>
      </div>

      <div className="card p-5 space-y-5">
        <div>
          <label className="label">Select Fiscal Year to Close *</label>
          <select className="input" value={selectedFY} onChange={e => { setSelectedFY(e.target.value); setConfirm(false); }}>
            <option value="">Choose fiscal year…</option>
            {fiscalYears.map((fy: any) => (
              <option key={fy.id} value={fy.id}>
                {fy.name} ({fy.start_date} → {fy.end_date})
                {fy.is_active ? ' — Active' : ''}
              </option>
            ))}
          </select>
          {fiscalYears.length === 0 && (
            <p className="mt-2 text-sm text-gray-500">
              All fiscal years are already closed, or{' '}
              <Link to="/accounting/fiscal-years" className="text-primary-600 hover:underline">
                create a new fiscal year
              </Link>
              .
            </p>
          )}
        </div>

        {selectedFY && fy && (
          <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600">Fiscal Year</span>
              <span className="font-medium">{fy.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Period</span>
              <span className="font-medium">{fy.start_date} → {fy.end_date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Status</span>
              <span className={`font-medium ${fy.is_active ? 'text-green-600' : 'text-gray-500'}`}>
                {fy.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        )}

        {/* Confirmation checkbox */}
        {selectedFY && (
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirm}
              onChange={e => setConfirm(e.target.checked)}
              className="mt-0.5 rounded"
            />
            <span className="text-sm text-gray-700">
              I confirm that all vouchers for <strong>{fy?.name ?? 'this fiscal year'}</strong> have been
              reviewed and posted, and I want to generate the closing entry and <strong>close this period</strong>.
            </span>
          </label>
        )}

        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <button
            className="btn-primary px-6 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={!selectedFY || !confirm || closingMutation.isPending}
            onClick={() => closingMutation.mutate()}
          >
            {closingMutation.isPending ? 'Generating…' : 'Generate Closing Entry & Close Year'}
          </button>
          <Link to="/accounting/fiscal-years" className="btn-secondary">
            Manage Fiscal Years
          </Link>
        </div>
      </div>
    </div>
  );
}
