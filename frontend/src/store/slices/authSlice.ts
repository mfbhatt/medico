import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import type { User } from "../../types";
import { authService } from "../../services/authService";
import { STORAGE_KEYS } from "../../utils/constants";

export interface ActivePatient {
  id: string;
  name: string;
  relationship_type: string;
  is_minor: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  activePatient: ActivePatient | null; // null = self
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

function loadAuthFromStorage(): Pick<AuthState, "user" | "token" | "refreshToken" | "isAuthenticated"> {
  try {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    const userJson = localStorage.getItem(STORAGE_KEYS.USER);
    const user: User | null = userJson ? JSON.parse(userJson) : null;

    if (token && isTokenExpired(token)) {
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
      localStorage.removeItem(STORAGE_KEYS.TENANT_ID);
      return { token: null, refreshToken: null, user: null, isAuthenticated: false };
    }

    return {
      token,
      refreshToken,
      user,
      isAuthenticated: !!token && !!user,
    };
  } catch {
    return { token: null, refreshToken: null, user: null, isAuthenticated: false };
  }
}

const initialState: AuthState = {
  ...loadAuthFromStorage(),
  loading: false,
  error: null,
  activePatient: null,
};

interface LoginPayload {
  email: string;
  password: string;
  tenant_id?: string;
}

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

interface SwitchTenantPayload {
  tenant_id: string;
}

export const switchTenantThunk = createAsyncThunk<LoginResponse, SwitchTenantPayload, { rejectValue: string }>("auth/switchTenant", async (payload, { rejectWithValue }) => {
  try {
    const apiModule = await import("../../services/api");
    const { data } = await apiModule.default.post("/auth/switch-tenant", { tenant_id: payload.tenant_id });
    const resp = data.data as LoginResponse;
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, resp.access_token);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, resp.refresh_token);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(resp.user));
    localStorage.setItem(STORAGE_KEYS.TENANT_ID, resp.user.tenant_id ?? "");
    return resp;
  } catch (error: any) {
    console.error("Tenant switch failed:", error);
    return rejectWithValue(error.response?.data?.message ?? "Failed to switch tenant");
  }
});

export const loginThunk = createAsyncThunk<LoginResponse, LoginPayload, { rejectValue: string }>("auth/login", async (payload, { rejectWithValue }) => {
  try {
    const response = await authService.login({
      email: payload.email,
      password: payload.password,
    });
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, response.access_token);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.refresh_token);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.user));
    if (response.user?.tenant_id) {
      localStorage.setItem(STORAGE_KEYS.TENANT_ID, response.user.tenant_id);
    }
    return {
      access_token: response.access_token,
      refresh_token: response.refresh_token,
      user: response.user,
    };
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message ?? error.message ?? "Login failed");
  }
});

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    setToken: (state, action: PayloadAction<{ token: string; refreshToken: string }>) => {
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.activePatient = null;
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
      localStorage.removeItem(STORAGE_KEYS.TENANT_ID);
    },
    setActivePatient: (state, action: PayloadAction<ActivePatient | null>) => {
      state.activePatient = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.access_token;
        state.refreshToken = action.payload.refresh_token;
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Login failed";
        state.isAuthenticated = false;
      })
      .addCase(switchTenantThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(switchTenantThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.access_token;
        state.refreshToken = action.payload.refresh_token;
        state.error = null;
      })
      .addCase(switchTenantThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to switch tenant";
      });
  },
});

export const { setUser, setToken, logout, setLoading, setError, setActivePatient } = authSlice.actions;
export default authSlice.reducer;
