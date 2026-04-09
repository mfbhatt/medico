import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import axios from "axios";
import { ALL_COUNTRIES } from "@/utils/addressData";

function resolveStateName(countryCode: string, stateCode: string): string {
  if (!stateCode) return "";
  const country = ALL_COUNTRIES.find((c) => c.code === countryCode);
  if (!country || country.states.length === 0) return stateCode;
  const state = country.states.find((s) => s.code === stateCode);
  return state ? state.name : stateCode;
}
import {
  Building2,
  MapPin,
  Phone,
  Star,
  ChevronLeft,
  Clock,
  User,
  Calendar,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { RootState } from "../../store";
import api from "../../services/api";

const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1",
});

interface ClinicDetail {
  id: string;
  tenant_id: string;
  name: string;
  city: string;
  state: string;
  address_line1: string;
  address_line2?: string;
  phone?: string;
  email?: string;
  services: string[];
  operating_hours?: Record<string, { open: string; close: string; closed?: boolean }>;
  appointment_slot_duration: number;
  max_advance_booking_days?: number;
}

interface Doctor {
  id: string;
  name: string;
  specialization?: string;
  experience_years?: number;
  consultation_fee?: number;
  biography?: string;
  average_rating?: number;
  total_ratings?: number;
  is_accepting_new_patients?: boolean;
}

interface Slot {
  start_time: string;
  end_time: string;
}

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function getTodayHours(hours?: ClinicDetail["operating_hours"]) {
  if (!hours) return null;
  const day = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const h = hours[day];
  if (!h || h.closed) return "Closed today";
  return `${h.open} – ${h.close}`;
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function maxDateStr(days = 30) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export default function PublicClinicDetailPage() {
  const { id: clinicId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((s: RootState) => s.auth);

  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [booking, setBooking] = useState(false);
  const [bookingDone, setBookingDone] = useState(false);
  const [bookingError, setBookingError] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["public", "clinic", clinicId],
    queryFn: () =>
      publicApi.get(`/public/clinics/${clinicId}`).then((r) => r.data.data),
    enabled: !!clinicId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: slotsData, isFetching: loadingSlots } = useQuery({
    queryKey: ["public", "slots", selectedDoctor?.id, clinicId, selectedDate],
    queryFn: () =>
      publicApi
        .get(`/public/slots`, {
          params: { doctor_id: selectedDoctor?.id, clinic_id: clinicId, date: selectedDate },
        })
        .then((r) => r.data.data),
    enabled: !!selectedDoctor && !!selectedDate,
    staleTime: 30 * 1000,
  });

  const clinic: ClinicDetail | undefined = data?.clinic;
  const doctors: Doctor[] = data?.doctors ?? [];
  const slots: Slot[] = slotsData?.available_slots ?? [];

  const handleSelectDoctor = (doc: Doctor) => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: { pathname: `/clinics/${clinicId}` } } });
      return;
    }
    if (selectedDoctor?.id === doc.id) {
      setSelectedDoctor(null);
      setSelectedDate("");
      setSelectedSlot(null);
      setBookingDone(false);
      setBookingError("");
      return;
    }
    setSelectedDoctor(doc);
    setSelectedDate("");
    setSelectedSlot(null);
    setBookingDone(false);
    setBookingError("");
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  };

  const handleBook = async () => {
    if (!selectedDoctor || !selectedDate || !selectedSlot || !clinic) return;
    if (!isAuthenticated) {
      navigate("/login", { state: { from: { pathname: `/clinics/${clinicId}` } } });
      return;
    }
    setBooking(true);
    setBookingError("");
    try {
      await api.post(
        "/appointments/",
        {
          doctor_id: selectedDoctor.id,
          clinic_id: clinicId,
          appointment_date: selectedDate,
          start_time: selectedSlot.start_time,
          appointment_type: "new_visit",
          chief_complaint: chiefComplaint || undefined,
        },
        { headers: { "X-Tenant-ID": clinic.tenant_id } }
      );
      setBookingDone(true);
    } catch (err: any) {
      setBookingError(err.response?.data?.message ?? "Booking failed. Please try again.");
    } finally {
      setBooking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error || !clinic) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Clinic not found</h2>
          <Link to="/clinics" className="text-blue-600 hover:underline text-sm">
            ← Back to all clinics
          </Link>
        </div>
      </div>
    );
  }

  const todayHours = getTodayHours(clinic.operating_hours);
  const maxAdvanceDays = clinic.max_advance_booking_days ?? 30;

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Clinic header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            to="/clinics"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ChevronLeft className="h-4 w-4" />
            All Clinics
          </Link>
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Building2 className="h-8 w-8 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">{clinic.name}</h1>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <MapPin className="h-4 w-4 flex-shrink-0" />
                  {clinic.address_line1}
                  {clinic.address_line2 ? `, ${clinic.address_line2}` : ""}, {clinic.city},{" "}
                  {resolveStateName(clinic.country, clinic.state)}
                </div>
                {clinic.phone && (
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Phone className="h-4 w-4 flex-shrink-0" />
                    {clinic.phone}
                  </div>
                )}
                {todayHours && (
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Clock className="h-4 w-4 flex-shrink-0" />
                    {todayHours}
                  </div>
                )}
              </div>
              {clinic.services.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {clinic.services.map((s) => (
                    <span
                      key={s}
                      className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Doctors */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">
          Available Doctors ({doctors.length})
        </h2>

        {!isAuthenticated && doctors.length > 0 && (
          <div className="mb-5 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
            <span className="flex-1">
              <Link to="/login" state={{ from: { pathname: `/clinics/${clinicId}` } }} className="font-semibold hover:underline">Sign in</Link>
              {" "}or{" "}
              <Link to="/register" state={{ from: { pathname: `/clinics/${clinicId}` } }} className="font-semibold hover:underline">register</Link>
              {" "}to book an appointment.
            </span>
          </div>
        )}

        {doctors.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <User className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p>No doctors listed at this clinic yet.</p>
          </div>
        )}

        <div className="space-y-4">
          {doctors.map((doc) => {
            const isSelected = selectedDoctor?.id === doc.id;
            return (
              <div
                key={doc.id}
                className={`bg-white rounded-xl border transition-all ${
                  isSelected ? "border-blue-400 shadow-md" : "border-gray-200"
                }`}
              >
                {/* Doctor row */}
                <div className="p-5 flex items-start gap-4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{doc.name}</h3>
                        {doc.specialization && (
                          <p className="text-sm text-indigo-600 font-medium">{doc.specialization}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 mt-1">
                          {doc.experience_years !== undefined && (
                            <span className="text-xs text-gray-500">
                              {doc.experience_years}y exp
                            </span>
                          )}
                          {!!doc.average_rating && doc.average_rating > 0 && (
                            <span className="flex items-center gap-0.5 text-xs text-amber-600">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              {doc.average_rating.toFixed(1)} ({doc.total_ratings})
                            </span>
                          )}
                          {doc.consultation_fee !== undefined && (
                            <span className="text-xs text-green-700 font-medium">
                              ${doc.consultation_fee}
                            </span>
                          )}
                        </div>
                      </div>
                      {doc.is_accepting_new_patients !== false ? (
                        <button
                          onClick={() => handleSelectDoctor(doc)}
                          className={`flex-shrink-0 text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
                            isSelected
                              ? "bg-blue-600 text-white"
                              : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                          }`}
                        >
                          {isSelected ? "Selected" : isAuthenticated ? "Book" : "Sign in to Book"}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          Not accepting patients
                        </span>
                      )}
                    </div>
                    {doc.biography && (
                      <p className="text-xs text-gray-500 mt-2 line-clamp-2">{doc.biography}</p>
                    )}
                  </div>
                </div>

                {/* Booking panel */}
                {isSelected && (
                  <div className="border-t border-blue-100 bg-blue-50/40 p-5">
                    {bookingDone ? (
                      <div className="flex items-center gap-3 text-green-700">
                        <CheckCircle className="h-6 w-6 flex-shrink-0" />
                        <div>
                          <p className="font-semibold">Appointment booked!</p>
                          <p className="text-sm">
                            {selectedDate} at {selectedSlot?.start_time} with {doc.name}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Date */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            <Calendar className="inline h-4 w-4 mr-1" />
                            Select Date
                          </label>
                          <input
                            type="date"
                            min={todayStr()}
                            max={maxDateStr(maxAdvanceDays)}
                            value={selectedDate}
                            onChange={(e) => handleDateChange(e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        {/* Slots */}
                        {selectedDate && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                              <Clock className="inline h-4 w-4 mr-1" />
                              Available Slots
                            </label>
                            {loadingSlots ? (
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading slots...
                              </div>
                            ) : slots.length === 0 ? (
                              <p className="text-sm text-gray-500">
                                No slots available on this date.
                              </p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {slots.map((slot) => (
                                  <button
                                    key={slot.start_time}
                                    onClick={() => setSelectedSlot(slot)}
                                    className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                                      selectedSlot?.start_time === slot.start_time
                                        ? "bg-blue-600 text-white border-blue-600"
                                        : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                                    }`}
                                  >
                                    {slot.start_time}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Reason */}
                        {selectedSlot && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                              Reason for Visit{" "}
                              <span className="text-gray-400 font-normal">(optional)</span>
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Fever, follow-up, routine checkup..."
                              value={chiefComplaint}
                              onChange={(e) => setChiefComplaint(e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        )}

                        {/* Error */}
                        {bookingError && (
                          <p className="text-sm text-red-600 flex items-center gap-1.5">
                            <AlertCircle className="h-4 w-4 flex-shrink-0" />
                            {bookingError}
                          </p>
                        )}

                        {/* CTA */}
                        {selectedSlot &&
                          (!isAuthenticated ? (
                            <button
                              onClick={() =>
                                navigate("/login", {
                                  state: { from: { pathname: `/clinics/${clinicId}` } },
                                })
                              }
                              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
                            >
                              Sign in to confirm booking
                            </button>
                          ) : (
                            <button
                              onClick={handleBook}
                              disabled={booking}
                              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
                            >
                              {booking ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" /> Booking...
                                </>
                              ) : (
                                `Confirm — ${selectedDate} at ${selectedSlot.start_time}`
                              )}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
