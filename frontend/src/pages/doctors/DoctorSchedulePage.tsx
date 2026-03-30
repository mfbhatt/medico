import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock, Plus, Trash2, ArrowLeft, Save } from "lucide-react";
import api from "@/services/api";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS: Record<string, string> = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday",
  thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday",
};

interface ScheduleEntry {
  clinic_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  max_patients: number;
}

interface NewEntryForm {
  clinic_id: string;
  selected_days: string[];
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  max_patients: number;
}

const WEEKDAYS = DAYS.slice(0, 5);
const WEEKEND = DAYS.slice(5);

export default function DoctorSchedulePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: clinicsData } = useQuery({
    queryKey: ["clinics-list"],
    queryFn: () => api.get("/clinics/", { params: { limit: 50 } }).then((r) => r.data.data),
  });
  const clinics: any[] = clinicsData?.clinics ?? clinicsData ?? [];

  const { data: doctor } = useQuery({
    queryKey: ["doctor", id],
    queryFn: () => api.get(`/doctors/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

  // Populate from doctor's existing schedules if available
  const existingSchedules: ScheduleEntry[] = (doctor?.schedules ?? []).map((s: any) => ({
    clinic_id: s.clinic_id,
    day_of_week: s.day_of_week,
    start_time: s.start_time,
    end_time: s.end_time,
    slot_duration_minutes: s.slot_duration_minutes ?? 30,
    max_patients: s.max_patients ?? 20,
  }));

  const [schedules, setSchedules] = useState<ScheduleEntry[]>(existingSchedules);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [addError, setAddError] = useState("");
  const [newEntry, setNewEntry] = useState<NewEntryForm>({
    clinic_id: clinics[0]?.id ?? "",
    selected_days: ["monday"],
    start_time: "09:00",
    end_time: "17:00",
    slot_duration_minutes: 30,
    max_patients: 20,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      api.post(`/doctors/${id}/schedules`, { schedules }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctor", id] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  const toggleDay = (day: string) => {
    setNewEntry((p) => ({
      ...p,
      selected_days: p.selected_days.includes(day)
        ? p.selected_days.filter((d) => d !== day)
        : [...p.selected_days, day],
    }));
  };

  const toggleGroup = (group: string[]) => {
    const allSelected = group.every((d) => newEntry.selected_days.includes(d));
    setNewEntry((p) => ({
      ...p,
      selected_days: allSelected
        ? p.selected_days.filter((d) => !group.includes(d))
        : [...new Set([...p.selected_days, ...group])],
    }));
  };

  const addEntry = () => {
    setAddError("");
    if (!newEntry.clinic_id) { setAddError("Please select a clinic."); return; }
    if (newEntry.selected_days.length === 0) { setAddError("Select at least one day."); return; }
    if (!newEntry.start_time || !newEntry.end_time) { setAddError("Start and end time are required."); return; }
    if (newEntry.start_time >= newEntry.end_time) { setAddError("End time must be after start time."); return; }

    const newRows: ScheduleEntry[] = newEntry.selected_days.map((day) => ({
      clinic_id: newEntry.clinic_id,
      day_of_week: day,
      start_time: newEntry.start_time,
      end_time: newEntry.end_time,
      slot_duration_minutes: newEntry.slot_duration_minutes,
      max_patients: newEntry.max_patients,
    }));

    // Replace existing entries for the same clinic+day combination
    setSchedules((prev) => {
      const replaced = new Set(newEntry.selected_days.map((d) => `${newEntry.clinic_id}::${d}`));
      return [
        ...prev.filter((s) => !replaced.has(`${s.clinic_id}::${s.day_of_week}`)),
        ...newRows,
      ];
    });
  };

  const removeEntry = (idx: number) => setSchedules((prev) => prev.filter((_, i) => i !== idx));

  const cls = "px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const doctorName = doctor?.full_name ? `Dr. ${doctor.full_name}` : "Doctor";

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate(`/doctors/${id}`)} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6 text-sm font-medium">
        <ArrowLeft className="h-4 w-4" /> Back to Doctor
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Calendar className="h-6 w-6 text-blue-600" /> Manage Schedule
        </h1>
        <p className="text-sm text-slate-500 mt-1">{doctorName} — weekly availability</p>
      </div>

      {saveMutation.isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {(saveMutation.error as any)?.response?.data?.message ?? "Failed to save schedule"}
        </div>
      )}

      {/* Add entry */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Schedule
        </h2>

        {/* Day picker */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">Days</label>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => toggleGroup(WEEKDAYS)}
                className="text-blue-600 hover:underline"
              >
                {WEEKDAYS.every((d) => newEntry.selected_days.includes(d)) ? "Deselect weekdays" : "Weekdays"}
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={() => toggleGroup(WEEKEND)}
                className="text-blue-600 hover:underline"
              >
                {WEEKEND.every((d) => newEntry.selected_days.includes(d)) ? "Deselect weekend" : "Weekend"}
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={() => toggleGroup(DAYS)}
                className="text-blue-600 hover:underline"
              >
                {DAYS.every((d) => newEntry.selected_days.includes(d)) ? "Deselect all" : "All days"}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day) => {
              const selected = newEntry.selected_days.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    selected
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600"
                  }`}
                >
                  {DAY_LABELS[day].slice(0, 3)}
                </button>
              );
            })}
          </div>
          {newEntry.selected_days.length > 1 && (
            <p className="text-xs text-slate-500 mt-1.5">
              Schedule will be applied to: {newEntry.selected_days.map((d) => DAY_LABELS[d]).join(", ")}
            </p>
          )}
        </div>

        {/* Rest of form */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <select
            value={newEntry.clinic_id}
            onChange={(e) => setNewEntry((p) => ({ ...p, clinic_id: e.target.value }))}
            className={cls}
          >
            <option value="">Select Clinic</option>
            {clinics.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <input type="time" value={newEntry.start_time} onChange={(e) => setNewEntry((p) => ({ ...p, start_time: e.target.value }))} className={`${cls} flex-1`} />
          </div>

          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <input type="time" value={newEntry.end_time} onChange={(e) => setNewEntry((p) => ({ ...p, end_time: e.target.value }))} className={`${cls} flex-1`} />
          </div>

          <select value={newEntry.slot_duration_minutes} onChange={(e) => setNewEntry((p) => ({ ...p, slot_duration_minutes: Number(e.target.value) }))} className={cls}>
            <option value={15}>15 min slots</option>
            <option value={20}>20 min slots</option>
            <option value={30}>30 min slots</option>
            <option value={45}>45 min slots</option>
            <option value={60}>60 min slots</option>
          </select>

          <input
            type="number" min={1} max={100} value={newEntry.max_patients}
            onChange={(e) => setNewEntry((p) => ({ ...p, max_patients: Number(e.target.value) }))}
            placeholder="Max patients"
            className={cls}
          />
        </div>

        {addError && (
          <p className="mt-2 text-xs text-red-600">{addError}</p>
        )}

        <button onClick={addEntry} className="mt-3 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm">
          {newEntry.selected_days.length > 1
            ? `Apply to ${newEntry.selected_days.length} days`
            : "Add Slot"}
        </button>
      </div>

      {/* Current schedule */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Current Schedule ({schedules.length} entries)</h2>
        </div>

        {schedules.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">No schedule entries yet. Add slots above.</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {schedules.map((s, i) => {
              const clinic = clinics.find((c: any) => c.id === s.clinic_id);
              return (
                <div key={i} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{DAY_LABELS[s.day_of_week]}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {s.start_time} – {s.end_time} · {s.slot_duration_minutes}min slots · Max {s.max_patients} patients
                      {clinic && ` · ${clinic.name}`}
                    </p>
                  </div>
                  <button onClick={() => removeEntry(i)} className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {saveSuccess && (
        <div className="mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          ✓ Schedule saved successfully!
        </div>
      )}
      {saveMutation.isError && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          Failed to save schedule. Please try again.
        </div>
      )}

      <div className="flex gap-3 mt-5">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || schedules.length === 0}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium px-5 py-2.5 rounded-lg text-sm"
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Saving…" : "Save Schedule"}
        </button>
        <button onClick={() => navigate(`/doctors/${id}`)} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium px-5 py-2.5 rounded-lg text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}
