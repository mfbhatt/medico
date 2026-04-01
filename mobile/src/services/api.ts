import axios from 'axios';
import { storage } from '../utils/storage';
import { toast } from '../utils/toast';

// Registered by the app root after the store is created — avoids a require cycle.
let _onSessionExpired: (() => void) | null = null;
export function setSessionExpiredCallback(cb: () => void) {
  _onSessionExpired = cb;
}

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

// Fallback tenant for this app deployment — used when storage hasn't been populated yet
// (e.g. existing sessions pre-dating the tenant_id persistence fix, or first request after install)
const ENV_TENANT_ID = process.env.EXPO_PUBLIC_TENANT_ID;

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token + tenant header
api.interceptors.request.use(async (config) => {
  try {
    const token = await storage.getItemAsync('access_token');
    const storedTenantId = await storage.getItemAsync('tenant_id');
    const tenantId = storedTenantId || ENV_TENANT_ID;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (tenantId) config.headers['X-Tenant-ID'] = tenantId;
  } catch {
    // SecureStore unavailable — at minimum attach the env fallback
    if (ENV_TENANT_ID) config.headers['X-Tenant-ID'] = ENV_TENANT_ID;
  }
  return config;
});

// Auto-refresh on 401
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token!);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && !original.url?.includes('/auth/login')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await storage.getItemAsync('refresh_token').catch(() => null);
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });
        const newToken = data.data.access_token;
        await storage.setItemAsync('access_token', newToken).catch(() => {});
        if (data.data.refresh_token) {
          await storage.setItemAsync('refresh_token', data.data.refresh_token).catch(() => {});
        }
        processQueue(null, newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (err) {
        processQueue(err, null);
        await storage.deleteItemAsync('access_token').catch(() => {});
        await storage.deleteItemAsync('refresh_token').catch(() => {});
        await storage.deleteItemAsync('user_data').catch(() => {});
        _onSessionExpired?.();
        toast.info('Your session has expired. Please sign in again.');
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

export default api;
