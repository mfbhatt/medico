import api from "./api";
import type { ApiResponse, LabOrder, LabReport, PaginatedResponse } from "../types";

interface LabOrderRequest {
  patientId: string;
  doctorId: string;
  tests: string[];
  dueDate: string;
}

interface LabReportRequest {
  labOrderId: string;
  patientId: string;
  reportDate: string;
  labName: string;
  technician: string;
  results: Array<{
    testName: string;
    result: string;
    unit: string;
    referenceRange: string;
    status: "normal" | "abnormal" | "critical";
  }>;
  notes?: string;
}

export const labService = {
  getLabOrders: async (
    patientId?: string,
    status?: string,
    page: number = 1,
    pageSize: number = 10
  ): Promise<PaginatedResponse<LabOrder>> => {
    const response = await api.get<ApiResponse<PaginatedResponse<LabOrder>>>(
      "/lab-orders",
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

  createLabOrder: async (data: LabOrderRequest): Promise<LabOrder> => {
    const response = await api.post<ApiResponse<LabOrder>>("/lab-orders", data);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error("Failed to create lab order");
  },

  updateLabOrder: async (id: string, data: Partial<LabOrderRequest>): Promise<LabOrder> => {
    const response = await api.put<ApiResponse<LabOrder>>(`/lab-orders/${id}`, data);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error("Failed to update lab order");
  },

  getLabOrder: async (id: string): Promise<LabOrder> => {
    const response = await api.get<ApiResponse<LabOrder>>(`/lab-orders/${id}`);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error("Failed to fetch lab order");
  },

  deleteLabOrder: async (id: string): Promise<void> => {
    await api.delete(`/lab-orders/${id}`);
  },

  getLabReports: async (
    patientId?: string,
    page: number = 1,
    pageSize: number = 10
  ): Promise<PaginatedResponse<LabReport>> => {
    const response = await api.get<ApiResponse<PaginatedResponse<LabReport>>>(
      "/lab-reports",
      {
        params: {
          patientId,
          page,
          pageSize,
        },
      }
    );
    return response.data.data || { data: [], total: 0, page, pageSize, totalPages: 0 };
  },

  createLabReport: async (data: LabReportRequest): Promise<LabReport> => {
    const response = await api.post<ApiResponse<LabReport>>("/lab-reports", data);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error("Failed to create lab report");
  },

  getLabReport: async (id: string): Promise<LabReport> => {
    const response = await api.get<ApiResponse<LabReport>>(`/lab-reports/${id}`);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error("Failed to fetch lab report");
  },

  updateSampleCollection: async (
    orderId: string,
    sampleCollected: boolean
  ): Promise<LabOrder> => {
    const response = await api.patch<ApiResponse<LabOrder>>(
      `/lab-orders/${orderId}/sample-collection`,
      { sampleCollected }
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error("Failed to update sample collection status");
  },
};
