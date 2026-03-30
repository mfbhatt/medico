import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X, ToggleLeft, ToggleRight } from 'lucide-react';
import api from '@/services/api';

const CATEGORIES = ['Medical', 'Surgical', 'Allied Health', 'Mental Health', 'Diagnostic', 'Other'];

interface Spec {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

interface FormState {
  name: string;
  category: string;
  description: string;
  is_active: boolean;
  sort_order: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  category: '',
  description: '',
  is_active: true,
  sort_order: '0',
};

export default function SpecializationsPage() {
  const [filterCategory, setFilterCategory] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [modalSpec, setModalSpec] = useState<Spec | null | 'new'>(null); // null = closed, 'new' = create
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Spec | null>(null);
  const qc = useQueryClient();

  const isActiveParam = filterActive === 'active' ? true : filterActive === 'inactive' ? false : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ['specializations', filterCategory, filterActive],
    queryFn: () =>
      api
        .get('/specializations/', {
          params: {
            category: filterCategory || undefined,
            is_active: isActiveParam,
          },
        })
        .then((r) => r.data.data as Spec[]),
  });

  const specs = data ?? [];

  const createMutation = useMutation({
    mutationFn: (payload: object) => api.post('/specializations/', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['specializations'] });
      setModalSpec(null);
      setForm(EMPTY_FORM);
      setFormError('');
    },
    onError: (err: any) => setFormError(err.response?.data?.detail ?? 'Failed to create'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: object }) =>
      api.patch(`/specializations/${id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['specializations'] });
      setModalSpec(null);
      setForm(EMPTY_FORM);
      setFormError('');
    },
    onError: (err: any) => setFormError(err.response?.data?.detail ?? 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/specializations/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['specializations'] });
      setDeleteTarget(null);
    },
  });

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setModalSpec('new');
  };

  const openEdit = (spec: Spec) => {
    setForm({
      name: spec.name,
      category: spec.category ?? '',
      description: spec.description ?? '',
      is_active: spec.is_active,
      sort_order: String(spec.sort_order),
    });
    setFormError('');
    setModalSpec(spec);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const payload = {
      name: form.name.trim(),
      category: form.category || null,
      description: form.description.trim() || null,
      is_active: form.is_active,
      sort_order: parseInt(form.sort_order) || 0,
    };
    if (modalSpec === 'new') {
      createMutation.mutate(payload);
    } else if (modalSpec) {
      updateMutation.mutate({ id: modalSpec.id, payload });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  // Group by category for display
  const grouped = specs.reduce<Record<string, Spec[]>>((acc, s) => {
    const key = s.category ?? 'Uncategorized';
    (acc[key] = acc[key] ?? []).push(s);
    return acc;
  }, {});

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Specializations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Platform-wide medical specialization catalog used across all tenants
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Add Specialization
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Category</label>
          <select
            className="input"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select
            className="input"
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value as typeof filterActive)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="flex items-end">
          <span className="text-sm text-gray-500 pb-2">
            {specs.length} specialization{specs.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-20 text-gray-400">Loading…</div>
      ) : specs.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <p className="font-medium">No specializations found</p>
          <p className="text-sm mt-1">Add specializations to populate dropdowns across the platform</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="card overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {category}
                </span>
                <span className="text-xs text-gray-400">{items.length} items</span>
              </div>
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600">Name</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600 hidden md:table-cell">
                      Description
                    </th>
                    <th className="text-center px-4 py-2.5 font-medium text-gray-600">Order</th>
                    <th className="text-center px-4 py-2.5 font-medium text-gray-600">Status</th>
                    <th className="text-right px-4 py-2.5 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((spec) => (
                    <tr key={spec.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{spec.name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell max-w-xs truncate">
                        {spec.description ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500 font-mono text-xs">
                        {spec.sort_order}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() =>
                            updateMutation.mutate({
                              id: spec.id,
                              payload: { is_active: !spec.is_active },
                            })
                          }
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full transition-colors ${
                            spec.is_active
                              ? 'bg-green-50 text-green-700 hover:bg-green-100'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                          title={spec.is_active ? 'Click to deactivate' : 'Click to activate'}
                        >
                          {spec.is_active ? (
                            <ToggleRight className="w-3.5 h-3.5" />
                          ) : (
                            <ToggleLeft className="w-3.5 h-3.5" />
                          )}
                          {spec.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          onClick={() => openEdit(spec)}
                          className="text-primary-600 hover:text-primary-800 inline-flex items-center gap-1 text-xs font-medium"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget(spec)}
                          className="text-red-500 hover:text-red-700 inline-flex items-center gap-1 text-xs font-medium"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalSpec !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {modalSpec === 'new' ? 'Add Specialization' : 'Edit Specialization'}
              </h2>
              <button
                onClick={() => { setModalSpec(null); setFormError(''); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="label">Name *</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Cardiology"
                  required
                />
              </div>

              <div>
                <label className="label">Category</label>
                <select
                  className="input"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  <option value="">— Uncategorized —</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Description</label>
                <textarea
                  className="input"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description (optional)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Sort Order</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={form.sort_order}
                    onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                  />
                  <p className="text-xs text-gray-400 mt-1">Lower = appears first</p>
                </div>
                <div className="flex flex-col justify-center pt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-primary-600"
                      checked={form.is_active}
                      onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                    />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>
                  <p className="text-xs text-gray-400 mt-1">Inactive items are hidden from dropdowns</p>
                </div>
              </div>

              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={isPending} className="btn-primary flex-1">
                  {isPending
                    ? 'Saving…'
                    : modalSpec === 'new'
                    ? 'Create Specialization'
                    : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => { setModalSpec(null); setFormError(''); }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Delete Specialization</h2>
            <p className="text-sm text-gray-600 mb-4">
              Delete <strong>{deleteTarget.name}</strong>? Doctors currently using this
              specialization will retain their saved value, but it will no longer appear in
              dropdowns.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg text-sm transition"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
