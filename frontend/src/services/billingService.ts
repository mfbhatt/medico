import api from "./api";
import type { ApiResponse, Invoice, PaginatedResponse } from "../types";

interface InvoiceRequest {
  patientId: string;
  invoiceDate: string;
  dueDate: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  notes?: string;
}

interface PaymentRequest {
  invoiceId: string;
  amount: number;
  paymentMethod: "card" | "bank_transfer" | "check" | "cash";
  transactionId?: string;
}

interface Invoice {
  id: string;
  patientId: string;
  invoiceDate: string;
  dueDate: string;
  status: "draft" | "sent" | "paid" | "overdue";
  subtotal: number;
  tax: number;
  total: number;
  lineItems: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  notes?: string;
  createdAt: string;
}

export const billingService = {
  getInvoices: async (
    patientId?: string,
    status?: string,
    page: number = 1,
    pageSize: number = 10
  ): Promise<PaginatedResponse<Invoice>> => {
    const response = await api.get<ApiResponse<PaginatedResponse<Invoice>>>(
      "/invoices",
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

  createInvoice: async (data: InvoiceRequest): Promise<Invoice> => {
    const response = await api.post<ApiResponse<Invoice>>("/invoices", data);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error("Failed to create invoice");
  },

  getInvoice: async (id: string): Promise<Invoice> => {
    const response = await api.get<ApiResponse<Invoice>>(`/invoices/${id}`);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error("Failed to fetch invoice");
  },

  updateInvoice: async (id: string, data: Partial<InvoiceRequest>): Promise<Invoice> => {
    const response = await api.put<ApiResponse<Invoice>>(`/invoices/${id}`, data);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error("Failed to update invoice");
  },

  deleteInvoice: async (id: string): Promise<void> => {
    await api.delete(`/invoices/${id}`);
  },

  sendInvoice: async (id: string): Promise<Invoice> => {
    const response = await api.post<ApiResponse<Invoice>>(
      `/invoices/${id}/send`,
      {}
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error("Failed to send invoice");
  },

  recordPayment: async (data: PaymentRequest): Promise<Invoice> => {
    const response = await api.post<ApiResponse<Invoice>>(
      `/invoices/${data.invoiceId}/payments`,
      {
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        transactionId: data.transactionId,
      }
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error("Failed to record payment");
  },

  generatePDF: async (id: string): Promise<Blob> => {
    const response = await api.get(`/invoices/${id}/pdf`, {
      responseType: "blob",
    });
    return response.data;
  },

  getOutstandingInvoices: async (patientId: string): Promise<Invoice[]> => {
    const response = await api.get<ApiResponse<Invoice[]>>(
      `/invoices/outstanding/${patientId}`
    );
    return response.data.data || [];
  },
};
