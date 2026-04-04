import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock, User, Phone, FileText, ArrowLeft, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import api from "@/services/api";

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800",
  checked_in: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-700",
  no_show: "bg-red-100 text-red-800",
};

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useSelector((s: RootState) => s.auth);
  const isPatient = user?.role === "patient";
  const qc = useQueryClient();

  const { data: appt, isLoading, isError } = useQuery({
    queryKey: ["appointment", id],
    queryFn: () => api.get(`/appointments/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) =>
      api.patch(`/appointments/${id}/cancel`, { reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointment", id] }),
  });

  const checkInMutation = useMutation({
    mutationFn: () => api.patch(`/appointments/${id}/check-in`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointment", id] }),
  });

  const noShowMutation = useMutation({
    mutationFn: () => api.patch(`/appointments/${id}/no-show`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointment", id] }),
  });

  const [showPayModal, setShowPayModal] = useState(false);
  const [paying, setPaying] = useState(false);

  const handlePay = async (method: "cash" | "razorpay") => {
    setPaying(true);
    try {
      if (method === "cash") {
        await api.post(`/appointments/${id}/initiate-payment`, { payment_method: "cash" });
        qc.invalidateQueries({ queryKey: ["appointment", id] });
        setShowPayModal(false);
      } else {
        const { data: res } = await api.post(`/appointments/${id}/initiate-payment`, { payment_method: "razorpay" });
        const order = res.data;
        let Rzp = (window as any).Razorpay;
        if (!Rzp) {
          await new Promise<void>((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "https://checkout.razorpay.com/v1/checkout.js";
            s.onload = () => resolve();
            s.onerror = () => reject();
            document.body.appendChild(s);
          });
          Rzp = (window as any).Razorpay;
        }
        const rzp = new Rzp({
          key: order.key_id,
          amount: order.amount,
          currency: order.currency,
          order_id: order.order_id,
          description: order.description,
          handler: async (response: any) => {
            await api.post(`/appointments/${id}/verify-payment`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            qc.invalidateQueries({ queryKey: ["appointment", id] });
            setShowPayModal(false);
          },
        });
        rzp.open();
      }
    } catch (err: any) {
      alert(err?.response?.data?.message ?? "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  const handleRefund = async () => {
    if (!window.confirm("Process refund for this cancelled appointment?")) return;
    try {
      await api.post(`/appointments/${id}/refund`, { reason: "Appointment cancelled" });
      qc.invalidateQueries({ queryKey: ["appointment", id] });
    } catch (err: any) {
      alert(err?.response?.data?.message ?? "Refund failed");
    }
  };

  if (isLoading) return <div className="text-center py-20 text-slate-400">Loading appointment…</div>;
  if (isError || !appt) return <div className="text-center py-20 text-slate-400">Appointment not found</div>;

  const canCancel = ["scheduled", "checked_in"].includes(appt.status);
  const canCheckIn = appt.status === "scheduled";
  const canNoShow = appt.status === "scheduled";
  const canPay = !["cancelled", "no_show"].includes(appt.status) && (!appt.payment_status || appt.payment_status === "issued" || appt.payment_status === "overdue");
  const canRefund = appt.status === "cancelled" && appt.payment_status === "paid";

  const PAYMENT_BADGE: Record<string, string> = {
    paid: "bg-green-100 text-green-800",
    issued: "bg-yellow-100 text-yellow-800",
    partially_paid: "bg-yellow-100 text-yellow-800",
    overdue: "bg-red-100 text-red-800",
    voided: "bg-gray-100 text-gray-600",
    draft: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate("/appointments")} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6 text-sm font-medium">
        <ArrowLeft className="h-4 w-4" /> Back to Appointments
      </button>

      <div className="bg-white rounded-xl border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Appointment Details</h1>
            <p className="text-sm text-slate-500 mt-0.5 font-mono">#{appt.id?.slice(0, 8)}</p>
          </div>
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full capitalize ${STATUS_COLORS[appt.status] ?? "bg-gray-100 text-gray-700"}`}>
            {appt.status?.replace(/_/g, " ")}
          </span>
        </div>

        <div className="p-6 space-y-6">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-5">
            <div className="flex gap-3">
              <User className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Patient</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{appt.patient_name ?? appt.patient_id?.slice(0, 8)}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <User className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Doctor</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{appt.doctor_name ?? appt.doctor_id?.slice(0, 8)}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Calendar className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Date</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{appt.appointment_date}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Clock className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Time</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{appt.start_time} – {appt.end_time}</p>
              </div>
            </div>

            {appt.clinic_name && (
              <div className="flex gap-3">
                <Phone className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Clinic</p>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">{appt.clinic_name}</p>
                </div>
              </div>
            )}

            {appt.appointment_type && (
              <div className="flex gap-3">
                <FileText className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Type</p>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5 capitalize">{appt.appointment_type?.replace(/_/g, " ")}</p>
                </div>
              </div>
            )}
          </div>

          {appt.chief_complaint && (
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">Chief Complaint</p>
              <p className="text-sm text-slate-800">{appt.chief_complaint}</p>
            </div>
          )}

          {appt.notes && (
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-slate-800">{appt.notes}</p>
            </div>
          )}

          {appt.cancellation_reason && (
            <div className="bg-red-50 rounded-lg p-4">
              <p className="text-xs text-red-600 font-medium uppercase tracking-wide mb-1">Cancellation Reason</p>
              <p className="text-sm text-red-800">{appt.cancellation_reason}</p>
            </div>
          )}

          {/* Payment section */}
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Payment</p>
              {appt.payment_status ? (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${PAYMENT_BADGE[appt.payment_status] ?? "bg-gray-100 text-gray-600"}`}>
                  {appt.payment_status.replace(/_/g, " ")}
                </span>
              ) : (
                <span className="text-xs text-slate-400">Unpaid</span>
              )}
            </div>
            {appt.consultation_fee != null && (
              <p className="text-lg font-bold text-slate-900">₹{appt.consultation_fee.toLocaleString()}</p>
            )}
            <div className="flex gap-2 mt-3">
              {canPay && (
                <button
                  onClick={() => setShowPayModal(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
                >
                  Pay Now
                </button>
              )}
              {canRefund && (
                <button
                  onClick={handleRefund}
                  className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
                >
                  Issue Refund
                </button>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-100">
            {canCheckIn && (
              <button
                onClick={() => checkInMutation.mutate()}
                disabled={checkInMutation.isPending}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium px-4 py-2.5 rounded-lg text-sm"
              >
                <CheckCircle className="h-4 w-4" />
                Check In
              </button>
            )}

            {canNoShow && (
              <button
                onClick={() => noShowMutation.mutate()}
                disabled={noShowMutation.isPending}
                className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-medium px-4 py-2.5 rounded-lg text-sm"
              >
                <AlertTriangle className="h-4 w-4" />
                Mark No-Show
              </button>
            )}

            {canCancel && (
              <button
                onClick={() => {
                  const reason = window.prompt("Cancellation reason (optional):");
                  if (reason !== null) cancelMutation.mutate(reason);
                }}
                disabled={cancelMutation.isPending}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium px-4 py-2.5 rounded-lg text-sm"
              >
                <XCircle className="h-4 w-4" />
                Cancel Appointment
              </button>
            )}

            {appt.appointment_type === "telemedicine" && appt.status === "scheduled" && (
              <button
                onClick={() => navigate(`/telemedicine/${id}`)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm"
              >
                Start Video Call
              </button>
            )}
          </div>
        </div>
      </div>
      {showPayModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Choose Payment Method</h2>
            {appt.consultation_fee != null && (
              <p className="text-2xl font-bold text-slate-900 mb-5">₹{appt.consultation_fee.toLocaleString()}</p>
            )}
            <div className="flex flex-col gap-3">
              {!isPatient && (
                <button
                  onClick={() => handlePay("cash")}
                  disabled={paying}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-medium py-2.5 rounded-lg text-sm"
                >
                  💵 Pay with Cash
                </button>
              )}
              <button
                onClick={() => handlePay("razorpay")}
                disabled={paying}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2.5 rounded-lg text-sm"
              >
                💳 Pay with Razorpay
              </button>
              <button onClick={() => setShowPayModal(false)} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 rounded-lg text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
