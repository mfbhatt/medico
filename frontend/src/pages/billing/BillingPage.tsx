import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import api from '@/services/api';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  issued: 'bg-blue-100 text-blue-700',
  partially_paid: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  written_off: 'bg-gray-100 text-gray-500',
};

export default function BillingPage() {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [showNewModal, setShowNewModal] = useState(false);
  const pageSize = 20;

  const patientId = searchParams.get('patient_id') ?? undefined;

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', patientId, status, page],
    queryFn: () =>
      api
        .get('/billing/invoices', {
          params: {
            patient_id: patientId || undefined,
            status: status || undefined,
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
          <h1 className="text-2xl font-bold text-slate-900">Billing</h1>
          <p className="text-sm text-slate-500 mt-1">Manage invoices and payments</p>
        </div>
        <button onClick={() => setShowNewModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm">
          <Plus className="h-4 w-4" /> New Invoice
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex gap-3 items-center">
        <select
          className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">All Status</option>
          <option value="issued">Issued</option>
          <option value="partially_paid">Partially Paid</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="draft">Draft</option>
        </select>
        {patientId && (
          <span className="text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full font-medium">
            Filtered by patient
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-slate-600">Invoice #</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">Patient</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">Issue Date</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">Due Date</th>
              <th className="text-right px-5 py-3 font-medium text-slate-600">Total</th>
              <th className="text-right px-5 py-3 font-medium text-slate-600">Balance</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">Status</th>
              <th className="text-right px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-12 text-slate-400 text-sm">Loading…</td></tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-slate-400 text-sm">No invoices found</td></tr>
            ) : (
              invoices.map((inv: any) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-700">{inv.invoice_number}</td>
                  <td className="px-5 py-3.5 text-slate-900 font-medium">{inv.patient_name ?? '—'}</td>
                  <td className="px-5 py-3.5 text-slate-600">{inv.issue_date}</td>
                  <td className="px-5 py-3.5 text-slate-600">{inv.due_date}</td>
                  <td className="px-5 py-3.5 text-right font-medium text-slate-900">
                    {inv.currency ?? '$'}{Number(inv.total_amount ?? 0).toFixed(2)}
                  </td>
                  <td className={`px-5 py-3.5 text-right font-medium ${Number(inv.balance_due) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {inv.currency ?? '$'}{Number(inv.balance_due ?? 0).toFixed(2)}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[inv.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {inv.status?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link to={`/billing/invoices/${inv.id}`} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                      View →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {meta.total > pageSize && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-sm text-slate-600">
            <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, meta.total)} of {meta.total}</span>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs hover:bg-slate-50 disabled:opacity-40" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <button className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs hover:bg-slate-50 disabled:opacity-40" disabled={page * pageSize >= meta.total} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>

      {showNewModal && (
        <NewInvoiceModal
          onClose={() => setShowNewModal(false)}
          onSuccess={() => { setShowNewModal(false); qc.invalidateQueries({ queryKey: ['invoices'] }); }}
        />
      )}
    </div>
  );
}

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

function NewInvoiceModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [clinicId, setClinicId] = useState('');
  const [items, setItems] = useState([{ description: '', unit_price: '', quantity: '1' }]);
  const [notes, setNotes] = useState('');

  // After invoice is created, hold its summary here to show the payment step
  const [createdInvoice, setCreatedInvoice] = useState<{ id: string; invoice_number: string; total: number; currency: string } | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const { data: patientsData } = useQuery({
    queryKey: ['patients-search-billing', patientSearch],
    queryFn: () => api.get('/patients/', { params: { q: patientSearch, page_size: 8 } }).then((r) => r.data.data),
    enabled: patientSearch.length > 1,
  });
  const suggestions = patientsData?.patients ?? patientsData ?? [];

  const { data: clinicsData } = useQuery({
    queryKey: ['clinics-list'],
    queryFn: () => api.get('/clinics/', { params: { limit: 50 } }).then((r) => r.data.data),
  });
  const clinics: any[] = clinicsData?.clinics ?? clinicsData ?? [];

  const mutation = useMutation({
    mutationFn: () => {
      const lineItems = items
        .filter((i) => i.description && i.unit_price)
        .map((i) => ({
          description: i.description,
          unit_price: Number(i.unit_price),
          quantity: Number(i.quantity) || 1,
          line_total: Number(i.unit_price) * (Number(i.quantity) || 1),
          item_type: 'consultation',
        }));
      return api.post('/billing/invoices', {
        patient_id: selectedPatient.id,
        clinic_id: clinicId,
        items: lineItems,
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
        name: 'Clinic Management',
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
            setTimeout(onSuccess, 1500);
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

  const cls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-slate-900">
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
              <p className="text-base font-semibold text-slate-900">Payment Successful</p>
              <p className="text-sm text-slate-500 mt-1">Invoice {createdInvoice.invoice_number} has been paid</p>
            </div>
          ) : (
            <div>
              <div className="bg-slate-50 rounded-xl p-4 mb-5 text-center">
                <p className="text-xs text-slate-500 mb-1">Invoice {createdInvoice.invoice_number}</p>
                <p className="text-3xl font-bold text-slate-900">
                  {createdInvoice.currency} {createdInvoice.total.toFixed(2)}
                </p>
              </div>

              {paymentError && (
                <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">{paymentError}</div>
              )}

              <button
                onClick={handleRazorpayPayment}
                disabled={paymentLoading}
                className="w-full flex items-center justify-center gap-2 bg-[#2d6be4] hover:bg-[#2460cc] disabled:bg-[#2d6be4]/60 text-white font-medium py-3 rounded-lg text-sm mb-3"
              >
                {paymentLoading ? (
                  'Opening Razorpay…'
                ) : (
                  <>
                    <img src="https://razorpay.com/favicon.png" className="w-4 h-4" alt="" />
                    Pay with Razorpay
                  </>
                )}
              </button>

              <button
                onClick={onSuccess}
                className="w-full py-2.5 text-sm text-slate-500 hover:text-slate-700"
              >
                Pay later
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
              <label className="text-xs font-medium text-slate-600 mb-1 block">Patient *</label>
              {selectedPatient ? (
                <div className="flex items-center justify-between bg-blue-50 px-3 py-2 rounded-lg">
                  <span className="text-sm font-medium text-blue-900">{selectedPatient.first_name} {selectedPatient.last_name}</span>
                  <button onClick={() => setSelectedPatient(null)}><X className="h-4 w-4 text-blue-400" /></button>
                </div>
              ) : (
                <div>
                  <input placeholder="Search patient…" value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} className={cls} />
                  {suggestions.length > 0 && (
                    <div className="border border-slate-200 rounded-lg mt-1 divide-y divide-slate-100 overflow-hidden">
                      {suggestions.slice(0, 5).map((p: any) => (
                        <button key={p.id} onClick={() => { setSelectedPatient(p); setPatientSearch(''); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm">
                          {p.first_name} {p.last_name} <span className="text-slate-400 text-xs ml-1">{p.mrn}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Clinic */}
            <div className="mb-4">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Clinic *</label>
              <select value={clinicId} onChange={(e) => setClinicId(e.target.value)} className={cls}>
                <option value="">Select clinic…</option>
                {clinics.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Items */}
            <div className="mb-4">
              <label className="text-xs font-medium text-slate-600 mb-2 block">Items *</label>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      placeholder="Description" value={item.description}
                      onChange={(e) => setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, description: e.target.value } : it))}
                      className={`${cls} col-span-6`}
                    />
                    <input
                      type="number" placeholder="Qty" value={item.quantity}
                      onChange={(e) => setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, quantity: e.target.value } : it))}
                      className={`${cls} col-span-2`}
                    />
                    <input
                      type="number" placeholder="Price" value={item.unit_price}
                      onChange={(e) => setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, unit_price: e.target.value } : it))}
                      className={`${cls} col-span-3`}
                    />
                    <button onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))} className="col-span-1 text-slate-400 hover:text-red-500">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => setItems((p) => [...p, { description: '', unit_price: '', quantity: '1' }])} className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium">
                + Add item
              </button>
            </div>

            <textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${cls} mb-4`} />

            <div className="flex gap-3">
              <button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || !selectedPatient || !clinicId || !items.some((i) => i.description && i.unit_price)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-lg text-sm"
              >
                {mutation.isPending ? 'Creating…' : 'Create Invoice'}
              </button>
              <button onClick={onClose} className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2.5 rounded-lg text-sm">Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
