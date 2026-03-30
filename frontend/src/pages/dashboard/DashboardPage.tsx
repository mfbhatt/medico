import { useQuery } from '@tanstack/react-query';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import api from '@/services/api';
import { useAppSelector } from '@/store/hooks';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend,
);

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <div className="stat-card">
      <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAppSelector((s) => s.auth);

  const { data: stats } = useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: () => api.get('/analytics/dashboard').then((r) => r.data.data),
  });

  const { data: trend } = useQuery({
    queryKey: ['analytics', 'appointment-trend'],
    queryFn: () => api.get('/analytics/appointments/trend?days=14').then((r) => r.data.data),
  });

  const trendArr: { date: string; total: number }[] = Array.isArray(trend) ? trend : [];

  const appointmentChartData = {
    labels: trendArr.map((t) => t.date),
    datasets: [
      {
        label: 'Appointments',
        data: trendArr.map((t) => t.total),
        backgroundColor: 'rgba(14, 165, 233, 0.15)',
        borderColor: '#0ea5e9',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
      },
    ],
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Welcome back, {user?.full_name?.split(' ')[0]}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Today's Appointments"
          value={stats?.today?.total_appointments ?? '—'}
          color="bg-blue-50"
          icon={<svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
        />
        <StatCard
          label="Total Patients"
          value={stats?.patients?.total ?? '—'}
          color="bg-green-50"
          icon={<svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
        />
        <StatCard
          label="New Patients This Month"
          value={stats?.patients?.new_this_month ?? '—'}
          color="bg-amber-50"
          icon={<svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>}
        />
        <StatCard
          label="Monthly Revenue"
          value={stats?.revenue?.this_month != null
            ? new Intl.NumberFormat(undefined, { style: 'currency', currency: stats.revenue.currency ?? 'USD', maximumFractionDigits: 0 }).format(stats.revenue.this_month)
            : '—'}
          color="bg-purple-50"
          icon={<svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Appointment Trend (14 days)</h3>
          <Line
            data={appointmentChartData}
            options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }}
          />
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Today's Breakdown</h3>
          {stats ? (
            <div className="space-y-3">
              {[
                { label: 'Scheduled', value: stats.today?.scheduled ?? 0, color: 'bg-blue-100 text-blue-700' },
                { label: 'In Progress', value: stats.today?.in_progress ?? 0, color: 'bg-yellow-100 text-yellow-700' },
                { label: 'Completed', value: stats.today?.completed ?? 0, color: 'bg-green-100 text-green-700' },
                { label: 'No Shows', value: stats.today?.no_shows ?? 0, color: 'bg-red-100 text-red-700' },
                { label: 'Cancelled', value: stats.today?.cancelled ?? 0, color: 'bg-gray-100 text-gray-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{label}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${color}`}>{value}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">No-show rate (30d)</span>
                <span className="text-sm font-semibold text-gray-900">{stats.no_show_rate_30d ?? 0}%</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <a href="/appointments/new" className="btn-primary">New Appointment</a>
          <a href="/patients/new" className="btn-secondary">Register Patient</a>
          <a href="/lab" className="btn-secondary">Lab Orders</a>
          <a href="/billing" className="btn-secondary">Billing</a>
        </div>
      </div>
    </div>
  );
}
