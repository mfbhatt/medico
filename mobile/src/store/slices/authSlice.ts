import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { storage } from '../../utils/storage';
import authApi from '@/services/authApi';
import api from '@/services/api';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  tenant_id: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true, // true until restoreSessionThunk completes on app start
};

export const loginThunk = createAsyncThunk(
  'auth/login',
  async (credentials: { phone: string; otp: string }, { rejectWithValue }) => {
    try {
      const data = await authApi.verifyOtp(credentials.phone, credentials.otp);
      await storage.setItemAsync('access_token', data.access_token);
      await storage.setItemAsync('refresh_token', data.refresh_token);
      return data;
    } catch (err) {
      return rejectWithValue('Invalid OTP');
    }
  },
);

export const logoutThunk = createAsyncThunk('auth/logout', async () => {
  try {
    await storage.deleteItemAsync('access_token');
    await storage.deleteItemAsync('refresh_token');
    await storage.deleteItemAsync('user_data');
    await storage.deleteItemAsync('tenant_id');
  } catch { /* ignore if SecureStore unavailable */ }
});

export const restoreSessionThunk = createAsyncThunk('auth/restore', async () => {
  try {
    const storedToken = await storage.getItemAsync('access_token');
    if (!storedToken) return null;

    // Validate token against backend; interceptor auto-refreshes if expired
    const validatedUser: User | null = await api
      .get('/auth/me')
      .then((r) => r.data.data as User)
      .catch(() => null);

    if (!validatedUser) {
      // Both access and refresh tokens invalid — clear persisted session
      await storage.deleteItemAsync('access_token');
      await storage.deleteItemAsync('refresh_token');
      await storage.deleteItemAsync('user_data');
      return null;
    }

    // Re-read token (may have been silently refreshed by the interceptor)
    const [token, refresh] = await Promise.all([
      storage.getItemAsync('access_token'),
      storage.getItemAsync('refresh_token'),
    ]);

    return { accessToken: token!, refreshToken: refresh ?? null, user: validatedUser };
  } catch {
    return null;
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setTokens(state, action: PayloadAction<{ accessToken: string; refreshToken: string }>) {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.isAuthenticated = true;
    },
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
    },
    clearAuth(state) {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
    },
    setCredentials(state, action: PayloadAction<{ access_token: string; refresh_token: string; user: User }>) {
      state.accessToken = action.payload.access_token;
      state.refreshToken = action.payload.refresh_token;
      state.user = action.payload.user;
      state.isAuthenticated = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (state) => { state.isLoading = true; })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.accessToken = action.payload.access_token;
        state.refreshToken = action.payload.refresh_token;
        state.user = action.payload.user;
      })
      .addCase(loginThunk.rejected, (state) => { state.isLoading = false; })
      .addCase(logoutThunk.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
      })
      .addCase(restoreSessionThunk.pending, (state) => { state.isLoading = true; })
      .addCase(restoreSessionThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload) {
          state.accessToken = action.payload.accessToken;
          state.refreshToken = action.payload.refreshToken ?? null;
          state.user = action.payload.user;
          state.isAuthenticated = true;
        }
      })
      .addCase(restoreSessionThunk.rejected, (state) => { state.isLoading = false; });
  },
});

export const { setTokens, setUser, clearAuth, setCredentials } = authSlice.actions;
export default authSlice.reducer;
