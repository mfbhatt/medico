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
  // ── Phone OTP ────────────────────────────────────────────────────────────
  requestOtp: (phone: string) =>
    api.post('/auth/otp/send', { phone }).then((r) => r.data),

  verifyOtp: (phone: string, otp: string, tenantId?: string): Promise<LoginResponse> =>
    api
      .post<{ data: LoginResponse }>('/auth/otp/verify', {
        phone,
        otp,
        ...(tenantId && { tenant_id: tenantId }),
      })
      .then((r) => r.data.data),

  // ── Email / Password ──────────────────────────────────────────────────────
  login: (email: string, password: string): Promise<LoginResponse> =>
    api
      .post<{ data: LoginResponse }>('/auth/login', { email, password })
      .then((r) => r.data.data),

  // ── Social ────────────────────────────────────────────────────────────────
  socialLogin: (
    provider: 'google' | 'facebook',
    token: string,
    tokenType: 'access_token' | 'id_token' = 'access_token'
  ): Promise<LoginResponse> =>
    api
      .post<{ data: LoginResponse }>('/auth/social', { provider, token, token_type: tokenType })
      .then((r) => r.data.data),

  // ── Session ───────────────────────────────────────────────────────────────
  refresh: (refreshToken: string): Promise<{ access_token: string; refresh_token: string }> =>
    api
      .post<{ data: { access_token: string; refresh_token: string } }>('/auth/refresh', {
        refresh_token: refreshToken,
      })
      .then((r) => r.data.data),

  me: () => api.get('/auth/me').then((r) => r.data.data),
};

export default authApi;
