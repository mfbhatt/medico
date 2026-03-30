import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock, User, Phone, FileText, ArrowLeft, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
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

  if (isLoading) return <div className="text-center py-20 text-slate-400">Loading appointment…</div>;
  if (isError || !appt) return <div className="text-center py-20 text-slate-400">Appointment not found</div>;

  const canCancel = ["scheduled", "checked_in"].includes(appt.status);
  const canCheckIn = appt.status === "scheduled";
  const canNoShow = appt.status === "scheduled";

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
    </div>
  );
}
