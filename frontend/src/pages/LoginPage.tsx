import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGoogleLogin } from "@react-oauth/google";
import { useAppDispatch } from "@/store/hooks";
import { loginThunk, switchTenantThunk } from "@/store/slices/authSlice";
import { addToast } from "@/store/slices/uiSlice";
import api from "@/services/api";
import { FACEBOOK_APP_ID, STORAGE_KEYS } from "@/utils/constants";

// ── Types ─────────────────────────────────────────────────────────
type LoginMethod = "email" | "phone";

const emailSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
type EmailFormData = z.infer<typeof emailSchema>;

// ── Helpers ───────────────────────────────────────────────────────
function persistTokens(data: any) {
  if (data.access_token) localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, data.access_token);
  if (data.refresh_token) localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
  if (data.user?.tenant_id) localStorage.setItem(STORAGE_KEYS.TENANT_ID, data.user.tenant_id);
  if (data.user) localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user));
}

// ── Main component ────────────────────────────────────────────────
export default function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/home";

  const [method, setMethod] = useState<LoginMethod>("email");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [tenants, setTenants] = useState<any[]>([]);
  const [switchingTenant, setSwitchingTenant] = useState(false);

  // Phone OTP state
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpTimer, setOtpTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailFormData>({ resolver: zodResolver(emailSchema) });

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // ── After login: check multiple tenants ───────────────────────
  const handlePostLogin = async () => {
    const resp = await api.get("/auth/my-tenants");
    const myTenants: any[] = resp.data.data ?? [];
    if (myTenants.length > 1) {
      setTenants(myTenants);
      return;
    }
    dispatch(addToast({ id: `t-${Date.now()}`, type: "success", message: "Login successful!" }));
    navigate(from, { replace: true });
  };

  // ── Social login shared handler ───────────────────────────────
  const handleSocialLogin = async (provider: "google" | "facebook", token: string) => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/social", { provider, token });
      const payload = data.data;
      if (!payload.access_token) {
        dispatch(addToast({ id: `t-${Date.now()}`, type: "error", message: payload.message ?? "Account not activated. Contact your administrator." }));
        return;
      }
      persistTokens(payload);
      await handlePostLogin();
    } catch (err: any) {
      dispatch(addToast({ id: `t-${Date.now()}`, type: "error", message: err?.response?.data?.message ?? "Social login failed" }));
    } finally {
      setLoading(false);
    }
  };

  // ── Google login ──────────────────────────────────────────────
  const googleLogin = useGoogleLogin({
    onSuccess: (resp) => handleSocialLogin("google", resp.access_token),
    onError: () => dispatch(addToast({ id: `t-${Date.now()}`, type: "error", message: "Google login cancelled" })),
    // Use id_token flow for better backend verification
    flow: "implicit",
  });

  // ── Facebook login ────────────────────────────────────────────
  const handleFacebookLogin = () => {
    if (!FACEBOOK_APP_ID) {
      dispatch(addToast({ id: `t-${Date.now()}`, type: "error", message: "Facebook login is not configured" }));
      return;
    }
    const fb = (window as any).FB;
    if (!fb) {
      dispatch(addToast({ id: `t-${Date.now()}`, type: "error", message: "Facebook SDK not loaded. Please refresh the page." }));
      return;
    }
    fb.login(
      (response: any) => {
        if (response.authResponse?.accessToken) {
          handleSocialLogin("facebook", response.authResponse.accessToken);
        }
      },
      { scope: "email,public_profile" }
    );
  };

  // ── Email login ───────────────────────────────────────────────
  const onEmailSubmit = async (data: EmailFormData) => {
    setLoading(true);
    try {
      await dispatch(loginThunk({ email: data.email!, password: data.password! })).unwrap();
      await handlePostLogin();
    } catch (error: any) {
      dispatch(addToast({ id: `t-${Date.now()}`, type: "error", message: typeof error === "string" ? error : (error?.message ?? "Invalid email or password") }));
    } finally {
      setLoading(false);
    }
  };

  // ── Phone OTP ─────────────────────────────────────────────────
  const startOtpTimer = () => {
    setOtpTimer(60);
    timerRef.current = setInterval(() => {
      setOtpTimer((t) => {
        if (t <= 1) { clearInterval(timerRef.current!); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const sendOtp = async () => {
    const p = phone.trim();
    if (!p) { dispatch(addToast({ id: `t-${Date.now()}`, type: "error", message: "Enter your phone number" })); return; }
    setLoading(true);
    try {
      await api.post("/auth/otp/send", { phone: p });
      setOtpSent(true);
      startOtpTimer();
      dispatch(addToast({ id: `t-${Date.now()}`, type: "success", message: "OTP sent to your phone" }));
    } catch (err: any) {
      dispatch(addToast({ id: `t-${Date.now()}`, type: "error", message: err?.response?.data?.message ?? "Failed to send OTP" }));
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim()) { dispatch(addToast({ id: `t-${Date.now()}`, type: "error", message: "Enter the OTP" })); return; }
    setLoading(true);
    try {
      const { data } = await api.post("/auth/otp/verify", { phone: phone.trim(), otp: otp.trim() });
      const payload = data.data;
      if (!payload.access_token) {
        dispatch(addToast({ id: `t-${Date.now()}`, type: "error", message: "Account not activated. Contact your administrator." }));
        return;
      }
      persistTokens(payload);
      await handlePostLogin();
    } catch (err: any) {
      dispatch(addToast({ id: `t-${Date.now()}`, type: "error", message: err?.response?.data?.message ?? "Invalid OTP" }));
    } finally {
      setLoading(false);
    }
  };

  // ── Tenant picker ─────────────────────────────────────────────
  const selectTenant = async (tenantId: string) => {
    const selected = tenants.find((t) => t.tenant_id === tenantId);
    if (selected?.is_current) {
      dispatch(addToast({ id: `t-${Date.now()}`, type: "success", message: "Login successful!" }));
      navigate(from, { replace: true });
      return;
    }
    setSwitchingTenant(true);
    try {
      await dispatch(switchTenantThunk({ tenant_id: tenantId })).unwrap();
      dispatch(addToast({ id: `t-${Date.now()}`, type: "success", message: "Login successful!" }));
      navigate(from, { replace: true });
    } catch (error: any) {
      dispatch(addToast({ id: `t-${Date.now()}`, type: "error", message: typeof error === "string" ? error : (error?.message ?? "Failed to switch tenant") }));
    } finally {
      setSwitchingTenant(false);
    }
  };

  // ── Render: tenant picker ─────────────────────────────────────
  if (tenants.length > 1) {
    return (
      <>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Select Organisation</h2>
        <p className="text-sm text-gray-500 mb-6">Your account has access to multiple organisations. Choose one to continue.</p>
        <div className="space-y-2">
          {tenants.map((t) => (
            <button key={t.tenant_id} onClick={() => selectTenant(t.tenant_id)} disabled={switchingTenant}
              className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50">
              <p className="font-medium text-gray-900">{t.tenant_name}</p>
              <p className="text-xs text-gray-400 capitalize">{t.role.replace(/_/g, " ")}</p>
            </button>
          ))}
        </div>
      </>
    );
  }

  // ── Render: login form ────────────────────────────────────────
  return (
    <>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Sign in to your account</h2>

      {/* Social buttons */}
      <div className="space-y-2 mb-5">
        <button
          type="button"
          onClick={() => googleLogin()}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition disabled:opacity-60"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <button
          type="button"
          onClick={handleFacebookLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-300 rounded-lg bg-[#1877F2] hover:bg-[#166fe5] text-sm font-medium text-white transition disabled:opacity-60"
        >
          <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
            <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.883v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
          </svg>
          Continue with Facebook
        </button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400">or</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* Method tabs */}
      <div className="flex rounded-lg border border-gray-200 mb-5 overflow-hidden">
        {(["email", "phone"] as LoginMethod[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMethod(m); setOtpSent(false); setOtp(""); }}
            className={`flex-1 py-2 text-sm font-medium transition ${method === m ? "bg-blue-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
          >
            {m === "email" ? "Email & Password" : "Phone OTP"}
          </button>
        ))}
      </div>

      {/* Email/password form */}
      {method === "email" && (
        <form onSubmit={handleSubmit(onEmailSubmit)} className="space-y-4">
          <div>
            <label className="label">Email address</label>
            <input type="email" className="input" placeholder="you@clinic.com" autoComplete="email" {...register("email")} />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">Password</label>
              <Link to="/forgot-password" className="text-xs text-primary-600 hover:underline">Forgot password?</Link>
            </div>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} className="input pr-10" placeholder="••••••••" autoComplete="current-password" {...register("password")} />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                )}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
          </div>
          <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
            {loading && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      )}

      {/* Phone OTP form */}
      {method === "phone" && (
        <div className="space-y-4">
          <div>
            <label className="label">Phone number</label>
            <input
              type="tel"
              className="input"
              placeholder="+1 555 000 0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={otpSent}
            />
          </div>

          {!otpSent ? (
            <button type="button" onClick={sendOtp} disabled={loading || !phone.trim()} className="btn-primary w-full disabled:opacity-60">
              {loading ? "Sending…" : "Send OTP"}
            </button>
          ) : (
            <>
              <div>
                <label className="label">One-time password</label>
                <input
                  type="text"
                  className="input tracking-widest text-center text-lg"
                  placeholder="• • • • • •"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <button type="button" onClick={verifyOtp} disabled={loading || otp.length < 4} className="btn-primary w-full disabled:opacity-60">
                {loading ? "Verifying…" : "Verify & Sign in"}
              </button>
              <button
                type="button"
                onClick={() => { setOtpSent(false); setOtp(""); if (timerRef.current) clearInterval(timerRef.current); sendOtp(); }}
                disabled={otpTimer > 0 || loading}
                className="w-full text-sm text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
              >
                {otpTimer > 0 ? `Resend OTP in ${otpTimer}s` : "Resend OTP"}
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
