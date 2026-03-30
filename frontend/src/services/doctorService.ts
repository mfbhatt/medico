import api from "./api";
import type { Doctor, PaginatedResponse } from "../types";

export const doctorService = {
  // Get all doctors
  getDoctors: async (filters?: any): Promise<PaginatedResponse<Doctor>> => {
    const response = await api.get("/doctors", { params: filters });
    return response.data;
  },

  // Get doctor by ID
  getDoctor: async (id: string): Promise<Doctor> => {
    const response = await api.get(`/doctors/${id}`);
    return response.data.data;
  },

  // Create doctor
  createDoctor: async (data: Partial<Doctor>): Promise<Doctor> => {
    const response = await api.post("/doctors", data);
    return response.data.data;
  },

  // Update doctor
  updateDoctor: async (id: string, data: Partial<Doctor>): Promise<Doctor> => {
    const response = await api.patch(`/doctors/${id}`, data);
    return response.data.data;
  },

  // Delete doctor
  deleteDoctor: async (id: string): Promise<void> => {
    await api.delete(`/doctors/${id}`);
  },

  // Get doctor schedule
  getDoctorSchedule: async (id: string): Promise<any> => {
    const response = await api.get(`/doctors/${id}/schedule`);
    return response.data.data;
  },

  // Update doctor schedule
  updateDoctorSchedule: async (id: string, schedule: any): Promise<any> => {
    const response = await api.patch(`/doctors/${id}/schedule`, schedule);
    return response.data.data;
  },
};
