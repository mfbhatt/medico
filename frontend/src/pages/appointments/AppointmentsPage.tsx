import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'badge-blue',
  confirmed: 'badge-blue',
  checked_in: 'badge-yellow',
  in_progress: 'badge-yellow',
  completed: 'badge-green',
  cancelled: 'badge-gray',
  no_show: 'badge-red',
};

interface Appointment {
  id: string;
  scheduled_time: string;
  patient_name: string;
  doctor_name: string;
  appointment_type: string;
  status: string;
}

interface ConfirmDialog {
  title: string;
  message: string;
  onConfirm: () => void;
}

export default function AppointmentsPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [confirm, setConfirm] = useState<ConfirmDialog | null>(null);
  const [cancelNote, setCancelNote] = useState('');
  const limit = 20;
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', date, search, status, page],
    queryFn: () =>
      api
        .get('/appointments/', {
          params: { date_from: date, date_to: date, status: status || undefined, page: page + 1, page_size: limit },
        })
        .then((r) => r.data),
  });

  const appointments: Appointment[] = data?.data ?? [];
  const meta = data?.meta ?? {};

  const checkInMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/appointments/${id}/check-in`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments'] }),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/appointments/${id}/cancel`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      setConfirm(null);
      setCancelNote('');
    },
  });

  const handleCheckIn = (appt: Appointment) => {
    setConfirm({
      title: 'Check In Patient',
      message: `Check in ${appt.patient_name}?`,
      onConfirm: () => {
        checkInMutation.mutate(appt.id);
        setConfirm(null);
      },
    });
  };

  const handleCancel = (appt: Appointment) => {
    setCancelNote('');
    setConfirm({
      title: 'Cancel Appointment',
      message: `Cancel the appointment for ${appt.patient_name}?`,
      onConfirm: () => {
        cancelMutation.mutate({ id: appt.id, reason: cancelNote });
      },
    });
  };

  const canCheckIn = (s: string) => s === 'scheduled' || s === 'confirmed';
  const canCancel = (s: string) => !['cancelled', 'completed', 'no_show'].includes(s);
  const isCancelDialog = confirm?.title === 'Cancel Appointment';

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Appointments</h1>
        <Link to="/appointments/new" className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Appointment
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex-1 min-w-48">
          <label className="label">Search</label>
          <input
            type="text"
            className="input"
            placeholder="Patient name, MRN…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
            <option value="">All</option>
            <option value="scheduled">Scheduled</option>
            <option value="confirmed">Confirmed</option>
            <option value="checked_in">Checked In</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
          </select>
        </div>
      </div>

      {/* Error banners */}
      {checkInMutation.isError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
          {(checkInMutation.error as any)?.response?.data?.detail ?? 'Check-in failed'}
        </div>
      )}
      {cancelMutation.isError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
          {(cancelMutation.error as any)?.response?.data?.detail ?? 'Cancellation failed'}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Time</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Patient</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Doctor</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-400">Loading…</td>
              </tr>
            ) : appointments.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-400">No appointments found</td>
              </tr>
            ) : (
              appointments.map((appt) => (
                <tr key={appt.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-gray-700">{appt.scheduled_time}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{appt.patient_name}</td>
                  <td className="px-4 py-3 text-gray-600">{appt.doctor_name}</td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{appt.appointment_type}</td>
                  <td className="px-4 py-3">
                    <span className={STATUS_COLORS[appt.status] ?? 'badge-gray'}>
                      {appt.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Link
                      to={`/appointments/${appt.id}`}
                      className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                    >
                      View
                    </Link>
                    {canCheckIn(appt.status) && (
                      <button
                        onClick={() => handleCheckIn(appt)}
                        disabled={checkInMutation.isPending}
                        className="text-green-600 hover:text-green-800 text-sm font-medium"
                      >
                        Check In
                      </button>
                    )}
                    {canCancel(appt.status) && (
                      <button
                        onClick={() => handleCancel(appt)}
                        className="text-red-500 hover:text-red-700 text-sm font-medium"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {meta.total > limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 text-sm text-gray-600">
            <span>
              Showing {page * limit + 1}–{Math.min((page + 1) * limit, meta.total)} of {meta.total}
            </span>
            <div className="flex gap-2">
              <button
                className="btn-secondary py-1 px-3"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <button
                className="btn-secondary py-1 px-3"
                disabled={(page + 1) * limit >= meta.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation dialog */}
      {confirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">{confirm.title}</h2>
              <p className="text-sm text-gray-600 mb-4">{confirm.message}</p>

              {isCancelDialog && (
                <div className="mb-4">
                  <label className="label">Cancellation Reason</label>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="Optional reason for cancellation"
                    value={cancelNote}
                    onChange={(e) => setCancelNote(e.target.value)}
                  />
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={confirm.onConfirm}
                  disabled={cancelMutation.isPending || checkInMutation.isPending}
                  className={`flex-1 font-medium py-2 px-4 rounded-lg text-sm transition ${
                    isCancelDialog
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {cancelMutation.isPending || checkInMutation.isPending ? 'Processing…' : 'Confirm'}
                </button>
                <button
                  onClick={() => { setConfirm(null); setCancelNote(''); }}
                  className="flex-1 btn-secondary"
                >
                  Go Back
                </button>
              </div>

              {(cancelMutation.isError) && (
                <p className="mt-2 text-xs text-red-600">
                  {(cancelMutation.error as any)?.response?.data?.detail ?? 'Action failed'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
