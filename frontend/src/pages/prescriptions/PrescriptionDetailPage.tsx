import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pill, RefreshCw, CheckCircle } from "lucide-react";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import api from "@/services/api";
import LoadingSpinner from "@/components/common/LoadingSpinner";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
  expired: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
};

const CLINICAL_ROLES = new Set(["doctor", "nurse", "clinic_admin", "tenant_admin", "super_admin"]);

export default function PrescriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useSelector((s: RootState) => s.auth);
  const qc = useQueryClient();

  const isClinical = CLINICAL_ROLES.has(user?.role ?? "");

  const { data: rx, isLoading, isError } = useQuery({
    queryKey: ["prescription", id],
    queryFn: () => api.get(`/prescriptions/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

  const completeMutation = useMutation({
    mutationFn: () => api.patch(`/prescriptions/${id}`, { status: "completed" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prescription", id] }),
  });

  const renewMutation = useMutation({
    mutationFn: () => api.post(`/prescriptions/${id}/renew`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prescription", id] }),
  });

  const refillMutation = useMutation({
    mutationFn: (reason: string) => api.post(`/prescriptions/${id}/request-refill`, { reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prescription", id] }),
  });

  if (isLoading) return <div className="py-20"><LoadingSpinner label="Loading prescription…" /></div>;
  if (isError || !rx) return <div className="text-center py-20 text-slate-400">Prescription not found</div>;

  const medications: any[] =
    rx.medications?.length
      ? rx.medications
      : rx.medication_name
      ? [{ drug_name: rx.medication_name, dosage: rx.dosage, frequency: rx.frequency, instructions: rx.instructions }]
      : [];

  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-6 text-sm font-medium"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="bg-white rounded-xl border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Prescription</h1>
            <p className="text-sm text-slate-500 mt-0.5 font-mono">#{rx.id?.slice(0, 8)}</p>
          </div>
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full capitalize ${STATUS_COLORS[rx.status] ?? "bg-gray-100 text-gray-700"}`}>
            {rx.status}
          </span>
        </div>

        <div className="p-6 space-y-6">
          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">Patient</p>
              <p className="font-semibold text-slate-900">{rx.patient_name ?? rx.patient_id?.slice(0, 8)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">Prescribed By</p>
              <p className="font-semibold text-slate-900">{rx.doctor_name ?? rx.doctor_id?.slice(0, 8) ?? "—"}</p>
            </div>
            {rx.diagnosis && (
              <div className="col-span-2">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">Diagnosis</p>
                <p className="text-slate-800">{rx.diagnosis}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">Start Date</p>
              <p className="text-slate-700">{rx.start_date ?? rx.created_at?.slice(0, 10) ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">End Date</p>
              <p className="text-slate-700">{rx.end_date ?? "—"}</p>
            </div>
            {rx.appointment_id && (
              <div className="col-span-2">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">Linked Appointment</p>
                <Link
                  to={`/appointments/${rx.appointment_id}`}
                  className="text-primary-600 hover:text-primary-800 font-medium"
                >
                  View Appointment →
                </Link>
              </div>
            )}
          </div>

          {/* Medications table */}
          <div>
            <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Pill className="h-4 w-4 text-primary-500" />
              Medications
            </h3>
            {medications.length === 0 ? (
              <p className="text-sm text-slate-400">No medications recorded</p>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium text-slate-600">Drug</th>
                      <th className="text-left px-4 py-2.5 font-medium text-slate-600">Dosage</th>
                      <th className="text-left px-4 py-2.5 font-medium text-slate-600">Frequency</th>
                      <th className="text-left px-4 py-2.5 font-medium text-slate-600">Duration</th>
                      <th className="text-left px-4 py-2.5 font-medium text-slate-600">Instructions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {medications.map((m: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{m.drug_name ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-700">{m.dosage ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-700">{m.frequency ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{m.duration_days ? `${m.duration_days} days` : "—"}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs">{m.instructions ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {rx.notes && (
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-slate-800">{rx.notes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-100">
            {isClinical && rx.status === "active" && (
              <button
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium px-4 py-2.5 rounded-lg text-sm"
              >
                <CheckCircle className="h-4 w-4" />
                {completeMutation.isPending ? "Updating…" : "Mark Completed"}
              </button>
            )}
            {isClinical && (
              <button
                onClick={() => renewMutation.mutate()}
                disabled={renewMutation.isPending}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium px-4 py-2.5 rounded-lg text-sm"
              >
                <RefreshCw className="h-4 w-4" />
                {renewMutation.isPending ? "Renewing…" : "Renew"}
              </button>
            )}
            {!isClinical && rx.status === "active" && (
              <button
                onClick={() => {
                  const reason = window.prompt("Reason for refill request (optional):");
                  if (reason !== null) refillMutation.mutate(reason);
                }}
                disabled={refillMutation.isPending}
                className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium px-4 py-2.5 rounded-lg text-sm"
              >
                <RefreshCw className="h-4 w-4" />
                {refillMutation.isPending ? "Requesting…" : "Request Refill"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
