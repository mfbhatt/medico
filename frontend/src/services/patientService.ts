import api from "./api";
import type { Patient, PaginatedResponse } from "../types";

export const patientService = {
  // Get all patients
  getPatients: async (filters?: any): Promise<PaginatedResponse<Patient>> => {
    const response = await api.get("/patients", { params: filters });
    return response.data;
  },

  // Get patient by ID
  getPatient: async (id: string): Promise<Patient> => {
    const response = await api.get(`/patients/${id}`);
    return response.data.data;
  },

  // Create patient
  createPatient: async (data: Partial<Patient>): Promise<Patient> => {
    const response = await api.post("/patients", data);
    return response.data.data;
  },

  // Update patient
  updatePatient: async (id: string, data: Partial<Patient>): Promise<Patient> => {
    const response = await api.patch(`/patients/${id}`, data);
    return response.data.data;
  },

  // Delete patient
  deletePatient: async (id: string): Promise<void> => {
    await api.delete(`/patients/${id}`);
  },

  // Get patient medical history
  getPatientHistory: async (id: string): Promise<any> => {
    const response = await api.get(`/patients/${id}/history`);
    return response.data.data;
  },
};
