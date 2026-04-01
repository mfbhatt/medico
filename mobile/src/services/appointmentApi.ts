import api from './api';

export interface Slot {
  time: string;
  available: boolean;
}

export interface Appointment {
  id: string;
  doctor_id: string;
  doctor_name: string;
  clinic_name: string;
  scheduled_date: string;
  scheduled_time: string;
  appointment_type: string;
  status: string;
  chief_complaint?: string;
  telemedicine_url?: string;
}

export interface ClinicOption {
  id: string;
  name: string;
  address: string;
  distance_km?: number;
  doctor_count: number;
  specializations: string[];
}

export interface DoctorOption {
  id: string;
  name: string;
  specialization: string;
  consultation_fee: number;
  average_rating: number;
  clinic_id: string;
  clinic_name: string;
}

const appointmentApi = {
  getSlots: (doctorId: string, clinicId: string, date: string): Promise<Slot[]> =>
    api
      .get('/appointments/slots', { params: { doctor_id: doctorId, clinic_id: clinicId, date } })
      .then((r) =>
        (r.data.data.available_slots ?? []).map((s: { start_time: string }) => ({
          time: s.start_time,
          available: true,
        }))
      ),

  getMyAppointments: (params?: { status?: string; limit?: number }): Promise<Appointment[]> =>
    api.get('/appointments/my', { params }).then((r) => r.data.data ?? []),

  book: (data: {
    doctor_id: string;
    clinic_id: string;
    appointment_date: string;
    start_time: string;
    appointment_type: string;
    chief_complaint?: string;
    patient_id?: string;
  }): Promise<Appointment> =>
    api.post('/appointments/', data).then((r) => r.data.data),

  cancel: (id: string, reason: string): Promise<Appointment> =>
    api.patch(`/appointments/${id}/cancel`, { reason }).then((r) => r.data.data),

  getDetail: (id: string): Promise<Appointment> =>
    api.get(`/appointments/${id}`).then((r) => r.data.data),

  getClinics: (params?: { search?: string }): Promise<ClinicOption[]> =>
    api.get('/clinics/', { params }).then((r) => r.data.data),

  getClinicDoctors: (clinicId: string): Promise<DoctorOption[]> =>
    api.get(`/clinics/${clinicId}/doctors`).then((r) => r.data.data),

  searchDoctors: (params: { search?: string; specialization?: string }): Promise<DoctorOption[]> =>
    api.get('/doctors/', { params }).then((r) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (r.data.data as any[]).map((d) => ({
        id: d.id,
        name: d.full_name ?? `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim(),
        specialization: d.primary_specialization,
        consultation_fee: d.consultation_fee ?? 0,
        average_rating: d.average_rating ?? 0,
        clinic_id: d.clinic_id ?? '',
        clinic_name: d.clinic_name ?? '',
      }))
    ),
};

export default appointmentApi;
