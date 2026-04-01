import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { Patient } from "../../types";

interface PatientsState {
  list: Patient[];
  filteredList: Patient[];
  selectedPatient: Patient | null;
  loading: boolean;
  error: string | null;
  filters: {
    search?: string;
    gender?: string;
    clinicId?: string;
  };
}

const initialState: PatientsState = {
  list: [],
  filteredList: [],
  selectedPatient: null,
  loading: false,
  error: null,
  filters: {},
};

export const patientsSlice = createSlice({
  name: "patients",
  initialState,
  reducers: {
    setPatients: (state, action: PayloadAction<Patient[]>) => {
      state.list = action.payload;
      state.filteredList = action.payload;
    },
    addPatient: (state, action: PayloadAction<Patient>) => {
      state.list.unshift(action.payload);
      state.filteredList.unshift(action.payload);
    },
    updatePatient: (state, action: PayloadAction<Patient>) => {
      const index = state.list.findIndex((p) => p.id === action.payload.id);
      if (index !== -1) {
        state.list[index] = action.payload;
        state.filteredList = [...state.list];
      }
    },
    deletePatient: (state, action: PayloadAction<string>) => {
      state.list = state.list.filter((p) => p.id !== action.payload);
      state.filteredList = [...state.list];
    },
    setSelectedPatient: (state, action: PayloadAction<Patient | null>) => {
      state.selectedPatient = action.payload;
    },
    setFilters: (state, action: PayloadAction<PatientsState["filters"]>) => {
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

export const { setPatients, addPatient, updatePatient, deletePatient, setSelectedPatient, setFilters, setLoading, setError } = patientsSlice.actions;
export default patientsSlice.reducer;
