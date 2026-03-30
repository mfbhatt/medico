import api from './api';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    role: string;
    clinic_id: string | null;
    tenant_id: string;
  };
}

export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
}

const authApi = {
  login: (data: LoginRequest) =>
    api.post<{ data: LoginResponse }>('/auth/login', data).then((r) => r.data.data),

  refresh: (refreshToken: string) =>
    api
      .post<{ data: RefreshResponse }>('/auth/refresh', { refresh_token: refreshToken })
      .then((r) => r.data.data),

  logout: () => api.post('/auth/logout'),

  me: () =>
    api.get<{ data: LoginResponse['user'] }>('/auth/me').then((r) => r.data.data),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', { token, password }),
};

export default authApi;
