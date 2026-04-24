import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setUser } from "@/store/slices/authSlice";
import { addToast } from "@/store/slices/uiSlice";
import api from "@/services/api";
import { STORAGE_KEYS } from "@/utils/constants";

const schema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["male", "female", "other"], { required_error: "Gender is required" }),
});
type FormData = z.infer<typeof schema>;

export default function PatientProfileCompletionPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const currentUser = useAppSelector((s) => s.auth.user);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: currentUser?.first_name && currentUser.first_name !== "Patient" ? currentUser.first_name : "",
      last_name: currentUser?.last_name || "",
    },
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const resp = await api.post("/auth/complete-profile", data);
      const updatedUser = resp.data.data.user;
      if (updatedUser) {
        dispatch(setUser(updatedUser));
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
      }
      dispatch(addToast({ id: `t-${Date.now()}`, type: "success", message: "Welcome! Your profile is ready." }));
      navigate("/appointments", { replace: true });
    } catch (err: any) {
      dispatch(addToast({
        id: `t-${Date.now()}`,
        type: "error",
        message: err?.response?.data?.message ?? "Failed to save profile. Please try again.",
      }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Complete your profile</h1>
          <p className="mt-1 text-sm text-gray-500">Just a few details so we can personalise your experience.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
            <label className="label">Date of birth</label>
            <input type="date" className="input" max={new Date().toISOString().split("T")[0]} {...register("date_of_birth")} />
            {errors.date_of_birth && <p className="mt-1 text-xs text-red-600">{errors.date_of_birth.message}</p>}
          </div>

          <div>
            <label className="label">Gender</label>
            <select className="input" {...register("gender")}>
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other / prefer not to say</option>
            </select>
            {errors.gender && <p className="mt-1 text-xs text-red-600">{errors.gender.message}</p>}
          </div>

          <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
            {loading && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {loading ? "Saving…" : "Save & continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
