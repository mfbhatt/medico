import { useQuery } from '@tanstack/react-query';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, ArcElement,
  Title, Tooltip, Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import api from '@/services/api';
import { useCurrency } from '@/hooks/useCurrency';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { CHART_COLORS } from '../constants';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

// ─── Reports Tab ──────────────────────────────────────────────────────────────

export function ReportsTab({ clinicId }: { clinicId: string }) {
  const fmt = useCurrency();

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['pharmacy-analytics', clinicId],
    queryFn: () => api.get('/inventory/reports/analytics', { params: clinicId ? { clinic_id: clinicId } : {} }).then((r) => r.data.data),
    enabled: !!clinicId,
    refetchInterval: 60_000,
  });

  if (isLoading) return <div className="py-20 flex justify-center"><LoadingSpinner label="Loading analytics…" /></div>;
  if (!analytics) return null;

  const dailyLabels = analytics.daily_trend.map((d: any) => {
    const dt = new Date(d.date);
    return `${dt.getMonth() + 1}/${dt.getDate()}`;
  });
  const dailyRevenue = analytics.daily_trend.map((d: any) => d.revenue);

  const paymentLabels = analytics.payment_breakdown.map((p: any) => p.method);
  const paymentRevenue = analytics.payment_breakdown.map((p: any) => p.revenue);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Today's Revenue", value: fmt(analytics.today.revenue), sub: `${analytics.today.count} sales` },
          { label: 'This Week', value: fmt(analytics.this_week.revenue), sub: `${analytics.this_week.count} sales` },
          { label: 'This Month', value: fmt(analytics.this_month.revenue), sub: `${analytics.this_month.count} sales` },
          { label: 'Stock (Retail)', value: fmt(analytics.stock_retail_value), sub: `${analytics.total_drugs} drugs · ${analytics.low_stock_count} low` },
        ].map((card) => (
          <div key={card.label} className="card p-5">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily revenue bar chart */}
        <div className="lg:col-span-2 card p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Daily Revenue (Last 30 Days)</h3>
          {dailyRevenue.length === 0 ? (
            <p className="text-center text-gray-400 py-12">No sales data yet</p>
          ) : (
            <Bar
              data={{
                labels: dailyLabels,
                datasets: [{
                  label: 'Revenue',
                  data: dailyRevenue,
                  backgroundColor: '#6366f1cc',
                  borderColor: '#6366f1',
                  borderWidth: 1,
                  borderRadius: 4,
                }],
              }}
              options={{
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                  y: { beginAtZero: true, ticks: { callback: (v) => fmt(Number(v)) } },
                  x: { ticks: { maxRotation: 45, font: { size: 10 } } },
                },
              }}
            />
          )}
        </div>

        {/* Payment method doughnut */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Payment Methods (This Month)</h3>
          {paymentRevenue.length === 0 ? (
            <p className="text-center text-gray-400 py-12">No data</p>
          ) : (
            <>
              <Doughnut
                data={{
                  labels: paymentLabels.map((l: string) => l.charAt(0).toUpperCase() + l.slice(1)),
                  datasets: [{
                    data: paymentRevenue,
                    backgroundColor: CHART_COLORS.slice(0, paymentRevenue.length),
                    borderWidth: 2,
                    borderColor: '#fff',
                  }],
                }}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { position: 'bottom', labels: { font: { size: 11 } } },
                    tooltip: { callbacks: { label: (ctx) => ` ${fmt(ctx.raw as number)}` } },
                  },
                }}
              />
              <div className="mt-3 space-y-1">
                {analytics.payment_breakdown.map((p: any, i: number) => (
                  <div key={p.method} className="flex justify-between text-xs text-gray-600">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: CHART_COLORS[i] }} />
                      {p.method.charAt(0).toUpperCase() + p.method.slice(1)}
                    </span>
                    <span>{fmt(p.revenue)} ({p.count})</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Top drugs */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-800">Top 10 Drugs by Revenue</h3>
        </div>
        {analytics.top_drugs.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No sales data yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">#</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Drug</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-600">Qty Sold</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-600">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {analytics.top_drugs.map((drug: any, i: number) => (
                <tr key={drug.drug_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-400 font-medium">{i + 1}</td>
                  <td className="px-4 py-2.5 text-gray-900 font-medium">{drug.drug_name}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{drug.qty_sold.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{fmt(drug.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
