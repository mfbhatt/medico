import { useState, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAppDispatch } from "@/store/hooks";
import { addToast } from "@/store/slices/uiSlice";
import { setUser, setToken } from "@/store/slices/authSlice";
import api from "@/services/api";
import { STORAGE_KEYS } from "@/utils/constants";

type RegMethod = "email" | "phone";

const emailSchema = z
  .object({
    first_name: z.string().min(1, "First name is required"),
    last_name: z.string().min(1, "Last name is required"),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });
type EmailFormData = z.infer<typeof emailSchema>;

function persistTokens(data: any) {
  if (data.access_token) localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, data.access_token);
  if (data.refresh_token) localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
  if (data.user?.tenant_id) localStorage.setItem(STORAGE_KEYS.TENANT_ID, data.user.tenant_id);
  if (data.user) localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user));
}

export default function PatientRegisterPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/home";

  const [method, setMethod] = useState<RegMethod>("email");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

  const startOtpTimer = () => {
    setOtpTimer(60);
    timerRef.current = setInterval(() => {
      setOtpTimer((t) => {
        if (t <= 1) { clearInterval(timerRef.current!); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const onEmailSubmit = async (data: EmailFormData) => {
    setLoading(true);
    try {
      const resp = await api.post("/auth/patient/register", {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        password: data.password,
      });
      const payload = resp.data.data;
      persistTokens(payload);
      if (payload.user) dispatch(setUser(payload.user));
      if (payload.access_token) dispatch(setToken({ token: payload.access_token, refreshToken: payload.refresh_token ?? "" }));
      dispatch(addToast({ id: `t-${Date.now()}`, type: "success", message: "Account created! Welcome." }));
      navigate(from, { replace: true });
    } catch (err: any) {
      dispatch(addToast({
        id: `t-${Date.now()}`,
        type: "error",
        message: err?.response?.data?.message ?? "Registration failed. Please try again.",
      }));
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async () => {
    const p = phone.trim();
    if (!p) {
      dispatch(addToast({ id: `t-${Date.now()}`, type: "error", message: "Enter your phone number" }));
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/otp/send", { phone: p });
      setOtpSent(true);
      startOtpTimer();
      dispatch(addToast({ id: `t-${Date.now()}`, type: "success", message: "OTP sent to your phone" }));
    } catch (err: any) {
      dispatch(addToast({
        id: `t-${Date.now()}`,
        type: "error",
        message: err?.response?.data?.message ?? "Failed to send OTP",
      }));
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim()) {
      dispatch(addToast({ id: `t-${Date.now()}`, type: "error", message: "Enter the OTP" }));
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/auth/otp/verify", { phone: phone.trim(), otp: otp.trim() });
      const payload = data.data;
      if (!payload.access_token) {
        dispatch(addToast({ id: `t-${Date.now()}`, type: "error", message: "No active clinic found. Please try again later." }));
        return;
      }
      persistTokens(payload);
      if (payload.user) dispatch(setUser(payload.user));
      if (payload.access_token) dispatch(setToken({ token: payload.access_token, refreshToken: payload.refresh_token ?? "" }));
      dispatch(addToast({ id: `t-${Date.now()}`, type: "success", message: "Account created! Welcome." }));
      navigate(from, { replace: true });
    } catch (err: any) {
      dispatch(addToast({
        id: `t-${Date.now()}`,
        type: "error",
        message: err?.response?.data?.message ?? "Invalid OTP",
      }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Create your patient account</h2>
      <p className="text-sm text-gray-500 mb-5">
        Already have an account?{" "}
        <Link to="/login" state={location.state} className="text-blue-600 hover:underline font-medium">
          Sign in
        </Link>
      </p>

      {/* Method tabs */}
      <div className="flex rounded-lg border border-gray-200 mb-5 overflow-hidden">
        {(["email", "phone"] as RegMethod[]).map((m) => (
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

      {/* Email registration form */}
      {method === "email" && (
        <form onSubmit={handleSubmit(onEmailSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">First name</label>
              <input type="text" className="input" placeholder="Jane" autoComplete="given-name" {...register("first_name")} />
              {errors.first_name && <p className="mt-1 text-xs text-red-600">{errors.first_name.message}</p>}
            </div>
            <div>
              <label className="label">Last name</label>
              <input type="text" className="input" placeholder="Smith" autoComplete="family-name" {...register("last_name")} />
              {errors.last_name && <p className="mt-1 text-xs text-red-600">{errors.last_name.message}</p>}
            </div>
          </div>

          <div>
            <label className="label">Email address</label>
            <input type="email" className="input" placeholder="jane@example.com" autoComplete="email" {...register("email")} />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
          </div>

          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} className="input pr-10" placeholder="Min. 8 characters" autoComplete="new-password" {...register("password")} />
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

          <div>
            <label className="label">Confirm password</label>
            <input type={showPassword ? "text" : "password"} className="input" placeholder="Re-enter password" autoComplete="new-password" {...register("confirm_password")} />
            {errors.confirm_password && <p className="mt-1 text-xs text-red-600">{errors.confirm_password.message}</p>}
          </div>

          <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
            {loading && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
      )}

      {/* Phone OTP registration */}
      {method === "phone" && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">Enter your phone number to receive a one-time code. If you don't have an account, one will be created for you.</p>
          <div>
            <label className="label">Phone number</label>
            <input type="tel" className="input" placeholder="+1 555 000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={otpSent} />
          </div>

          {!otpSent ? (
            <button type="button" onClick={sendOtp} disabled={loading || !phone.trim()} className="btn-primary w-full disabled:opacity-60">
              {loading ? "Sending…" : "Send OTP"}
            </button>
          ) : (
            <>
              <div>
                <label className="label">One-time password</label>
                <input type="text" className="input tracking-widest text-center text-lg" placeholder="• • • • • •" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
              </div>
              <button type="button" onClick={verifyOtp} disabled={loading || otp.length < 4} className="btn-primary w-full disabled:opacity-60">
                {loading ? "Verifying…" : "Verify & Create account"}
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
