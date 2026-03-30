import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, X, Building2, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import api from '@/services/api';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';

interface ClinicAssignment {
  id: string;
  clinic_id: string;
  clinic_name: string;
  is_primary_clinic: boolean;
  consultation_fee_override: number | null;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
}

interface Clinic {
  id: string;
  name: string;
  city: string;
}

export default function DoctorClinicsPage() {
  const { id: doctorId } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const role = useSelector((s: RootState) => s.auth.user?.role);
  const isSuperAdmin = role === 'super_admin';

  const [addOpen, setAddOpen] = useState(false);
  const [addClinicId, setAddClinicId] = useState('');
  const [addFeeOverride, setAddFeeOverride] = useState('');
  const [addIsPrimary, setAddIsPrimary] = useState(false);
  const [addStartDate, setAddStartDate] = useState('');
  const [addError, setAddError] = useState('');

  // Load doctor info
  const { data: doctorData } = useQuery({
    queryKey: ['doctor', doctorId],
    queryFn: () => api.get(`/doctors/${doctorId}`).then((r) => r.data.data),
  });

  // Load clinic assignments
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['doctor-clinics', doctorId],
    queryFn: () => api.get(`/doctors/${doctorId}/clinics`).then((r) => r.data.data as ClinicAssignment[]),
  });

  // Load all available clinics (for add dropdown)
  const { data: allClinics = [] } = useQuery({
    queryKey: ['clinics-all'],
    queryFn: () => api.get('/clinics/', { params: { page_size: 200 } }).then((r) => r.data.data as Clinic[]),
    enabled: addOpen,
  });

  const assignedClinicIds = new Set(assignments.map((a) => a.clinic_id));
  const availableClinics = allClinics.filter((c) => !assignedClinicIds.has(c.id));

  const addMutation = useMutation({
    mutationFn: () =>
      api.post(`/doctors/${doctorId}/clinics`, {
        clinic_id: addClinicId,
        is_primary_clinic: addIsPrimary,
        consultation_fee_override: addFeeOverride ? Number(addFeeOverride) : undefined,
        start_date: addStartDate || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctor-clinics', doctorId] });
      qc.invalidateQueries({ queryKey: ['doctors'] });
      setAddOpen(false);
      setAddClinicId('');
      setAddFeeOverride('');
      setAddIsPrimary(false);
      setAddStartDate('');
      setAddError('');
    },
    onError: (err: any) => setAddError(err.response?.data?.message ?? 'Failed to assign clinic'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ clinicId, isActive }: { clinicId: string; isActive: boolean }) =>
      api.patch(`/doctors/${doctorId}/clinics/${clinicId}`, { is_active: isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctor-clinics', doctorId] }),
  });

  const removeMutation = useMutation({
    mutationFn: (clinicId: string) => api.delete(`/doctors/${doctorId}/clinics/${clinicId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctor-clinics', doctorId] }),
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addClinicId) { setAddError('Please select a clinic'); return; }
    setAddError('');
    addMutation.mutate();
  };

  const canManage = isSuperAdmin || role === 'tenant_admin' || role === 'clinic_admin';

  return (
    <div>
      <div className="mb-6">
        <Link to="/doctors" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="w-4 h-4" />
          Back to Doctors
        </Link>
      </div>

      <div className="page-header">
        <div>
          <h1 className="page-title">Clinic Assignments</h1>
          {doctorData && (
            <p className="text-sm text-slate-500 mt-0.5">
              Dr. {doctorData.full_name} · {doctorData.primary_specialization}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link to={`/doctors/${doctorId}/stats`} className="btn-secondary text-sm">
            View Stats & Settlement
          </Link>
          {canManage && (
            <button onClick={() => setAddOpen(true)} className="btn-primary text-sm">
              <Plus className="w-4 h-4 mr-1 inline-block" />
              Assign to Clinic
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-slate-400">Loading…</div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No clinic assignments yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assignments.map((a) => (
            <div key={a.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{a.clinic_name}</h3>
                    {a.is_primary_clinic && (
                      <span className="badge badge-blue text-xs">Primary</span>
                    )}
                  </div>
                  <span className={`badge mt-1 ${a.is_active ? 'badge-green' : 'badge-gray'}`}>
                    {a.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <button
                      title={a.is_active ? 'Disable' : 'Enable'}
                      onClick={() => toggleMutation.mutate({ clinicId: a.clinic_id, isActive: !a.is_active })}
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded"
                    >
                      {a.is_active ? (
                        <ToggleRight className="w-5 h-5 text-green-500" />
                      ) : (
                        <ToggleLeft className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      title="Remove"
                      onClick={() => {
                        if (confirm(`Remove Dr. ${doctorData?.full_name} from ${a.clinic_name}?`)) {
                          removeMutation.mutate(a.clinic_id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">Fee Override</p>
                  <p className="font-medium text-slate-900">
                    {a.consultation_fee_override != null ? `$${a.consultation_fee_override}` : 'Default fee'}
                  </p>
                </div>
                {a.start_date && (
                  <div>
                    <p className="text-slate-500 text-xs">Start Date</p>
                    <p className="text-slate-700">{a.start_date}</p>
                  </div>
                )}
                {a.end_date && (
                  <div>
                    <p className="text-slate-500 text-xs">End Date</p>
                    <p className="text-slate-700">{a.end_date}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Assignment Modal */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-lg font-semibold">Assign to Clinic</h2>
              <button onClick={() => { setAddOpen(false); setAddError(''); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-5 space-y-4">
              <div>
                <label className="label">Clinic *</label>
                <select
                  className="input"
                  value={addClinicId}
                  onChange={(e) => setAddClinicId(e.target.value)}
                  required
                >
                  <option value="">— Select clinic —</option>
                  {availableClinics.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.city ? ` (${c.city})` : ''}</option>
                  ))}
                </select>
                {availableClinics.length === 0 && allClinics.length > 0 && (
                  <p className="text-xs text-slate-500 mt-1">Doctor is already assigned to all clinics.</p>
                )}
              </div>

              <div>
                <label className="label">Consultation Fee Override ($)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="input"
                  placeholder="Leave blank to use doctor's default fee"
                  value={addFeeOverride}
                  onChange={(e) => setAddFeeOverride(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Start Date</label>
                <input
                  type="date"
                  className="input"
                  value={addStartDate}
                  onChange={(e) => setAddStartDate(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPrimary"
                  checked={addIsPrimary}
                  onChange={(e) => setAddIsPrimary(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-primary-600"
                />
                <label htmlFor="isPrimary" className="text-sm text-slate-700">
                  Set as primary clinic
                </label>
              </div>

              {addError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                  {addError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={addMutation.isPending} className="btn-primary flex-1">
                  {addMutation.isPending ? 'Assigning…' : 'Assign'}
                </button>
                <button
                  type="button"
                  onClick={() => { setAddOpen(false); setAddError(''); }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
