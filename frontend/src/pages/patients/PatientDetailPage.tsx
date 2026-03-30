import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import api from '@/services/api';
import AddressFields, { type AddressValue } from '@/components/ui/AddressFields';
import { useEnabledCountries } from '@/hooks/useEnabledCountries';

type Tab = 'overview' | 'appointments' | 'records' | 'prescriptions' | 'labs' | 'billing';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'records', label: 'Medical Records' },
  { id: 'prescriptions', label: 'Prescriptions' },
  { id: 'labs', label: 'Lab Reports' },
  { id: 'billing', label: 'Billing' },
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

interface EditForm {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  gender: string;
  marital_status: string;
  blood_group: string;
  address_line1: string;
  height_cm: string;
  weight_kg: string;
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('overview');
  const [editOpen, setEditOpen] = useState(false);
  const qc = useQueryClient();
  const { countries } = useEnabledCountries();

  const [editForm, setEditForm] = useState<EditForm>({
    first_name: '', last_name: '', phone: '', email: '', gender: '',
    marital_status: '', blood_group: '', address_line1: '',
    height_cm: '', weight_kg: '',
  });

  const [editAddress, setEditAddress] = useState<AddressValue>({
    country: 'US', state: '', city: '', postal_code: '',
  });

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => api.get(`/patients/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

  // Populate edit form when patient loads
  useEffect(() => {
    if (patient) {
      setEditForm({
        first_name: patient.first_name ?? '',
        last_name: patient.last_name ?? '',
        phone: patient.phone ?? '',
        email: patient.email ?? '',
        gender: patient.gender ?? '',
        marital_status: patient.marital_status ?? '',
        blood_group: patient.blood_group ?? '',
        address_line1: patient.address ?? patient.address_line1 ?? '',
        height_cm: patient.height_cm != null ? String(patient.height_cm) : '',
        weight_kg: patient.weight_kg != null ? String(patient.weight_kg) : '',
      });
      setEditAddress({
        country: patient.country ?? 'US',
        state: patient.state ?? '',
        city: patient.city ?? '',
        postal_code: patient.postal_code ?? patient.zip_code ?? '',
      });
    }
  }, [patient]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.patch(`/patients/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient', id] });
      setEditOpen(false);
    },
  });

  const { data: appointments } = useQuery({
    queryKey: ['patient-appointments', id],
    queryFn: () =>
      api.get('/appointments/', { params: { patient_id: id, limit: 10 } }).then((r) => r.data.data),
    enabled: tab === 'appointments' && !!id,
  });

  const { data: prescriptions } = useQuery({
    queryKey: ['patient-prescriptions', id],
    queryFn: () =>
      api.get(`/prescriptions/patient/${id}`, { params: { limit: 10 } }).then((r) => r.data.data),
    enabled: tab === 'prescriptions' && !!id,
  });

  if (isLoading) return <div className="text-center py-20 text-gray-400">Loading patient…</div>;
  if (!patient) return <div className="text-center py-20 text-gray-400">Patient not found</div>;

  const age = patient.date_of_birth
    ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      ...editForm,
      country: editAddress.country,
      city: editAddress.city,
      state: editAddress.state,
      zip_code: editAddress.postal_code,
      height_cm: editForm.height_cm ? Number(editForm.height_cm) : undefined,
      weight_kg: editForm.weight_kg ? Number(editForm.weight_kg) : undefined,
    });
  };

  const setField = (field: keyof EditForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setEditForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center text-xl font-bold text-primary-700">
            {patient.first_name[0]}{patient.last_name[0]}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {patient.first_name} {patient.last_name}
              {patient.is_deceased && <span className="ml-2 badge-gray text-sm">Deceased</span>}
            </h1>
            <p className="text-sm text-gray-500">
              MRN: <span className="font-mono">{patient.mrn}</span>
              {age !== null && ` · ${age} years · ${patient.gender}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/appointments/new?patient_id=${id}`} className="btn-primary">
            Book Appointment
          </Link>
          <button className="btn-secondary" onClick={() => setEditOpen(true)}>Edit</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors
                ${tab === t.id
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Personal Information</h3>
            <dl className="space-y-3 text-sm">
              {[
                ['Date of Birth', patient.date_of_birth],
                ['Blood Type', patient.blood_group ?? '—'],
                ['Phone', patient.phone],
                ['Email', patient.email ?? '—'],
                ['Address', patient.address ?? patient.address_line1 ?? '—'],
                ['City / State', [patient.city, patient.state].filter(Boolean).join(', ') || '—'],
                ['Height', patient.height_cm ? `${patient.height_cm} cm` : '—'],
                ['Weight', patient.weight_kg ? `${patient.weight_kg} kg` : '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-gray-500">{label}</dt>
                  <dd className="font-medium text-gray-900 text-right max-w-xs">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Medical History</h3>
            <div className="space-y-3">
              {patient.allergies?.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Allergies</p>
                  <div className="flex flex-wrap gap-1.5">
                    {patient.allergies.map((a: { id: string; allergen: string; severity: string }) => (
                      <span key={a.id} className={`badge ${a.severity === 'severe' ? 'badge-red' : 'badge-yellow'}`}>
                        {a.allergen}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">No known allergies</p>
              )}

              {patient.chronic_conditions?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Chronic Conditions</p>
                  <div className="flex flex-wrap gap-1.5">
                    {patient.chronic_conditions.map((c: { id: string; condition_name: string }) => (
                      <span key={c.id} className="badge-blue">{c.condition_name}</span>
                    ))}
                  </div>
                </div>
              )}

              {patient.emergency_contacts?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Emergency Contact</p>
                  {patient.emergency_contacts.slice(0, 1).map((ec: { id: string; name: string; relationship: string; phone: string }) => (
                    <p key={ec.id} className="text-sm text-gray-700">
                      {ec.name} ({ec.relationship}) — {ec.phone}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'appointments' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date & Time</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Doctor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!(appointments ?? []).length ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">No appointments found</td></tr>
              ) : (appointments ?? []).map((a: { id: string; scheduled_date: string; scheduled_time: string; doctor_name: string; appointment_type: string; status: string }) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{a.scheduled_date} {a.scheduled_time}</td>
                  <td className="px-4 py-3">{a.doctor_name}</td>
                  <td className="px-4 py-3 capitalize">{a.appointment_type}</td>
                  <td className="px-4 py-3">
                    <span className="badge badge-blue">{a.status.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/appointments/${a.id}`} className="text-primary-600 hover:text-primary-800 font-medium">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'prescriptions' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Prescribing Doctor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Items</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!(prescriptions ?? []).length ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">No prescriptions found</td></tr>
              ) : (prescriptions ?? []).map((rx: { id: string; created_at: string; doctor_name: string; item_count: number; status: string }) => (
                <tr key={rx.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{rx.created_at.slice(0, 10)}</td>
                  <td className="px-4 py-3">{rx.doctor_name}</td>
                  <td className="px-4 py-3">{rx.item_count} item(s)</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${rx.status === 'active' ? 'badge-green' : rx.status === 'expired' ? 'badge-red' : 'badge-gray'}`}>
                      {rx.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/prescriptions/${rx.id}`} className="text-primary-600 hover:text-primary-800 font-medium">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'records' && (
        <div className="text-center py-12 text-gray-400">
          <Link to={`/medical-records/${id}`} className="btn-secondary">
            View Medical Records
          </Link>
        </div>
      )}

      {tab === 'labs' && (
        <div className="text-center py-12 text-gray-400">
          <Link to={`/lab?patient_id=${id}`} className="btn-secondary">
            View Lab Reports
          </Link>
        </div>
      )}

      {tab === 'billing' && (
        <div className="text-center py-12 text-gray-400">
          <Link to={`/billing?patient_id=${id}`} className="btn-secondary">
            View Billing History
          </Link>
        </div>
      )}

      {/* Edit Patient Modal */}
      {editOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">Edit Patient</h2>
              <button onClick={() => setEditOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">First Name *</label>
                  <input className="input" value={editForm.first_name} onChange={setField('first_name')} required />
                </div>
                <div>
                  <label className="label">Last Name *</label>
                  <input className="input" value={editForm.last_name} onChange={setField('last_name')} required />
                </div>
                <div>
                  <label className="label">Phone *</label>
                  <input className="input" value={editForm.phone} onChange={setField('phone')} required />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input className="input" type="email" value={editForm.email} onChange={setField('email')} />
                </div>
                <div>
                  <label className="label">Gender</label>
                  <select className="input" value={editForm.gender} onChange={setField('gender')}>
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="label">Marital Status</label>
                  <select className="input" value={editForm.marital_status} onChange={setField('marital_status')}>
                    <option value="">Select</option>
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                    <option value="divorced">Divorced</option>
                    <option value="widowed">Widowed</option>
                  </select>
                </div>
                <div>
                  <label className="label">Blood Group</label>
                  <select className="input" value={editForm.blood_group} onChange={setField('blood_group')}>
                    <option value="">Unknown</option>
                    {BLOOD_GROUPS.map((bg) => <option key={bg} value={bg}>{bg}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Address</label>
                  <input className="input" value={editForm.address_line1} onChange={setField('address_line1')} placeholder="Street address" />
                </div>
                <div>
                  <label className="label">Height (cm)</label>
                  <input className="input" type="number" value={editForm.height_cm} onChange={setField('height_cm')} min={0} />
                </div>
                <div>
                  <label className="label">Weight (kg)</label>
                  <input className="input" type="number" value={editForm.weight_kg} onChange={setField('weight_kg')} min={0} />
                </div>
              </div>

              <AddressFields
                value={editAddress}
                onChange={setEditAddress}
                countries={countries}
                inputCls="input"
              />

              {updateMutation.isError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                  {(updateMutation.error as any)?.response?.data?.detail ?? 'Failed to update patient'}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setEditOpen(false)} className="btn-secondary flex-1">
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
