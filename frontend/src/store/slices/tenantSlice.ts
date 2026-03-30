import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface TenantState {
  tenantId: string | null;
  tenantName: string | null;
  slug: string | null;
  plan: string | null;
  features: Record<string, boolean>;
  logoUrl: string | null;
}

const getStoredTenant = (): Partial<TenantState> => {
  try {
    const raw = localStorage.getItem('tenant');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const initialState: TenantState = {
  tenantId: null,
  tenantName: null,
  slug: null,
  plan: null,
  features: {},
  logoUrl: null,
  ...getStoredTenant(),
};

const tenantSlice = createSlice({
  name: 'tenant',
  initialState,
  reducers: {
    setTenant(state, action: PayloadAction<Omit<TenantState, 'features'> & { features?: Record<string, boolean> }>) {
      Object.assign(state, action.payload);
      if (!action.payload.features) {
        state.features = {};
      }
      localStorage.setItem(
        'tenant',
        JSON.stringify({
          tenantId: state.tenantId,
          tenantName: state.tenantName,
          slug: state.slug,
          plan: state.plan,
          features: state.features,
          logoUrl: state.logoUrl,
        }),
      );
    },
    clearTenant(state) {
      state.tenantId = null;
      state.tenantName = null;
      state.slug = null;
      state.plan = null;
      state.features = {};
      state.logoUrl = null;
      localStorage.removeItem('tenant');
    },
    setFeatureFlags(state, action: PayloadAction<Record<string, boolean>>) {
      state.features = action.payload;
    },
  },
});

export const { setTenant, clearTenant, setFeatureFlags } = tenantSlice.actions;
export default tenantSlice.reducer;
