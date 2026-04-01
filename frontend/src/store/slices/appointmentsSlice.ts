import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { Appointment } from "../../types";

interface AppointmentsState {
  list: Appointment[];
  filteredList: Appointment[];
  selectedAppointment: Appointment | null;
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

const initialState: AppointmentsState = {
  list: [],
  filteredList: [],
  selectedAppointment: null,
  loading: false,
  error: null,
  filters: {},
};

export const appointmentsSlice = createSlice({
  name: "appointments",
  initialState,
  reducers: {
    setAppointments: (state, action: PayloadAction<Appointment[]>) => {
      state.list = action.payload;
      state.filteredList = action.payload;
    },
    addAppointment: (state, action: PayloadAction<Appointment>) => {
      state.list.unshift(action.payload);
      state.filteredList.unshift(action.payload);
    },
    updateAppointment: (state, action: PayloadAction<Appointment>) => {
      const index = state.list.findIndex((a) => a.id === action.payload.id);
      if (index !== -1) {
        state.list[index] = action.payload;
        state.filteredList = [...state.list];
      }
    },
    deleteAppointment: (state, action: PayloadAction<string>) => {
      state.list = state.list.filter((a) => a.id !== action.payload);
      state.filteredList = [...state.list];
    },
    setSelectedAppointment: (state, action: PayloadAction<Appointment | null>) => {
      state.selectedAppointment = action.payload;
    },
    setFilters: (state, action: PayloadAction<AppointmentsState["filters"]>) => {
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

export const { setAppointments, addAppointment, updateAppointment, deleteAppointment, setSelectedAppointment, setFilters, setLoading, setError } = appointmentsSlice.actions;
export default appointmentsSlice.reducer;
