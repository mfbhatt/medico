import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Layers,
  Globe,
  Users,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  Plus,
} from "lucide-react";
import api from "@/services/api";

interface TenantRow {
  id: string;
  name: string;
  plan: string;
  subscription_plan?: string;
  status: string;
  clinics_count: number;
  users_count: number;
  created_at: string;
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${accent}`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-600",
  suspended: "bg-red-100 text-red-700",
};

const PLAN_COLORS: Record<string, string> = {
  basic: "bg-blue-50 text-blue-700",
  professional: "bg-purple-50 text-purple-700",
  enterprise: "bg-indigo-50 text-indigo-700",
};

export default function SuperAdminDashboard() {
  const { data: tenantsData } = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: () => api.get("/tenants/").then((r) => r.data.data),
  });

  const tenants: TenantRow[] = tenantsData?.items ?? tenantsData ?? [];

  const activeTenants = tenants.filter((t) => t.status === "active").length;
  const suspendedTenants = tenants.filter((t) => t.status === "suspended").length;

  return (
    <div>
      {/* Header */}
      <div className="page-header mb-8">
        <div>
          <h1 className="page-title">System Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Platform-wide overview — all tenants</p>
        </div>
        <div className="flex gap-3">
          <Link to="/admin/tenants" className="btn-secondary flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Manage Tenants
          </Link>
          <Link to="/admin/clinics" className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Clinic
          </Link>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Tenants"
          value={tenants.length}
          sub={`${activeTenants} active · ${suspendedTenants} suspended`}
          icon={Layers}
          accent="bg-purple-600"
        />
        <StatCard
          label="Total Clinics"
          value={tenants.reduce((s, t) => s + (t.clinics_count ?? 0), 0)}
          sub="across all tenants"
          icon={Globe}
          accent="bg-blue-600"
        />
        <StatCard
          label="Total Users"
          value={tenants.reduce((s, t) => s + (t.users_count ?? 0), 0)}
          sub="staff + patients"
          icon={Users}
          accent="bg-teal-600"
        />
        <StatCard
          label="Active Tenants"
          value={activeTenants}
          sub={`of ${tenants.length} total`}
          icon={Activity}
          accent="bg-green-600"
        />
      </div>

      {/* Tenant Table */}
      <div className="card mb-8">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">All Tenants</h3>
          <Link
            to="/admin/tenants"
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            View all <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 font-medium text-slate-600">Organization</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Plan</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Clinics</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Users</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {tenants.slice(0, 10).map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3.5 font-medium text-slate-900">{t.name}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PLAN_COLORS[t.subscription_plan ?? ''] ?? "bg-gray-100 text-gray-600"}`}>
                      {t.subscription_plan}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right text-slate-700">{t.clinics_count ?? "—"}</td>
                  <td className="px-5 py-3.5 text-right text-slate-700">{t.users_count ?? "—"}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[t.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {t.status === "active" ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" /> {t.status}
                        </span>
                      ) : t.status === "suspended" ? (
                        <span className="flex items-center gap-1">
                          <XCircle className="h-3 w-3" /> {t.status}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {t.status}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link
                      to={`/admin/tenants`}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {tenants.length === 0 && (
            <div className="text-center py-12 text-sm text-slate-400">No tenants found.</div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="card p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Link to="/admin/tenants" className="btn-primary">New Tenant</Link>
          <Link to="/admin/clinics" className="btn-secondary">Add Clinic</Link>
          <Link to="/admin/users" className="btn-secondary">Manage Users</Link>
          <Link to="/analytics" className="btn-secondary">View Reports</Link>
        </div>
      </div>
    </div>
  );
}
