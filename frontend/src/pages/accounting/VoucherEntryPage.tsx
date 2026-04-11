import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { addToast } from '@/store/slices/uiSlice';
import api from '@/services/api';
import { Copy } from 'lucide-react';

const VOUCHER_TYPES = [
  { value: 'receipt',     label: 'Receipt',     hint: 'Money received (cash/bank in)' },
  { value: 'payment',     label: 'Payment',     hint: 'Money paid out (cash/bank out)' },
  { value: 'journal',     label: 'Journal',     hint: 'General adjustment entry' },
  { value: 'contra',      label: 'Contra',      hint: 'Transfer between cash & bank' },
  { value: 'sales',       label: 'Sales',       hint: 'Revenue / sales invoice posting' },
  { value: 'purchase',    label: 'Purchase',    hint: 'Purchase / expense invoice posting' },
  { value: 'credit_note', label: 'Credit Note', hint: 'Refund / credit to party' },
  { value: 'debit_note',  label: 'Debit Note',  hint: 'Debit raised on party' },
];

interface Line {
  account_id: string;
  account_label: string;
  debit_amount: string;
  credit_amount: string;
  narration: string;
  gst_rate: string;
  tds_amount: string;
}

const emptyLine = (): Line => ({
  account_id: '',
  account_label: '',
  debit_amount: '',
  credit_amount: '',
  narration: '',
  gst_rate: '',
  tds_amount: '',
});

// ── Account typeahead ────────────────────────────────────────────────────────

function AccountTypeahead({
  value,
  label,
  onChange,
  placeholder = 'Search account…',
  autoFocus,
  onEnter,
}: {
  value: string;
  label: string;
  onChange: (id: string, label: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onEnter?: () => void;
}) {
  const [query, setQuery] = useState(label);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [highlight, setHighlight] = useState(0);

  const { data: results } = useQuery({
    queryKey: ['accounting', 'account-search', query],
    queryFn: () =>
      api.get('/accounting/accounts/search', { params: { q: query, limit: 12 } }).then(r => r.data.data),
    enabled: focused && query.length >= 0,
    staleTime: 10_000,
  });

  const options: any[] = results ?? [];

  // Sync label prop changes from parent (e.g. editing existing)
  useEffect(() => { setQuery(label); }, [label]);

  const select = (opt: any) => {
    setQuery(opt.label);
    setOpen(false);
    onChange(opt.id, opt.label);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown') { setOpen(true); e.preventDefault(); }
      return;
    }
    if (e.key === 'ArrowDown') { setHighlight(h => Math.min(h + 1, options.length - 1)); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { setHighlight(h => Math.max(h - 1, 0)); e.preventDefault(); }
    else if (e.key === 'Enter' || e.key === 'Tab') {
      if (options[highlight]) { select(options[highlight]); e.preventDefault(); }
      else if (e.key === 'Tab' && onEnter) onEnter();
    }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        className="input py-1.5 text-sm w-full"
        value={query}
        placeholder={placeholder}
        onChange={e => { setQuery(e.target.value); setOpen(true); setHighlight(0); onChange('', e.target.value); }}
        onFocus={() => { setFocused(true); setOpen(true); }}
        onBlur={() => { setTimeout(() => setOpen(false), 150); setFocused(false); }}
        onKeyDown={handleKey}
      />
      {open && options.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-52 overflow-y-auto"
        >
          {options.map((opt: any, i: number) => (
            <div
              key={opt.id}
              className={`px-3 py-2 cursor-pointer text-sm ${i === highlight ? 'bg-primary-50 text-primary-800' : 'hover:bg-gray-50'}`}
              onMouseDown={() => select(opt)}
            >
              <span className="font-medium">{opt.name}</span>
              {opt.code && <span className="ml-2 text-gray-400 font-mono text-xs">{opt.code}</span>}
              <span className="ml-2 text-gray-400 text-xs capitalize">{opt.account_type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

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
  const [showGst, setShowGst] = useState(false);
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);

  const toast = {
    success: (m: string) => dispatch(addToast({ id: Date.now().toString(), type: 'success', message: m, duration: 3000 })),
    error: (m: string) => dispatch(addToast({ id: Date.now().toString(), type: 'error', message: m, duration: 5000 })),
  };

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
        account_label: `${l.account_code ? l.account_code + ' – ' : ''}${l.account_name}`,
        debit_amount: l.debit_amount > 0 ? String(l.debit_amount) : '',
        credit_amount: l.credit_amount > 0 ? String(l.credit_amount) : '',
        narration: l.narration || '',
        gst_rate: '',
        tds_amount: '',
      })));
    }
  }, [existing]);

  const totalDr = lines.reduce((s, l) => s + (parseFloat(l.debit_amount) || 0), 0);
  const totalCr = lines.reduce((s, l) => s + (parseFloat(l.credit_amount) || 0), 0);
  const balanced = Math.abs(totalDr - totalCr) < 0.01 && totalDr > 0;
  const diff = Math.abs(totalDr - totalCr);

  const setLine = useCallback((i: number, field: keyof Line, value: string) => {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  }, []);

  const setLineAccount = useCallback((i: number, id: string, label: string) => {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, account_id: id, account_label: label } : l));
  }, []);

  const addLine = () => setLines(prev => [...prev, emptyLine()]);
  const removeLine = (i: number) => { if (lines.length > 2) setLines(prev => prev.filter((_, idx) => idx !== i)); };

  // Quick-fill: when user enters Dr on line 0, auto-suggest Cr diff on next blank line
  const autoFillDiff = (i: number, field: 'debit_amount' | 'credit_amount', val: string) => {
    setLine(i, field, val);
    const amount = parseFloat(val) || 0;
    if (amount > 0 && lines.length === 2) {
      const other = field === 'debit_amount' ? 'credit_amount' : 'debit_amount';
      const otherIdx = i === 0 ? 1 : 0;
      const otherLine = lines[otherIdx];
      if (!otherLine.debit_amount && !otherLine.credit_amount) {
        setLines(prev => prev.map((l, idx) => idx === otherIdx ? { ...l, [other]: val } : l));
      }
    }
  };

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      isEdit ? api.put(`/accounting/vouchers/${id}`, data) : api.post('/accounting/vouchers', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounting'] });
      toast.success(isEdit ? 'Voucher updated' : 'Voucher created & posted');
      navigate('/accounting/vouchers');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to save voucher'),
  });

  const cloneMutation = useMutation({
    mutationFn: () => api.post(`/accounting/vouchers/${id}/clone`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['accounting'] });
      const newId = res.data?.data?.id;
      toast.success(`Cloned as ${res.data?.data?.voucher_number}`);
      if (newId) navigate(`/accounting/vouchers/${newId}/edit`);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Clone failed'),
  });

  const handleSubmit = () => {
    const validLines = lines.filter(l => l.account_id && (parseFloat(l.debit_amount) > 0 || parseFloat(l.credit_amount) > 0));
    if (validLines.length < 2) { toast.error('At least 2 lines with amounts are required'); return; }
    if (!balanced) { toast.error('Debit total must equal Credit total'); return; }
    saveMutation.mutate({
      voucher_type: voucherType,
      voucher_date: voucherDate,
      narration: narration || undefined,
      reference: reference || undefined,
      lines: validLines.map(l => ({
        account_id: l.account_id,
        debit_amount: parseFloat(l.debit_amount) || 0,
        credit_amount: parseFloat(l.credit_amount) || 0,
        narration: l.narration || undefined,
        gst_rate: parseFloat(l.gst_rate) || 0,
        tds_amount: parseFloat(l.tds_amount) || 0,
      })),
    });
  };

  const typeInfo = VOUCHER_TYPES.find(t => t.value === voucherType);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="page-header mb-4">
        <div>
          <h1 className="page-title">{isEdit ? 'Edit Voucher' : 'New Voucher Entry'}</h1>
          {typeInfo && <p className="text-sm text-gray-500 mt-0.5">{typeInfo.hint}</p>}
        </div>
        <div className="flex gap-2">
          {isEdit && !existing?.source_type && (
            <button
              className="btn-secondary flex items-center gap-1.5 text-sm"
              onClick={() => cloneMutation.mutate()}
              disabled={cloneMutation.isPending}
              title="Clone this voucher with today's date"
            >
              <Copy className="h-3.5 w-3.5" />
              Clone
            </button>
          )}
        </div>
      </div>

      <div className="card p-5 space-y-5">
        {/* ── Header fields ────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="label">Voucher Type *</label>
            <select className="input" value={voucherType} onChange={e => setVoucherType(e.target.value)} disabled={isEdit && !!existing?.source_type}>
              {VOUCHER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Date *</label>
            <input type="date" className="input" value={voucherDate} onChange={e => setVoucherDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Reference / Cheque No.</label>
            <input className="input" value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. CHQ-1234" />
          </div>
          <div>
            <label className="label">Narration</label>
            <input className="input" value={narration} onChange={e => setNarration(e.target.value)} placeholder="Brief description" />
          </div>
        </div>

        {/* ── Auto-posted warning ──────────────────────────────── */}
        {isEdit && existing?.source_type && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <span>⚠</span>
            <span>This voucher was auto-posted from <strong>{existing.source_type}</strong> and cannot be edited. Use Clone to create a correction entry.</span>
          </div>
        )}

        {/* ── Lines table ──────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Voucher Lines</span>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
              <input type="checkbox" checked={showGst} onChange={e => setShowGst(e.target.checked)} className="rounded" />
              Show GST / TDS columns
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-2 py-2 font-medium text-gray-600 w-5/12 min-w-52">Account</th>
                  <th className="text-right px-2 py-2 font-medium text-blue-600 w-28">Debit (Dr)</th>
                  <th className="text-right px-2 py-2 font-medium text-amber-600 w-28">Credit (Cr)</th>
                  <th className="text-left px-2 py-2 font-medium text-gray-500 w-32">Narration</th>
                  {showGst && <>
                    <th className="text-right px-2 py-2 font-medium text-gray-500 w-20">GST %</th>
                    <th className="text-right px-2 py-2 font-medium text-gray-500 w-20">TDS Amt</th>
                  </>}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lines.map((line, i) => (
                  <tr key={i} className="hover:bg-gray-50/80">
                    <td className="px-1 py-1.5">
                      <AccountTypeahead
                        value={line.account_id}
                        label={line.account_label}
                        onChange={(id, lbl) => setLineAccount(i, id, lbl)}
                        placeholder="Search account…"
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <input
                        type="number" min="0" step="0.01"
                        className="input py-1.5 text-sm text-right w-full"
                        value={line.debit_amount}
                        onChange={e => autoFillDiff(i, 'debit_amount', e.target.value)}
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <input
                        type="number" min="0" step="0.01"
                        className="input py-1.5 text-sm text-right w-full"
                        value={line.credit_amount}
                        onChange={e => autoFillDiff(i, 'credit_amount', e.target.value)}
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <input
                        className="input py-1.5 text-sm w-full"
                        value={line.narration}
                        onChange={e => setLine(i, 'narration', e.target.value)}
                        placeholder="Optional"
                      />
                    </td>
                    {showGst && <>
                      <td className="px-1 py-1.5">
                        <input
                          type="number" min="0" step="0.5"
                          className="input py-1.5 text-sm text-right w-full"
                          value={line.gst_rate}
                          onChange={e => setLine(i, 'gst_rate', e.target.value)}
                          placeholder="0"
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <input
                          type="number" min="0" step="0.01"
                          className="input py-1.5 text-sm text-right w-full"
                          value={line.tds_amount}
                          onChange={e => setLine(i, 'tds_amount', e.target.value)}
                          placeholder="0.00"
                        />
                      </td>
                    </>}
                    <td className="px-1 py-1.5 text-center">
                      {lines.length > 2 && (
                        <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600 text-xl leading-none">×</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={`font-semibold text-sm border-t-2 ${balanced ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
                  <td className="px-3 py-2 text-gray-700">Total</td>
                  <td className={`px-2 py-2 text-right font-bold ${balanced ? 'text-green-700' : 'text-red-600'}`}>
                    ₹{totalDr.toFixed(2)}
                  </td>
                  <td className={`px-2 py-2 text-right font-bold ${balanced ? 'text-green-700' : 'text-red-600'}`}>
                    ₹{totalCr.toFixed(2)}
                  </td>
                  <td colSpan={showGst ? 4 : 2} className="px-3 py-2">
                    {balanced ? (
                      <span className="text-green-700 font-semibold">✓ Balanced</span>
                    ) : totalDr > 0 || totalCr > 0 ? (
                      <span className="text-red-600 font-semibold">
                        ✗ Difference ₹{diff.toFixed(2)} —
                        {totalDr > totalCr ? ` add ₹${diff.toFixed(2)} Cr` : ` add ₹${diff.toFixed(2)} Dr`}
                      </span>
                    ) : null}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <button onClick={addLine} className="mt-2 text-sm text-primary-600 hover:text-primary-800 flex items-center gap-1">
            + Add line
          </button>
        </div>

        {/* ── Balance banner ───────────────────────────────────── */}
        {(totalDr > 0 || totalCr > 0) && !balanced && (
          <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <span className="mt-0.5">⚠</span>
            <div>
              <span className="font-medium">Voucher is unbalanced — </span>
              <span>Debit ₹{totalDr.toFixed(2)} vs Credit ₹{totalCr.toFixed(2)}</span>
              <p className="text-xs text-red-400 mt-0.5">
                Double-entry rule: every debit must have an equal credit.
                {totalDr > totalCr
                  ? ` Add a credit entry of ₹${diff.toFixed(2)} to balance.`
                  : ` Add a debit entry of ₹${diff.toFixed(2)} to balance.`}
              </p>
            </div>
          </div>
        )}

        {/* ── Actions ──────────────────────────────────────────── */}
        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <button
            className="btn-primary px-8 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={!balanced || saveMutation.isPending || (isEdit && !!existing?.source_type)}
            onClick={handleSubmit}
          >
            {saveMutation.isPending ? 'Saving…' : isEdit ? 'Update Voucher' : 'Save & Post'}
          </button>
          <button className="btn-secondary" onClick={() => navigate('/accounting/vouchers')}>Cancel</button>
          {!balanced && totalDr > 0 && (
            <span className="text-xs text-gray-400 self-center">Balance the entry above to enable saving</span>
          )}
        </div>
      </div>

      {/* ── Keyboard shortcuts hint ──────────────────────────── */}
      <p className="text-xs text-gray-400 mt-3">
        Tip: Use <kbd className="bg-gray-100 px-1 rounded">Tab</kbd> to move between fields,
        <kbd className="bg-gray-100 px-1 rounded ml-1">↑↓</kbd> to navigate account suggestions,
        <kbd className="bg-gray-100 px-1 rounded ml-1">Enter</kbd> to select.
      </p>
    </div>
  );
}
