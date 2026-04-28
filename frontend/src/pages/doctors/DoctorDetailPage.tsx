import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Mail, Phone, Award, ArrowLeft, Calendar, Hash,
  Clock, DollarSign, Star, Video, UserCheck, UserX, FileText, Pencil, X,
} from "lucide-react";
import api from "@/services/api";
import { useCurrency, useCurrencySymbol } from "@/hooks/useCurrency";

const DAY_LABELS: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed",
  thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun",
};

interface EditDoctorForm {
  first_name: string;
  last_name: string;
  phone: string;
  registration_number: string;
  specialization: string;
  experience_years: string;
  consultation_fee: string;
  follow_up_fee: string;
  default_slot_duration: string;
  biography: string;
  is_accepting_new_patients: boolean;
  telemedicine_enabled: boolean;
}

const INITIAL_EDIT_FORM: EditDoctorForm = {
  first_name: "", last_name: "", phone: "",
  registration_number: "", specialization: "",
  experience_years: "", consultation_fee: "", follow_up_fee: "",
  default_slot_duration: "", biography: "",
  is_accepting_new_patients: true, telemedicine_enabled: false,
};

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 text-blue-500 flex-shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">{label}</p>
        <p className="text-sm text-slate-900 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{title}</p>
      {children}
    </div>
  );
}

export default function DoctorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fmt = useCurrency();
  const currencySymbol = useCurrencySymbol();
  const qc = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditDoctorForm>(INITIAL_EDIT_FORM);
  const [editError, setEditError] = useState("");

  const { data: doctor, isLoading, isError } = useQuery({
    queryKey: ["doctor", id],
    queryFn: () => api.get(`/doctors/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

  const { data: specsData } = useQuery({
    queryKey: ["specializations"],
    queryFn: () =>
      api.get("/specializations/", { params: { is_active: true } })
        .then((r) => r.data.data as { id: string; name: string; category: string | null }[]),
    staleTime: 5 * 60 * 1000,
  });
  const specializations = specsData ?? [];
  const specsByCategory = specializations.reduce<Record<string, typeof specializations>>(
    (acc, s) => {
      const key = s.category ?? "Other";
      (acc[key] = acc[key] ?? []).push(s);
      return acc;
    },
    {}
  );

  const updateMutation = useMutation({
    mutationFn: async ({ form }: { form: EditDoctorForm }) => {
      await Promise.all([
        api.patch(`/doctors/${id}`, {
          primary_specialization: form.specialization || undefined,
          registration_number: form.registration_number || undefined,
          consultation_fee: form.consultation_fee ? Number(form.consultation_fee) : undefined,
          follow_up_fee: form.follow_up_fee ? Number(form.follow_up_fee) : undefined,
          experience_years: form.experience_years ? Number(form.experience_years) : undefined,
          default_slot_duration: form.default_slot_duration ? Number(form.default_slot_duration) : undefined,
          bio: form.biography || undefined,
          is_accepting_new_patients: form.is_accepting_new_patients,
          telemedicine_enabled: form.telemedicine_enabled,
        }),
        api.patch(`/users/${doctor.user_id}`, {
          first_name: form.first_name || undefined,
          last_name: form.last_name || undefined,
          phone: form.phone || undefined,
        }),
      ]);
    },
    onSuccess: (_data, variables) => {
      const { form } = variables;
      const firstName = form.first_name || doctor.first_name;
      const lastName = form.last_name || doctor.last_name;
      const updated = {
        ...doctor,
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`.trim(),
        phone: form.phone || doctor.phone,
        registration_number: form.registration_number || doctor.registration_number,
        primary_specialization: form.specialization || doctor.primary_specialization,
        experience_years: form.experience_years ? Number(form.experience_years) : doctor.experience_years,
        consultation_fee: form.consultation_fee ? Number(form.consultation_fee) : doctor.consultation_fee,
        follow_up_fee: form.follow_up_fee ? Number(form.follow_up_fee) : doctor.follow_up_fee,
        default_slot_duration: form.default_slot_duration ? Number(form.default_slot_duration) : doctor.default_slot_duration,
        biography: form.biography,
        is_accepting_new_patients: form.is_accepting_new_patients,
        telemedicine_enabled: form.telemedicine_enabled,
      };
      // Update detail cache in-place
      qc.setQueryData(["doctor", id], updated);
      // Update list cache in-place (preserves order)
      qc.setQueriesData({ queryKey: ["doctors"] }, (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((d: any) => d.id === id ? { ...d, ...updated } : d),
        };
      });
      setEditOpen(false);
      setEditError("");
    },
    onError: (err: any) => {
      setEditError(err.response?.data?.detail ?? "Failed to update doctor");
    },
  });

  const openEdit = () => {
    setEditForm({
      first_name: doctor.first_name ?? "",
      last_name: doctor.last_name ?? "",
      phone: doctor.phone ?? "",
      registration_number: doctor.registration_number ?? "",
      specialization: doctor.primary_specialization ?? "",
      experience_years: doctor.experience_years != null ? String(doctor.experience_years) : "",
      consultation_fee: doctor.consultation_fee != null ? String(doctor.consultation_fee) : "",
      follow_up_fee: doctor.follow_up_fee != null ? String(doctor.follow_up_fee) : "",
      default_slot_duration: doctor.default_slot_duration != null ? String(doctor.default_slot_duration) : "",
      biography: doctor.biography ?? "",
      is_accepting_new_patients: doctor.is_accepting_new_patients ?? true,
      telemedicine_enabled: doctor.telemedicine_enabled ?? false,
    });
    setEditError("");
    setEditOpen(true);
  };

  const setEditField = (field: keyof Omit<EditDoctorForm, "is_accepting_new_patients" | "telemedicine_enabled">) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setEditForm((f) => ({ ...f, [field]: e.target.value }));

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditError("");
    updateMutation.mutate({ form: editForm });
  };

  if (isLoading) return <div className="text-center py-20 text-slate-400">Loading doctor…</div>;
  if (isError || !doctor) return <div className="text-center py-20 text-slate-400">Doctor not found</div>;

  const name = `Dr. ${doctor.first_name ?? ""} ${doctor.last_name ?? ""}`.trim();
  const schedules: any[] = Array.isArray(doctor.schedules) ? doctor.schedules : [];

  const qualifications: string[] = Array.isArray(doctor.qualifications)
    ? doctor.qualifications
    : doctor.qualifications && typeof doctor.qualifications === "object"
      ? Object.values(doctor.qualifications)
      : [];

  const secondarySpecs: string[] = Array.isArray(doctor.secondary_specializations)
    ? doctor.secondary_specializations
    : doctor.secondary_specializations && typeof doctor.secondary_specializations === "object"
      ? Object.values(doctor.secondary_specializations)
      : [];

  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={() => navigate("/doctors")}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6 text-sm font-medium"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Doctors
      </button>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">

        {/* Header */}
        <div className="px-6 py-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{name}</h1>
            {doctor.primary_specialization && (
              <p className="text-sm text-slate-500 mt-0.5">{doctor.primary_specialization}</p>
            )}
            <div className="flex flex-wrap gap-2 mt-2">
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                doctor.is_accepting_new_patients ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              }`}>
                {doctor.is_accepting_new_patients
                  ? <><UserCheck className="h-3.5 w-3.5" /> Accepting patients</>
                  : <><UserX className="h-3.5 w-3.5" /> Not accepting</>}
              </span>
              {doctor.telemedicine_enabled && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700">
                  <Video className="h-3.5 w-3.5" /> Telemedicine
                </span>
              )}
            </div>
          </div>

          {/* Rating */}
          {doctor.total_ratings > 0 && (
            <div className="text-right flex-shrink-0">
              <div className="flex items-center gap-1 justify-end">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${i < Math.round(doctor.average_rating) ? "fill-yellow-400 text-yellow-400" : "text-slate-200"}`}
                  />
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {doctor.average_rating.toFixed(1)} · {doctor.total_ratings} rating{doctor.total_ratings !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </div>

        {/* Contact */}
        <div className="px-6 py-5">
          <Section title="Contact">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {doctor.email && <Field icon={<Mail className="h-4 w-4" />} label="Email" value={doctor.email} />}
              {doctor.phone && <Field icon={<Phone className="h-4 w-4" />} label="Phone" value={doctor.phone} />}
            </div>
          </Section>
        </div>

        {/* Professional */}
        <div className="px-6 py-5">
          <Section title="Professional">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {doctor.registration_number && (
                <Field icon={<Hash className="h-4 w-4" />} label="Registration No." value={
                  <span className="font-mono">{doctor.registration_number}</span>
                } />
              )}
              {doctor.experience_years != null && (
                <Field icon={<Award className="h-4 w-4" />} label="Experience" value={`${doctor.experience_years} year${doctor.experience_years !== 1 ? "s" : ""}`} />
              )}
              {doctor.default_slot_duration != null && (
                <Field icon={<Clock className="h-4 w-4" />} label="Slot Duration" value={`${doctor.default_slot_duration} min`} />
              )}
              {secondarySpecs.length > 0 && (
                <div className="sm:col-span-2 flex gap-3">
                  <Award className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Secondary Specializations</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {secondarySpecs.map((s, i) => (
                        <span key={i} className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">{s}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {qualifications.length > 0 && (
                <div className="sm:col-span-2 flex gap-3">
                  <Award className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Qualifications</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {qualifications.map((q, i) => (
                        <span key={i} className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full">{q}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Section>
        </div>

        {/* Fees */}
        {(doctor.consultation_fee != null || doctor.follow_up_fee != null) && (
          <div className="px-6 py-5">
            <Section title="Fees">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {doctor.consultation_fee != null && (
                  <Field icon={<DollarSign className="h-4 w-4" />} label="Consultation" value={fmt(doctor.consultation_fee)} />
                )}
                {doctor.follow_up_fee != null && (
                  <Field icon={<DollarSign className="h-4 w-4" />} label="Follow-up" value={fmt(doctor.follow_up_fee)} />
                )}
              </div>
            </Section>
          </div>
        )}

        {/* Biography */}
        {doctor.biography && (
          <div className="px-6 py-5">
            <Section title="Biography">
              <div className="flex gap-3">
                <FileText className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{doctor.biography}</p>
              </div>
            </Section>
          </div>
        )}

        {/* Weekly Schedule */}
        {schedules.length > 0 && (
          <div className="px-6 py-5">
            <Section title="Weekly Schedule">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {schedules.map((s: any) => (
                  <div key={s.id} className="bg-slate-50 rounded-lg px-3 py-2 text-sm">
                    <p className="font-semibold text-slate-700 text-xs uppercase">{DAY_LABELS[s.day_of_week] ?? s.day_of_week}</p>
                    <p className="text-slate-600">{s.start_time} – {s.end_time}</p>
                    {s.break_start && (
                      <p className="text-xs text-slate-400">Break {s.break_start}–{s.break_end}</p>
                    )}
                    <p className="text-xs text-slate-400">{s.slot_duration} min slots</p>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}

        {/* Actions */}
        <div className="px-6 py-5">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={openEdit}
              className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium px-4 py-2.5 rounded-lg text-sm"
            >
              <Pencil className="h-4 w-4" /> Edit Profile
            </button>
            <Link
              to={`/doctors/${id}/schedule`}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm"
            >
              <Calendar className="h-4 w-4" /> Manage Schedule
            </Link>
            <Link
              to={`/appointments/new?doctor_id=${id}`}
              className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium px-4 py-2.5 rounded-lg text-sm"
            >
              Book Appointment
            </Link>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">Edit Doctor</h2>
              <button
                onClick={() => { setEditOpen(false); setEditError(""); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-5">
              {/* Personal Info */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Personal Info</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">First Name</label>
                    <input className="input" value={editForm.first_name} onChange={setEditField("first_name")} />
                  </div>
                  <div>
                    <label className="label">Last Name</label>
                    <input className="input" value={editForm.last_name} onChange={setEditField("last_name")} />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Phone</label>
                    <input className="input" type="tel" value={editForm.phone} onChange={setEditField("phone")} />
                  </div>
                </div>
              </div>

              {/* Professional */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Professional</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="label">Registration No.</label>
                    <input className="input" value={editForm.registration_number} onChange={setEditField("registration_number")} />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Specialization</label>
                    {specializations.length > 0 ? (
                      <select className="input" value={editForm.specialization} onChange={setEditField("specialization")}>
                        <option value="">— Select —</option>
                        {Object.entries(specsByCategory).map(([cat, items]) => (
                          <optgroup key={cat} label={cat}>
                            {items.map((s) => (
                              <option key={s.id} value={s.name}>{s.name}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    ) : (
                      <input className="input" value={editForm.specialization} onChange={setEditField("specialization")} placeholder="e.g. Cardiology" />
                    )}
                  </div>
                  <div>
                    <label className="label">Experience (years)</label>
                    <input className="input" type="number" min={0} value={editForm.experience_years} onChange={setEditField("experience_years")} />
                  </div>
                  <div>
                    <label className="label">Slot Duration (min)</label>
                    <input className="input" type="number" min={5} step={5} value={editForm.default_slot_duration} onChange={setEditField("default_slot_duration")} />
                  </div>
                </div>
              </div>

              {/* Fees */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Fees ({currencySymbol})</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Consultation Fee</label>
                    <input className="input" type="number" min={0} value={editForm.consultation_fee} onChange={setEditField("consultation_fee")} />
                  </div>
                  <div>
                    <label className="label">Follow-up Fee</label>
                    <input className="input" type="number" min={0} value={editForm.follow_up_fee} onChange={setEditField("follow_up_fee")} />
                  </div>
                </div>
              </div>

              {/* Biography */}
              <div>
                <label className="label">Biography</label>
                <textarea
                  className="input min-h-[80px] resize-y"
                  value={editForm.biography}
                  onChange={setEditField("biography")}
                  placeholder="Short professional bio…"
                />
              </div>

              {/* Settings */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Settings</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <input
                      id="detail-accepting"
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      checked={editForm.is_accepting_new_patients}
                      onChange={(e) => setEditForm((f) => ({ ...f, is_accepting_new_patients: e.target.checked }))}
                    />
                    <label htmlFor="detail-accepting" className="text-sm text-gray-700 cursor-pointer">Accepting new patients</label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      id="detail-telemedicine"
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      checked={editForm.telemedicine_enabled}
                      onChange={(e) => setEditForm((f) => ({ ...f, telemedicine_enabled: e.target.checked }))}
                    />
                    <label htmlFor="detail-telemedicine" className="text-sm text-gray-700 cursor-pointer">Telemedicine enabled</label>
                  </div>
                </div>
              </div>

              {editError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                  {editError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={updateMutation.isPending} className="btn-primary flex-1">
                  {updateMutation.isPending ? "Saving…" : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditOpen(false); setEditError(""); }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
