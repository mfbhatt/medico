import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrency } from '@/hooks/useCurrency';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import api from '@/services/api';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler,
);

const PERIODS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

export default function AnalyticsPage() {
  const fmt = useCurrency();
  const [days, setDays] = useState('30');

  const { data: dashboard } = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: () => api.get('/analytics/dashboard').then((r) => r.data.data),
  });

  const { data: trend } = useQuery({
    queryKey: ['analytics-trend', days],
    queryFn: () =>
      api.get(`/analytics/appointments/trend?days=${days}`).then((r) => r.data.data),
  });

  const { data: revenue } = useQuery({
    queryKey: ['analytics-revenue', days],
    queryFn: () =>
      api.get(`/analytics/revenue/summary?months=6`).then((r) => r.data.data),
  });

  const { data: doctors } = useQuery({
    queryKey: ['analytics-doctors'],
    queryFn: () => api.get('/analytics/doctors/performance').then((r) => r.data.data),
  });

  const trendChart = {
    labels: trend?.labels ?? [],
    datasets: [
      {
        label: 'Appointments',
        data: trend?.values ?? [],
        borderColor: '#0ea5e9',
        backgroundColor: 'rgba(14,165,233,0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const revenueChart = {
    labels: revenue?.labels ?? [],
    datasets: [
      {
        label: 'Revenue ($)',
        data: revenue?.values ?? [],
        backgroundColor: '#8b5cf6',
        borderRadius: 4,
      },
    ],
  };

  const statusDoughnut = {
    labels: ['Completed', 'No Show', 'Cancelled', 'Scheduled'],
    datasets: [
      {
        data: [
          dashboard?.completed_count ?? 0,
          dashboard?.no_show_count ?? 0,
          dashboard?.cancelled_count ?? 0,
          dashboard?.scheduled_count ?? 0,
        ],
        backgroundColor: ['#10b981', '#ef4444', '#9ca3af', '#3b82f6'],
        borderWidth: 0,
      },
    ],
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Analytics</h1>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setDays(p.value)}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                days === p.value ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Appointments', value: dashboard?.total_appointments?.toLocaleString() ?? '—', color: 'text-blue-600' },
          { label: 'Total Revenue', value: dashboard?.total_revenue ? fmt(dashboard.total_revenue) : '—', color: 'text-purple-600' },
          { label: 'New Patients', value: dashboard?.new_patients?.toLocaleString() ?? '—', color: 'text-green-600' },
          { label: 'No-show Rate', value: dashboard?.no_show_rate ? `${dashboard.no_show_rate}%` : '—', color: 'text-red-600' },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-5 text-center">
            <p className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-sm text-gray-500 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Appointment Trend</h3>
          <Line data={trendChart} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />
        </div>
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Revenue</h3>
          <Bar data={revenueChart} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card p-5 flex flex-col items-center">
          <h3 className="font-semibold text-gray-900 mb-4 self-start">Appointment Status</h3>
          <div className="w-48 h-48">
            <Doughnut
              data={statusDoughnut}
              options={{ responsive: true, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } }}
            />
          </div>
        </div>

        <div className="card p-5 xl:col-span-2">
          <h3 className="font-semibold text-gray-900 mb-4">Doctor Performance</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left pb-2 font-medium text-gray-600">Doctor</th>
                <th className="text-right pb-2 font-medium text-gray-600">Appointments</th>
                <th className="text-right pb-2 font-medium text-gray-600">Completed</th>
                <th className="text-right pb-2 font-medium text-gray-600">Revenue</th>
                <th className="text-right pb-2 font-medium text-gray-600">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(doctors ?? []).map((d: {
                doctor_id: string;
                doctor_name: string;
                total_appointments: number;
                completed_appointments: number;
                total_revenue: number;
                average_rating: number;
              }) => (
                <tr key={d.doctor_id} className="hover:bg-gray-50">
                  <td className="py-2.5 font-medium text-gray-900">{d.doctor_name}</td>
                  <td className="py-2.5 text-right text-gray-600">{d.total_appointments}</td>
                  <td className="py-2.5 text-right text-green-600">{d.completed_appointments}</td>
                  <td className="py-2.5 text-right text-gray-900">{d.total_revenue != null ? fmt(d.total_revenue) : '—'}</td>
                  <td className="py-2.5 text-right">
                    <span className="text-yellow-500">★</span> {d.average_rating?.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
