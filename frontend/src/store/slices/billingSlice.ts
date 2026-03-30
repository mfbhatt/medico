import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { Invoice } from "../types";

interface BillingState {
  invoices: Invoice[];
  filteredInvoices: Invoice[];
  selectedInvoice: Invoice | null;
  loading: boolean;
  error: string | null;
  filters: {
    status?: string;
    patientId?: string;
    dateFrom?: string;
    dateTo?: string;
    minAmount?: number;
    maxAmount?: number;
  };
}

const initialState: BillingState = {
  invoices: [],
  filteredInvoices: [],
  selectedInvoice: null,
  loading: false,
  error: null,
  filters: {},
};

export const billingSlice = createSlice({
  name: "billing",
  initialState,
  reducers: {
    setInvoices: (state, action: PayloadAction<Invoice[]>) => {
      state.invoices = action.payload;
      state.filteredInvoices = action.payload;
    },
    addInvoice: (state, action: PayloadAction<Invoice>) => {
      state.invoices.unshift(action.payload);
      state.filteredInvoices.unshift(action.payload);
    },
    updateInvoice: (state, action: PayloadAction<Invoice>) => {
      const index = state.invoices.findIndex((i) => i.id === action.payload.id);
      if (index !== -1) {
        state.invoices[index] = action.payload;
        state.filteredInvoices = [...state.invoices];
      }
    },
    deleteInvoice: (state, action: PayloadAction<string>) => {
      state.invoices = state.invoices.filter((i) => i.id !== action.payload);
      state.filteredInvoices = [...state.invoices];
    },
    setSelectedInvoice: (state, action: PayloadAction<Invoice | null>) => {
      state.selectedInvoice = action.payload;
    },
    setFilters: (state, action: PayloadAction<BillingState["filters"]>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const { setInvoices, addInvoice, updateInvoice, deleteInvoice, setSelectedInvoice, setFilters, setLoading, setError } = billingSlice.actions;
export default billingSlice.reducer;
