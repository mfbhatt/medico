/**
 * Appointment API service — wraps all appointment-related endpoints.
 */
import api from "./api";

export interface Slot {
  start_time: string;
  end_time: string;
}

export interface SlotsResponse {
  date: string;
  doctor_id: string;
  clinic_id: string;
  slot_duration: number;
  available_slots: Slot[];
  available_count: number;
  booked_count: number;
}

export interface BookAppointmentPayload {
  patient_id: string;
  doctor_id: string;
  clinic_id: string;
  appointment_date: string;
  start_time: string;
  duration_minutes?: number;
  appointment_type?: "in_person" | "telemedicine" | "home_visit" | "emergency";
  priority?: "routine" | "urgent" | "emergency";
  chief_complaint?: string;
  visit_type?: "new" | "follow_up" | "emergency";
  is_walk_in?: boolean;
  patient_notes?: string;
}

export const appointmentApi = {
  getAvailableSlots: (params: {
    doctor_id: string;
    clinic_id: string;
    date: string;
  }) =>
    api.get<{ success: boolean; data: SlotsResponse }>("/appointments/slots", {
      params,
    }),

  bookAppointment: (payload: BookAppointmentPayload) =>
    api.post("/appointments/", payload),

  listAppointments: (params: {
    clinic_id?: string;
    doctor_id?: string;
    patient_id?: string;
    date_from?: string;
    date_to?: string;
    status?: string;
    page?: number;
    page_size?: number;
  }) => api.get("/appointments/", { params }),

  getAppointment: (id: string) => api.get(`/appointments/${id}`),

  cancelAppointment: (id: string, reason?: string) =>
    api.patch(`/appointments/${id}/cancel`, { reason }),

  rescheduleAppointment: (
    id: string,
    payload: { appointment_date: string; start_time: string }
  ) => api.patch(`/appointments/${id}/reschedule`, payload),

  checkIn: (id: string) => api.patch(`/appointments/${id}/check-in`),

  markNoShow: (id: string) => api.patch(`/appointments/${id}/no-show`),

  startConsultation: (id: string) =>
    api.patch(`/appointments/${id}/start-consultation`),

  completeAppointment: (id: string) =>
    api.patch(`/appointments/${id}/complete`),

  joinWaitlist: (payload: {
    patient_id: string;
    doctor_id: string;
    clinic_id: string;
    preferred_date_from: string;
    preferred_date_until?: string;
    preferred_time_from?: string;
    preferred_time_until?: string;
    chief_complaint?: string;
  }) => api.post("/appointments/waitlist", payload),

  getTodaysQueue: (clinicId: string) =>
    api.get(`/appointments/queue/today`, { params: { clinic_id: clinicId } }),
};
