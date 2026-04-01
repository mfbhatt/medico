import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { Doctor } from "../../types";

interface DoctorsState {
  list: Doctor[];
  filteredList: Doctor[];
  selectedDoctor: Doctor | null;
  loading: boolean;
  error: string | null;
  filters: {
    search?: string;
    specialization?: string;
    status?: string;
    clinicId?: string;
  };
}

const initialState: DoctorsState = {
  list: [],
  filteredList: [],
  selectedDoctor: null,
  loading: false,
  error: null,
  filters: {},
};

export const doctorsSlice = createSlice({
  name: "doctors",
  initialState,
  reducers: {
    setDoctors: (state, action: PayloadAction<Doctor[]>) => {
      state.list = action.payload;
      state.filteredList = action.payload;
    },
    addDoctor: (state, action: PayloadAction<Doctor>) => {
      state.list.unshift(action.payload);
      state.filteredList.unshift(action.payload);
    },
    updateDoctor: (state, action: PayloadAction<Doctor>) => {
      const index = state.list.findIndex((d) => d.id === action.payload.id);
      if (index !== -1) {
        state.list[index] = action.payload;
        state.filteredList = [...state.list];
      }
    },
    deleteDoctor: (state, action: PayloadAction<string>) => {
      state.list = state.list.filter((d) => d.id !== action.payload);
      state.filteredList = [...state.list];
    },
    setSelectedDoctor: (state, action: PayloadAction<Doctor | null>) => {
      state.selectedDoctor = action.payload;
    },
    setFilters: (state, action: PayloadAction<DoctorsState["filters"]>) => {
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

export const { setDoctors, addDoctor, updateDoctor, deleteDoctor, setSelectedDoctor, setFilters, setLoading, setError } = doctorsSlice.actions;
export default doctorsSlice.reducer;
