import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '@/store';
import { addToast } from '@/store/slices/uiSlice';
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
  appointment_date: string;
  start_time: string;
  patient_name: string;
  doctor_name: string;
  appointment_type: string;
  status: string;
}

interface ConfirmDialog {
  type: 'cancel' | 'checkin';
  appt: Appointment;
}

export default function AppointmentsPage() {
  const { user } = useSelector((s: RootState) => s.auth);
  const dispatch = useDispatch<AppDispatch>();
  const isPatient = user?.role === 'patient';

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [confirm, setConfirm] = useState<ConfirmDialog | null>(null);
  const [cancelNote, setCancelNote] = useState('');
  const [rescheduleAppt, setRescheduleAppt] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const limit = 20;
  const qc = useQueryClient();

  const toast = {
    success: (message: string) => dispatch(addToast({ id: Date.now().toString(), type: 'success', message, duration: 3000 })),
    error: (message: string) => dispatch(addToast({ id: Date.now().toString(), type: 'error', message, duration: 5000 })),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', date, status, page],
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      setConfirm(null);
      toast.success('Patient checked in successfully');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Check-in failed');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/appointments/${id}/cancel`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      setConfirm(null);
      setCancelNote('');
      toast.success('Appointment cancelled');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Cancellation failed');
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({ id, appointment_date, start_time }: { id: string; appointment_date: string; start_time: string }) =>
      api.patch(`/appointments/${id}/reschedule`, { appointment_date, start_time }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      setRescheduleAppt(null);
      setRescheduleDate('');
      setRescheduleTime('');
      toast.success('Appointment rescheduled');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Reschedule failed');
    },
  });

  const canCheckIn = (s: string) => !isPatient && (s === 'scheduled' || s === 'confirmed');
  const canCancel = (s: string) => !['cancelled', 'completed', 'no_show'].includes(s);
  const canReschedule = (s: string) => !['cancelled', 'completed', 'no_show'].includes(s);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{isPatient ? 'My Appointments' : 'Appointments'}</h1>
        <Link to="/appointments/new" className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Book Appointment
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
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

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Time</th>
              {!isPatient && <th className="text-left px-4 py-3 font-medium text-gray-600">Patient</th>}
              <th className="text-left px-4 py-3 font-medium text-gray-600">Doctor</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={isPatient ? 6 : 7} className="text-center py-12 text-gray-400">Loading…</td>
              </tr>
            ) : appointments.length === 0 ? (
              <tr>
                <td colSpan={isPatient ? 6 : 7} className="text-center py-12 text-gray-400">
                  {isPatient ? 'No appointments found. Book your first appointment!' : 'No appointments found'}
                </td>
              </tr>
            ) : (
              appointments.map((appt) => (
                <tr key={appt.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-700">{appt.appointment_date ?? appt.scheduled_time?.slice(0, 10)}</td>
                  <td className="px-4 py-3 font-mono text-gray-700">{appt.start_time ?? appt.scheduled_time?.slice(11, 16)}</td>
                  {!isPatient && <td className="px-4 py-3 font-medium text-gray-900">{appt.patient_name}</td>}
                  <td className="px-4 py-3 text-gray-600">{appt.doctor_name}</td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{appt.appointment_type?.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3">
                    <span className={STATUS_COLORS[appt.status] ?? 'badge-gray'}>
                      {appt.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Link to={`/appointments/${appt.id}`} className="text-primary-600 hover:text-primary-800 text-sm font-medium">
                      View
                    </Link>
                    {canReschedule(appt.status) && (
                      <button
                        onClick={() => { setRescheduleAppt(appt); setRescheduleDate(appt.appointment_date ?? today); setRescheduleTime(appt.start_time ?? ''); }}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Reschedule
                      </button>
                    )}
                    {canCheckIn(appt.status) && (
                      <button
                        onClick={() => setConfirm({ type: 'checkin', appt })}
                        disabled={checkInMutation.isPending}
                        className="text-green-600 hover:text-green-800 text-sm font-medium"
                      >
                        Check In
                      </button>
                    )}
                    {canCancel(appt.status) && (
                      <button
                        onClick={() => { setCancelNote(''); setConfirm({ type: 'cancel', appt }); }}
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
              <button className="btn-secondary py-1 px-3" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <button className="btn-secondary py-1 px-3" disabled={(page + 1) * limit >= meta.total} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cancel / Check-In confirmation dialog */}
      {confirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                {confirm.type === 'cancel' ? 'Cancel Appointment' : 'Check In Patient'}
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                {confirm.type === 'cancel'
                  ? `Cancel the appointment for ${confirm.appt.patient_name}?`
                  : `Check in ${confirm.appt.patient_name}?`}
              </p>

              {confirm.type === 'cancel' && (
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
                  onClick={() => {
                    if (confirm.type === 'cancel') cancelMutation.mutate({ id: confirm.appt.id, reason: cancelNote });
                    else checkInMutation.mutate(confirm.appt.id);
                  }}
                  disabled={cancelMutation.isPending || checkInMutation.isPending}
                  className={`flex-1 font-medium py-2 px-4 rounded-lg text-sm transition ${
                    confirm.type === 'cancel'
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {cancelMutation.isPending || checkInMutation.isPending ? 'Processing…' : 'Confirm'}
                </button>
                <button onClick={() => { setConfirm(null); setCancelNote(''); }} className="flex-1 btn-secondary">
                  Go Back
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule dialog */}
      {rescheduleAppt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Reschedule Appointment</h2>
              <p className="text-sm text-gray-500 mb-4">
                Dr. {rescheduleAppt.doctor_name}
              </p>
              <div className="space-y-3 mb-5">
                <div>
                  <label className="label">New Date</label>
                  <input
                    type="date"
                    className="input"
                    min={today}
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">New Time</label>
                  <input
                    type="time"
                    className="input"
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => rescheduleMutation.mutate({ id: rescheduleAppt.id, appointment_date: rescheduleDate, start_time: rescheduleTime })}
                  disabled={rescheduleMutation.isPending || !rescheduleDate || !rescheduleTime}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2 px-4 rounded-lg text-sm transition"
                >
                  {rescheduleMutation.isPending ? 'Saving…' : 'Confirm Reschedule'}
                </button>
                <button onClick={() => setRescheduleAppt(null)} className="flex-1 btn-secondary">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
