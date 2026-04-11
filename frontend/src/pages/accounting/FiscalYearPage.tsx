import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { addToast } from '@/store/slices/uiSlice';
import api from '@/services/api';

interface FY {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_closed: boolean;
}

const EMPTY_FORM = { name: '', start_date: '', end_date: '', is_active: true };

export default function FiscalYearPage() {
  const dispatch = useDispatch();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const toast = {
    success: (m: string) => dispatch(addToast({ id: Date.now().toString(), type: 'success', message: m, duration: 3000 })),
    error: (m: string) => dispatch(addToast({ id: Date.now().toString(), type: 'error', message: m, duration: 5000 })),
  };

  const { data: fyList = [], isLoading } = useQuery<FY[]>({
    queryKey: ['accounting', 'fiscal-years'],
    queryFn: () => api.get('/accounting/fiscal-years').then(r => r.data.data),
  });

  const saveMutation = useMutation({
    mutationFn: (data: typeof EMPTY_FORM) =>
      editId
        ? api.put(`/accounting/fiscal-years/${editId}`, data)
        : api.post('/accounting/fiscal-years', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounting', 'fiscal-years'] });
      toast.success(editId ? 'Fiscal year updated' : 'Fiscal year created');
      setShowModal(false);
      setForm(EMPTY_FORM);
      setEditId(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to save'),
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/accounting/fiscal-years/${id}/close`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounting', 'fiscal-years'] });
      toast.success('Fiscal year closed');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to close'),
  });

  const openEdit = (fy: FY) => {
    setEditId(fy.id);
    setForm({ name: fy.name, start_date: fy.start_date, end_date: fy.end_date, is_active: fy.is_active });
    setShowModal(true);
  };

  const openNew = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  return (
    <div>
      <div className="page-header mb-6 flex justify-between items-center">
        <div>
          <h1 className="page-title">Fiscal Years</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage financial years for your organisation</p>
        </div>
        <div className="flex gap-2">
          <Link to="/accounting/closing-entry" className="btn-secondary text-sm">Year-End Closing</Link>
          <button className="btn-primary" onClick={openNew}>+ New Fiscal Year</button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Start Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">End Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 w-32" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {fyList.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400">No fiscal years yet</td></tr>
              )}
              {fyList.map(fy => (
                <tr key={fy.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{fy.name}</td>
                  <td className="px-4 py-3 text-slate-600">{fy.start_date}</td>
                  <td className="px-4 py-3 text-slate-600">{fy.end_date}</td>
                  <td className="px-4 py-3">
                    {fy.is_closed ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">Closed</span>
                    ) : fy.is_active ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {!fy.is_closed && (
                      <>
                        <button onClick={() => openEdit(fy)} className="text-xs text-blue-600 hover:underline">Edit</button>
                        <button
                          onClick={() => { if (confirm(`Close "${fy.name}"? This cannot be undone.`)) closeMutation.mutate(fy.id); }}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Close Year
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">{editId ? 'Edit Fiscal Year' : 'New Fiscal Year'}</h2>
            <div className="space-y-3">
              <div>
                <label className="label">Name *</label>
                <input className="input" placeholder="e.g. FY 2024-25" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Start Date *</label>
                  <input type="date" className="input" value={form.start_date}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div>
                  <label className="label">End Date *</label>
                  <input type="date" className="input" value={form.end_date}
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                Active
              </label>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                className="btn-primary"
                disabled={!form.name || !form.start_date || !form.end_date || saveMutation.isPending}
                onClick={() => saveMutation.mutate(form)}
              >
                {saveMutation.isPending ? 'Saving…' : 'Save'}
              </button>
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
