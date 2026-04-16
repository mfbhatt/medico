import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Plus, Search, Edit2, Trash2, X, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import api from "@/services/api";
import { useAppSelector } from "@/store/hooks";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import Pagination from "@/components/ui/Pagination";

const MODULES = [
  { key: "appointments", label: "Appointments" },
  { key: "patients", label: "Patients" },
  { key: "doctors", label: "Doctors" },
  { key: "medical_records", label: "Medical Records" },
  { key: "prescriptions", label: "Prescriptions" },
  { key: "lab", label: "Lab Reports" },
  { key: "billing", label: "Billing" },
  { key: "pharmacy", label: "Pharmacy" },
  { key: "accounting", label: "Accounting" },
  { key: "analytics", label: "Analytics" },
];

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-red-100 text-red-700",
  tenant_admin: "bg-purple-100 text-purple-700",
  clinic_admin: "bg-blue-100 text-blue-700",
  doctor: "bg-indigo-100 text-indigo-700",
  nurse: "bg-green-100 text-green-700",
  receptionist: "bg-yellow-100 text-yellow-800",
  pharmacist: "bg-orange-100 text-orange-700",
  lab_technician: "bg-cyan-100 text-cyan-700",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-600",
  locked: "bg-red-100 text-red-700",
  pending_verification: "bg-yellow-100 text-yellow-700",
};

const ROLES = ["doctor", "nurse", "receptionist", "clinic_admin", "pharmacist", "lab_technician"];
const PAGE_SIZE = 20;

type SortField = "last_name" | "first_name" | "email" | "role" | "status" | "created_at";

function SortIcon({ field, sortBy, sortOrder }: { field: SortField; sortBy: SortField; sortOrder: "asc" | "desc" }) {
  if (sortBy !== field) return <ArrowUpDown className="h-3.5 w-3.5 text-slate-300 ml-1 inline" />;
  return sortOrder === "asc" ? <ArrowUp className="h-3.5 w-3.5 text-blue-500 ml-1 inline" /> : <ArrowDown className="h-3.5 w-3.5 text-blue-500 ml-1 inline" />;
}

export default function UsersPage() {
  const qc = useQueryClient();
  const role = useAppSelector((s) => s.auth.user?.role);
  const tenantId = useAppSelector((s) => s.auth.user?.tenant_id);
  const isSuperAdmin = role === "super_admin";

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [clinicFilter, setClinicFilter] = useState("");
  const [tenantFilter, setTenantFilter] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortField>("last_name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [showNewModal, setShowNewModal] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  // Load clinics for clinic filter (tenant users only)
  const { data: clinicsData } = useQuery({
    queryKey: ["clinics-filter", tenantId],
    queryFn: () => api.get("/clinics/", { params: { page_size: 200 } }).then((r) => r.data.data as { id: string; name: string }[]),
    enabled: !isSuperAdmin,
    staleTime: 5 * 60 * 1000,
  });
  const clinics = clinicsData ?? [];

  // Load tenants for super admin tenant filter
  const { data: tenantsData } = useQuery({
    queryKey: ["tenants-filter"],
    queryFn: () => api.get("/tenants/", { params: { page_size: 200 } }).then((r) => r.data.data as { id: string; name: string }[]),
    enabled: isSuperAdmin,
    staleTime: 5 * 60 * 1000,
  });
  const tenants = tenantsData ?? [];

  // Load clinics for selected tenant (super admin scoped view)
  const { data: tenantClinicsData } = useQuery({
    queryKey: ["clinics-filter-for-tenant", tenantFilter],
    queryFn: () => api.get("/clinics/", { params: { tenant_id: tenantFilter, page_size: 200 } }).then((r) => r.data.data as { id: string; name: string }[]),
    enabled: isSuperAdmin && !!tenantFilter,
    staleTime: 5 * 60 * 1000,
  });
  const tenantClinics = tenantClinicsData ?? [];

  const queryKey = ["users", tenantId, tenantFilter, clinicFilter, roleFilter, statusFilter, search, sortBy, sortOrder, page];

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: () =>
      api
        .get("/users/", {
          params: {
            role: roleFilter || undefined,
            clinic_id: clinicFilter || undefined,
            status: statusFilter || undefined,
            tenant_id: isSuperAdmin ? tenantFilter || undefined : undefined,
            search: search || undefined,
            sort_by: sortBy,
            sort_order: sortOrder,
            page,
            page_size: PAGE_SIZE,
          },
        })
        .then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  const users: any[] = Array.isArray((data as any)?.data) ? (data as any).data : [];
  const total: number = (data as any)?.meta?.total ?? 0;

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortBy === field) {
        setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
      } else {
        setSortBy(field);
        setSortOrder("asc");
      }
      setPage(1);
    },
    [sortBy],
  );

  const handleSearchInput = (value: string) => {
    setSearchInput(value);
    setSearch(value);
    setPage(1);
  };

  const handleRoleFilter = (r: string) => {
    setRoleFilter(r);
    setPage(1);
  };
  const handleStatusFilter = (s: string) => {
    setStatusFilter(s);
    setPage(1);
  };
  const handleClinicFilter = (c: string) => {
    setClinicFilter(c);
    setPage(1);
  };
  const handleTenantFilter = (t: string) => {
    setTenantFilter(t);
    setClinicFilter("");
    setRoleFilter("");
    setStatusFilter("");
    setPage(1);
  };

  const invalidate = () => qc.invalidateQueries({ queryKey: ["users", tenantId] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      setDeleteTarget(null);
      invalidate();
    },
  });

  const thCls = "text-left px-5 py-3 font-medium text-slate-600 cursor-pointer select-none hover:text-slate-900 whitespace-nowrap";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage staff accounts and access</p>
        </div>
        {!isSuperAdmin && (
          <button onClick={() => setShowNewModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm">
            <Plus className="h-4 w-4" /> Add User
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={searchInput}
            onChange={(e) => handleSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Tenant filter — super admin only */}
        {isSuperAdmin && (
          <select value={tenantFilter} onChange={(e) => handleTenantFilter(e.target.value)} className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-44">
            <option value="">All Tenants</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}

        {/* Clinic filter — tenant users always; super admin when tenant is selected */}
        {(!isSuperAdmin || tenantFilter) && (
          <select value={clinicFilter} onChange={(e) => handleClinicFilter(e.target.value)} className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-40">
            <option value="">All Clinics</option>
            {(isSuperAdmin ? tenantClinics : clinics).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        {/* Role filter — not needed for global super admin view */}
        {(!isSuperAdmin || tenantFilter) && (
          <select value={roleFilter} onChange={(e) => handleRoleFilter(e.target.value)} className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-36">
            <option value="">All Roles</option>
            {(isSuperAdmin ? [...ROLES, "tenant_admin"] : ROLES).map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        )}

        {/* Status filter */}
        {(!isSuperAdmin || tenantFilter) && (
          <select value={statusFilter} onChange={(e) => handleStatusFilter(e.target.value)} className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-36">
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending_verification">Pending</option>
            <option value="locked">Locked</option>
          </select>
        )}

        {/* Active filter count badge */}
        {(tenantFilter || clinicFilter || roleFilter || statusFilter || search) && (
          <button
            onClick={() => {
              setTenantFilter("");
              setClinicFilter("");
              setRoleFilter("");
              setStatusFilter("");
              setSearch("");
              setSearchInput("");
              setPage(1);
            }}
            className="px-3 py-2.5 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg border border-red-200 whitespace-nowrap"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      {(() => {
        // Build a lookup map for clinic names from the loaded clinics list
        const clinicMap = new Map<string, string>((isSuperAdmin ? tenantClinics : clinics).map((c) => [c.id, c.name]));
        // Show role column when not super-admin global view
        const showRole = !isSuperAdmin || !!tenantFilter;
        // Show clinic column when clinic data is available
        const showClinic = (!isSuperAdmin || !!tenantFilter) && (isSuperAdmin ? tenantClinics : clinics).length > 0;
        const colCount = 4 + (showRole ? 1 : 0) + (showClinic ? 1 : 0);

        return (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className={thCls} onClick={() => handleSort("last_name")}>
                      Name <SortIcon field="last_name" sortBy={sortBy} sortOrder={sortOrder} />
                    </th>
                    <th className={thCls} onClick={() => handleSort("email")}>
                      Email <SortIcon field="email" sortBy={sortBy} sortOrder={sortOrder} />
                    </th>
                    {showRole && (
                      <th className={thCls} onClick={() => handleSort("role")}>
                        Role <SortIcon field="role" sortBy={sortBy} sortOrder={sortOrder} />
                      </th>
                    )}
                    {showClinic && <th className={thCls}>Clinic</th>}
                    <th className={thCls} onClick={() => handleSort("status")}>
                      Status <SortIcon field="status" sortBy={sortBy} sortOrder={sortOrder} />
                    </th>
                    <th className={thCls} onClick={() => handleSort("created_at")}>
                      Joined <SortIcon field="created_at" sortBy={sortBy} sortOrder={sortOrder} />
                    </th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className={`divide-y divide-slate-50 transition-opacity duration-150 ${isFetching && !isLoading ? "opacity-50" : "opacity-100"}`}>
                  {isLoading && users.length === 0 ? (
                    <tr>
                      <td colSpan={colCount} className="text-center py-12 text-slate-400">
                        Loading…
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={colCount} className="text-center py-12 text-slate-400">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-slate-900">
                            {u.first_name} {u.last_name}
                          </p>
                          {u.phone && <p className="text-xs text-slate-400 mt-0.5">{u.phone}</p>}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">{u.email ?? "—"}</td>
                        {showRole && (
                          <td className="px-5 py-3.5">
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${ROLE_COLORS[u.role] ?? "bg-gray-100 text-gray-600"}`}>{u.role?.replace(/_/g, " ") ?? "—"}</span>
                          </td>
                        )}
                        {showClinic && <td className="px-5 py-3.5 text-slate-500 text-xs">{u.clinic_id ? (clinicMap.get(u.clinic_id) ?? u.clinic_id) : "—"}</td>}
                        <td className="px-5 py-3.5">
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[u.status] ?? "bg-gray-100 text-gray-600"}`}>{u.status?.replace(/_/g, " ") ?? "—"}</span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 text-xs">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => setEditTarget(u)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                              <Edit2 className="h-4 w-4" />
                            </button>
                            {!isSuperAdmin && (
                              <button onClick={() => setDeleteTarget(u)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
          </div>
        );
      })()}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-2">Deactivate User?</h3>
            <p className="text-sm text-slate-600 mb-6">
              Deactivate{" "}
              <strong>
                {deleteTarget.first_name} {deleteTarget.last_name}
              </strong>
              ? They will lose access to the system.
            </p>
            <div className="flex gap-3">
              <button onClick={() => deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending} className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium py-2.5 rounded-lg text-sm">
                {deleteMutation.isPending ? "Deactivating…" : "Deactivate"}
              </button>
              <button onClick={() => setDeleteTarget(null)} className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2.5 rounded-lg text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewModal && (
        <UserFormModal
          clinics={isSuperAdmin ? tenantClinics : clinics}
          onClose={() => setShowNewModal(false)}
          onSuccess={() => {
            setShowNewModal(false);
            invalidate();
          }}
        />
      )}

      {editTarget && (
        <UserFormModal
          user={editTarget}
          isSuperAdmin={isSuperAdmin}
          clinics={isSuperAdmin ? tenantClinics : clinics}
          onClose={() => setEditTarget(null)}
          onSuccess={() => {
            setEditTarget(null);
            invalidate();
          }}
        />
      )}
    </div>
  );
}

function UserFormModal({ user, isSuperAdmin, clinics, onClose, onSuccess }: { user?: any; isSuperAdmin?: boolean; clinics?: { id: string; name: string }[]; onClose: () => void; onSuccess: () => void }) {
  const isEdit = !!user;
  const tenantFeatures = useSelector((state: RootState) => state.tenant?.features ?? {});

  // Modules enabled at tenant level — these are the only ones the tenant admin can toggle per user
  const enabledModules = MODULES.filter(({ key }) => tenantFeatures[key] !== false);

  const [form, setForm] = useState({
    first_name: user?.first_name ?? "",
    last_name: user?.last_name ?? "",
    email: user?.email ?? "",
    role: user?.role ?? "doctor",
    password: "",
    phone: user?.phone ?? "",
    clinic_id: user?.clinic_id ?? "",
  });

  // Per-user module access: default all tenant-enabled modules to ON, respect saved user.features
  const [userModules, setUserModules] = useState<Record<string, boolean>>(() => {
    const saved: Record<string, boolean> = user?.features ?? {};
    return Object.fromEntries(enabledModules.map(({ key }) => [key, saved[key] !== false]));
  });

  const toggleUserModule = (key: string) => setUserModules((prev) => ({ ...prev, [key]: !prev[key] }));

  const mutation = useMutation({
    mutationFn: () => {
      if (isEdit) {
        const body: any = {
          first_name: form.first_name,
          last_name: form.last_name,
          phone: form.phone || undefined,
          clinic_id: form.clinic_id || null,
          features: userModules,
        };
        if (form.password) body.new_password = form.password;
        return api.patch(`/users/${user.id}`, body);
      }
      return api.post("/users/", { ...form, clinic_id: form.clinic_id || undefined });
    },
    onSuccess,
  });

  const cls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-slate-900">{isEdit ? "Edit User" : "Add User"}</h3>
          <button onClick={onClose}>
            <X className="h-5 w-5 text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        {mutation.isError && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">{(mutation.error as any)?.response?.data?.message ?? "Operation failed"}</div>}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="First Name *" value={form.first_name} onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))} className={cls} />
            <input placeholder="Last Name *" value={form.last_name} onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))} className={cls} />
          </div>
          {!isEdit && <input type="email" placeholder="Email *" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className={cls} />}
          <input type="tel" placeholder="Phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className={cls} />
          {!isEdit && !isSuperAdmin && (
            <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} className={cls}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          )}
          {!isSuperAdmin && clinics && clinics.length > 0 && (
            <select value={form.clinic_id} onChange={(e) => setForm((p) => ({ ...p, clinic_id: e.target.value }))} className={cls}>
              <option value="">No specific clinic</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <input type="password" placeholder={isEdit ? "New Password (leave blank to keep)" : "Password *"} value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} className={cls} />
        </div>

        {/* Module access — only shown when editing, and only for tenant admins */}
        {isEdit && !isSuperAdmin && enabledModules.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Module Access</p>
            <div className="grid grid-cols-2 gap-2">
              {enabledModules.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleUserModule(key)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${userModules[key] ? "bg-blue-50 border-blue-300 text-blue-800" : "bg-slate-50 border-slate-200 text-slate-400 line-through"}`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${userModules[key] ? "bg-blue-500" : "bg-slate-300"}`} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-5">
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.first_name || !form.last_name || (!isEdit && (!form.email || !form.password))}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-lg text-sm"
          >
            {mutation.isPending ? "Saving…" : isEdit ? "Save Changes" : "Create User"}
          </button>
          <button onClick={onClose} className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2.5 rounded-lg text-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
