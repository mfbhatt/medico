import api from './api';

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    role: string;
    tenant_id: string;
  };
}

const authApi = {
  requestOtp: (phone: string) =>
    api.post('/auth/patient/request-otp', { phone }).then((r) => r.data),

  verifyOtp: (phone: string, otp: string): Promise<LoginResponse> =>
    api.post<{ data: LoginResponse }>('/auth/patient/verify-otp', { phone, otp }).then((r) => r.data.data),

  refresh: (refreshToken: string): Promise<{ access_token: string; refresh_token: string }> =>
    api
      .post<{ data: { access_token: string; refresh_token: string } }>('/auth/refresh', { refresh_token: refreshToken })
      .then((r) => r.data.data),

  me: () => api.get('/auth/me').then((r) => r.data.data),
};

export default authApi;
