import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAppDispatch } from "@/store/hooks";
import { loginThunk, switchTenantThunk } from "@/store/slices/authSlice";
import { addToast } from "@/store/slices/uiSlice";
import api from "@/services/api";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/home";

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [tenants, setTenants] = useState<any[]>([]);
  const [switchingTenant, setSwitchingTenant] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await dispatch(loginThunk(data)).unwrap();

      // Check if user belongs to multiple tenants
      const resp = await api.get("/auth/my-tenants");
      const myTenants: any[] = resp.data.data ?? [];
      if (myTenants.length > 1) {
        setTenants(myTenants);
        setLoading(false);
        return; // Stay on page to show tenant picker
      }

      dispatch(addToast({ id: `toast-${Date.now()}`, type: "success", message: "Login successful!" }));
      navigate(from, { replace: true });
    } catch (error: any) {
      dispatch(addToast({
        id: `toast-${Date.now()}`,
        type: "error",
        message: typeof error === "string" ? error : (error?.message ?? "Invalid email or password"),
      }));
    } finally {
      setLoading(false);
    }
  };

  const selectTenant = async (tenantId: string) => {
    // If this tenant is already active (auto-selected during login), just navigate
    const selected = tenants.find((t) => t.tenant_id === tenantId);
    if (selected?.is_current) {
      dispatch(addToast({ id: `toast-${Date.now()}`, type: "success", message: "Login successful!" }));
      navigate(from, { replace: true });
      return;
    }
    setSwitchingTenant(true);
    try {
      await dispatch(switchTenantThunk({ tenant_id: tenantId })).unwrap();
      dispatch(addToast({ id: `toast-${Date.now()}`, type: "success", message: "Login successful!" }));
      navigate(from, { replace: true });
    } catch (error: any) {
      dispatch(addToast({ id: `toast-${Date.now()}`, type: "error", message: typeof error === "string" ? error : (error?.message ?? "Failed to switch tenant") }));
    } finally {
      setSwitchingTenant(false);
    }
  };

  // Tenant picker step
  if (tenants.length > 1) {
    return (
      <>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Select Organisation</h2>
        <p className="text-sm text-gray-500 mb-6">Your account has access to multiple organisations. Choose one to continue.</p>
        <div className="space-y-2">
          {tenants.map((t) => (
            <button
              key={t.tenant_id}
              onClick={() => selectTenant(t.tenant_id)}
              disabled={switchingTenant}
              className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              <p className="font-medium text-gray-900">{t.tenant_name}</p>
              <p className="text-xs text-gray-400 capitalize">{t.role.replace(/_/g, " ")}</p>
            </button>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Sign in to your account</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Email address</label>
          <input type="email" className="input" placeholder="you@clinic.com" autoComplete="email" {...register("email")} />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="label mb-0">Password</label>
            <Link to="/forgot-password" className="text-xs text-primary-600 hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input type={showPassword ? "text" : "password"} className="input pr-10" placeholder="••••••••" autoComplete="current-password" {...register("password")} />
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPassword ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>

        <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
          {loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : null}
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </>
  );
}
