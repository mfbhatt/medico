import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { LabOrder, LabReport } from "../../types";

interface LabState {
  orders: LabOrder[];
  filteredOrders: LabOrder[];
  reports: LabReport[];
  selectedOrder: LabOrder | null;
  selectedReport: LabReport | null;
  loading: boolean;
  error: string | null;
  filters: {
    status?: string;
    patientId?: string;
    doctorId?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

const initialState: LabState = {
  orders: [],
  filteredOrders: [],
  reports: [],
  selectedOrder: null,
  selectedReport: null,
  loading: false,
  error: null,
  filters: {},
};

export const labSlice = createSlice({
  name: "lab",
  initialState,
  reducers: {
    setLabOrders: (state, action: PayloadAction<LabOrder[]>) => {
      state.orders = action.payload;
      state.filteredOrders = action.payload;
    },
    addLabOrder: (state, action: PayloadAction<LabOrder>) => {
      state.orders.unshift(action.payload);
      state.filteredOrders.unshift(action.payload);
    },
    updateLabOrder: (state, action: PayloadAction<LabOrder>) => {
      const index = state.orders.findIndex((o) => o.id === action.payload.id);
      if (index !== -1) {
        state.orders[index] = action.payload;
        state.filteredOrders = [...state.orders];
      }
    },
    deleteLabOrder: (state, action: PayloadAction<string>) => {
      state.orders = state.orders.filter((o) => o.id !== action.payload);
      state.filteredOrders = [...state.orders];
    },
    setLabReports: (state, action: PayloadAction<LabReport[]>) => {
      state.reports = action.payload;
    },
    addLabReport: (state, action: PayloadAction<LabReport>) => {
      state.reports.unshift(action.payload);
    },
    updateLabReport: (state, action: PayloadAction<LabReport>) => {
      const index = state.reports.findIndex((r) => r.id === action.payload.id);
      if (index !== -1) {
        state.reports[index] = action.payload;
      }
    },
    setSelectedOrder: (state, action: PayloadAction<LabOrder | null>) => {
      state.selectedOrder = action.payload;
    },
    setSelectedReport: (state, action: PayloadAction<LabReport | null>) => {
      state.selectedReport = action.payload;
    },
    setFilters: (state, action: PayloadAction<LabState["filters"]>) => {
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

export const { setLabOrders, addLabOrder, updateLabOrder, deleteLabOrder, setLabReports, addLabReport, updateLabReport, setSelectedOrder, setSelectedReport, setFilters, setLoading, setError } = labSlice.actions;
export default labSlice.reducer;
