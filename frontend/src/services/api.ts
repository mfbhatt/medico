import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL, API_TIMEOUT, STORAGE_KEYS } from "../utils/constants";

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor — attach token and tenant
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    const tenantId = localStorage.getItem(STORAGE_KEYS.TENANT_ID);

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (tenantId) {
      config.headers["X-Tenant-ID"] = tenantId;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Token refresh state — prevents concurrent refresh calls
let _refreshing = false;
let _refreshQueue: Array<(token: string | null) => void> = [];

function _flushQueue(token: string | null) {
  _refreshQueue.forEach((resolve) => resolve(token));
  _refreshQueue = [];
}

function _clearSession() {
  localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER);
  localStorage.removeItem(STORAGE_KEYS.TENANT_ID);
  if (!window.location.pathname.includes("/login")) {
    window.location.href = "/login";
  }
}

// Response interceptor — on 401, attempt token refresh then retry
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest: InternalAxiosRequestConfig & { _retry?: boolean } =
      error.config ?? {};
    const url: string = originalRequest.url ?? "";
    const status: number = error.response?.status;

    // Don't attempt refresh for auth endpoints or already-retried requests
    if (
      status !== 401 ||
      originalRequest._retry ||
      url.includes("/auth/login") ||
      url.includes("/auth/refresh")
    ) {
      if (status === 401 && !url.includes("/auth/login")) {
        _clearSession();
      }
      return Promise.reject(error);
    }

    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (!refreshToken) {
      _clearSession();
      return Promise.reject(error);
    }

    // If a refresh is already in flight, queue this request
    if (_refreshing) {
      return new Promise((resolve, reject) => {
        _refreshQueue.push((newToken) => {
          if (!newToken) return reject(error);
          originalRequest._retry = true;
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          resolve(api(originalRequest));
        });
      });
    }

    _refreshing = true;
    originalRequest._retry = true;

    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/auth/refresh`,
        { refresh_token: refreshToken },
        { headers: { "Content-Type": "application/json" } }
      );

      const newAccessToken: string = data.data.access_token;
      const newRefreshToken: string = data.data.refresh_token;

      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, newAccessToken);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);

      api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

      _flushQueue(newAccessToken);
      return api(originalRequest);
    } catch {
      _flushQueue(null);
      _clearSession();
      return Promise.reject(error);
    } finally {
      _refreshing = false;
    }
  }
);

export default api;
