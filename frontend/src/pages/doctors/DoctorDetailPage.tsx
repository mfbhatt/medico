import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Mail, Phone, Award, ArrowLeft, Calendar, MapPin } from "lucide-react";
import api from "@/services/api";

export default function DoctorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: doctor, isLoading, isError } = useQuery({
    queryKey: ["doctor", id],
    queryFn: () => api.get(`/doctors/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

  if (isLoading) return <div className="text-center py-20 text-slate-400">Loading doctor…</div>;
  if (isError || !doctor) return <div className="text-center py-20 text-slate-400">Doctor not found</div>;

  const name = doctor.user
    ? `Dr. ${doctor.user.first_name} ${doctor.user.last_name}`
    : `Dr. ${doctor.first_name ?? ""} ${doctor.last_name ?? ""}`;

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate("/doctors")} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6 text-sm font-medium">
        <ArrowLeft className="h-4 w-4" /> Back to Doctors
      </button>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{name}</h1>
            {doctor.specialization && (
              <p className="text-sm text-slate-500 mt-0.5">{doctor.specialization}</p>
            )}
          </div>
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
            (doctor.status ?? doctor.user?.status) === "active"
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-600"
          }`}>
            {(doctor.status ?? doctor.user?.status ?? "active").charAt(0).toUpperCase() + (doctor.status ?? doctor.user?.status ?? "active").slice(1)}
          </span>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-5">
            {(doctor.user?.email ?? doctor.email) && (
              <div className="flex gap-3">
                <Mail className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Email</p>
                  <p className="text-sm text-slate-900 mt-0.5">{doctor.user?.email ?? doctor.email}</p>
                </div>
              </div>
            )}

            {(doctor.user?.phone ?? doctor.phone) && (
              <div className="flex gap-3">
                <Phone className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Phone</p>
                  <p className="text-sm text-slate-900 mt-0.5">{doctor.user?.phone ?? doctor.phone}</p>
                </div>
              </div>
            )}

            {doctor.license_number && (
              <div className="flex gap-3">
                <Award className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">License</p>
                  <p className="text-sm text-slate-900 mt-0.5">{doctor.license_number}</p>
                </div>
              </div>
            )}

            {doctor.years_of_experience != null && (
              <div className="flex gap-3">
                <Award className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Experience</p>
                  <p className="text-sm text-slate-900 mt-0.5">{doctor.years_of_experience} years</p>
                </div>
              </div>
            )}
          </div>

          {doctor.qualifications?.length > 0 && (
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Qualifications</p>
              <ul className="space-y-1">
                {doctor.qualifications.map((q: string, i: number) => (
                  <li key={i} className="text-sm text-slate-800 flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span> {q}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {doctor.clinic_assignments?.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Assigned Clinics</p>
              <div className="flex flex-wrap gap-2">
                {doctor.clinic_assignments.map((ca: any, i: number) => (
                  <span key={i} className="bg-blue-50 text-blue-700 text-xs px-3 py-1 rounded-full font-medium flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {ca.clinic_name ?? ca.clinic_id?.slice(0, 8)}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <Link
              to={`/doctors/${id}/schedule`}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm"
            >
              <Calendar className="h-4 w-4" /> Manage Schedule
            </Link>
            <Link
              to={`/appointments/new?doctor_id=${id}`}
              className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium px-4 py-2.5 rounded-lg text-sm"
            >
              Book Appointment
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
