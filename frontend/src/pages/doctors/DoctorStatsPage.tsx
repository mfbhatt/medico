import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Users, UserCheck, RefreshCw, Gift,
  Download, TrendingUp, DollarSign, Calendar,
} from 'lucide-react';
import api from '@/services/api';

interface StatsSummary {
  total_appointments: number;
  new_patients: number;
  revisits: number;
  free_consultations: number;
}

interface StatsGrouped {
  period: string;
  total: number;
  new_patients: number;
  revisits: number;
  free_consultations: number;
}

interface SettlementSummary {
  total_appointments: number;
  total_billed: number;
  total_paid: number;
  total_discount: number;
  total_outstanding: number;
}

interface SettlementRow {
  appointment_id: string;
  appointment_date: string;
  start_time: string;
  clinic_name: string;
  patient_name: string;
  visit_type: string;
  is_first_visit: boolean;
  invoice_number: string | null;
  invoice_status: string | null;
  total_amount: number;
  discount_amount: number;
  paid_amount: number;
  balance_due: number;
}

interface ClinicAssignment {
  clinic_id: string;
  clinic_name: string;
}

type TabKey = 'stats' | 'settlement';

const TODAY = new Date().toISOString().slice(0, 10);
const MONTH_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="card p-5">
      <div className={`inline-flex p-2.5 rounded-lg mb-3 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

export default function DoctorStatsPage() {
  const { id: doctorId } = useParams<{ id: string }>();
  const [tab, setTab] = useState<TabKey>('stats');
  const [clinicFilter, setClinicFilter] = useState('');
  const [dateFrom, setDateFrom] = useState(MONTH_AGO);
  const [dateTo, setDateTo] = useState(TODAY);
  const [groupBy, setGroupBy] = useState<'day' | 'month'>('day');

  const { data: doctorData } = useQuery({
    queryKey: ['doctor', doctorId],
    queryFn: () => api.get(`/doctors/${doctorId}`).then((r) => r.data.data),
  });

  const { data: clinicsData = [] } = useQuery({
    queryKey: ['doctor-clinics', doctorId],
    queryFn: () =>
      api.get(`/doctors/${doctorId}/clinics`).then((r) => r.data.data as ClinicAssignment[]),
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['doctor-stats', doctorId, clinicFilter, dateFrom, dateTo, groupBy],
    queryFn: () =>
      api.get(`/doctors/${doctorId}/stats`, {
        params: {
          clinic_id: clinicFilter || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          group_by: groupBy,
        },
      }).then((r) => r.data.data as { summary: StatsSummary; grouped: StatsGrouped[] }),
    enabled: tab === 'stats',
  });

  const { data: settlementData, isLoading: settlementLoading } = useQuery({
    queryKey: ['doctor-settlement', doctorId, clinicFilter, dateFrom, dateTo],
    queryFn: () =>
      api.get(`/doctors/${doctorId}/settlement`, {
        params: {
          clinic_id: clinicFilter || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        },
      }).then((r) => r.data.data as { summary: SettlementSummary; appointments: SettlementRow[] }),
    enabled: tab === 'settlement',
  });

  const summary = statsData?.summary;
  const grouped = statsData?.grouped ?? [];
  const settlement = settlementData;

  const handleExportCSV = () => {
    if (!settlement?.appointments.length) return;
    const headers = [
      'Date', 'Time', 'Patient', 'Clinic', 'Visit Type', 'First Visit',
      'Invoice #', 'Status', 'Billed', 'Discount', 'Paid', 'Outstanding',
    ];
    const rows = settlement.appointments.map((r) => [
      r.appointment_date,
      r.start_time,
      r.patient_name,
      r.clinic_name,
      r.visit_type,
      r.is_first_visit ? 'Yes' : 'No',
      r.invoice_number ?? '',
      r.invoice_status ?? '',
      r.total_amount.toFixed(2),
      r.discount_amount.toFixed(2),
      r.paid_amount.toFixed(2),
      r.balance_due.toFixed(2),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `settlement_${doctorData?.full_name?.replace(/ /g, '_') ?? doctorId}_${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusBadgeClass = (status: string | null) => {
    if (!status) return 'badge-gray';
    const map: Record<string, string> = {
      paid: 'badge-green',
      partially_paid: 'badge-blue',
      issued: 'badge-yellow',
      overdue: 'badge-red',
      draft: 'badge-gray',
    };
    return map[status] ?? 'badge-gray';
  };

  return (
    <div>
      <div className="mb-6">
        <Link to={`/doctors/${doctorId}/clinics`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="w-4 h-4" />
          Back to Clinic Assignments
        </Link>
      </div>

      <div className="page-header mb-6">
        <div>
          <h1 className="page-title">Doctor Analytics</h1>
          {doctorData && (
            <p className="text-sm text-slate-500 mt-0.5">
              Dr. {doctorData.full_name} · {doctorData.primary_specialization}
            </p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Clinic</label>
          <select className="input min-w-40" value={clinicFilter} onChange={(e) => setClinicFilter(e.target.value)}>
            <option value="">All Clinics</option>
            {clinicsData.map((c) => (
              <option key={c.clinic_id} value={c.clinic_id}>{c.clinic_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">From</label>
          <input type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        {tab === 'stats' && (
          <div>
            <label className="label">Group By</label>
            <select className="input" value={groupBy} onChange={(e) => setGroupBy(e.target.value as 'day' | 'month')}>
              <option value="day">Day</option>
              <option value="month">Month</option>
            </select>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {(['stats', 'settlement'] as TabKey[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'stats' ? 'Appointment Stats' : 'Settlement Report'}
          </button>
        ))}
      </div>

      {/* ── Stats Tab ──────────────────────────────────────── */}
      {tab === 'stats' && (
        <>
          {statsLoading ? (
            <div className="text-center py-16 text-slate-400">Loading stats…</div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <StatCard
                  icon={Calendar}
                  label="Total Appointments"
                  value={summary?.total_appointments ?? 0}
                  color="bg-blue-50 text-blue-600"
                />
                <StatCard
                  icon={Users}
                  label="New Patients"
                  value={summary?.new_patients ?? 0}
                  color="bg-green-50 text-green-600"
                />
                <StatCard
                  icon={RefreshCw}
                  label="Revisits"
                  value={summary?.revisits ?? 0}
                  color="bg-violet-50 text-violet-600"
                />
                <StatCard
                  icon={Gift}
                  label="Free Consultations"
                  value={summary?.free_consultations ?? 0}
                  color="bg-amber-50 text-amber-600"
                />
              </div>

              {/* Grouped breakdown table */}
              {grouped.length > 0 ? (
                <div className="card overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100">
                    <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Breakdown by {groupBy === 'day' ? 'Day' : 'Month'}
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium text-slate-600">{groupBy === 'day' ? 'Date' : 'Month'}</th>
                          <th className="text-right px-4 py-3 font-medium text-slate-600">Total</th>
                          <th className="text-right px-4 py-3 font-medium text-slate-600">New Patients</th>
                          <th className="text-right px-4 py-3 font-medium text-slate-600">Revisits</th>
                          <th className="text-right px-4 py-3 font-medium text-slate-600">Free</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {grouped.map((g) => (
                          <tr key={g.period} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-mono text-slate-700">{g.period}</td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-900">{g.total}</td>
                            <td className="px-4 py-3 text-right text-green-700">{g.new_patients}</td>
                            <td className="px-4 py-3 text-right text-violet-700">{g.revisits}</td>
                            <td className="px-4 py-3 text-right text-amber-700">{g.free_consultations}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  No completed appointments found for this period.
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Settlement Tab ─────────────────────────────────── */}
      {tab === 'settlement' && (
        <>
          {settlementLoading ? (
            <div className="text-center py-16 text-slate-400">Loading settlement data…</div>
          ) : (
            <>
              {/* Settlement summary cards */}
              {settlement && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <StatCard
                    icon={UserCheck}
                    label="Appointments"
                    value={settlement.summary.total_appointments}
                    color="bg-blue-50 text-blue-600"
                  />
                  <StatCard
                    icon={DollarSign}
                    label="Total Billed"
                    value={`$${settlement.summary.total_billed.toFixed(2)}`}
                    color="bg-slate-50 text-slate-600"
                  />
                  <StatCard
                    icon={DollarSign}
                    label="Total Collected"
                    value={`$${settlement.summary.total_paid.toFixed(2)}`}
                    color="bg-green-50 text-green-600"
                  />
                  <StatCard
                    icon={DollarSign}
                    label="Outstanding"
                    value={`$${settlement.summary.total_outstanding.toFixed(2)}`}
                    color={settlement.summary.total_outstanding > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'}
                  />
                </div>
              )}

              {settlement?.appointments.length ? (
                <div className="card overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="font-semibold text-slate-900">Appointment Breakdown</h2>
                    <button
                      onClick={handleExportCSV}
                      className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50"
                    >
                      <Download className="w-4 h-4" />
                      Export CSV
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                          <th className="text-left px-4 py-3 font-medium text-slate-600">Patient</th>
                          <th className="text-left px-4 py-3 font-medium text-slate-600">Clinic</th>
                          <th className="text-left px-4 py-3 font-medium text-slate-600">Visit</th>
                          <th className="text-left px-4 py-3 font-medium text-slate-600">Invoice</th>
                          <th className="text-right px-4 py-3 font-medium text-slate-600">Billed</th>
                          <th className="text-right px-4 py-3 font-medium text-slate-600">Discount</th>
                          <th className="text-right px-4 py-3 font-medium text-slate-600">Paid</th>
                          <th className="text-right px-4 py-3 font-medium text-slate-600">Due</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {settlement.appointments.map((row) => (
                          <tr key={row.appointment_id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                              <div className="font-mono text-xs">{row.appointment_date}</div>
                              <div className="text-xs text-slate-400">{row.start_time}</div>
                            </td>
                            <td className="px-4 py-3 text-slate-900">{row.patient_name}</td>
                            <td className="px-4 py-3 text-slate-600 text-xs">{row.clinic_name}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-0.5">
                                <span className="badge badge-gray text-xs capitalize">
                                  {row.visit_type.replace('_', ' ')}
                                </span>
                                {row.is_first_visit && (
                                  <span className="badge badge-green text-xs">First Visit</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {row.invoice_number ? (
                                <div>
                                  <p className="font-mono text-xs text-slate-700">{row.invoice_number}</p>
                                  <span className={`badge text-xs ${statusBadgeClass(row.invoice_status)}`}>
                                    {row.invoice_status?.replace('_', ' ')}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-900">${row.total_amount.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right text-amber-700">
                              {row.discount_amount > 0 ? `-$${row.discount_amount.toFixed(2)}` : '—'}
                            </td>
                            <td className="px-4 py-3 text-right text-green-700">${row.paid_amount.toFixed(2)}</td>
                            <td className={`px-4 py-3 text-right font-semibold ${row.balance_due > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                              ${row.balance_due.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                        <tr>
                          <td colSpan={5} className="px-4 py-3 font-semibold text-slate-700">Totals</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            ${settlement.summary.total_billed.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-amber-700">
                            {settlement.summary.total_discount > 0
                              ? `-$${settlement.summary.total_discount.toFixed(2)}`
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-green-700">
                            ${settlement.summary.total_paid.toFixed(2)}
                          </td>
                          <td className={`px-4 py-3 text-right font-semibold ${settlement.summary.total_outstanding > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                            ${settlement.summary.total_outstanding.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  No completed appointments found for this period.
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
