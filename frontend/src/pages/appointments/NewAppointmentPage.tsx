import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock, AlertCircle, Lock, CreditCard, Banknote, Search, X } from "lucide-react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import api from "@/services/api";

export default function NewAppointmentPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const { user, activePatient } = useSelector((s: RootState) => s.auth);
  const isPatient = user?.role === "patient";

  // For patients: use the active profile (dependent) if selected, otherwise self
  const prefillPatientId = isPatient
    ? (activePatient?.id ?? user?.patient_id ?? "")
    : (searchParams.get("patient_id") ?? "");

  const prefillPatientLabel = isPatient && activePatient
    ? activePatient.name
    : (isPatient ? (user?.full_name ?? `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim()) : "");

  const [form, setForm] = useState({
    patientId: prefillPatientId,
    doctorId: "",
    clinicId: "",
    appointmentDate: new Date().toISOString().slice(0, 10),
    startTime: "",
    appointmentType: "regular",
    chiefComplaint: "",
    notes: "",
  });

  const cls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  // Patient autocomplete state
  const [patientQuery, setPatientQuery] = useState("");
  const [patientLabel, setPatientLabel] = useState("");
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const patientRef = useRef<HTMLDivElement>(null);

  // Fetch existing family members for patient role
  const { data: familyData } = useQuery({
    queryKey: ["my-family-members"],
    queryFn: () => api.get("/patients/me/family").then((r) => r.data.data ?? []),
    enabled: isPatient,
    staleTime: 60_000,
  });
  const familyMembers: Array<{ id: string; first_name: string; last_name: string; relationship_type: string; is_minor: boolean }> =
    familyData ?? [];

  // Inline new-patient registration
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    first_name: "", last_name: "", date_of_birth: "", gender: "", phone: "", email: "",
  });
  const [registerRelType, setRegisterRelType] = useState("child");
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerLoading, setRegisterLoading] = useState(false);

  const handleRegisterPatient = async () => {
    setRegisterError(null);
    setRegisterLoading(true);
    try {
      const payload: any = { ...registerForm };
      // For patients: auto-link the new patient as a family member
      if (isPatient && user?.patient_id) {
        payload.link_to_patient_id = user.patient_id;
        payload.relationship_type = registerRelType;
      }
      const res = await api.post("/patients/", payload);
      const created = res.data?.data;
      if (created?.id) {
        const name = `${registerForm.first_name} ${registerForm.last_name}`.trim();
        set("patientId", created.id);
        setPatientLabel(name);
        setShowRegisterForm(false);
        setRegisterForm({ first_name: "", last_name: "", date_of_birth: "", gender: "", phone: "", email: "" });
        setRegisterRelType("child");
        // Refresh family members list so the new member appears in the selector
        qc.invalidateQueries({ queryKey: ["my-family-members"] });
      }
    } catch (err: any) {
      const code = err?.response?.data?.error_code;
      if (code === "POTENTIAL_DUPLICATE") {
        const d = err.response.data.data;
        setRegisterError(
          `A patient with the same name and date of birth already exists (MRN: ${d.existing_mrn}). Search for them above instead.`
        );
      } else {
        setRegisterError(err?.response?.data?.message ?? "Failed to register patient");
      }
    } finally {
      setRegisterLoading(false);
    }
  };

  const { data: patientResults, isFetching: searchingPatients } = useQuery({
    queryKey: ["patients-search", patientQuery],
    queryFn: () =>
      api.get("/patients/", { params: { q: patientQuery, page_size: 20 } }).then((r) => {
        const raw = r.data.data;
        return Array.isArray(raw) ? raw : raw?.patients ?? [];
      }),
    enabled: !isPatient && patientQuery.trim().length >= 3,
    staleTime: 10_000,
  });
  const patientResults_ = patientResults ?? [];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (patientRef.current && !patientRef.current.contains(e.target as Node)) {
        setShowPatientDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const { data: doctorsData } = useQuery({
    queryKey: ["doctors-list"],
    queryFn: () => api.get("/doctors/", { params: { limit: 100 } }).then((r) => r.data.data),
  });
  const doctors = Array.isArray(doctorsData) ? doctorsData : doctorsData?.doctors ?? [];

  const { data: clinicsData } = useQuery({
    queryKey: ["clinics-list"],
    queryFn: () => api.get("/clinics/", { params: { limit: 50 } }).then((r) => r.data.data),
  });
  const clinics = clinicsData?.clinics ?? clinicsData ?? [];

  const [bookingError, setBookingError] = useState<string | null>(null);
  const [, setBookedApptId] = useState<string | null>(null);
  const [paymentChoice, setPaymentChoice] = useState<"razorpay" | "pay_later">("pay_later");
  const [paying, setPaying] = useState(false);

  // Proactive same-patient+doctor+day duplicate check
  const { data: existingAppts } = useQuery({
    queryKey: ["appt-duplicate-check", form.patientId, form.doctorId, form.appointmentDate],
    queryFn: () =>
      api.get("/appointments/", {
        params: {
          patient_id: form.patientId,
          doctor_id: form.doctorId,
          date_from: form.appointmentDate,
          date_to: form.appointmentDate,
          page_size: 5,
        },
      }).then((r) => r.data),
    enabled: !!(form.patientId && form.doctorId && form.appointmentDate),
    staleTime: 30 * 1000,
  });
  // Exclude cancelled/no-show from the duplicate check
  const INACTIVE_STATUSES = new Set(["cancelled", "no_show"]);
  const patientAlreadyBooked =
    (existingAppts?.data ?? []).some((a: any) => !INACTIVE_STATUSES.has(a.status));

  const slotsQueryKey = ["slots", form.doctorId, form.clinicId, form.appointmentDate];

  const { data: slotsData, isLoading: loadingSlots } = useQuery({
    queryKey: slotsQueryKey,
    queryFn: () =>
      api
        .get("/appointments/slots", {
          params: {
            doctor_id: form.doctorId,
            clinic_id: form.clinicId,
            date: form.appointmentDate,
          },
        })
        .then((r) => r.data.data),
    enabled: !!(form.doctorId && form.clinicId && form.appointmentDate),
  });

  type Slot = { start_time: string; end_time: string };
  const allSlots: Slot[] = slotsData?.all_slots ?? slotsData?.available_slots ?? [];
  const bookedSet = new Set<string>((slotsData?.booked_slots ?? []).map((s: Slot) => s.start_time));
  const hasAnySlot = allSlots.length > 0;
  const hasAvailable = allSlots.some((s) => !bookedSet.has(s.start_time));

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/appointments/", {
        patient_id: form.patientId,
        doctor_id: form.doctorId,
        clinic_id: form.clinicId,
        appointment_date: form.appointmentDate,
        start_time: form.startTime,
        appointment_type: form.appointmentType,
        chief_complaint: form.chiefComplaint,
        notes: form.notes,
      }),
    onSuccess: async (res) => {
      const appt = res.data?.data ?? res.data;
      const apptId = appt?.id;
      setBookedApptId(apptId ?? null);
      if (paymentChoice === "razorpay" && apptId) {
        setPaying(true);
        try {
          const { data: payRes } = await api.post(`/appointments/${apptId}/initiate-payment`, { payment_method: "razorpay" });
          const order = payRes.data;
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
              await api.post(`/appointments/${apptId}/verify-payment`, {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              navigate(`/appointments/${apptId}`);
            },
          });
          rzp.open();
        } catch (err: any) {
          alert(err?.response?.data?.message ?? "Payment failed. You can pay from the appointment detail page.");
          navigate(`/appointments/${apptId}`);
        } finally {
          setPaying(false);
        }
      } else {
        navigate(apptId ? `/appointments/${apptId}` : "/appointments");
      }
    },
    onError: (err: any) => {
      const code = err?.response?.data?.error_code;
      const msg = err?.response?.data?.message ?? "Failed to book appointment";
      setBookingError(msg);
      if (code === "DOUBLE_BOOKING") {
        qc.invalidateQueries({ queryKey: slotsQueryKey });
        setForm((p) => ({ ...p, startTime: "" }));
      }
    },
  });


  const set = (key: string, val: string) => {
    setBookingError(null);
    setForm((p) => ({ ...p, [key]: val, ...(key !== "startTime" ? { startTime: "" } : {}) }));
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Schedule Appointment</h1>
        <p className="text-sm text-slate-500 mt-1">{isPatient ? "Book a new appointment" : "Book a new appointment for a patient"}</p>
      </div>

      {bookingError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm flex gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{bookingError}</span>
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
        className="bg-white rounded-xl border border-slate-200 p-6 space-y-5"
      >
        {/* Patient */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Patient *</label>
          {isPatient ? (
            <div className="space-y-3">
              {/* "Book for" selector: self + existing family members + register new */}
              <div className="flex flex-wrap gap-2">
                {/* Self */}
                <button
                  type="button"
                  onClick={() => {
                    set("patientId", user?.patient_id ?? "");
                    setPatientLabel("");
                    setShowRegisterForm(false);
                    setRegisterError(null);
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                    form.patientId === (user?.patient_id ?? "") && !showRegisterForm
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-700 border-slate-300 hover:border-blue-400"
                  }`}
                >
                  {`${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim() || "Myself"}
                  <span className="ml-1.5 text-[10px] opacity-70">(You)</span>
                </button>

                {/* Existing family members */}
                {familyMembers.map((fm) => (
                  <button
                    key={fm.id}
                    type="button"
                    onClick={() => {
                      set("patientId", fm.id);
                      setPatientLabel(`${fm.first_name} ${fm.last_name}`);
                      setShowRegisterForm(false);
                      setRegisterError(null);
                    }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                      form.patientId === fm.id && !showRegisterForm
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-slate-700 border-slate-300 hover:border-blue-400"
                    }`}
                  >
                    {`${fm.first_name} ${fm.last_name}`}
                    <span className="ml-1.5 text-[10px] opacity-70 capitalize">({fm.relationship_type.replace(/_/g, " ")})</span>
                  </button>
                ))}

                {/* Register new */}
                <button
                  type="button"
                  onClick={() => {
                    setShowRegisterForm(true);
                    set("patientId", user?.patient_id ?? "");
                    setPatientLabel("");
                    setRegisterError(null);
                    setRegisterForm({ first_name: "", last_name: "", date_of_birth: "", gender: "", phone: "", email: "" });
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                    showRegisterForm
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-700 border-slate-300 hover:border-blue-400"
                  }`}
                >
                  + Register new family member
                </button>
              </div>

              {/* Selected patient display */}
              {!showRegisterForm && (
                <div className={`${cls} bg-slate-50 text-slate-700 flex items-center gap-2 cursor-default`}>
                  <Lock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  <span>{patientLabel || prefillPatientLabel || `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim()}</span>
                </div>
              )}

              {/* Inline family member registration */}
              {showRegisterForm && (
                <div className="mt-1 border border-blue-200 bg-blue-50 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-blue-900">Register New Family Member</p>

                  {registerError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs flex gap-2">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      <span>{registerError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">First Name *</label>
                      <input type="text" value={registerForm.first_name} required
                        onChange={(e) => setRegisterForm((p) => ({ ...p, first_name: e.target.value }))}
                        className={cls} placeholder="First name" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Last Name *</label>
                      <input type="text" value={registerForm.last_name} required
                        onChange={(e) => setRegisterForm((p) => ({ ...p, last_name: e.target.value }))}
                        className={cls} placeholder="Last name" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Date of Birth *</label>
                      <input type="date" value={registerForm.date_of_birth} required
                        max={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => setRegisterForm((p) => ({ ...p, date_of_birth: e.target.value }))}
                        className={cls} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Gender *</label>
                      <select value={registerForm.gender} required
                        onChange={(e) => setRegisterForm((p) => ({ ...p, gender: e.target.value }))}
                        className={cls}>
                        <option value="">Select…</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Mobile Number</label>
                      <input type="tel" value={registerForm.phone}
                        onChange={(e) => setRegisterForm((p) => ({ ...p, phone: e.target.value }))}
                        className={cls} placeholder="Optional" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                      <input type="email" value={registerForm.email}
                        onChange={(e) => setRegisterForm((p) => ({ ...p, email: e.target.value }))}
                        className={cls} placeholder="Optional" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Their relationship to you *</label>
                      <select value={registerRelType} onChange={(e) => setRegisterRelType(e.target.value)} className={cls}>
                        <option value="child">Child</option>
                        <option value="parent">Parent</option>
                        <option value="spouse">Spouse</option>
                        <option value="sibling">Sibling</option>
                        <option value="guardian">Guardian</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRegisterPatient}
                    disabled={registerLoading || !registerForm.first_name || !registerForm.last_name || !registerForm.date_of_birth || !registerForm.gender}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium py-2 rounded-lg transition"
                  >
                    {registerLoading ? "Registering…" : "Register & Book for Them"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
            <div ref={patientRef} className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={patientLabel || patientQuery}
                  placeholder="Search by name, mobile or email…"
                  className={`${cls} pl-9 pr-8`}
                  onFocus={() => {
                    if (form.patientId) {
                      // allow re-search after a selection
                      setPatientLabel("");
                      set("patientId", "");
                    }
                    setShowPatientDropdown(true);
                  }}
                  onChange={(e) => {
                    setPatientLabel("");
                    set("patientId", "");
                    setPatientQuery(e.target.value);
                    setShowPatientDropdown(true);
                  }}
                />
                {(patientLabel || patientQuery) && (
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    onClick={() => {
                      setPatientLabel("");
                      setPatientQuery("");
                      set("patientId", "");
                      setShowPatientDropdown(false);
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Hidden required validation anchor */}
              <input type="hidden" value={form.patientId} required />

              {showPatientDropdown && patientQuery.trim().length >= 3 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {searchingPatients ? (
                    <div className="px-4 py-3 text-sm text-slate-400">Searching…</div>
                  ) : patientResults_.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-slate-400">No patients found</div>
                  ) : (
                    patientResults_.map((p: any) => {
                      const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
                      const phone = p.phone ?? p.mobile ?? "";
                      const email = p.email ?? "";
                      const mrn = p.mrn ?? p.id?.slice(0, 8);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className="w-full text-left px-4 py-2.5 hover:bg-blue-50 flex flex-col gap-0.5 border-b border-slate-100 last:border-0"
                          onMouseDown={() => {
                            set("patientId", p.id);
                            setPatientLabel(name);
                            setPatientQuery("");
                            setShowPatientDropdown(false);
                          }}
                        >
                          <span className="text-sm font-semibold text-slate-900">{name}</span>
                          <span className="text-xs text-slate-500 flex items-center gap-3">
                            {phone && <span>📱 {phone}</span>}
                            {email && <span>✉ {email}</span>}
                            {mrn && <span className="font-mono text-slate-400">#{mrn}</span>}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              {patientQuery.trim().length > 0 && patientQuery.trim().length < 3 && (
                <p className="mt-1 text-xs text-slate-400">Type at least 3 characters to search</p>
              )}
              {form.patientId && patientLabel && (
                <p className="mt-1 text-xs text-emerald-600 font-medium">✓ {patientLabel} selected</p>
              )}
            </div>

            {/* Register new patient toggle */}
            <label className="mt-2 flex items-center gap-2 cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={showRegisterForm}
                onChange={(e) => {
                  setShowRegisterForm(e.target.checked);
                  setRegisterError(null);
                  if (e.target.checked) setShowPatientDropdown(false);
                }}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-600">Register a new patient</span>
            </label>

            {/* Inline patient registration form */}
            {showRegisterForm && (
              <div className="mt-3 border border-blue-200 bg-blue-50 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-blue-900 mb-1">Register New Patient</p>

                {registerError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs flex gap-2">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>{registerError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">First Name *</label>
                    <input
                      type="text" value={registerForm.first_name} required
                      onChange={(e) => setRegisterForm((p) => ({ ...p, first_name: e.target.value }))}
                      className={cls} placeholder="First name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Last Name *</label>
                    <input
                      type="text" value={registerForm.last_name} required
                      onChange={(e) => setRegisterForm((p) => ({ ...p, last_name: e.target.value }))}
                      className={cls} placeholder="Last name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Date of Birth *</label>
                    <input
                      type="date" value={registerForm.date_of_birth} required
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setRegisterForm((p) => ({ ...p, date_of_birth: e.target.value }))}
                      className={cls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Gender *</label>
                    <select
                      value={registerForm.gender} required
                      onChange={(e) => setRegisterForm((p) => ({ ...p, gender: e.target.value }))}
                      className={cls}
                    >
                      <option value="">Select…</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Mobile Number</label>
                    <input
                      type="tel" value={registerForm.phone}
                      onChange={(e) => setRegisterForm((p) => ({ ...p, phone: e.target.value }))}
                      className={cls} placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                    <input
                      type="email" value={registerForm.email}
                      onChange={(e) => setRegisterForm((p) => ({ ...p, email: e.target.value }))}
                      className={cls} placeholder="Optional"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRegisterPatient}
                  disabled={registerLoading || !registerForm.first_name || !registerForm.last_name || !registerForm.date_of_birth || !registerForm.gender}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium py-2 rounded-lg transition"
                >
                  {registerLoading ? "Registering…" : "Register & Select Patient"}
                </button>
              </div>
            )}
            </>
          )}
        </div>

        {/* Doctor */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Doctor *</label>
          <select value={form.doctorId} onChange={(e) => set("doctorId", e.target.value)} required className={cls}>
            <option value="">Select doctor…</option>
            {doctors.map((d: any) => (
              <option key={d.id} value={d.id}>
                Dr. {d.user?.first_name ?? d.first_name} {d.user?.last_name ?? d.last_name}
                {d.specialization ? ` — ${d.specialization}` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Clinic */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Clinic *</label>
          <select value={form.clinicId} onChange={(e) => set("clinicId", e.target.value)} required className={cls}>
            <option value="">Select clinic…</option>
            {clinics.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
            <Calendar className="h-4 w-4" /> Date *
          </label>
          <input
            type="date" value={form.appointmentDate}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => set("appointmentDate", e.target.value)}
            required className={cls}
          />
        </div>

        {/* Same-patient duplicate warning */}
        {patientAlreadyBooked && form.appointmentType !== "emergency" && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm flex gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-500" />
            <span>
              This patient already has an appointment with this doctor on the selected date.
              Change the date, or select <strong>Emergency</strong> type to override.
            </span>
          </div>
        )}

        {/* Time slot */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
            <Clock className="h-4 w-4" /> Time Slot *
          </label>
          {!form.doctorId || !form.clinicId ? (
            <p className="text-xs text-slate-400 py-2">Select doctor and clinic first to see available slots.</p>
          ) : loadingSlots ? (
            <p className="text-xs text-slate-400 py-2">Loading slots…</p>
          ) : !hasAnySlot ? (
            <p className="text-xs text-red-500 py-2">No schedule found for the selected date.</p>
          ) : (
            <>
              {/* Legend */}
              <div className="flex items-center gap-4 mb-2 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-blue-600 inline-block" /> Selected
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded border border-slate-200 bg-white inline-block" /> Available
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-red-100 inline-block" /> Booked
                </span>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {allSlots.map((slot) => {
                  const isBooked = bookedSet.has(slot.start_time);
                  const isSelected = form.startTime === slot.start_time;
                  return (
                    <button
                      key={slot.start_time}
                      type="button"
                      disabled={isBooked}
                      onClick={() => !isBooked && setForm((p) => ({ ...p, startTime: slot.start_time }))}
                      title={isBooked ? "This slot is already booked" : `Book ${slot.start_time} – ${slot.end_time}`}
                      className={`relative px-2 py-2 rounded-lg text-xs font-medium border transition select-none ${
                        isBooked
                          ? "bg-red-50 border-red-200 text-red-400 cursor-not-allowed"
                          : isSelected
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                          : "bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:text-blue-700 cursor-pointer"
                      }`}
                    >
                      {isBooked && (
                        <Lock className="w-2.5 h-2.5 absolute top-1 right-1 text-red-300" />
                      )}
                      <span className={isBooked ? "line-through" : ""}>{slot.start_time}</span>
                    </button>
                  );
                })}
              </div>

              {!hasAvailable && (
                <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  All slots are booked for this date. Please select a different date.
                </p>
              )}

              {slotsData && (
                <p className="mt-1.5 text-xs text-slate-400">
                  {slotsData.available_count ?? 0} of {slotsData.total_slots ?? allSlots.length} slots available
                </p>
              )}
            </>
          )}
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Appointment Type</label>
          <select value={form.appointmentType} onChange={(e) => setForm((p) => ({ ...p, appointmentType: e.target.value }))} className={cls}>
            <option value="regular">Regular</option>
            <option value="follow_up">Follow-up</option>
            <option value="emergency">Emergency</option>
            <option value="telemedicine">Telemedicine</option>
          </select>
        </div>

        {/* Chief complaint */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Chief Complaint</label>
          <input
            type="text" value={form.chiefComplaint}
            onChange={(e) => setForm((p) => ({ ...p, chiefComplaint: e.target.value }))}
            placeholder="e.g., Persistent headache, annual checkup…"
            className={cls}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            rows={2} className={cls}
            placeholder="Additional notes or special requirements"
          />
        </div>

        {/* Payment method selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Payment Method</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPaymentChoice("razorpay")}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition ${
                paymentChoice === "razorpay"
                  ? "border-blue-600 bg-blue-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <CreditCard className={`h-5 w-5 flex-shrink-0 ${paymentChoice === "razorpay" ? "text-blue-600" : "text-slate-400"}`} />
              <div>
                <p className={`text-sm font-semibold ${paymentChoice === "razorpay" ? "text-blue-700" : "text-slate-700"}`}>Pay Online</p>
                <p className="text-xs text-slate-500 mt-0.5">Razorpay · UPI · Cards</p>
              </div>
              <div className={`ml-auto w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${paymentChoice === "razorpay" ? "border-blue-600" : "border-slate-300"}`}>
                {paymentChoice === "razorpay" && <div className="w-2 h-2 rounded-full bg-blue-600" />}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setPaymentChoice("pay_later")}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition ${
                paymentChoice === "pay_later"
                  ? "border-blue-600 bg-blue-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <Banknote className={`h-5 w-5 flex-shrink-0 ${paymentChoice === "pay_later" ? "text-blue-600" : "text-slate-400"}`} />
              <div>
                <p className={`text-sm font-semibold ${paymentChoice === "pay_later" ? "text-blue-700" : "text-slate-700"}`}>Pay at Clinic</p>
                <p className="text-xs text-slate-500 mt-0.5">Cash when you arrive</p>
              </div>
              <div className={`ml-auto w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${paymentChoice === "pay_later" ? "border-blue-600" : "border-slate-300"}`}>
                {paymentChoice === "pay_later" && <div className="w-2 h-2 rounded-full bg-blue-600" />}
              </div>
            </button>
          </div>
        </div>

        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <button
            type="submit"
            disabled={mutation.isPending || paying || !form.startTime || (patientAlreadyBooked && form.appointmentType !== "emergency")}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition"
          >
            {mutation.isPending || paying
              ? (paymentChoice === "razorpay" ? "Preparing payment…" : "Booking…")
              : (paymentChoice === "razorpay" ? "Book & Pay Online" : "Book Appointment")}
          </button>
          <button type="button" onClick={() => navigate("/appointments")} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium px-6 py-2.5 rounded-lg text-sm transition">
            Cancel
          </button>
        </div>
      </form>

    </div>
  );
}
