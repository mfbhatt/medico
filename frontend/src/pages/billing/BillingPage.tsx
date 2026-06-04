import { useState, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Search } from 'lucide-react';
import api from '@/services/api';
import appConfig from '@/config/app';
import SkeletonTable from '@/components/common/SkeletonTable';

// ── Currency helpers ──────────────────────────────────────────────────────────
const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ', SGD: 'S$',
};
const curSym = (code?: string) =>
  code ? (CURRENCY_SYMBOLS[code] ?? code + ' ') : '₹';

// ── Status styling ────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  issued: 'bg-blue-100 text-blue-700',
  partially_paid: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  written_off: 'bg-gray-100 text-gray-500',
};

const STATUS_TAGS = [
  { value: '', label: 'All' },
  { value: 'issued', label: 'Issued' },
  { value: 'partially_paid', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'draft', label: 'Draft' },
];

const SORT_OPTIONS = [
  { value: 'issue_date:desc', label: 'Newest First' },
  { value: 'issue_date:asc', label: 'Oldest First' },
  { value: 'due_date:asc', label: 'Due Date ↑' },
  { value: 'due_date:desc', label: 'Due Date ↓' },
  { value: 'total_amount:desc', label: 'Total ↓' },
  { value: 'total_amount:asc', label: 'Total ↑' },
  { value: 'balance_due:desc', label: 'Balance ↓' },
];

// ── BillingPage ───────────────────────────────────────────────────────────────
export default function BillingPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('');
  const [sortKey, setSortKey] = useState('issue_date:desc');
  const [page, setPage] = useState(1);
  const [showNewModal, setShowNewModal] = useState(false);
  const pageSize = 20;

  const patientId = searchParams.get('patient_id') ?? undefined;
  const [sortBy, sortDir] = sortKey.split(':');

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', patientId, status, sortBy, sortDir, page],
    queryFn: () =>
      api
        .get('/billing/invoices', {
          params: {
            patient_id: patientId || undefined,
            status: status || undefined,
            sort_by: sortBy,
            sort_dir: sortDir,
            page,
            page_size: pageSize,
          },
        })
        .then((r) => r.data),
  });

  const invoices: any[] = data?.data ?? [];
  const meta = data?.meta ?? {};

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Billing</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage invoices and payments</p>
        </div>
        <button onClick={() => setShowNewModal(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> New Invoice
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6 flex flex-wrap gap-3 items-center">
        {/* Quick status tags */}
        <div className="flex flex-wrap gap-1.5">
          {STATUS_TAGS.map((tag) => (
            <button
              key={tag.value}
              onClick={() => { setStatus(tag.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                status === tag.value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-blue-400'
              }`}
            >
              {tag.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {patientId && (
            <span className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-full font-medium">
              Filtered by patient
            </span>
          )}
          <select
            className="input py-1.5 text-xs"
            value={sortKey}
            onChange={(e) => { setSortKey(e.target.value); setPage(1); }}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table — double-click a row to open the invoice */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-slate-600 dark:text-slate-400">Invoice #</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600 dark:text-slate-400">Patient</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600 dark:text-slate-400">Issue Date</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600 dark:text-slate-400">Due Date</th>
              <th className="text-right px-5 py-3 font-medium text-slate-600 dark:text-slate-400">Total</th>
              <th className="text-right px-5 py-3 font-medium text-slate-600 dark:text-slate-400">Balance</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600 dark:text-slate-400">Status</th>
              <th className="text-right px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {isLoading ? (
              <SkeletonTable rows={8} columns={8} />
            ) : invoices.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-slate-400 text-sm">No invoices found</td></tr>
            ) : (
              invoices.map((inv: any) => (
                <tr
                  key={inv.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer select-none"
                  onDoubleClick={() => navigate(`/billing/invoices/${inv.id}`)}
                >
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-700 dark:text-slate-300">{inv.invoice_number}</td>
                  <td className="px-5 py-3.5 text-slate-900 dark:text-slate-100 font-medium">{inv.patient_name ?? '—'}</td>
                  <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">{inv.issue_date}</td>
                  <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">{inv.due_date}</td>
                  <td className="px-5 py-3.5 text-right font-medium text-slate-900 dark:text-slate-100">
                    {curSym(inv.currency)}{Number(inv.total_amount ?? 0).toFixed(2)}
                  </td>
                  <td className={`px-5 py-3.5 text-right font-medium ${Number(inv.balance_due) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {curSym(inv.currency)}{Number(inv.balance_due ?? 0).toFixed(2)}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[inv.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {inv.status?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link
                      to={`/billing/invoices/${inv.id}`}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {meta.total > pageSize && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400">
            <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, meta.total)} of {meta.total}</span>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-xs hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <button className="px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-xs hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40" disabled={page * pageSize >= meta.total} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>

      {showNewModal && (
        <NewInvoiceModal
          onClose={() => setShowNewModal(false)}
          onSuccess={(invoiceId) => {
            setShowNewModal(false);
            qc.invalidateQueries({ queryKey: ['invoices'] });
            if (invoiceId) navigate(`/billing/invoices/${invoiceId}`);
          }}
        />
      )}
    </div>
  );
}

// ── Razorpay loader ───────────────────────────────────────────────────────────
function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).Razorpay) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Razorpay'));
    document.body.appendChild(s);
  });
}

// ── Item type options ─────────────────────────────────────────────────────────
const ITEM_TYPES = [
  { value: 'consultation', label: 'Consultation' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'lab', label: 'Lab' },
  { value: 'medication', label: 'Medication' },
  { value: 'room', label: 'Room' },
  { value: 'misc', label: 'Misc' },
];

interface LineItem {
  description: string;
  unit_price: string;
  quantity: string;
  item_type: string;
  discount_percent: string;
}

// ── NewInvoiceModal ───────────────────────────────────────────────────────────
function NewInvoiceModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (id?: string) => void }) {
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [clinicId, setClinicId] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState('issued');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [items, setItems] = useState<LineItem[]>([
    { description: '', unit_price: '', quantity: '1', item_type: 'consultation', discount_percent: '0' },
  ]);
  const [discountPct, setDiscountPct] = useState('0');
  const [taxRate, setTaxRate] = useState('0');
  const [notes, setNotes] = useState('');

  // Item drug/service search
  const [itemSearches, setItemSearches] = useState<Record<number, string>>({ 0: '' });
  const [activeItemIdx, setActiveItemIdx] = useState<number | null>(null);
  const itemRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const { data: clinicsData } = useQuery({
    queryKey: ['clinics-list'],
    queryFn: () => api.get('/clinics/', { params: { limit: 50 } }).then((r) => r.data.data),
  });
  const clinics: any[] = clinicsData?.clinics ?? clinicsData ?? [];

  const { data: patientsData } = useQuery({
    queryKey: ['patients-search-billing', patientSearch],
    queryFn: () => api.get('/patients/', { params: { q: patientSearch, page_size: 8 } }).then((r) => r.data.data),
    enabled: patientSearch.length > 1,
  });
  const suggestions = patientsData?.patients ?? patientsData ?? [];

  // Drug/item search for currently active item row
  const currentSearch = activeItemIdx !== null ? (itemSearches[activeItemIdx] ?? '') : '';
  const { data: drugsRaw } = useQuery({
    queryKey: ['drugs-billing-search', currentSearch],
    queryFn: () =>
      api.get('/inventory/drugs', { params: { q: currentSearch, page_size: 8 } }).then((r) => r.data.data),
    enabled: currentSearch.trim().length > 1,
    staleTime: 10_000,
  });
  const drugs: any[] = drugsRaw ?? [];

  // Computed totals
  const validItems = items.filter((i) => i.description && i.unit_price && Number(i.unit_price) >= 0 && Number(i.quantity) >= 1);
  const subtotal = validItems.reduce(
    (sum, i) => sum + Number(i.unit_price) * (Number(i.quantity) || 1) * (1 - (Number(i.discount_percent) || 0) / 100),
    0,
  );
  const invoiceDiscountAmt = subtotal * (Number(discountPct) || 0) / 100;
  const taxableAmt = subtotal - invoiceDiscountAmt;
  const taxAmt = taxableAmt * (Number(taxRate) || 0) / 100;
  const total = taxableAmt + taxAmt;

  // Created invoice (payment step)
  const [createdInvoice, setCreatedInvoice] = useState<{ id: string; invoice_number: string; total: number; currency: string } | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: () => {
      const lineItems = validItems.map((i) => {
        const qty = Number(i.quantity) || 1;
        const price = Number(i.unit_price);
        const discPct = Number(i.discount_percent) || 0;
        const lineTotal = price * qty * (1 - discPct / 100);
        return {
          description: i.description,
          unit_price: price,
          quantity: qty,
          item_type: i.item_type || 'consultation',
          discount_percent: discPct,
          line_total: Math.round(lineTotal * 100) / 100,
        };
      });
      return api.post('/billing/invoices', {
        patient_id: selectedPatient.id,
        clinic_id: clinicId,
        status: invoiceStatus,
        due_date: dueDate,
        items: lineItems,
        discount_amount: Math.round(invoiceDiscountAmt * 100) / 100,
        tax_rate: Number(taxRate) || 0,
        notes: notes || undefined,
      });
    },
    onSuccess: (res) => {
      const d = res.data.data;
      setCreatedInvoice({
        id: d.invoice_id,
        invoice_number: d.invoice_number,
        total: d.total,
        currency: d.currency ?? 'INR',
      });
    },
  });

  const handleRazorpayPayment = async () => {
    if (!createdInvoice) return;
    setPaymentLoading(true);
    setPaymentError('');
    try {
      const orderRes = await api.post('/billing/razorpay/create-order', { invoice_id: createdInvoice.id });
      const { razorpay_order_id, amount, currency, key_id, invoice_number } = orderRes.data.data;
      await loadRazorpayScript();
      const rzp = new (window as any).Razorpay({
        key: key_id,
        amount: Math.round(amount * 100),
        currency,
        name: appConfig.name,
        description: `Invoice ${invoice_number}`,
        order_id: razorpay_order_id,
        handler: async (response: any) => {
          try {
            await api.post('/billing/razorpay/verify-payment', {
              invoice_id: createdInvoice.id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            setPaymentSuccess(true);
            setTimeout(() => onSuccess(createdInvoice.id), 1500);
          } catch (err: any) {
            setPaymentError(err?.response?.data?.message ?? 'Payment verification failed');
            setPaymentLoading(false);
          }
        },
        modal: { ondismiss: () => setPaymentLoading(false) },
      });
      rzp.open();
    } catch (err: any) {
      setPaymentError(err?.response?.data?.message ?? 'Failed to initialize Razorpay');
      setPaymentLoading(false);
    }
  };

  const updateItem = (idx: number, field: keyof LineItem, value: string) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const addItem = () => {
    const idx = items.length;
    setItems((p) => [...p, { description: '', unit_price: '', quantity: '1', item_type: 'consultation', discount_percent: '0' }]);
    setItemSearches((p) => ({ ...p, [idx]: '' }));
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setItemSearches((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
    if (activeItemIdx === idx) setActiveItemIdx(null);
  };

  const selectDrug = (drug: any, idx: number) => {
    updateItem(idx, 'description', drug.name ?? drug.generic_name ?? '');
    updateItem(idx, 'unit_price', String(drug.selling_price ?? ''));
    updateItem(idx, 'item_type', 'medication');
    setItemSearches((p) => ({ ...p, [idx]: '' }));
    setActiveItemIdx(null);
  };

  const cls = 'input';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {createdInvoice ? 'Payment' : 'New Invoice'}
          </h3>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400 hover:text-slate-600" /></button>
        </div>

        {/* ── Payment step ── */}
        {createdInvoice ? (
          paymentSuccess ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100">Payment Successful</p>
              <p className="text-sm text-slate-500 mt-1">Invoice {createdInvoice.invoice_number} has been paid</p>
            </div>
          ) : (
            <div>
              {/* Items review */}
              <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-4 mb-4">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Invoice Review — {createdInvoice.invoice_number}</p>
                <div className="space-y-1 mb-3">
                  {validItems.map((item, idx) => {
                    const qty = Number(item.quantity) || 1;
                    const price = Number(item.unit_price);
                    const disc = Number(item.discount_percent) || 0;
                    const lineAmt = price * qty * (1 - disc / 100);
                    return (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-slate-700 dark:text-slate-300">
                          {item.description}
                          {qty > 1 && <span className="text-slate-400 ml-1">×{qty}</span>}
                          {disc > 0 && <span className="text-green-600 ml-1">-{disc}%</span>}
                        </span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {curSym(createdInvoice.currency)}{lineAmt.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {Number(discountPct) > 0 && (
                  <div className="flex justify-between text-xs text-green-700 mb-1">
                    <span>Discount ({discountPct}%)</span>
                    <span>-{curSym(createdInvoice.currency)}{invoiceDiscountAmt.toFixed(2)}</span>
                  </div>
                )}
                {Number(taxRate) > 0 && (
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Tax / GST ({taxRate}%)</span>
                    <span>{curSym(createdInvoice.currency)}{taxAmt.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-slate-200 dark:border-slate-600 pt-2 flex justify-between font-bold text-base">
                  <span className="text-slate-900 dark:text-slate-100">Total</span>
                  <span className="text-blue-700 dark:text-blue-400">
                    {curSym(createdInvoice.currency)}{createdInvoice.total.toFixed(2)}
                  </span>
                </div>
              </div>

              {paymentError && (
                <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">{paymentError}</div>
              )}

              <button
                onClick={handleRazorpayPayment}
                disabled={paymentLoading}
                className="w-full flex items-center justify-center gap-2 bg-[#2d6be4] hover:bg-[#2460cc] disabled:bg-[#2d6be4]/60 text-white font-medium py-3 rounded-lg text-sm mb-3"
              >
                {paymentLoading ? 'Opening Razorpay…' : (
                  <><img src="https://razorpay.com/favicon.png" className="w-4 h-4" alt="" /> Pay with Razorpay</>
                )}
              </button>

              <button
                onClick={() => onSuccess(createdInvoice.id)}
                className="w-full py-2.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Pay later — view invoice
              </button>
            </div>
          )
        ) : (
          /* ── Invoice creation form ── */
          <>
            {mutation.isError && (
              <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">
                {(mutation.error as any)?.response?.data?.message ?? 'Failed to create invoice'}
              </div>
            )}

            {/* Patient */}
            <div className="mb-4">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Patient *</label>
              {selectedPatient ? (
                <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg">
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-300">{selectedPatient.first_name} {selectedPatient.last_name}</span>
                  <button onClick={() => setSelectedPatient(null)}><X className="h-4 w-4 text-blue-400" /></button>
                </div>
              ) : (
                <div>
                  <input placeholder="Search patient…" value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} className={cls} />
                  {suggestions.length > 0 && (
                    <div className="border border-slate-200 dark:border-slate-600 rounded-lg mt-1 divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden bg-white dark:bg-slate-700">
                      {suggestions.slice(0, 5).map((p: any) => (
                        <button key={p.id} onClick={() => { setSelectedPatient(p); setPatientSearch(''); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-600 text-sm text-slate-800 dark:text-slate-200">
                          {p.first_name} {p.last_name} <span className="text-slate-400 text-xs ml-1">{p.mrn}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Clinic + Status row */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Clinic *</label>
                <select value={clinicId} onChange={(e) => setClinicId(e.target.value)} className={cls}>
                  <option value="">Select clinic…</option>
                  {clinics.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Status</label>
                <select value={invoiceStatus} onChange={(e) => setInvoiceStatus(e.target.value)} className={cls}>
                  <option value="issued">Issued</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>

            {/* Due date */}
            <div className="mb-4">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
                Due Date <span className="text-slate-400 font-normal">(default: 30 days from today)</span>
              </label>
              <input
                type="date"
                value={dueDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDueDate(e.target.value)}
                className={cls}
              />
            </div>

            {/* Items */}
            <div className="mb-4">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2 block">Items *</label>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="border border-slate-100 dark:border-slate-700 rounded-lg p-3 space-y-2">
                    <div className="flex gap-2 items-center">
                      {/* Type */}
                      <select
                        value={item.item_type}
                        onChange={(e) => updateItem(i, 'item_type', e.target.value)}
                        className="input text-xs py-1.5 w-32 flex-shrink-0"
                      >
                        {ITEM_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>

                      {/* Description with drug search */}
                      <div className="flex-1 relative" ref={(el) => { itemRefs.current[i] = el; }}>
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                          <input
                            placeholder="Description / search item…"
                            value={activeItemIdx === i && itemSearches[i] !== undefined ? itemSearches[i] : item.description}
                            className="input pl-8 text-sm"
                            onFocus={() => {
                              setActiveItemIdx(i);
                              setItemSearches((p) => ({ ...p, [i]: item.description }));
                            }}
                            onChange={(e) => {
                              setItemSearches((p) => ({ ...p, [i]: e.target.value }));
                              updateItem(i, 'description', e.target.value);
                            }}
                            onBlur={() => setTimeout(() => setActiveItemIdx(null), 200)}
                          />
                        </div>
                        {/* Drug dropdown */}
                        {activeItemIdx === i && currentSearch.trim().length > 1 && drugs.length > 0 && (
                          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {drugs.map((drug: any) => (
                              <button
                                key={drug.id}
                                type="button"
                                onMouseDown={() => selectDrug(drug, i)}
                                className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-slate-600 text-sm flex justify-between items-center border-b border-slate-100 dark:border-slate-600 last:border-0"
                              >
                                <span className="text-slate-800 dark:text-slate-200">{drug.name ?? drug.generic_name}</span>
                                {drug.selling_price != null && (
                                  <span className="text-xs text-slate-500 ml-2 flex-shrink-0">
                                    {curSym()}
                                    {Number(drug.selling_price).toFixed(2)}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <button onClick={() => removeItem(i)} className="text-slate-400 hover:text-red-500 flex-shrink-0">
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Qty / Price / Discount row */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Qty</label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="1"
                          value={item.quantity}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === '' || Number(v) >= 1) updateItem(i, 'quantity', v);
                          }}
                          className="input text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Unit Price</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={item.unit_price}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === '' || Number(v) >= 0) updateItem(i, 'unit_price', v);
                          }}
                          className="input text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Discount %</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          placeholder="0"
                          value={item.discount_percent}
                          onChange={(e) => updateItem(i, 'discount_percent', e.target.value)}
                          className="input text-sm"
                        />
                      </div>
                    </div>

                    {/* Line total preview */}
                    {item.unit_price && item.quantity && (
                      <p className="text-xs text-right text-slate-500 dark:text-slate-400">
                        Line total:{' '}
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {curSym()}
                          {(Number(item.unit_price) * (Number(item.quantity) || 1) * (1 - (Number(item.discount_percent) || 0) / 100)).toFixed(2)}
                        </span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={addItem}
                className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                + Add item
              </button>
            </div>

            {/* Discount & Tax */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
                  Invoice Discount %
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="0"
                  value={discountPct}
                  onChange={(e) => setDiscountPct(e.target.value)}
                  className={cls}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
                  Tax / GST %
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="0"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className={cls}
                />
              </div>
            </div>

            {/* Running total preview */}
            {validItems.length > 0 && (
              <div className="bg-slate-50 dark:bg-slate-700/40 rounded-lg p-3 mb-4 text-sm space-y-1">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Subtotal</span><span>{curSym()}{subtotal.toFixed(2)}</span>
                </div>
                {Number(discountPct) > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>Discount ({discountPct}%)</span><span>-{curSym()}{invoiceDiscountAmt.toFixed(2)}</span>
                  </div>
                )}
                {Number(taxRate) > 0 && (
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Tax / GST ({taxRate}%)</span><span>{curSym()}{taxAmt.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t border-slate-200 dark:border-slate-600 pt-1 text-slate-900 dark:text-slate-100">
                  <span>Total</span><span>{curSym()}{total.toFixed(2)}</span>
                </div>
              </div>
            )}

            <textarea
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={`${cls} mb-4`}
            />

            <div className="flex gap-3">
              <button
                onClick={() => mutation.mutate()}
                disabled={
                  mutation.isPending ||
                  !selectedPatient ||
                  !clinicId ||
                  validItems.length === 0
                }
                className="btn-primary flex-1"
              >
                {mutation.isPending ? 'Creating…' : 'Create Invoice'}
              </button>
              <button
                onClick={onClose}
                className="flex-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium py-2.5 rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
