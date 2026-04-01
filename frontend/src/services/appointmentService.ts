import api from "./api";
import type { Appointment, PaginatedResponse } from "../types";

export const appointmentService = {
  // Get all appointments
  getAppointments: async (filters?: any): Promise<PaginatedResponse<Appointment>> => {
    const response = await api.get("/appointments", { params: filters });
    return response.data;
  },

  // Get appointment by ID
  getAppointment: async (id: string): Promise<Appointment> => {
    const response = await api.get(`/appointments/${id}`);
    return response.data.data;
  },

  // Create appointment
  createAppointment: async (data: Partial<Appointment>): Promise<Appointment> => {
    const response = await api.post("/appointments", data);
    return response.data.data;
  },

  // Update appointment
  updateAppointment: async (id: string, data: Partial<Appointment>): Promise<Appointment> => {
    const response = await api.patch(`/appointments/${id}`, data);
    return response.data.data;
  },

  // Delete appointment
  deleteAppointment: async (id: string): Promise<void> => {
    await api.delete(`/appointments/${id}`);
  },

  // Get available slots
  getAvailableSlots: async (doctorId: string, date: string): Promise<string[]> => {
    const response = await api.get(`/appointments/slots`, {
      params: { doctorId, date },
    });
    return response.data.data;
  },

  // Cancel appointment
  cancelAppointment: async (id: string, reason: string): Promise<Appointment> => {
    const response = await api.patch(`/appointments/${id}/cancel`, { reason });
    return response.data.data;
  },
};
