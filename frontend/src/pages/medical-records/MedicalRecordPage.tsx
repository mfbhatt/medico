import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, ArrowLeft, X, Lock } from "lucide-react";
import api from "@/services/api";

const TYPE_COLORS: Record<string, string> = {
  soap: "bg-blue-100 text-blue-700",
  prescription: "bg-green-100 text-green-700",
  lab_order: "bg-purple-100 text-purple-700",
};

const TYPE_LABELS: Record<string, string> = {
  soap: "SOAP Note",
  prescription: "Prescription",
  lab_order: "Lab Order",
};

export default function MedicalRecordPage() {
  const { id: recordId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteForm, setNoteForm] = useState({ subjective: "", objective: "", assessment: "", plan: "" });

  // recordId here is the appointment_id or patient_id depending on context
  // The API is GET /medical-records/patient/{patient_id}
  // We try fetching with the ID provided
  const { data: recordsData, isLoading } = useQuery({
    queryKey: ["medical-records", recordId],
    queryFn: () => api.get(`/medical-records/patient/${recordId}`).then((r) => r.data.data),
    enabled: !!recordId,
    retry: false,
  });
  const records: any[] = recordsData?.records ?? recordsData ?? [];

  const signMutation = useMutation({
    mutationFn: (recId: string) => api.post(`/medical-records/${recId}/sign`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medical-records", recordId] }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post("/medical-records/", {
        patient_id: recordId,
        subjective: noteForm.subjective,
        objective: noteForm.objective,
        assessment: noteForm.assessment,
        plan: noteForm.plan,
      }),
    onSuccess: () => {
      setShowAddNote(false);
      setNoteForm({ subjective: "", objective: "", assessment: "", plan: "" });
      qc.invalidateQueries({ queryKey: ["medical-records", recordId] });
    },
  });

  const cls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate("/patients")} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6 text-sm font-medium">
        <ArrowLeft className="h-4 w-4" /> Back to Patients
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-600" /> Medical Records
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-mono">Patient ID: {recordId?.slice(0, 16)}</p>
        </div>
        <button onClick={() => setShowAddNote(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm">
          <Plus className="h-4 w-4" /> Add SOAP Note
        </button>
      </div>

      {/* Add note form */}
      {showAddNote && (
        <div className="bg-white rounded-xl border border-blue-200 p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900">New SOAP Note</h3>
            <button onClick={() => setShowAddNote(false)}><X className="h-5 w-5 text-slate-400" /></button>
          </div>
          {createMutation.isError && (
            <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg mb-3">
              {(createMutation.error as any)?.response?.data?.message ?? "Failed to create record"}
            </div>
          )}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Subjective (patient's complaint)</label>
              <textarea value={noteForm.subjective} onChange={(e) => setNoteForm((p) => ({ ...p, subjective: e.target.value }))} rows={2} className={cls} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Objective (examination findings)</label>
              <textarea value={noteForm.objective} onChange={(e) => setNoteForm((p) => ({ ...p, objective: e.target.value }))} rows={2} className={cls} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Assessment (diagnosis)</label>
              <textarea value={noteForm.assessment} onChange={(e) => setNoteForm((p) => ({ ...p, assessment: e.target.value }))} rows={2} className={cls} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Plan (treatment)</label>
              <textarea value={noteForm.plan} onChange={(e) => setNoteForm((p) => ({ ...p, plan: e.target.value }))} rows={2} className={cls} />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !noteForm.subjective} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium px-4 py-2 rounded-lg text-sm">
              {createMutation.isPending ? "Saving…" : "Save Note"}
            </button>
            <button onClick={() => setShowAddNote(false)} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-4 py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      {isLoading && <div className="text-center py-12 text-slate-400 text-sm">Loading records…</div>}

      {!isLoading && records.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No medical records found</p>
        </div>
      )}

      <div className="space-y-4">
        {records.map((record: any) => (
          <div key={record.id} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${TYPE_COLORS[record.record_type] ?? "bg-gray-100 text-gray-600"}`}>
                  {TYPE_LABELS[record.record_type] ?? record.record_type}
                </span>
                <span className="text-xs text-slate-400">{record.created_at?.slice(0, 10)}</span>
                {record.is_signed && (
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <Lock className="h-3 w-3" /> Signed
                  </span>
                )}
              </div>
              {!record.is_signed && (
                <button
                  onClick={() => signMutation.mutate(record.id)}
                  disabled={signMutation.isPending}
                  className="text-xs text-green-700 bg-green-50 hover:bg-green-100 font-medium px-3 py-1 rounded-lg"
                >
                  Sign & Lock
                </button>
              )}
            </div>

            <div className="space-y-2">
              {record.subjective && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Subjective</p>
                  <p className="text-sm text-slate-800 mt-0.5">{record.subjective}</p>
                </div>
              )}
              {record.objective && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Objective</p>
                  <p className="text-sm text-slate-800 mt-0.5">{record.objective}</p>
                </div>
              )}
              {record.assessment && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Assessment</p>
                  <p className="text-sm text-slate-800 mt-0.5">{record.assessment}</p>
                </div>
              )}
              {record.plan && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Plan</p>
                  <p className="text-sm text-slate-800 mt-0.5">{record.plan}</p>
                </div>
              )}
              {record.addendums?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 mb-2">Addendums</p>
                  {record.addendums.map((a: any, i: number) => (
                    <div key={i} className="bg-amber-50 rounded-lg p-3 text-xs text-slate-700 mb-1">
                      {a.content} <span className="text-slate-400 ml-2">{a.created_at?.slice(0, 10)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
