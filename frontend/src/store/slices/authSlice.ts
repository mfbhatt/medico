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
  refreshPending: boolean; // true while a silent token refresh is in flight
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
      // Access token expired — clear it but keep refresh token so the app
      // can silently obtain a new access token on load instead of forcing a login.
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      return { token: null, refreshToken, user, isAuthenticated: false };
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
  refreshPending: false,
};

interface RefreshResponse {
  access_token: string;
  refresh_token: string;
}

export const refreshAuthThunk = createAsyncThunk<RefreshResponse, void, { rejectValue: string }>(
  "auth/refresh",
  async (_, { rejectWithValue }) => {
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (!refreshToken) return rejectWithValue("No refresh token");
    try {
      // Use raw axios to avoid the response interceptor creating a refresh loop
      const { default: axios } = await import("axios");
      const API_BASE_URL = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:8000/api/v1";
      const tenantId = localStorage.getItem(STORAGE_KEYS.TENANT_ID);
      const { data } = await axios.post(
        `${API_BASE_URL}/auth/refresh`,
        { refresh_token: refreshToken },
        {
          headers: {
            "Content-Type": "application/json",
            ...(tenantId ? { "X-Tenant-ID": tenantId } : {}),
          },
        }
      );
      const { access_token, refresh_token: newRefreshToken } = data.data as RefreshResponse;
      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, access_token);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);
      return { access_token, refresh_token: newRefreshToken };
    } catch (err: any) {
      // Clear storage so the user is redirected to login
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
      localStorage.removeItem(STORAGE_KEYS.TENANT_ID);
      return rejectWithValue(err?.response?.data?.message ?? "Session expired");
    }
  }
);

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
      })
      .addCase(refreshAuthThunk.pending, (state) => {
        state.refreshPending = true;
      })
      .addCase(refreshAuthThunk.fulfilled, (state, action) => {
        state.refreshPending = false;
        state.token = action.payload.access_token;
        state.refreshToken = action.payload.refresh_token;
        state.isAuthenticated = true;
      })
      .addCase(refreshAuthThunk.rejected, (state) => {
        state.refreshPending = false;
        state.token = null;
        state.refreshToken = null;
        state.user = null;
        state.isAuthenticated = false;
      });
  },
});

export const { setUser, setToken, logout, setLoading, setError, setActivePatient } = authSlice.actions;
export default authSlice.reducer;
