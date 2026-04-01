import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface TenantState {
  currentClinicId: string | null;
  currentTenantId: string | null;
}

const initialState: TenantState = {
  currentClinicId: null,
  currentTenantId: null,
};

const tenantSlice = createSlice({
  name: 'tenant',
  initialState,
  reducers: {
    setClinic(state, action: PayloadAction<{ clinicId: string | null; tenantId: string | null }>) {
      state.currentClinicId = action.payload.clinicId;
      state.currentTenantId = action.payload.tenantId;
    },
    clearTenant(state) {
      state.currentClinicId = null;
      state.currentTenantId = null;
    },
  },
});

export const { setClinic, clearTenant } = tenantSlice.actions;
export default tenantSlice.reducer;
