import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock, AlertCircle, Lock, CreditCard, Banknote } from "lucide-react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import api from "@/services/api";

export default function NewAppointmentPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const { user } = useSelector((s: RootState) => s.auth);
  const isPatient = user?.role === "patient";

  const prefillPatientId = isPatient
    ? (user?.patient_id ?? "")
    : (searchParams.get("patient_id") ?? "");

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

  const { data: patientsData } = useQuery({
    queryKey: ["patients-search"],
    queryFn: () => api.get("/patients/", { params: { limit: 100 } }).then((r) => r.data.data),
    enabled: !isPatient,
  });
  const patients = patientsData?.patients ?? patientsData ?? [];

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
  const [bookedApptId, setBookedApptId] = useState<string | null>(null);
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
            <div className={`${cls} bg-slate-50 text-slate-700 flex items-center gap-2 cursor-default`}>
              <Lock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
              {user?.full_name ?? `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim()}
            </div>
          ) : (
            <select value={form.patientId} onChange={(e) => set("patientId", e.target.value)} required className={cls}>
              <option value="">Select patient…</option>
              {patients.map((p: any) => (
                <option key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.mrn ?? p.id.slice(0, 8)})</option>
              ))}
            </select>
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
