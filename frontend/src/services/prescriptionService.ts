import api from "./api";
import type { ApiResponse, Prescription, PaginatedResponse } from "../types";

interface PrescriptionRequest {
  patientId: string;
  doctorId: string;
  medication: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate: string;
  refills: number;
  notes?: string;
}

export const prescriptionService = {
  getPrescriptions: async (
    patientId?: string,
    status?: string,
    page: number = 1,
    pageSize: number = 10
  ): Promise<PaginatedResponse<Prescription>> => {
    const response = await api.get<ApiResponse<PaginatedResponse<Prescription>>>(
      "/prescriptions",
      {
        params: {
          patientId,
          status,
          page,
          pageSize,
        },
      }
    );
    return response.data.data || { data: [], total: 0, page, pageSize, totalPages: 0 };
  },

  createPrescription: async (data: PrescriptionRequest): Promise<Prescription> => {
    const response = await api.post<ApiResponse<Prescription>>(
      "/prescriptions",
      data
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error("Failed to create prescription");
  },

  getPrescription: async (id: string): Promise<Prescription> => {
    const response = await api.get<ApiResponse<Prescription>>(
      `/prescriptions/${id}`
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error("Failed to fetch prescription");
  },

  updatePrescription: async (
    id: string,
    data: Partial<PrescriptionRequest>
  ): Promise<Prescription> => {
    const response = await api.put<ApiResponse<Prescription>>(
      `/prescriptions/${id}`,
      data
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error("Failed to update prescription");
  },

  deletePrescription: async (id: string): Promise<void> => {
    await api.delete(`/prescriptions/${id}`);
  },

  renewPrescription: async (id: string): Promise<Prescription> => {
    const response = await api.post<ApiResponse<Prescription>>(
      `/prescriptions/${id}/renew`,
      {}
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error("Failed to renew prescription");
  },

  checkDrugInteractions: async (
    medication: string,
    existingMedications: string[]
  ): Promise<{ interactions: string[]; warnings: string[] }> => {
    const response = await api.post<
      ApiResponse<{ interactions: string[]; warnings: string[] }>
    >("/prescriptions/check-interactions", {
      medication,
      existingMedications,
    });
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error("Failed to check drug interactions");
  },

  checkAllergyInteractions: async (
    medication: string,
    allergies: string[]
  ): Promise<{ interactions: string[] }> => {
    const response = await api.post<ApiResponse<{ interactions: string[] }>>(
      "/prescriptions/check-allergies",
      {
        medication,
        allergies,
      }
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error("Failed to check allergy interactions");
  },

  requestRefill: async (
    prescriptionId: string,
    reason?: string
  ): Promise<void> => {
    await api.post(`/prescriptions/${prescriptionId}/request-refill`, {
      reason,
    });
  },
};
