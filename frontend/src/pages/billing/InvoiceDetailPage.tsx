import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, ArrowLeft, X, DollarSign } from "lucide-react";
import api from "@/services/api";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  issued: "bg-blue-100 text-blue-700",
  partially_paid: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  written_off: "bg-gray-100 text-gray-600",
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showPayModal, setShowPayModal] = useState(false);

  const { data: invoice, isLoading, isError } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => api.get(`/billing/invoices/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

  if (isLoading) return <div className="text-center py-20 text-slate-400">Loading invoice…</div>;
  if (isError || !invoice) return <div className="text-center py-20 text-slate-400">Invoice not found</div>;

  const canPay = ["issued", "partially_paid", "overdue"].includes(invoice.status);
  const cur = invoice.currency ?? "USD";

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate("/billing")} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6 text-sm font-medium">
        <ArrowLeft className="h-4 w-4" /> Back to Billing
      </button>

      <div className="bg-white rounded-xl border border-slate-200" id="invoice-print">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-100 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Invoice</h1>
            <p className="text-sm text-slate-500 mt-0.5 font-mono">{invoice.invoice_number}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full capitalize ${STATUS_COLORS[invoice.status] ?? "bg-gray-100 text-gray-700"}`}>
              {invoice.status?.replace(/_/g, " ")}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Dates */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 rounded-lg p-4">
            <div>
              <p className="text-xs text-slate-500 font-medium">Issue Date</p>
              <p className="text-sm font-semibold text-slate-900 mt-0.5">{invoice.issue_date}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Due Date</p>
              <p className="text-sm font-semibold text-slate-900 mt-0.5">{invoice.due_date}</p>
            </div>
          </div>

          {/* Line items */}
          {invoice.items?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Services & Items</h3>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600">Description</th>
                    <th className="text-right px-4 py-2.5 font-medium text-slate-600">Qty</th>
                    <th className="text-right px-4 py-2.5 font-medium text-slate-600">Unit Price</th>
                    <th className="text-right px-4 py-2.5 font-medium text-slate-600">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {invoice.items.map((item: any) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-slate-800">{item.description}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{cur} {Number(item.unit_price).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">{cur} {Number(item.line_total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="text-slate-900 font-medium">{cur} {Number(invoice.subtotal ?? 0).toFixed(2)}</span>
              </div>
              {invoice.discount_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Discount</span>
                  <span className="text-green-700">-{cur} {Number(invoice.discount_amount).toFixed(2)}</span>
                </div>
              )}
              {invoice.tax_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Tax ({invoice.tax_rate}%)</span>
                  <span className="text-slate-900 font-medium">{cur} {Number(invoice.tax_amount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold border-t border-slate-200 pt-2">
                <span className="text-slate-900">Total</span>
                <span className="text-blue-700">{cur} {Number(invoice.total_amount ?? 0).toFixed(2)}</span>
              </div>
              {invoice.paid_amount > 0 && (
                <div className="flex justify-between text-sm text-green-700">
                  <span>Paid</span>
                  <span>-{cur} {Number(invoice.paid_amount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-slate-700">Balance Due</span>
                <span className={invoice.balance_due > 0 ? "text-red-700" : "text-green-700"}>
                  {cur} {Number(invoice.balance_due ?? 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment history */}
          {invoice.payments?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Payment History</h3>
              <div className="space-y-1">
                {invoice.payments.map((p: any) => (
                  <div key={p.id} className="flex justify-between text-sm bg-green-50 px-4 py-2.5 rounded-lg">
                    <span className="text-slate-600">{p.payment_date} · {p.payment_method}</span>
                    <span className="font-medium text-green-700">{cur} {Number(p.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {invoice.notes && (
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">Notes</p>
              <p className="text-sm text-slate-700">{invoice.notes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button onClick={() => window.print()} className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium px-4 py-2.5 rounded-lg text-sm">
              <Download className="h-4 w-4" /> Print / Download
            </button>
            {canPay && (
              <button onClick={() => setShowPayModal(true)} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm">
                <DollarSign className="h-4 w-4" /> Record Payment
              </button>
            )}
          </div>
        </div>
      </div>

      {showPayModal && (
        <RecordPaymentModal
          invoice={invoice}
          onClose={() => setShowPayModal(false)}
          onSuccess={() => { setShowPayModal(false); qc.invalidateQueries({ queryKey: ["invoice", id] }); }}
        />
      )}
    </div>
  );
}

function RecordPaymentModal({ invoice, onClose, onSuccess }: { invoice: any; onClose: () => void; onSuccess: () => void }) {
  const [amount, setAmount] = useState(String(invoice.balance_due ?? ""));
  const [method, setMethod] = useState("cash");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/billing/payments", {
        invoice_id: invoice.id,
        amount: Number(amount),
        payment_method: method,
        notes: notes || undefined,
      }),
    onSuccess,
  });

  const cls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-slate-900">Record Payment</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400 hover:text-slate-600" /></button>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Balance due: <span className="font-semibold text-slate-900">{invoice.currency ?? "USD"} {Number(invoice.balance_due).toFixed(2)}</span>
        </p>

        {mutation.isError && (
          <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">
            {(mutation.error as any)?.response?.data?.message ?? "Failed to record payment"}
          </div>
        )}

        <div className="space-y-3">
          <input type="number" min="0.01" step="0.01" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} className={cls} />
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={cls}>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="insurance">Insurance</option>
            <option value="online">Online</option>
          </select>
          <input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className={cls} />
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !amount} className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-2.5 rounded-lg text-sm">
            {mutation.isPending ? "Saving…" : "Record Payment"}
          </button>
          <button onClick={onClose} className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2.5 rounded-lg text-sm">Cancel</button>
        </div>
      </div>
    </div>
  );
}
