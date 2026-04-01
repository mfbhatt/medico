import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Search } from 'lucide-react';
import api from '@/services/api';
import Pagination from '@/components/ui/Pagination';

const PAGE_SIZE = 20;

interface AddDoctorForm {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password: string;
  registration_number: string;
  specialization: string;
  consultation_fee: string;
  experience_years: string;
}

const INITIAL_FORM: AddDoctorForm = {
  first_name: '', last_name: '', email: '', phone: '',
  password: '', registration_number: '',
  specialization: '', consultation_fee: '', experience_years: '',
};

export default function DoctorsPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [specializationFilter, setSpecializationFilter] = useState('');
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddDoctorForm>(INITIAL_FORM);
  const [addError, setAddError] = useState('');
  const qc = useQueryClient();

  const handleSearch = () => { setSearch(searchInput); setPage(1); };

  // Fetch specialization catalog for dropdowns
  const { data: specsData } = useQuery({
    queryKey: ['specializations'],
    queryFn: () =>
      api.get('/specializations/', { params: { is_active: true } }).then((r) => r.data.data as { id: string; name: string; category: string | null }[]),
    staleTime: 5 * 60 * 1000, // cache 5 min
  });
  const specializations = specsData ?? [];

  const { data: doctorsRaw, isLoading } = useQuery({
    queryKey: ['doctors', search, specializationFilter, page],
    queryFn: () =>
      api
        .get('/doctors/', {
          params: {
            search: search || undefined,
            specialization: specializationFilter || undefined,
            page,
            page_size: PAGE_SIZE,
          },
        })
        .then((r) => r.data),
    keepPreviousData: true,
  } as any);

  const doctors: any[] = Array.isArray((doctorsRaw as any)?.data) ? (doctorsRaw as any).data : [];
  const total: number = (doctorsRaw as any)?.meta?.total ?? 0;

  const createMutation = useMutation({
    mutationFn: (form: AddDoctorForm) =>
      api.post('/users', {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
        registration_number: form.registration_number,
        specialization: form.specialization,
        consultation_fee: form.consultation_fee ? Number(form.consultation_fee) : undefined,
        experience_years: form.experience_years ? Number(form.experience_years) : 0,
        role: 'doctor',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctors'] });
      setAddOpen(false);
      setAddForm(INITIAL_FORM);
      setAddError('');
    },
    onError: (err: any) => {
      setAddError(err.response?.data?.detail ?? 'Failed to create doctor');
    },
  });

  const setField = (field: keyof AddDoctorForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setAddForm((f) => ({ ...f, [field]: e.target.value }));

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    createMutation.mutate(addForm);
  };

  // Group specializations by category for <optgroup> display
  const specsByCategory = specializations.reduce<Record<string, typeof specializations>>(
    (acc, s) => {
      const key = s.category ?? 'Other';
      (acc[key] = acc[key] ?? []).push(s);
      return acc;
    },
    {}
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Doctors</h1>
        <button onClick={() => setAddOpen(true)} className="btn-primary">
          + Add Doctor
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6 flex gap-3 flex-wrap items-end">
        <div className="flex-1 min-w-48 relative">
          <label className="label">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              className="input pl-9"
              placeholder="Doctor name, registration…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
        </div>
        <button onClick={handleSearch} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg self-end">
          Search
        </button>
        <div>
          <label className="label">Specialization</label>
          <select
            className="input min-w-48"
            value={specializationFilter}
            onChange={(e) => { setSpecializationFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Specializations</option>
            {Object.entries(specsByCategory).map(([cat, items]) => (
              <optgroup key={cat} label={cat}>
                {items.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      {/* Doctor cards */}
      {isLoading ? (
        <div className="text-center py-20 text-gray-400">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {doctors.map((doctor: {
            id: string;
            full_name: string;
            primary_specialization: string;
            registration_number: string;
            consultation_fee: number;
            average_rating: number;
            total_ratings: number;
            is_accepting_new_patients: boolean;
          }) => (
            <div key={doctor.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-primary-100 flex items-center justify-center text-sm font-bold text-primary-700">
                    Dr
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{doctor.full_name}</p>
                    <p className="text-xs text-gray-500">{doctor.primary_specialization}</p>
                  </div>
                </div>
                <span className={`badge ${doctor.is_accepting_new_patients ? 'badge-green' : 'badge-gray'}`}>
                  {doctor.is_accepting_new_patients ? 'Accepting' : 'Full'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                <div>
                  <p className="text-gray-500 text-xs">Reg. No.</p>
                  <p className="font-mono text-gray-700">{doctor.registration_number}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Consultation Fee</p>
                  <p className="font-medium text-gray-900">
                    {doctor.consultation_fee ? `$${doctor.consultation_fee}` : '—'}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500 text-xs">Rating</p>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <svg
                        key={i}
                        className={`w-3.5 h-3.5 ${i < Math.round(doctor.average_rating) ? 'text-yellow-400' : 'text-gray-200'}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                    <span className="text-xs text-gray-500 ml-1">({doctor.total_ratings})</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Link to={`/doctors/${doctor.id}`} className="btn-secondary text-center text-xs py-1.5">
                  Profile
                </Link>
                <Link to={`/doctors/${doctor.id}/schedule`} className="btn-secondary text-center text-xs py-1.5">
                  Schedule
                </Link>
                <Link to={`/doctors/${doctor.id}/clinics`} className="btn-secondary text-center text-xs py-1.5">
                  Clinics
                </Link>
                <Link to={`/doctors/${doctor.id}/stats`} className="btn-secondary text-center text-xs py-1.5">
                  Stats
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && doctors.length === 0 && (
        <div className="text-center py-20 text-gray-400">No doctors found</div>
      )}

      {total > PAGE_SIZE && (
        <div className="mt-4 bg-white rounded-xl border border-slate-200">
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        </div>
      )}

      {/* Add Doctor Modal */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">Add Doctor</h2>
              <button
                onClick={() => { setAddOpen(false); setAddError(''); setAddForm(INITIAL_FORM); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">First Name *</label>
                  <input className="input" value={addForm.first_name} onChange={setField('first_name')} required />
                </div>
                <div>
                  <label className="label">Last Name *</label>
                  <input className="input" value={addForm.last_name} onChange={setField('last_name')} required />
                </div>
                <div>
                  <label className="label">Email *</label>
                  <input className="input" type="email" value={addForm.email} onChange={setField('email')} required />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input" type="tel" value={addForm.phone} onChange={setField('phone')} />
                </div>
                <div className="col-span-2">
                  <label className="label">Password *</label>
                  <input
                    className="input"
                    type="password"
                    value={addForm.password}
                    onChange={setField('password')}
                    required
                    minLength={8}
                    placeholder="Minimum 8 characters"
                  />
                </div>
                <div>
                  <label className="label">Registration No. *</label>
                  <input className="input" value={addForm.registration_number} onChange={setField('registration_number')} required />
                </div>
                <div>
                  <label className="label">Specialization</label>
                  {specializations.length > 0 ? (
                    <select className="input" value={addForm.specialization} onChange={setField('specialization')}>
                      <option value="">— Select —</option>
                      {Object.entries(specsByCategory).map(([cat, items]) => (
                        <optgroup key={cat} label={cat}>
                          {items.map((s) => (
                            <option key={s.id} value={s.name}>{s.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="input"
                      value={addForm.specialization}
                      onChange={setField('specialization')}
                      placeholder="e.g. Cardiology"
                    />
                  )}
                </div>
                <div>
                  <label className="label">Consultation Fee ($)</label>
                  <input className="input" type="number" min={0} value={addForm.consultation_fee} onChange={setField('consultation_fee')} />
                </div>
                <div>
                  <label className="label">Experience (years)</label>
                  <input className="input" type="number" min={0} value={addForm.experience_years} onChange={setField('experience_years')} />
                </div>
              </div>

              {addError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                  {addError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={createMutation.isPending} className="btn-primary flex-1">
                  {createMutation.isPending ? 'Creating…' : 'Create Doctor'}
                </button>
                <button
                  type="button"
                  onClick={() => { setAddOpen(false); setAddError(''); setAddForm(INITIAL_FORM); }}
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
