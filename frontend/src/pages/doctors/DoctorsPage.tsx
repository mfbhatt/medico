import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Search, Pencil, Building2 } from 'lucide-react';
import api from '@/services/api';
import Pagination from '@/components/ui/Pagination';
import { useDebounce } from '@/hooks/useDebounce';
import { useCurrency, useCurrencySymbol } from '@/hooks/useCurrency';

const PAGE_SIZE = 20;

interface AddDoctorForm {
  first_name: string;
  middle_name: string;
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
  first_name: '', middle_name: '', last_name: '', email: '', phone: '',
  password: '', registration_number: '',
  specialization: '', consultation_fee: '', experience_years: '',
};

interface EditDoctorForm {
  first_name: string;
  middle_name: string;
  last_name: string;
  email: string;
  phone: string;
  new_password: string;
  registration_number: string;
  specialization: string;
  experience_years: string;
  consultation_fee: string;
  follow_up_fee: string;
  default_slot_duration: string;
  biography: string;
  is_accepting_new_patients: boolean;
  telemedicine_enabled: boolean;
}

const INITIAL_EDIT_FORM: EditDoctorForm = {
  first_name: '',
  middle_name: '',
  last_name: '',
  email: '',
  phone: '',
  new_password: '',
  registration_number: '',
  specialization: '',
  experience_years: '',
  consultation_fee: '',
  follow_up_fee: '',
  default_slot_duration: '',
  biography: '',
  is_accepting_new_patients: true,
  telemedicine_enabled: false,
};

export default function DoctorsPage() {
  const fmt = useCurrency();
  const currencySymbol = useCurrencySymbol();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [specializationFilter, setSpecializationFilter] = useState('');
  const [page, setPage] = useState(1);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddDoctorForm>(INITIAL_FORM);
  const [addError, setAddError] = useState('');
  const [addSelectedClinics, setAddSelectedClinics] = useState<Set<string>>(new Set());
  const [addPrimaryClinic, setAddPrimaryClinic] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editDoctorId, setEditDoctorId] = useState<string | null>(null);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditDoctorForm>(INITIAL_EDIT_FORM);
  const [editError, setEditError] = useState('');
  const [editSelectedClinics, setEditSelectedClinics] = useState<Set<string>>(new Set());
  const [editPrimaryClinic, setEditPrimaryClinic] = useState('');

  const qc = useQueryClient();

  const { data: editDoctorClinics = [], isLoading: isLoadingClinics } = useQuery({
    queryKey: ['doctor-clinics', editDoctorId],
    queryFn: () => api.get(`/doctors/${editDoctorId}/clinics`).then((r) => r.data.data),
    enabled: !!editDoctorId,
  });

  // Sync edit clinic selections once the doctor's current assignments load
  useEffect(() => {
    if (!editOpen) return;
    const clinics = editDoctorClinics as any[];
    if (clinics.length === 0) return;
    setEditSelectedClinics(new Set(clinics.map((c) => c.clinic_id)));
    const primary = clinics.find((c) => c.is_primary_location);
    setEditPrimaryClinic(primary?.clinic_id ?? '');
  }, [editDoctorClinics, editOpen]);

  const { data: allClinicsRaw } = useQuery({
    queryKey: ['clinics'],
    queryFn: () => api.get('/clinics/').then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });
  const allClinics: any[] = Array.isArray(allClinicsRaw) ? allClinicsRaw : [];

  const { data: specsData } = useQuery({
    queryKey: ['specializations'],
    queryFn: () =>
      api.get('/specializations/', { params: { is_active: true } }).then((r) => r.data.data as { id: string; name: string; category: string | null }[]),
    staleTime: 5 * 60 * 1000,
  });
  const specializations = specsData ?? [];

  const { data: doctorsRaw, isLoading } = useQuery({
    queryKey: ['doctors', debouncedSearch, specializationFilter, page],
    queryFn: () =>
      api
        .get('/doctors/', {
          params: {
            search: debouncedSearch || undefined,
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
    mutationFn: async (payload: { form: AddDoctorForm; selectedClinics: Set<string>; primaryClinic: string }) => {
      const { form, selectedClinics, primaryClinic } = payload;
      const res = await api.post('/users/', {
        first_name: form.first_name,
        middle_name: form.middle_name || undefined,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
        registration_number: form.registration_number,
        specialization: form.specialization,
        consultation_fee: form.consultation_fee ? Number(form.consultation_fee) : undefined,
        experience_years: form.experience_years ? Number(form.experience_years) : 0,
        role: 'doctor',
      });
      const doctorId = res.data?.data?.id ?? res.data?.data?.doctor_id;
      if (doctorId && selectedClinics.size > 0) {
        await Promise.all(
          [...selectedClinics].map((clinicId) =>
            api.post(`/doctors/${doctorId}/clinics`, {
              clinic_id: clinicId,
              is_primary_location: clinicId === primaryClinic,
            })
          )
        );
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctors'] });
      setAddOpen(false);
      setAddForm(INITIAL_FORM);
      setAddSelectedClinics(new Set());
      setAddPrimaryClinic('');
      setAddError('');
    },
    onError: (err: any) => {
      setAddError(err.response?.data?.detail ?? 'Failed to create doctor');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      doctorId,
      userId,
      form,
      selectedClinics,
      primaryClinic,
      currentClinics,
    }: {
      doctorId: string;
      userId: string;
      form: EditDoctorForm;
      selectedClinics: Set<string>;
      primaryClinic: string;
      currentClinics: any[];
    }) => {
      const currentClinicIds = new Set(currentClinics.map((c: any) => c.clinic_id));
      const toAdd = [...selectedClinics].filter((id) => !currentClinicIds.has(id));
      const toRemove = [...currentClinicIds].filter((id) => !selectedClinics.has(id));

      await Promise.all([
        api.patch(`/doctors/${doctorId}`, {
          primary_specialization: form.specialization || undefined,
          registration_number: form.registration_number || undefined,
          consultation_fee: form.consultation_fee ? Number(form.consultation_fee) : undefined,
          follow_up_fee: form.follow_up_fee ? Number(form.follow_up_fee) : undefined,
          experience_years: form.experience_years ? Number(form.experience_years) : undefined,
          default_slot_duration: form.default_slot_duration ? Number(form.default_slot_duration) : undefined,
          bio: form.biography || undefined,
          is_accepting_new_patients: form.is_accepting_new_patients,
          telemedicine_enabled: form.telemedicine_enabled,
        }),
        api.patch(`/users/${userId}`, {
          first_name: form.first_name || undefined,
          middle_name: form.middle_name || undefined,
          last_name: form.last_name || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          new_password: form.new_password || undefined,
        }),
        ...toAdd.map((clinicId) =>
          api.post(`/doctors/${doctorId}/clinics`, {
            clinic_id: clinicId,
            is_primary_location: clinicId === primaryClinic,
          })
        ),
        ...toRemove.map((clinicId) => api.delete(`/doctors/${doctorId}/clinics/${clinicId}`)),
      ]);

      // Update primary flag for clinics that stayed but whose primary status changed
      const staying = [...selectedClinics].filter((id) => currentClinicIds.has(id));
      await Promise.all(
        staying.map((clinicId) => {
          const current = currentClinics.find((c: any) => c.clinic_id === clinicId);
          const shouldBePrimary = clinicId === primaryClinic;
          if (current && current.is_primary_location !== shouldBePrimary) {
            return api.patch(`/doctors/${doctorId}/clinics/${clinicId}`, {
              is_primary_location: shouldBePrimary,
            });
          }
          return Promise.resolve();
        })
      );
    },
    onSuccess: (_data, variables) => {
      const { doctorId, form } = variables;
      qc.setQueriesData({ queryKey: ['doctors'] }, (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((d: any) => {
            if (d.id !== doctorId) return d;
            const firstName = form.first_name || d.first_name;
            const middleName = form.middle_name !== undefined ? form.middle_name : (d.middle_name ?? '');
            const lastName = form.last_name || d.last_name;
            return {
              ...d,
              first_name: firstName,
              middle_name: middleName,
              last_name: lastName,
              full_name: [firstName, middleName, lastName].filter(Boolean).join(' '),
              phone: form.phone || d.phone,
              registration_number: form.registration_number || d.registration_number,
              primary_specialization: form.specialization || d.primary_specialization,
              experience_years: form.experience_years ? Number(form.experience_years) : d.experience_years,
              consultation_fee: form.consultation_fee ? Number(form.consultation_fee) : d.consultation_fee,
              follow_up_fee: form.follow_up_fee ? Number(form.follow_up_fee) : d.follow_up_fee,
              default_slot_duration: form.default_slot_duration ? Number(form.default_slot_duration) : d.default_slot_duration,
              biography: form.biography,
              is_accepting_new_patients: form.is_accepting_new_patients,
              telemedicine_enabled: form.telemedicine_enabled,
            };
          }),
        };
      });
      qc.invalidateQueries({ queryKey: ['doctor-clinics', variables.doctorId] });
      setEditOpen(false);
      setEditDoctorId(null);
      setEditUserId(null);
      setEditForm(INITIAL_EDIT_FORM);
      setEditSelectedClinics(new Set());
      setEditPrimaryClinic('');
      setEditError('');
    },
    onError: (err: any) => {
      setEditError(err.response?.data?.detail ?? 'Failed to update doctor');
    },
  });

  const openEdit = (doctor: any) => {
    setEditDoctorId(doctor.id);
    setEditUserId(doctor.user_id);
    setEditForm({
      first_name: doctor.first_name ?? '',
      middle_name: doctor.middle_name ?? '',
      last_name: doctor.last_name ?? '',
      email: doctor.email ?? '',
      phone: doctor.phone ?? '',
      new_password: '',
      registration_number: doctor.registration_number ?? '',
      specialization: doctor.primary_specialization ?? '',
      experience_years: doctor.experience_years != null ? String(doctor.experience_years) : '',
      consultation_fee: doctor.consultation_fee != null ? String(doctor.consultation_fee) : '',
      follow_up_fee: doctor.follow_up_fee != null ? String(doctor.follow_up_fee) : '',
      default_slot_duration: doctor.default_slot_duration != null ? String(doctor.default_slot_duration) : '',
      biography: doctor.biography ?? '',
      is_accepting_new_patients: doctor.is_accepting_new_patients ?? true,
      telemedicine_enabled: doctor.telemedicine_enabled ?? false,
    });
    setEditSelectedClinics(new Set());
    setEditPrimaryClinic('');
    setEditError('');
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditError('');
    setEditForm(INITIAL_EDIT_FORM);
    setEditSelectedClinics(new Set());
    setEditPrimaryClinic('');
    setEditDoctorId(null);
    setEditUserId(null);
  };

  const closeAdd = () => {
    setAddOpen(false);
    setAddError('');
    setAddForm(INITIAL_FORM);
    setAddSelectedClinics(new Set());
    setAddPrimaryClinic('');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDoctorId || !editUserId) return;
    setEditError('');
    updateMutation.mutate({
      doctorId: editDoctorId,
      userId: editUserId,
      form: editForm,
      selectedClinics: editSelectedClinics,
      primaryClinic: editPrimaryClinic,
      currentClinics: editDoctorClinics as any[],
    });
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    createMutation.mutate({ form: addForm, selectedClinics: addSelectedClinics, primaryClinic: addPrimaryClinic });
  };

  const setEditField = (field: keyof Omit<EditDoctorForm, 'is_accepting_new_patients' | 'telemedicine_enabled'>) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setEditForm((f) => ({ ...f, [field]: e.target.value }));

  const setField = (field: keyof AddDoctorForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setAddForm((f) => ({ ...f, [field]: e.target.value }));

  const specsByCategory = specializations.reduce<Record<string, typeof specializations>>(
    (acc, s) => {
      const key = s.category ?? 'Other';
      (acc[key] = acc[key] ?? []).push(s);
      return acc;
    },
    {}
  );

  const renderClinicSelector = (
    selectedClinics: Set<string>,
    primaryClinic: string,
    onToggle: (id: string, checked: boolean) => void,
    onSetPrimary: (id: string) => void,
    currentAssignments: any[] = []
  ) => {
    if (allClinics.length === 0) {
      return (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">
          No clinics available. Create clinics in the system first.
        </div>
      );
    }
    const currentIds = new Set(currentAssignments.map((c: any) => c.clinic_id));
    return (
      <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
        {allClinics.map((clinic: any) => {
          const isSelected = selectedClinics.has(clinic.id);
          const isPrimary = clinic.id === primaryClinic;
          const isAdding = isSelected && !currentIds.has(clinic.id) && currentIds.size > 0;
          const isRemoving = !isSelected && currentIds.has(clinic.id);
          return (
            <div
              key={clinic.id}
              className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
            >
              <input
                id={`clinic-${clinic.id}`}
                type="checkbox"
                checked={isSelected}
                onChange={(e) => onToggle(clinic.id, e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer flex-shrink-0"
              />
              <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <label htmlFor={`clinic-${clinic.id}`} className="text-sm font-medium text-slate-800 flex-1 cursor-pointer truncate">
                {clinic.name}
              </label>
              {isAdding && (
                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-semibold flex-shrink-0">+Add</span>
              )}
              {isRemoving && (
                <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold flex-shrink-0">−Remove</span>
              )}
              {isSelected && (
                <button
                  type="button"
                  onClick={() => onSetPrimary(isPrimary ? '' : clinic.id)}
                  title={isPrimary ? 'Primary clinic (click to unset)' : 'Set as primary clinic'}
                  className={`flex-shrink-0 text-xs px-2 py-0.5 rounded font-semibold transition-colors ${
                    isPrimary
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-700'
                  }`}
                >
                  {isPrimary ? '★ Primary' : 'Set Primary'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

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
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>
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
                    {doctor.consultation_fee ? fmt(doctor.consultation_fee) : '—'}
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
                <button
                  onClick={() => openEdit(doctor)}
                  className="col-span-2 flex items-center justify-center gap-1.5 btn-secondary text-xs py-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
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

      {/* Edit Doctor Modal */}
      {editOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold text-gray-900">Edit Doctor</h2>
              <button onClick={closeEdit} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-6">
              {/* Personal Info */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Personal Info</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="label">First Name</label>
                    <input className="input" value={editForm.first_name} onChange={setEditField('first_name')} />
                  </div>
                  <div>
                    <label className="label">Middle Name <span className="text-slate-400 font-normal">(optional)</span></label>
                    <input className="input" value={editForm.middle_name} onChange={setEditField('middle_name')} placeholder="Middle name or initial" />
                  </div>
                  <div>
                    <label className="label">Last Name</label>
                    <input className="input" value={editForm.last_name} onChange={setEditField('last_name')} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="label">Phone</label>
                    <input className="input" type="tel" value={editForm.phone} onChange={setEditField('phone')} />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input className="input" type="email" value={editForm.email} onChange={setEditField('email')} />
                  </div>
                  <div className="col-span-2">
                    <label className="label">
                      New Password <span className="text-slate-400 font-normal">(leave blank to keep current)</span>
                    </label>
                    <input
                      className="input"
                      type="password"
                      value={editForm.new_password}
                      onChange={setEditField('new_password')}
                      placeholder="Minimum 8 characters"
                      minLength={editForm.new_password ? 8 : undefined}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              </div>

              {/* Professional */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Professional</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="label">Registration No.</label>
                    <input className="input" value={editForm.registration_number} onChange={setEditField('registration_number')} />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Specialization</label>
                    {specializations.length > 0 ? (
                      <select className="input" value={editForm.specialization} onChange={setEditField('specialization')}>
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
                      <input className="input" value={editForm.specialization} onChange={setEditField('specialization')} placeholder="e.g. Cardiology" />
                    )}
                  </div>
                  <div>
                    <label className="label">Experience (years)</label>
                    <input className="input" type="number" min={0} value={editForm.experience_years} onChange={setEditField('experience_years')} />
                  </div>
                  <div>
                    <label className="label">Slot Duration (min)</label>
                    <input className="input" type="number" min={5} step={5} value={editForm.default_slot_duration} onChange={setEditField('default_slot_duration')} />
                  </div>
                </div>
              </div>

              {/* Fees */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Fees ({currencySymbol})</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Consultation Fee</label>
                    <input className="input" type="number" min={0} value={editForm.consultation_fee} onChange={setEditField('consultation_fee')} />
                  </div>
                  <div>
                    <label className="label">Follow-up Fee</label>
                    <input className="input" type="number" min={0} value={editForm.follow_up_fee} onChange={setEditField('follow_up_fee')} />
                  </div>
                </div>
              </div>

              {/* Biography */}
              <div>
                <label className="label">Biography</label>
                <textarea
                  className="input min-h-[80px] resize-y"
                  value={editForm.biography}
                  onChange={setEditField('biography')}
                  placeholder="Short professional bio…"
                />
              </div>

              {/* Settings */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Settings</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <input
                      id="edit-accepting"
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      checked={editForm.is_accepting_new_patients}
                      onChange={(e) => setEditForm((f) => ({ ...f, is_accepting_new_patients: e.target.checked }))}
                    />
                    <label htmlFor="edit-accepting" className="text-sm text-gray-700 cursor-pointer">Accepting new patients</label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      id="edit-telemedicine"
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      checked={editForm.telemedicine_enabled}
                      onChange={(e) => setEditForm((f) => ({ ...f, telemedicine_enabled: e.target.checked }))}
                    />
                    <label htmlFor="edit-telemedicine" className="text-sm text-gray-700 cursor-pointer">Telemedicine enabled</label>
                  </div>
                </div>
              </div>

              {/* Clinic Assignments */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Clinic Assignments</p>
                  {editSelectedClinics.size > 0 && (
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
                      {editSelectedClinics.size} selected
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  Check clinics to assign. Click <strong>Set Primary</strong> on the doctor's main clinic.
                </p>
                {isLoadingClinics ? (
                  <div className="text-sm text-slate-500 animate-pulse py-3 text-center">Loading current assignments…</div>
                ) : (
                  renderClinicSelector(
                    editSelectedClinics,
                    editPrimaryClinic,
                    (id, checked) => {
                      const next = new Set(editSelectedClinics);
                      if (checked) next.add(id); else next.delete(id);
                      setEditSelectedClinics(next);
                      if (!checked && editPrimaryClinic === id) setEditPrimaryClinic('');
                    },
                    setEditPrimaryClinic,
                    editDoctorClinics as any[]
                  )
                )}
              </div>

              {editError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                  {editError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={updateMutation.isPending} className="btn-primary flex-1">
                  {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
                </button>
                <button type="button" onClick={closeEdit} className="btn-secondary flex-1">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Doctor Modal */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold text-gray-900">Add Doctor</h2>
              <button onClick={closeAdd} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-5">
              {/* Personal Info */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Personal Info</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="label">First Name *</label>
                    <input className="input" value={addForm.first_name} onChange={setField('first_name')} required />
                  </div>
                  <div>
                    <label className="label">Middle Name <span className="text-slate-400 font-normal">(optional)</span></label>
                    <input className="input" value={addForm.middle_name} onChange={setField('middle_name')} placeholder="Middle name or initial" />
                  </div>
                  <div>
                    <label className="label">Last Name *</label>
                    <input className="input" value={addForm.last_name} onChange={setField('last_name')} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
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
                </div>
              </div>

              {/* Professional */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Professional</p>
                <div className="grid grid-cols-2 gap-4">
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
                    <label className="label">Consultation Fee ({currencySymbol})</label>
                    <input className="input" type="number" min={0} value={addForm.consultation_fee} onChange={setField('consultation_fee')} />
                  </div>
                  <div>
                    <label className="label">Experience (years)</label>
                    <input className="input" type="number" min={0} value={addForm.experience_years} onChange={setField('experience_years')} />
                  </div>
                </div>
              </div>

              {/* Clinic Assignments */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Clinic Assignments</p>
                  {addSelectedClinics.size > 0 && (
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
                      {addSelectedClinics.size} selected
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  Optionally assign this doctor to clinics now. Click <strong>Set Primary</strong> for the main clinic.
                </p>
                {renderClinicSelector(
                  addSelectedClinics,
                  addPrimaryClinic,
                  (id, checked) => {
                    const next = new Set(addSelectedClinics);
                    if (checked) next.add(id); else next.delete(id);
                    setAddSelectedClinics(next);
                    if (!checked && addPrimaryClinic === id) setAddPrimaryClinic('');
                  },
                  setAddPrimaryClinic
                )}
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
                <button type="button" onClick={closeAdd} className="btn-secondary flex-1">
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
