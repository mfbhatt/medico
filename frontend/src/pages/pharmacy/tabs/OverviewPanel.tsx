import { useQuery } from '@tanstack/react-query';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, ArcElement,
  Title, Tooltip, Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  ShoppingCart, BarChart2, TrendingUp, AlertTriangle,
  DollarSign, Boxes, ShieldAlert, CheckCircle,
} from 'lucide-react';
import api from '@/services/api';
import { useCurrency } from '@/hooks/useCurrency';
import type { Tab, SaleRecord } from '../types';
import { OVERVIEW_COLORS } from '../constants';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

// ─── Overview Panel ───────────────────────────────────────────────────────────

export function OverviewPanel({ clinicId, onNavigate }: { clinicId: string; onNavigate: (tab: Tab) => void }) {
  const fmt = useCurrency();

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['pharmacy-analytics', clinicId],
    queryFn: () =>
      api.get('/inventory/reports/analytics', { params: clinicId ? { clinic_id: clinicId } : {} })
        .then((r) => r.data.data),
    enabled: !!clinicId,
    staleTime: 60_000,
  });

  const { data: recentSalesData } = useQuery({
    queryKey: ['pharmacy-sales-recent', clinicId],
    queryFn: () =>
      api.get('/inventory/sales', { params: { page: 1, page_size: 6, ...(clinicId ? { clinic_id: clinicId } : {}) } })
        .then((r) => r.data),
    enabled: !!clinicId,
    staleTime: 30_000,
  });
  const recentSales: SaleRecord[] = recentSalesData?.data ?? [];

  const { data: alertsData } = useQuery({
    queryKey: ['pharmacy-alerts', clinicId],
    queryFn: () =>
      api.get('/inventory/stock-alerts', { params: clinicId ? { clinic_id: clinicId } : {} })
        .then((r) => r.data.data ?? []),
    enabled: !!clinicId,
    staleTime: 60_000,
  });
  const alerts: any[] = alertsData ?? [];

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card h-28 bg-gray-100 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card h-64 bg-gray-100 rounded-xl" />
          <div className="card h-64 bg-gray-100 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card h-72 bg-gray-100 rounded-xl" />
          <div className="card h-72 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  const last7 = (analytics?.daily_trend ?? []).slice(-7);
  const trendLabels = last7.map((d: any) => {
    const dt = new Date(d.date);
    return dt.toLocaleDateString('en', { weekday: 'short', day: 'numeric' });
  });
  const trendRevenue = last7.map((d: any) => d.revenue);

  const paymentLabels = (analytics?.payment_breakdown ?? []).map((p: any) =>
    p.method.charAt(0).toUpperCase() + p.method.slice(1)
  );
  const paymentRevenue = (analytics?.payment_breakdown ?? []).map((p: any) => p.revenue);
  const topDrugs: any[] = (analytics?.top_drugs ?? []).slice(0, 5);
  const maxDrugRevenue = topDrugs[0]?.revenue ?? 1;

  const lowStock = analytics?.low_stock_count ?? 0;
  const kpis = [
    {
      label: "Today's Revenue",
      value: fmt(analytics?.today?.revenue ?? 0),
      sub: `${analytics?.today?.count ?? 0} sales today`,
      Icon: DollarSign,
      gradientFrom: '#6366f1', gradientTo: '#818cf8',
    },
    {
      label: 'This Week',
      value: fmt(analytics?.this_week?.revenue ?? 0),
      sub: `${analytics?.this_week?.count ?? 0} transactions`,
      Icon: TrendingUp,
      gradientFrom: '#8b5cf6', gradientTo: '#a78bfa',
    },
    {
      label: 'This Month',
      value: fmt(analytics?.this_month?.revenue ?? 0),
      sub: `${analytics?.this_month?.count ?? 0} transactions`,
      Icon: BarChart2,
      gradientFrom: '#0ea5e9', gradientTo: '#38bdf8',
    },
    {
      label: 'Stock Value',
      value: fmt(analytics?.stock_retail_value ?? 0),
      sub: `${analytics?.total_drugs ?? 0} drugs`,
      Icon: Boxes,
      gradientFrom: '#10b981', gradientTo: '#34d399',
    },
    {
      label: 'Low Stock',
      value: String(lowStock),
      sub: lowStock > 0 ? 'Needs reorder' : 'All sufficient',
      Icon: AlertTriangle,
      gradientFrom: lowStock > 0 ? '#f59e0b' : '#10b981',
      gradientTo: lowStock > 0 ? '#fbbf24' : '#34d399',
      onClick: () => onNavigate('alerts'),
    },
    {
      label: 'Active Alerts',
      value: String(alerts.length),
      sub: alerts.length > 0 ? 'Needs attention' : 'No issues',
      Icon: ShieldAlert,
      gradientFrom: alerts.length > 0 ? '#ef4444' : '#10b981',
      gradientTo: alerts.length > 0 ? '#f87171' : '#34d399',
      onClick: () => onNavigate('alerts'),
    },
  ];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-6">

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            onClick={kpi.onClick}
            className={`card p-4 flex flex-col gap-3 group ${
              kpi.onClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200' : ''
            }`}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
              style={{ background: `linear-gradient(135deg, ${kpi.gradientFrom}, ${kpi.gradientTo})` }}
            >
              <kpi.Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">{kpi.label}</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5 leading-tight">{kpi.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{kpi.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue trend */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold text-gray-800">Revenue Trend</h3>
              <p className="text-xs text-gray-400 mt-0.5">Last 7 days performance</p>
            </div>
            <button onClick={() => onNavigate('reports')} className="text-xs font-medium text-primary-600 hover:text-primary-800 border border-primary-200 hover:border-primary-300 px-2.5 py-1 rounded-lg transition-colors">
              Full report →
            </button>
          </div>
          {trendRevenue.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-300 gap-2">
              <BarChart2 className="w-12 h-12 opacity-30" />
              <p className="text-sm text-gray-400">No sales data yet</p>
            </div>
          ) : (
            <Bar
              data={{
                labels: trendLabels,
                datasets: [{
                  label: 'Revenue',
                  data: trendRevenue,
                  backgroundColor: trendRevenue.map((_: number, i: number) =>
                    i === trendRevenue.length - 1 ? 'rgba(99,102,241,0.9)' : 'rgba(99,102,241,0.25)'
                  ),
                  borderColor: '#6366f1',
                  borderWidth: 1.5,
                  borderRadius: 8,
                  borderSkipped: false,
                  hoverBackgroundColor: 'rgba(99,102,241,0.85)',
                }],
              }}
              options={{
                responsive: true,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    backgroundColor: '#1e293b',
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: { label: (ctx) => `  Revenue: ${fmt(ctx.raw as number)}` },
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.04)' },
                    border: { display: false },
                    ticks: { callback: (v) => fmt(Number(v)), font: { size: 11 }, color: '#9ca3af' },
                  },
                  x: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: { font: { size: 11 }, color: '#9ca3af' },
                  },
                },
              }}
            />
          )}
        </div>

        {/* Payment methods */}
        <div className="card p-5">
          <div className="mb-5">
            <h3 className="font-semibold text-gray-800">Payment Methods</h3>
            <p className="text-xs text-gray-400 mt-0.5">This month's breakdown</p>
          </div>
          {paymentRevenue.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-36 gap-2 text-gray-300">
              <p className="text-sm text-gray-400">No payment data</p>
            </div>
          ) : (
            <>
              <div className="relative mb-4">
                <Doughnut
                  data={{
                    labels: paymentLabels,
                    datasets: [{
                      data: paymentRevenue,
                      backgroundColor: OVERVIEW_COLORS.slice(0, paymentRevenue.length),
                      borderWidth: 3,
                      borderColor: '#fff',
                      hoverBorderColor: '#fff',
                      hoverOffset: 6,
                    }],
                  }}
                  options={{
                    responsive: true,
                    cutout: '68%',
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        backgroundColor: '#1e293b',
                        padding: 10,
                        cornerRadius: 8,
                        callbacks: { label: (ctx) => `  ${fmt(ctx.raw as number)}` },
                      },
                    },
                  }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-lg font-bold text-gray-800">{fmt(paymentRevenue.reduce((a: number, b: number) => a + b, 0))}</p>
                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Total</p>
                </div>
              </div>
              <div className="space-y-2 mt-2">
                {(analytics?.payment_breakdown ?? []).map((p: any, i: number) => (
                  <div key={p.method} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: OVERVIEW_COLORS[i] }} />
                      <span className="capitalize font-medium">{p.method}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{p.count} sales</span>
                      <span className="text-xs font-semibold text-gray-800">{fmt(p.revenue)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent sales */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h3 className="font-semibold text-gray-800">Recent Sales</h3>
              <p className="text-xs text-gray-400 mt-0.5">Latest transactions</p>
            </div>
            <button onClick={() => onNavigate('sales')} className="text-xs font-medium text-primary-600 hover:text-primary-800 border border-primary-200 hover:border-primary-300 px-2.5 py-1 rounded-lg transition-colors">
              View all →
            </button>
          </div>
          {recentSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-2">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-gray-300" />
              </div>
              <p className="text-sm text-gray-400">No sales recorded yet</p>
            </div>
          ) : (
            <div>
              {recentSales.map((sale, idx) => (
                <div
                  key={sale.id}
                  className={`flex items-center px-5 py-3.5 gap-4 hover:bg-gray-50 transition-colors ${idx !== recentSales.length - 1 ? 'border-b border-gray-50' : ''}`}
                >
                  <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center shrink-0">
                    <ShoppingCart className="w-3.5 h-3.5 text-primary-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-800">{sale.sale_number}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        sale.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : sale.status === 'voided'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-amber-100 text-amber-700'
                      }`}>{sale.status}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {sale.patient_name || 'Walk-in'} · {sale.item_count} item{sale.item_count !== 1 ? 's' : ''} · <span className="capitalize">{sale.payment_method}</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-900">{fmt(sale.total_amount)}</p>
                    <p className="text-xs text-gray-400">{new Date(sale.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Top drugs */}
          {topDrugs.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-800">Top Drugs</h3>
                  <p className="text-xs text-gray-400 mt-0.5">By revenue this month</p>
                </div>
                <button onClick={() => onNavigate('reports')} className="text-xs text-primary-600 hover:text-primary-800 font-medium">Reports →</button>
              </div>
              <div className="space-y-3">
                {topDrugs.map((drug: any, i: number) => (
                  <div key={drug.drug_id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-gray-700 truncate flex-1 mr-2 flex items-center gap-1.5">
                        <span
                          className="w-4 h-4 rounded text-white text-[9px] font-bold flex items-center justify-center shrink-0"
                          style={{ background: OVERVIEW_COLORS[i] }}
                        >
                          {i + 1}
                        </span>
                        {drug.drug_name}
                      </span>
                      <span className="text-xs font-bold text-gray-900 shrink-0">{fmt(drug.revenue)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(drug.revenue / maxDrugRevenue) * 100}%`,
                          background: `linear-gradient(90deg, ${OVERVIEW_COLORS[i]}99, ${OVERVIEW_COLORS[i]})`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stock alerts */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-800">Stock Alerts</h3>
                <p className="text-xs text-gray-400 mt-0.5">Issues requiring action</p>
              </div>
              {alerts.length > 0 && (
                <button onClick={() => onNavigate('alerts')} className="text-xs text-primary-600 hover:text-primary-800 font-medium">
                  View all →
                </button>
              )}
            </div>
            {alerts.length === 0 ? (
              <div className="flex items-center gap-2.5 bg-emerald-50 rounded-lg px-3 py-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-sm text-emerald-700 font-medium">All stock levels OK</span>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.slice(0, 5).map((alert: any) => {
                  const critical = alert.expired_qty > 0;
                  return (
                    <div
                      key={alert.drug_id}
                      className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${
                        critical
                          ? 'bg-red-50 border-red-100'
                          : 'bg-amber-50 border-amber-100'
                      }`}
                    >
                      <div className={`w-1.5 h-full rounded-full shrink-0 self-stretch mt-0.5 min-h-[32px] ${critical ? 'bg-red-400' : 'bg-amber-400'}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{alert.drug_name}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {[
                            critical && `${alert.expired_qty} units expired`,
                            alert.is_low_stock && `${alert.current_stock ?? 0} units left`,
                            alert.expiring_soon_qty > 0 && `${alert.expiring_soon_qty} expiring soon`,
                          ].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {alerts.length > 5 && (
                  <button
                    onClick={() => onNavigate('alerts')}
                    className="w-full text-center text-xs text-primary-600 hover:text-primary-800 font-medium py-1.5 hover:bg-primary-50 rounded-lg transition-colors"
                  >
                    +{alerts.length - 5} more alerts →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
