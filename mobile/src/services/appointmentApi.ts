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

const appointmentApi = {
  getSlots: (doctorId: string, clinicId: string, date: string): Promise<Slot[]> =>
    api
      .get('/appointments/slots', { params: { doctor_id: doctorId, clinic_id: clinicId, date } })
      .then((r) => r.data.data),

  getMyAppointments: (params?: { status?: string; limit?: number }): Promise<Appointment[]> =>
    api.get('/appointments/my', { params }).then((r) => r.data.data),

  book: (data: {
    doctor_id: string;
    clinic_id: string;
    scheduled_date: string;
    scheduled_time: string;
    appointment_type: string;
    chief_complaint?: string;
  }): Promise<Appointment> =>
    api.post('/appointments/', data).then((r) => r.data.data),

  cancel: (id: string, reason: string): Promise<Appointment> =>
    api.post(`/appointments/${id}/cancel`, { reason }).then((r) => r.data.data),

  getDetail: (id: string): Promise<Appointment> =>
    api.get(`/appointments/${id}`).then((r) => r.data.data),
};

export default appointmentApi;
