import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useAppSelector } from '@/store/hooks';
import { RootState } from '@/store';
import { getModulesForUser, type AppModule } from '@/modules/registry';
import api from '@/services/api';
import { useCurrency } from '@/hooks/useCurrency';
import {
  Calendar, Users, TrendingDown, CheckCircle, Clock,
  Package, FlaskConical, AlertTriangle, ChevronRight,
  DollarSign,
} from 'lucide-react';
import QuickNavBar from '@/components/dashboard/QuickNavBar';

// ─── KPI types ────────────────────────────────────────────────────────────────

interface KPI {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconBg: string;
  sub?: string;
}

// ─── Role-specific KPI extraction ─────────────────────────────────────────────

function buildKPIs(role: string, stats: any, fmt: (n: number) => string): KPI[] {
  if (!stats) return [];
  const t = stats.today ?? {};
  const p = stats.patients ?? {};
  const r = stats.revenue ?? {};

  switch (role) {
    case 'tenant_admin':
    case 'clinic_admin':
      return [
        {
          label: "Today's Appointments",
          value: t.total_appointments ?? '—',
          icon: Calendar,
          iconBg: 'bg-blue-100 text-blue-600',
          sub: `${t.scheduled ?? 0} scheduled · ${t.completed ?? 0} done`,
        },
        {
          label: 'Total Patients',
          value: (p.total ?? '—').toLocaleString?.() ?? p.total ?? '—',
          icon: Users,
          iconBg: 'bg-emerald-100 text-emerald-600',
          sub: `+${p.new_this_month ?? 0} this month`,
        },
        {
          label: 'Revenue (Month)',
          value: r.this_month != null ? fmt(r.this_month) : '—',
          icon: DollarSign,
          iconBg: 'bg-purple-100 text-purple-600',
        },
        {
          label: 'No-show Rate (30d)',
          value: `${stats.no_show_rate_30d ?? 0}%`,
          icon: TrendingDown,
          iconBg: 'bg-red-100 text-red-600',
        },
      ];

    case 'doctor':
      return [
        {
          label: "My Appointments Today",
          value: t.total_appointments ?? '—',
          icon: Calendar,
          iconBg: 'bg-blue-100 text-blue-600',
        },
        {
          label: 'Completed',
          value: t.completed ?? '—',
          icon: CheckCircle,
          iconBg: 'bg-green-100 text-green-600',
        },
        {
          label: 'In Progress',
          value: t.in_progress ?? '—',
          icon: Clock,
          iconBg: 'bg-amber-100 text-amber-600',
        },
        {
          label: 'New Patients (Month)',
          value: p.new_this_month ?? '—',
          icon: Users,
          iconBg: 'bg-violet-100 text-violet-600',
        },
      ];

    case 'nurse':
    case 'receptionist':
      return [
        {
          label: 'Appointments Today',
          value: t.total_appointments ?? '—',
          icon: Calendar,
          iconBg: 'bg-blue-100 text-blue-600',
        },
        {
          label: 'Scheduled',
          value: t.scheduled ?? '—',
          icon: Clock,
          iconBg: 'bg-amber-100 text-amber-600',
        },
        {
          label: 'Completed',
          value: t.completed ?? '—',
          icon: CheckCircle,
          iconBg: 'bg-green-100 text-green-600',
        },
        {
          label: 'No-shows',
          value: t.no_shows ?? '—',
          icon: TrendingDown,
          iconBg: 'bg-red-100 text-red-600',
        },
      ];

    default:
      return [];
  }
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ kpi }: { kpi: KPI }) {
  const Icon = kpi.icon;
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${kpi.iconBg}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500">{kpi.label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{kpi.value}</p>
        {kpi.sub && <p className="text-xs text-gray-400 mt-0.5">{kpi.sub}</p>}
      </div>
    </div>
  );
}

// ─── Module Tile ──────────────────────────────────────────────────────────────

function ModuleTile({ module, onClick }: { module: AppModule; onClick: () => void }) {
  const Icon = module.icon;
  return (
    <button
      onClick={onClick}
      className="card group p-6 flex flex-col gap-4 text-left hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer w-full"
    >
      <div
        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${module.gradient} flex items-center justify-center flex-shrink-0`}
      >
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm group-hover:text-primary-600 transition-colors">
          {module.name}
        </p>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{module.description}</p>
      </div>
      <div className="flex items-center gap-1 text-xs text-primary-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
        Open <ChevronRight className="w-3.5 h-3.5" />
      </div>
    </button>
  );
}

// ─── HomePage ────────────────────────────────────────────────────────────────

// Roles that can fetch /analytics/dashboard
const ANALYTICS_ROLES = ['tenant_admin', 'clinic_admin', 'doctor', 'nurse', 'receptionist'];

export default function HomePage() {
  const { user } = useAppSelector((s) => s.auth);
  const { features: tenantFeatures, userFeatures } = useSelector((s: RootState) => s.tenant);
  const navigate = useNavigate();
  const fmt = useCurrency();

  const role: string = user?.role ?? '';
  const firstName = user?.full_name?.split(' ')[0] ?? 'there';

  const modules = getModulesForUser(role, tenantFeatures ?? {}, userFeatures ?? {});

  // General analytics — available to clinical + admin staff
  const { data: stats } = useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: () => api.get('/analytics/dashboard').then((r) => r.data.data),
    enabled: ANALYTICS_ROLES.includes(role),
    staleTime: 60_000,
    retry: false,
  });

  // Pharmacist-specific: stock alert counts
  const { data: alertCounts } = useQuery({
    queryKey: ['pharmacy-alerts-summary'],
    queryFn: () =>
      api.get('/inventory/stock-alerts').then((r) => {
        const alerts: any[] = r.data.data ?? [];
        return {
          low: alerts.filter((a) => a.type === 'low_stock' || a.is_low_stock).length,
          expired: alerts.filter((a) => a.type === 'expired' || a.expired_qty > 0).length,
        };
      }),
    enabled: role === 'pharmacist',
    staleTime: 60_000,
    retry: false,
  });

  // Lab technician-specific: pending order count
  const { data: pendingLabCount } = useQuery({
    queryKey: ['lab-pending-count'],
    queryFn: () =>
      api
        .get('/lab/orders', { params: { status: 'pending', page_size: 1 } })
        .then((r) => r.data.meta?.total ?? r.data.total ?? 0),
    enabled: role === 'lab_technician',
    staleTime: 60_000,
    retry: false,
  });

  // Build KPI list for the current role
  const kpis: KPI[] = (() => {
    if (role === 'pharmacist') {
      return [
        {
          label: 'Low Stock Alerts',
          value: alertCounts?.low ?? '—',
          icon: AlertTriangle,
          iconBg: 'bg-amber-100 text-amber-600',
        },
        {
          label: 'Expired Items',
          value: alertCounts?.expired ?? '—',
          icon: Package,
          iconBg: 'bg-red-100 text-red-600',
        },
      ];
    }
    if (role === 'lab_technician') {
      return [
        {
          label: 'Pending Lab Orders',
          value: pendingLabCount ?? '—',
          icon: FlaskConical,
          iconBg: 'bg-cyan-100 text-cyan-600',
        },
      ];
    }
    return buildKPIs(role, stats, fmt);
  })();

  return (
    <div className="max-w-screen-xl">
      {/* ── Welcome header ──────────────────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {firstName}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* ── Quick nav ───────────────────────────────────────────────────────── */}
      <QuickNavBar />

      {/* ── KPI row ─────────────────────────────────────────────────────────── */}
      {kpis.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
          {kpis.map((kpi) => (
            <KPICard key={kpi.label} kpi={kpi} />
          ))}
        </div>
      )}

      {/* ── Module tiles ────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">
          Your Modules
        </h2>

        {modules.length === 0 ? (
          <div className="card p-10 text-center text-gray-400 text-sm">
            No modules are currently available for your account.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {modules.map((mod) => (
              <ModuleTile
                key={mod.id}
                module={mod}
                onClick={() => navigate(mod.defaultPath)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
