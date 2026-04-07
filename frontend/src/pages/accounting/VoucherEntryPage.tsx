import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { addToast } from '@/store/slices/uiSlice';
import api from '@/services/api';

const VOUCHER_TYPES = [
  { value: 'receipt', label: 'Receipt (Money In)' },
  { value: 'payment', label: 'Payment (Money Out)' },
  { value: 'journal', label: 'Journal Entry' },
  { value: 'contra', label: 'Contra (Cash ↔ Bank)' },
  { value: 'sales', label: 'Sales' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'credit_note', label: 'Credit Note' },
  { value: 'debit_note', label: 'Debit Note' },
];

interface Line {
  account_id: string;
  debit_amount: string;
  credit_amount: string;
  narration: string;
}

export default function VoucherEntryPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const qc = useQueryClient();
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;

  const today = new Date().toISOString().slice(0, 10);
  const [voucherType, setVoucherType] = useState('journal');
  const [voucherDate, setVoucherDate] = useState(today);
  const [narration, setNarration] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<Line[]>([
    { account_id: '', debit_amount: '', credit_amount: '', narration: '' },
    { account_id: '', debit_amount: '', credit_amount: '', narration: '' },
  ]);

  const toast = {
    success: (m: string) => dispatch(addToast({ id: Date.now().toString(), type: 'success', message: m, duration: 3000 })),
    error: (m: string) => dispatch(addToast({ id: Date.now().toString(), type: 'error', message: m, duration: 5000 })),
  };

  const { data: accounts } = useQuery({
    queryKey: ['accounting', 'accounts'],
    queryFn: () => api.get('/accounting/accounts').then(r => r.data.data),
  });

  const { data: existing } = useQuery({
    queryKey: ['accounting', 'voucher', id],
    queryFn: () => api.get(`/accounting/vouchers/${id}`).then(r => r.data.data),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      setVoucherType(existing.voucher_type);
      setVoucherDate(existing.voucher_date);
      setNarration(existing.narration || '');
      setReference(existing.reference || '');
      setLines(existing.lines.map((l: any) => ({
        account_id: l.account_id,
        debit_amount: l.debit_amount > 0 ? String(l.debit_amount) : '',
        credit_amount: l.credit_amount > 0 ? String(l.credit_amount) : '',
        narration: l.narration || '',
      })));
    }
  }, [existing]);

  const totalDr = lines.reduce((s, l) => s + (parseFloat(l.debit_amount) || 0), 0);
  const totalCr = lines.reduce((s, l) => s + (parseFloat(l.credit_amount) || 0), 0);
  const balanced = Math.abs(totalDr - totalCr) < 0.01 && totalDr > 0;

  const setLine = (i: number, field: keyof Line, value: string) => {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  };

  const addLine = () => setLines(prev => [...prev, { account_id: '', debit_amount: '', credit_amount: '', narration: '' }]);
  const removeLine = (i: number) => { if (lines.length > 2) setLines(prev => prev.filter((_, idx) => idx !== i)); };

  const saveMutation = useMutation({
    mutationFn: (data: any) => isEdit ? api.put(`/accounting/vouchers/${id}`, data) : api.post('/accounting/vouchers', data),
    onSuccess: (_res) => {
      qc.invalidateQueries({ queryKey: ['accounting'] });
      toast.success(isEdit ? 'Voucher updated' : 'Voucher created');
      navigate('/accounting/vouchers');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to save voucher'),
  });

  const handleSubmit = () => {
    const validLines = lines.filter(l => l.account_id && (parseFloat(l.debit_amount) > 0 || parseFloat(l.credit_amount) > 0));
    if (validLines.length < 2) { toast.error('At least 2 lines with amounts required'); return; }
    if (!balanced) { toast.error('Debit total must equal Credit total'); return; }

    saveMutation.mutate({
      voucher_type: voucherType,
      voucher_date: voucherDate,
      narration,
      reference,
      lines: validLines.map(l => ({
        account_id: l.account_id,
        debit_amount: parseFloat(l.debit_amount) || 0,
        credit_amount: parseFloat(l.credit_amount) || 0,
        narration: l.narration || undefined,
      })),
    });
  };

  const accountOptions = (accounts ?? []).map((a: any) => ({ value: a.id, label: `${a.code ? a.code + ' - ' : ''}${a.name}` }));

  return (
    <div className="max-w-4xl mx-auto">
      <div className="page-header mb-6">
        <h1 className="page-title">{isEdit ? 'Edit Voucher' : 'New Voucher Entry'}</h1>
      </div>

      <div className="card p-6 space-y-5">
        {/* Header fields */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="label">Voucher Type *</label>
            <select className="input" value={voucherType} onChange={e => setVoucherType(e.target.value)}>
              {VOUCHER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Date *</label>
            <input type="date" className="input" value={voucherDate} onChange={e => setVoucherDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Reference</label>
            <input className="input" value={reference} onChange={e => setReference(e.target.value)} placeholder="Invoice #, etc." />
          </div>
          <div>
            <label className="label">Narration</label>
            <input className="input" value={narration} onChange={e => setNarration(e.target.value)} placeholder="Description" />
          </div>
        </div>

        {/* Lines table */}
        <div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-2 font-medium text-gray-600 w-5/12">Account</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600 w-2/12">Debit (Dr)</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600 w-2/12">Credit (Cr)</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 w-2/12">Narration</th>
                <th className="w-1/12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lines.map((line, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-2 py-1.5">
                    <select
                      className="input py-1.5 text-sm"
                      value={line.account_id}
                      onChange={e => setLine(i, 'account_id', e.target.value)}
                    >
                      <option value="">Select account</option>
                      {accountOptions.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input py-1.5 text-sm text-right"
                      value={line.debit_amount}
                      onChange={e => setLine(i, 'debit_amount', e.target.value)}
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input py-1.5 text-sm text-right"
                      value={line.credit_amount}
                      onChange={e => setLine(i, 'credit_amount', e.target.value)}
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      className="input py-1.5 text-sm"
                      value={line.narration}
                      onChange={e => setLine(i, 'narration', e.target.value)}
                      placeholder="Optional"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {lines.length > 2 && (
                      <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={`font-semibold text-sm border-t-2 ${balanced ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
                <td className="px-3 py-2 text-gray-700">Total</td>
                <td className={`px-3 py-2 text-right font-bold ${balanced ? 'text-green-700' : 'text-red-600'}`}>
                  ₹{totalDr.toFixed(2)}
                </td>
                <td className={`px-3 py-2 text-right font-bold ${balanced ? 'text-green-700' : 'text-red-600'}`}>
                  ₹{totalCr.toFixed(2)}
                </td>
                <td colSpan={2} className="px-3 py-2">
                  {balanced ? (
                    <span className="text-green-700 text-sm font-semibold">✓ Balanced</span>
                  ) : (
                    <span className="text-red-600 text-sm font-semibold">
                      ✗ Off by ₹{Math.abs(totalDr - totalCr).toFixed(2)}
                    </span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>

          <button onClick={addLine} className="mt-2 text-sm text-primary-600 hover:text-primary-800 flex items-center gap-1">
            + Add line
          </button>
        </div>

        {/* Balance status banner */}
        {totalDr > 0 || totalCr > 0 ? (
          balanced ? (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              <span className="text-base">✓</span>
              <span className="font-medium">Voucher is balanced</span>
              <span className="text-green-500">— Debit ₹{totalDr.toFixed(2)} = Credit ₹{totalCr.toFixed(2)}</span>
            </div>
          ) : (
            <div className="flex items-start gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <span className="text-base mt-0.5">⚠</span>
              <div>
                <span className="font-medium">Voucher is not balanced</span>
                <span className="ml-2 text-red-500">
                  Difference of ₹{Math.abs(totalDr - totalCr).toFixed(2)}
                  {totalDr > totalCr
                    ? ` — add ₹${(totalDr - totalCr).toFixed(2)} more in Credit`
                    : ` — add ₹${(totalCr - totalDr).toFixed(2)} more in Debit`}
                </span>
                <p className="text-xs text-red-400 mt-0.5">Double-entry: Total Debit must equal Total Credit to save.</p>
              </div>
            </div>
          )
        ) : null}

        {/* Actions */}
        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <button
            className="btn-primary px-8 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!balanced || saveMutation.isPending}
            title={!balanced ? 'Debit total must equal Credit total before saving' : ''}
            onClick={handleSubmit}
          >
            {saveMutation.isPending ? 'Saving…' : isEdit ? 'Update Voucher' : 'Save & Post'}
          </button>
          <button className="btn-secondary" onClick={() => navigate('/accounting/vouchers')}>Cancel</button>
          {!balanced && totalDr > 0 && (
            <span className="text-xs text-gray-400 self-center">
              Balance the voucher above to enable saving
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
