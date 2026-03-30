import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, X, FileText } from "lucide-react";
import api from "@/services/api";
import { useDebounce } from "@/hooks/useDebounce";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
  expired: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
};

export default function PrescriptionsPage() {
  const qc = useQueryClient();
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [showNewModal, setShowNewModal] = useState(false);
  const debouncedSearch = useDebounce(patientSearch, 300);

  const { data: patientsData } = useQuery({
    queryKey: ["patients-search", debouncedSearch],
    queryFn: () => api.get("/patients/", { params: { search: debouncedSearch, limit: 10 } }).then((r) => r.data.data),
    enabled: debouncedSearch.length > 1,
  });
  const patientSuggestions = patientsData?.patients ?? patientsData ?? [];

  const { data: rxData, isLoading } = useQuery({
    queryKey: ["prescriptions", selectedPatient?.id, statusFilter],
    queryFn: () =>
      api.get(`/prescriptions/patient/${selectedPatient.id}`, {
        params: { status: statusFilter || undefined, limit: 50 },
      }).then((r) => r.data.data),
    enabled: !!selectedPatient?.id,
  });
  const prescriptions = rxData?.prescriptions ?? rxData ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Prescriptions</h1>
          <p className="text-sm text-slate-500 mt-1">Search a patient to view their prescriptions</p>
        </div>
        {selectedPatient && (
          <button onClick={() => setShowNewModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm">
            <Plus className="h-4 w-4" /> New Prescription
          </button>
        )}
      </div>

      {/* Patient search */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search patient by name, phone, or MRN…"
              value={selectedPatient ? `${selectedPatient.first_name} ${selectedPatient.last_name}` : patientSearch}
              onChange={(e) => { setPatientSearch(e.target.value); setSelectedPatient(null); }}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {selectedPatient && (
              <button onClick={() => { setSelectedPatient(null); setPatientSearch(""); }} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
              </button>
            )}
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="expired">Expired</option>
          </select>
        </div>

        {/* Dropdown suggestions */}
        {!selectedPatient && patientSuggestions.length > 0 && debouncedSearch.length > 1 && (
          <div className="mt-2 border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
            {patientSuggestions.slice(0, 5).map((p: any) => (
              <button
                key={p.id}
                onClick={() => { setSelectedPatient(p); setPatientSearch(""); }}
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-sm"
              >
                <span className="font-medium text-slate-900">{p.first_name} {p.last_name}</span>
                <span className="text-slate-400 ml-2 text-xs">{p.mrn} · {p.phone}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Prescriptions table */}
      {!selectedPatient && (
        <div className="text-center py-20 text-slate-400">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Search and select a patient to view prescriptions</p>
        </div>
      )}

      {selectedPatient && isLoading && (
        <div className="text-center py-12 text-slate-400 text-sm">Loading prescriptions…</div>
      )}

      {selectedPatient && !isLoading && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 text-sm">
              Prescriptions for {selectedPatient.first_name} {selectedPatient.last_name}
            </h3>
            <span className="text-xs text-slate-400">{prescriptions.length} record(s)</span>
          </div>

          {prescriptions.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">No prescriptions found</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Medication</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Dosage</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Frequency</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Start</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">End</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {prescriptions.map((rx: any) => (
                  <tr key={rx.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5 font-medium text-slate-900">
                      {rx.medications?.map((m: any) => m.drug_name).join(", ") ?? rx.medication_name ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700">
                      {rx.medications?.map((m: any) => m.dosage).join(", ") ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700">
                      {rx.medications?.map((m: any) => m.frequency).join(", ") ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{rx.start_date ?? "—"}</td>
                    <td className="px-5 py-3.5 text-slate-600">{rx.end_date ?? "—"}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[rx.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {rx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* New Prescription Modal */}
      {showNewModal && selectedPatient && (
        <NewPrescriptionModal patient={selectedPatient} onClose={() => setShowNewModal(false)} onSuccess={() => { setShowNewModal(false); qc.invalidateQueries({ queryKey: ["prescriptions"] }); }} />
      )}
    </div>
  );
}

function NewPrescriptionModal({ patient, onClose, onSuccess }: { patient: any; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    drug_name: "",
    dosage: "",
    frequency: "",
    duration_days: "7",
    instructions: "",
    diagnosis: "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/prescriptions/", {
        patient_id: patient.id,
        diagnosis: form.diagnosis,
        medications: [{
          drug_name: form.drug_name,
          dosage: form.dosage,
          frequency: form.frequency,
          duration_days: Number(form.duration_days),
          instructions: form.instructions,
        }],
      }),
    onSuccess,
  });

  const cls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-slate-900">New Prescription</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400 hover:text-slate-600" /></button>
        </div>
        <p className="text-sm text-slate-500 mb-4">Patient: <span className="font-medium text-slate-900">{patient.first_name} {patient.last_name}</span></p>

        {mutation.isError && (
          <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">
            {(mutation.error as any)?.response?.data?.message ?? "Failed to create prescription"}
          </div>
        )}

        <div className="space-y-3">
          <input placeholder="Diagnosis *" value={form.diagnosis} onChange={(e) => setForm((p) => ({ ...p, diagnosis: e.target.value }))} className={cls} />
          <input placeholder="Drug Name *" value={form.drug_name} onChange={(e) => setForm((p) => ({ ...p, drug_name: e.target.value }))} className={cls} />
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Dosage (e.g. 500mg)" value={form.dosage} onChange={(e) => setForm((p) => ({ ...p, dosage: e.target.value }))} className={cls} />
            <input placeholder="Frequency" value={form.frequency} onChange={(e) => setForm((p) => ({ ...p, frequency: e.target.value }))} className={cls} />
          </div>
          <input type="number" placeholder="Duration (days)" value={form.duration_days} onChange={(e) => setForm((p) => ({ ...p, duration_days: e.target.value }))} className={cls} />
          <textarea placeholder="Special instructions…" value={form.instructions} onChange={(e) => setForm((p) => ({ ...p, instructions: e.target.value }))} rows={2} className={cls} />
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.drug_name || !form.diagnosis} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-lg text-sm">
            {mutation.isPending ? "Saving…" : "Create Prescription"}
          </button>
          <button onClick={onClose} className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2.5 rounded-lg text-sm">Cancel</button>
        </div>
      </div>
    </div>
  );
}
