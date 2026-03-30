import api from "./api";
import type { ApiResponse, User } from "../types";
import { STORAGE_KEYS } from "../utils/constants";

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export const authService = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    try {
      console.log("authService.login: Sending request to /auth/login with email:", credentials.email);
      const response = await api.post<ApiResponse<LoginResponse>>("/auth/login", credentials);
      console.log("authService.login: Raw response:", response);

      if (response.data.success && response.data.data) {
        const { access_token, refresh_token, user } = response.data.data;
        localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, access_token);
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refresh_token);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
        if (user.tenant_id) {
          localStorage.setItem(STORAGE_KEYS.TENANT_ID, user.tenant_id);
        }
        return response.data.data;
      }

      throw new Error("Login failed - invalid response format");
    } catch (error: any) {
      console.error("authService.login: Error:", error);
      throw error;
    }
  },

  logout: async (): Promise<void> => {
    try {
      await api.post("/auth/logout");
    } finally {
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
      localStorage.removeItem(STORAGE_KEYS.TENANT_ID);
    }
  },

  refreshToken: async (): Promise<{ access_token: string; refresh_token: string }> => {
    const refresh_token = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (!refresh_token) {
      throw new Error("No refresh token available");
    }

    const response = await api.post<ApiResponse<{ access_token: string; refresh_token: string }>>("/auth/refresh", { refresh_token });

    if (response.data.success && response.data.data) {
      const { access_token, refresh_token: newRefreshToken } = response.data.data;
      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, access_token);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);
      return response.data.data;
    }

    throw new Error("Token refresh failed");
  },

  requestPasswordReset: async (email: string): Promise<void> => {
    await api.post("/auth/request-password-reset", { email });
  },

  resetPassword: async (data: ResetPasswordRequest): Promise<void> => {
    await api.post("/auth/reset-password", data);
  },

  verifyToken: async (): Promise<User> => {
    const response = await api.get<ApiResponse<User>>("/auth/verify");
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error("Token verification failed");
  },

  getCurrentUser: (): User | null => {
    const userJson = localStorage.getItem(STORAGE_KEYS.USER);
    return userJson ? JSON.parse(userJson) : null;
  },

  isAuthenticated: (): boolean => {
    return !!localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  },
};
