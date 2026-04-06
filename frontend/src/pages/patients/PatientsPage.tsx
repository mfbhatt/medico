import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, Users } from 'lucide-react';
import api from '@/services/api';
import { useDebounce } from '@/hooks/useDebounce';

interface FamilyMember {
  id: string;
  mrn: string;
  name: string;
  relationship_type: string;
  is_minor: boolean;
  date_of_birth: string;
  gender: string;
}

interface Patient {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  age: number;
  gender: string;
  phone: string;
  email: string;
  is_deceased: boolean;
  is_minor: boolean;
  family_members: FamilyMember[];
}

function exportPatientsCSV(patients: any[]) {
  const headers = ['MRN', 'First Name', 'Last Name', 'DOB', 'Age', 'Gender', 'Phone', 'Email'];
  const rows = patients.map((p) => [
    p.mrn, p.first_name, p.last_name, p.date_of_birth, p.age, p.gender, p.phone, p.email ?? '',
  ]);
  const csv = [headers, ...rows].map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `patients-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PatientsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const limit = 25;
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['patients', debouncedSearch, page],
    queryFn: () =>
      api
        .get('/patients/', {
          params: { q: debouncedSearch || undefined, page: page + 1, page_size: limit },
        })
        .then((r) => r.data),
  });

  const allPatients = data?.data ?? [];
  const meta = data?.meta ?? {};

  // Collect all IDs that appear as family sub-rows so we don't render them twice
  const subRowIds = new Set<string>(
    allPatients.flatMap((p: Patient) => (p.family_members ?? []).map((fm) => fm.id))
  );
  const patients = allPatients.filter((p: Patient) => !subRowIds.has(p.id));

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Patients</h1>
        <div className="flex gap-2">
          {patients.length > 0 && (
            <button
              onClick={() => exportPatientsCSV(patients)}
              className="btn-secondary flex items-center gap-1.5"
              title="Export current page to CSV"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
          )}
          <Link to="/patients/new" className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Register Patient
        </Link>
        </div>
      </div>

      {/* Search */}
      <div className="card p-4 mb-6">
        <div className="relative max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            className="input pl-9"
            placeholder="Search by name, MRN, phone, email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
      </div>

      {/* Patient list */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">MRN</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">DOB / Age</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Gender</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Contact</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : patients.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">No patients found</td></tr>
            ) : (
              patients.map((p: Patient) => (
                <Fragment key={p.id}>
                  {/* Primary patient row */}
                  <tr
                    className={`transition-colors ${
                      p.family_members?.length > 0
                        ? 'bg-blue-50/40 hover:bg-blue-50/70 border-b-0'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className={`py-3 font-mono text-xs text-gray-500 ${p.family_members?.length > 0 ? 'pl-3 pr-4 border-l-4 border-l-blue-500' : 'px-4'}`}>{p.mrn}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium ${p.is_deceased ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {p.first_name} {p.last_name}
                        </p>
                        {p.is_minor && (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Minor</span>
                        )}
                        {p.is_deceased && (
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">Deceased</span>
                        )}
                        {p.family_members?.length > 0 && (
                          <span className="flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium border border-blue-100">
                            <Users className="w-2.5 h-2.5" />
                            {p.family_members.length} linked
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.date_of_birth} <span className="text-gray-400">({p.age}y)</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{p.gender}</td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{p.phone}</p>
                      {p.email && <p className="text-xs text-gray-400">{p.email}</p>}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Link to={`/patients/${p.id}`} className="text-primary-600 hover:text-primary-800 text-sm font-medium">
                        View
                      </Link>
                      <Link
                        to={`/appointments/new?patient_id=${p.id}`}
                        className="text-green-600 hover:text-green-800 text-sm font-medium"
                      >
                        Book
                      </Link>
                    </td>
                  </tr>

                  {/* Family member sub-rows */}
                  {p.family_members?.map((fm, idx) => (
                    <tr
                      key={fm.id}
                      className={`bg-blue-50/60 hover:bg-blue-100/70 transition-colors ${idx === p.family_members.length - 1 ? 'border-b-2 border-b-blue-200' : 'border-b-0'}`}
                    >
                      <td className="pl-7 pr-4 py-2.5 font-mono text-xs text-gray-400 border-l-4 border-l-blue-300">{fm.mrn}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-blue-300 text-sm select-none">└</span>
                          <Link
                            to={`/patients/${fm.id}`}
                            className="text-sm text-gray-700 hover:text-primary-600 font-medium"
                          >
                            {fm.name}
                          </Link>
                          <span className="text-[10px] bg-white border border-blue-200 text-blue-600 px-1.5 py-0.5 rounded-full font-medium capitalize">
                            {fm.relationship_type.replace(/_/g, ' ')}
                          </span>
                          {fm.is_minor && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Minor</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{fm.date_of_birth}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500 capitalize">{fm.gender}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-400">—</td>
                      <td className="px-4 py-2.5 text-right space-x-2">
                        <Link to={`/patients/${fm.id}`} className="text-primary-600 hover:text-primary-800 text-xs font-medium">
                          View
                        </Link>
                        <Link
                          to={`/appointments/new?patient_id=${fm.id}`}
                          className="text-green-600 hover:text-green-800 text-xs font-medium"
                        >
                          Book
                        </Link>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))
            )}
          </tbody>
        </table>

        {meta.total > limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 text-sm text-gray-600">
            <span>Showing {page * limit + 1}–{Math.min((page + 1) * limit, meta.total)} of {meta.total}</span>
            <div className="flex gap-2">
              <button className="btn-secondary py-1 px-3" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <button className="btn-secondary py-1 px-3" disabled={(page + 1) * limit >= meta.total} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
