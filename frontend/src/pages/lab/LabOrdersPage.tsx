import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, X, FlaskConical, ChevronDown } from "lucide-react";
import api from "@/services/api";
import { useDebounce } from "@/hooks/useDebounce";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  collected: "bg-blue-100 text-blue-800",
  processing: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-600",
};

export default function LabOrdersPage() {
  const qc = useQueryClient();
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const debouncedSearch = useDebounce(patientSearch, 300);

  const { data: patientsData } = useQuery({
    queryKey: ["patients-search", debouncedSearch],
    queryFn: () => api.get("/patients/", { params: { search: debouncedSearch, limit: 10 } }).then((r) => r.data.data),
    enabled: debouncedSearch.length > 1,
  });
  const patientSuggestions = patientsData?.patients ?? patientsData ?? [];

  const { data: labData, isLoading } = useQuery({
    queryKey: ["lab-reports", selectedPatient?.id],
    queryFn: () =>
      api.get(`/lab/reports/patient/${selectedPatient.id}`, { params: { limit: 50 } }).then((r) => r.data.data),
    enabled: !!selectedPatient?.id,
  });
  const reports = labData?.reports ?? labData ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lab Orders</h1>
          <p className="text-sm text-slate-500 mt-1">Search a patient to view their lab orders and reports</p>
        </div>
        {selectedPatient && (
          <button onClick={() => setShowNewModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm">
            <Plus className="h-4 w-4" /> New Lab Order
          </button>
        )}
      </div>

      {/* Patient search */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search patient by name, phone, or MRN…"
            value={selectedPatient ? `${selectedPatient.first_name} ${selectedPatient.last_name}` : patientSearch}
            onChange={(e) => { setPatientSearch(e.target.value); setSelectedPatient(null); }}
            className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {selectedPatient && (
            <button onClick={() => { setSelectedPatient(null); setPatientSearch(""); }} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
            </button>
          )}
        </div>
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

      {!selectedPatient && (
        <div className="text-center py-20 text-slate-400">
          <FlaskConical className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Search and select a patient to view lab orders</p>
        </div>
      )}

      {selectedPatient && isLoading && <div className="text-center py-12 text-slate-400 text-sm">Loading lab orders…</div>}

      {selectedPatient && !isLoading && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 text-sm">
              Lab Orders for {selectedPatient.first_name} {selectedPatient.last_name}
            </h3>
            <span className="text-xs text-slate-400">{reports.length} record(s)</span>
          </div>

          {reports.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">No lab orders found</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {reports.map((r: any) => (
                <div key={r.id} className="px-5 py-4 hover:bg-slate-50 flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{r.order_number ?? `Lab #${r.id?.slice(0, 8)}`}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Tests: {r.tests?.join(", ") ?? "—"} · Ordered: {r.ordered_date ?? r.created_at?.slice(0, 10)}
                    </p>
                    {r.results?.length > 0 && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {r.results.filter((res: any) => res.status !== "normal").length} abnormal result(s)
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {r.status}
                    </span>
                    {r.id && (
                      <a href={`/lab/reports/${r.id}`} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                        View →
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showNewModal && selectedPatient && (
        <NewLabOrderModal
          patient={selectedPatient}
          onClose={() => setShowNewModal(false)}
          onSuccess={() => { setShowNewModal(false); qc.invalidateQueries({ queryKey: ["lab-reports"] }); }}
        />
      )}
    </div>
  );
}

function LabTestMultiSelect({
  selected,
  onChange,
}: {
  selected: any[];
  onChange: (tests: any[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 200);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: catalogData } = useQuery({
    queryKey: ["lab-test-catalog", debouncedSearch],
    queryFn: () =>
      api.get("/lab/tests", { params: debouncedSearch ? { search: debouncedSearch } : {} }).then((r) => r.data.data),
  });
  const allTests: any[] = catalogData ?? [];

  // Group by category
  const grouped = allTests.reduce((acc: Record<string, any[]>, t: any) => {
    const cat = t.category ?? "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

  const isSelected = (t: any) => selected.some((s) => s.test_name === t.test_name);
  const toggle = (t: any) => {
    if (isSelected(t)) onChange(selected.filter((s) => s.test_name !== t.test_name));
    else onChange([...selected, { test_name: t.test_name, test_code: t.test_code, loinc_code: t.loinc_code, panel_name: t.panel_name }]);
  };
  const remove = (name: string) => onChange(selected.filter((s) => s.test_name !== name));

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((t) => (
            <span key={t.test_name} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full">
              {t.test_name}
              <button type="button" onClick={() => remove(t.test_name)} className="hover:text-blue-900">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span className={selected.length === 0 ? "text-slate-400" : "text-slate-900"}>
          {selected.length === 0 ? "Select tests…" : `${selected.length} test${selected.length > 1 ? "s" : ""} selected`}
        </span>
        <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-72 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                autoFocus
                placeholder="Search tests…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {Object.keys(grouped).sort().map((cat) => (
              <div key={cat}>
                <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50 sticky top-0">
                  {cat}
                </div>
                {grouped[cat].map((t: any) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggle(t)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between gap-2 ${isSelected(t) ? "bg-blue-50" : ""}`}
                  >
                    <div>
                      <span className={`font-medium ${isSelected(t) ? "text-blue-700" : "text-slate-900"}`}>{t.test_name}</span>
                      {t.test_code && <span className="text-slate-400 text-xs ml-1.5">{t.test_code}</span>}
                      {t.is_fasting_required && <span className="text-amber-600 text-xs ml-1.5">· Fasting</span>}
                    </div>
                    {isSelected(t) && <div className="h-4 w-4 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0"><X className="h-2.5 w-2.5 text-white" /></div>}
                  </button>
                ))}
              </div>
            ))}
            {allTests.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-sm">No tests found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NewLabOrderModal({ patient, onClose, onSuccess }: { patient: any; onClose: () => void; onSuccess: () => void }) {
  const [doctorId, setDoctorId] = useState("");
  const [clinicId, setClinicId] = useState("");
  const [selectedTests, setSelectedTests] = useState<any[]>([]);
  const [priority, setPriority] = useState("routine");
  const [clinicalNotes, setClinicalNotes] = useState("");

  const { data: doctorsData } = useQuery({
    queryKey: ["doctors-list"],
    queryFn: () => api.get("/doctors/", { params: { limit: 100 } }).then((r) => r.data.data),
  });
  const doctors: any[] = Array.isArray(doctorsData) ? doctorsData : doctorsData?.doctors ?? [];

  const { data: clinicsData } = useQuery({
    queryKey: ["clinics-list"],
    queryFn: () => api.get("/clinics/", { params: { limit: 50 } }).then((r) => r.data.data),
  });
  const clinics: any[] = clinicsData?.clinics ?? clinicsData ?? [];

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/lab/orders", {
        patient_id: patient.id,
        doctor_id: doctorId,
        clinic_id: clinicId,
        tests: selectedTests,
        priority,
        clinical_notes: clinicalNotes || undefined,
      }),
    onSuccess,
  });

  const cls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-slate-900">New Lab Order</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400 hover:text-slate-600" /></button>
        </div>
        <p className="text-sm text-slate-500 mb-4">Patient: <span className="font-medium text-slate-900">{patient.first_name} {patient.last_name}</span></p>

        {mutation.isError && (
          <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">
            {(mutation.error as any)?.response?.data?.message ?? "Failed to create lab order"}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Doctor *</label>
            <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className={cls}>
              <option value="">Select doctor…</option>
              {doctors.map((d: any) => (
                <option key={d.id} value={d.id}>
                  Dr. {d.user?.first_name ?? d.first_name} {d.user?.last_name ?? d.last_name}
                  {d.specialization ? ` — ${d.specialization}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Clinic *</label>
            <select value={clinicId} onChange={(e) => setClinicId(e.target.value)} className={cls}>
              <option value="">Select clinic…</option>
              {clinics.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Tests *</label>
            <LabTestMultiSelect selected={selectedTests} onChange={setSelectedTests} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={cls}>
              <option value="routine">Routine</option>
              <option value="urgent">Urgent</option>
              <option value="stat">STAT</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Clinical Notes</label>
            <textarea value={clinicalNotes} onChange={(e) => setClinicalNotes(e.target.value)} rows={2} className={cls} />
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || selectedTests.length === 0 || !doctorId || !clinicId} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-lg text-sm">
            {mutation.isPending ? "Ordering…" : "Create Order"}
          </button>
          <button onClick={onClose} className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2.5 rounded-lg text-sm">Cancel</button>
        </div>
      </div>
    </div>
  );
}
