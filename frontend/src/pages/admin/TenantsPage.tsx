import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, X, Building2, AlertTriangle, UserCircle, UserPlus, Eye, EyeOff, Pencil } from "lucide-react";
import api from "@/services/api";
import Pagination from "@/components/ui/Pagination";

const MODULES = [
  { key: "appointments",    label: "Appointments" },
  { key: "patients",        label: "Patients" },
  { key: "doctors",         label: "Doctors" },
  { key: "medical_records", label: "Medical Records" },
  { key: "prescriptions",   label: "Prescriptions" },
  { key: "lab",             label: "Lab Reports" },
  { key: "billing",         label: "Billing" },
  { key: "pharmacy",        label: "Pharmacy" },
  { key: "accounting",      label: "Accounting" },
  { key: "analytics",       label: "Analytics" },
];

const PAGE_SIZE = 20;

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-600",
  suspended: "bg-red-100 text-red-700",
};

const PLAN_COLORS: Record<string, string> = {
  basic: "bg-blue-50 text-blue-700",
  professional: "bg-purple-50 text-purple-700",
  enterprise: "bg-indigo-50 text-indigo-700",
};

export default function TenantsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<any>(null);
  const [editTarget, setEditTarget] = useState<any>(null);

  const { data: tenantsData, isLoading } = useQuery({
    queryKey: ["tenants", debouncedSearch, page],
    queryFn: () =>
      api.get("/tenants/", { params: { search: debouncedSearch || undefined, page, page_size: PAGE_SIZE } })
        .then((r) => r.data),
    keepPreviousData: true,
  } as any);

  const allTenants: any[] = Array.isArray((tenantsData as any)?.data) ? (tenantsData as any).data : [];
  const total: number = (tenantsData as any)?.meta?.total ?? 0;

  const filteredTenants = allTenants;

  const suspendMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/tenants/${id}/suspend`, {}),
    onSuccess: () => { setSuspendTarget(null); qc.invalidateQueries({ queryKey: ["tenants"] }); },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tenant Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage clinic organizations and subscriptions</p>
        </div>
        <button onClick={() => setShowNewModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm">
          <Plus className="h-4 w-4" /> New Tenant
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text" placeholder="Search by name or email…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-8 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {isLoading && <div className="text-center py-12 text-slate-400 text-sm">Loading tenants…</div>}

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filteredTenants.map((t) => (
          <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{t.name}</h3>
                  <p className="text-xs text-slate-500">{t.primary_email ?? "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditTarget(t)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  title="Edit tenant"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[t.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {t.status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 bg-slate-50 rounded-lg p-3 mb-4">
              <div className="text-center">
                <p className="text-xl font-bold text-slate-900">{t.clinics_count ?? "—"}</p>
                <p className="text-xs text-slate-500">Clinics</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-slate-900">{t.users_count ?? "—"}</p>
                <p className="text-xs text-slate-500">Users</p>
              </div>
              <div className="text-center">
                <p className={`text-sm font-bold capitalize px-2 py-0.5 rounded-full ${PLAN_COLORS[t.plan] ?? "bg-gray-50 text-gray-700"}`}>{t.plan}</p>
                <p className="text-xs text-slate-500 mt-1">Plan</p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
              <span>Created {t.created_at?.slice(0, 10)}</span>
              {t.trial_ends_at && <span>Trial ends {t.trial_ends_at?.slice(0, 10)}</span>}
            </div>

            <div className="flex gap-2">
              {t.status === "active" && (
                <button
                  onClick={() => setSuspendTarget(t)}
                  className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 font-medium py-2 rounded-lg text-xs transition"
                >
                  Suspend
                </button>
              )}
              {t.status === "suspended" && (
                <span className="flex-1 text-center text-xs text-red-600 font-medium py-2">Suspended</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {!isLoading && filteredTenants.length === 0 && (
        <div className="text-center py-16 text-slate-400 text-sm">No tenants found.</div>
      )}

      {total > PAGE_SIZE && (
        <div className="mt-4 bg-white rounded-xl border border-slate-200">
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        </div>
      )}

      {/* Confirm Suspend Modal */}
      {suspendTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Suspend Tenant?</h3>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to suspend <strong>{suspendTarget.name}</strong>? Their users will lose access immediately.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => suspendMutation.mutate(suspendTarget.id)}
                disabled={suspendMutation.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium py-2.5 rounded-lg text-sm"
              >
                {suspendMutation.isPending ? "Suspending…" : "Yes, Suspend"}
              </button>
              <button onClick={() => setSuspendTarget(null)} className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2.5 rounded-lg text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewModal && (
        <NewTenantModal
          onClose={() => setShowNewModal(false)}
          onSuccess={() => { setShowNewModal(false); qc.invalidateQueries({ queryKey: ["tenants"] }); }}
        />
      )}

      {editTarget && (
        <EditTenantModal
          tenant={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["tenants"] });
          qc.invalidateQueries({ queryKey: ["all-users-for-admin"] });
          setEditTarget(null);
        }}
        />
      )}
    </div>
  );
}

function slugify(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const COUNTRY_OPTIONS = [
  ["US","United States"],["GB","United Kingdom"],["CA","Canada"],["AU","Australia"],
  ["IN","India"],["AE","UAE"],["SA","Saudi Arabia"],["SG","Singapore"],
  ["DE","Germany"],["FR","France"],["NL","Netherlands"],["PH","Philippines"],
  ["NG","Nigeria"],["ZA","South Africa"],["KE","Kenya"],["PK","Pakistan"],
  ["BD","Bangladesh"],["EG","Egypt"],["TR","Turkey"],["BR","Brazil"],["MX","Mexico"],
  ["OTHER","Other"],
];

function NewTenantModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [adminMode, setAdminMode] = useState<"new" | "existing">("new");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");

  // Organisation fields
  const [orgName, setOrgName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("US");
  const [timezone, setTimezone] = useState("UTC");
  const [plan, setPlan] = useState("professional");

  // Admin fields
  const [adminFirst, setAdminFirst] = useState("");
  const [adminLast, setAdminLast] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  // Fetch all users for "existing user" mode
  const { data: usersData } = useQuery({
    queryKey: ["users-list"],
    queryFn: () => api.get("/users/", { params: { limit: 200 } }).then((r) => r.data.data),
    enabled: adminMode === "existing",
  });
  const allUsers: any[] = usersData?.items ?? usersData ?? [];

  // Auto-generate slug from org name
  useEffect(() => {
    if (!slugManual) setSlug(slugify(orgName));
  }, [orgName, slugManual]);

  // Pre-fill admin fields when an existing user is selected
  useEffect(() => {
    if (adminMode === "existing" && selectedUserId) {
      const u = allUsers.find((u) => u.id === selectedUserId);
      if (u) {
        setAdminFirst(u.first_name ?? u.full_name?.split(" ")[0] ?? "");
        setAdminLast(u.last_name ?? u.full_name?.split(" ").slice(1).join(" ") ?? "");
        setAdminEmail(u.email ?? "");
      }
    } else if (adminMode === "new") {
      setAdminFirst("");
      setAdminLast("");
      setAdminEmail("");
      setAdminPassword("");
      setSelectedUserId("");
    }
  }, [adminMode, selectedUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/tenants/onboard", {
        name: orgName,
        slug,
        primary_email: contactEmail || adminEmail,
        primary_phone: phone || undefined,
        country,
        timezone,
        plan,
        admin_first_name: adminFirst,
        admin_last_name: adminLast,
        admin_email: adminEmail,
        admin_password: adminPassword,
      }),
    onSuccess,
  });

  const cls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const canSubmit =
    orgName &&
    contactEmail &&
    adminEmail &&
    adminFirst &&
    adminLast &&
    (adminMode === "existing" ? !!selectedUserId : !!adminPassword);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-slate-900">Onboard New Tenant</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400 hover:text-slate-600" /></button>
        </div>

        {mutation.isError && (
          <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">
            {(mutation.error as any)?.response?.data?.detail ?? (mutation.error as any)?.response?.data?.message ?? "Failed to create tenant"}
          </div>
        )}

        {/* Organisation Details */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Organisation Details</p>
          <div className="space-y-3">
            <input
              placeholder="Organisation Name *"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className={cls}
            />
            <div className="relative">
              <input
                placeholder="Slug (auto-generated)"
                value={slug}
                onChange={(e) => { setSlugManual(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); }}
                className={cls}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                {slugManual ? "custom" : "auto"}
              </span>
            </div>
            <input
              type="email"
              placeholder="Contact Email *"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className={cls}
            />
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className={cls} />
              <select value={country} onChange={(e) => setCountry(e.target.value)} className={cls}>
                {COUNTRY_OPTIONS.map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={cls}>
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern (EST/EDT)</option>
                <option value="America/Chicago">Central (CST/CDT)</option>
                <option value="America/Los_Angeles">Pacific (PST/PDT)</option>
                <option value="Europe/London">London (GMT/BST)</option>
                <option value="Europe/Paris">Paris (CET/CEST)</option>
                <option value="Asia/Dubai">Dubai (GST)</option>
                <option value="Asia/Kolkata">India (IST)</option>
                <option value="Asia/Singapore">Singapore (SGT)</option>
              </select>
              <select value={plan} onChange={(e) => setPlan(e.target.value)} className={cls}>
                <option value="basic">Basic</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          </div>
        </div>

        <hr className="border-slate-100 mb-5" />

        {/* Admin Account */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Admin Account</p>

          {/* Mode toggle */}
          <div className="flex gap-2 mb-4 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setAdminMode("new")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors ${
                adminMode === "new" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <UserPlus className="h-4 w-4" />
              New User
            </button>
            <button
              type="button"
              onClick={() => setAdminMode("existing")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors ${
                adminMode === "existing" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <UserCircle className="h-4 w-4" />
              Existing User
            </button>
          </div>

          {adminMode === "existing" && (
            <div className="mb-3">
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className={cls}
              >
                <option value="">— Select a user —</option>
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name ?? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim()} ({u.email}) · {u.role}
                  </option>
                ))}
              </select>
              {selectedUserId && (() => {
                const u = allUsers.find((u) => u.id === selectedUserId);
                return u ? (
                  <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                      {(u.full_name ?? u.email ?? "U").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{u.full_name}</p>
                      <p className="text-xs text-slate-500">{u.email} · <span className="capitalize">{u.role}</span></p>
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          )}

          <div className="space-y-3">
            {adminMode === "new" && (
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="First Name *"
                  value={adminFirst}
                  onChange={(e) => setAdminFirst(e.target.value)}
                  className={cls}
                />
                <input
                  placeholder="Last Name *"
                  value={adminLast}
                  onChange={(e) => setAdminLast(e.target.value)}
                  className={cls}
                />
              </div>
            )}
            {adminMode === "new" && (
              <input
                type="email"
                placeholder="Admin Email *"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className={cls}
              />
            )}
            {adminMode === "new" && (
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password for this tenant *"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className={cls}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !canSubmit}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-lg text-sm"
          >
            {mutation.isPending ? "Creating…" : "Create Tenant"}
          </button>
          <button onClick={onClose} className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2.5 rounded-lg text-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function EditTenantModal({ tenant, onClose, onSuccess }: { tenant: any; onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState(tenant.name ?? "");
  const [email, setEmail] = useState(tenant.primary_email ?? "");
  const [phone, setPhone] = useState(tenant.primary_phone ?? "");
  const [country, setCountry] = useState(tenant.country ?? "US");
  const [timezone, setTimezone] = useState(tenant.timezone ?? "UTC");
  const [plan, setPlan] = useState(tenant.plan ?? "basic");
  const [status, setStatus] = useState(tenant.status ?? "active");
  const [newAdminId, setNewAdminId] = useState("");
  // Module access: default all ON when features is empty/undefined
  const [modules, setModules] = useState<Record<string, boolean>>(() => {
    const f: Record<string, boolean> = tenant.features ?? {};
    return Object.fromEntries(MODULES.map(({ key }) => [key, f[key] !== false]));
  });
  const toggleModule = (key: string) =>
    setModules((prev) => ({ ...prev, [key]: !prev[key] }));

  const { data: usersData, isLoading: usersLoading, isError: usersError } = useQuery({
    queryKey: ["all-users-for-admin"],
    queryFn: () => api.get("/users/", { params: { limit: 500 } }).then((r) => {
      const d = r.data.data;
      return Array.isArray(d) ? d : (d?.items ?? []);
    }),
  });
  const allUsers: any[] = usersData ?? [];

  // Current admin comes from the tenant object (stored on save, cross-tenant safe)
  const currentAdmin = tenant.admin_user_id
    ? { id: tenant.admin_user_id, full_name: tenant.admin_name, email: tenant.admin_email }
    : null;

  const mutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/tenants/${tenant.id}`, {
        name, primary_email: email, primary_phone: phone || undefined, country, timezone, plan, status,
      });
      if (newAdminId && newAdminId !== currentAdmin?.id) {
        await api.patch(`/tenants/${tenant.id}/admin`, { user_id: newAdminId });
      }
      await api.patch(`/tenants/${tenant.id}/modules`, { modules });
    },
    onSuccess,
  });

  const cls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-slate-900">Edit Tenant</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400 hover:text-slate-600" /></button>
        </div>

        {mutation.isError && (
          <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">
            {(mutation.error as any)?.response?.data?.detail ?? "Failed to update tenant"}
          </div>
        )}

        {/* Stats banner */}
        <div className="grid grid-cols-3 gap-3 bg-slate-50 rounded-lg p-3 mb-5">
          <div className="text-center">
            <p className="text-xl font-bold text-slate-900">{tenant.clinics_count ?? "—"}</p>
            <p className="text-xs text-slate-500">Clinics</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-slate-900">{tenant.users_count ?? "—"}</p>
            <p className="text-xs text-slate-500">Users</p>
          </div>
          <div className="text-center">
            <p className={`text-sm font-bold capitalize px-2 py-0.5 rounded-full ${PLAN_COLORS[tenant.plan] ?? "bg-gray-50 text-gray-700"}`}>{tenant.plan}</p>
            <p className="text-xs text-slate-500 mt-1">Current Plan</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Organisation Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={cls} placeholder="Organisation Name *" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Contact Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={cls} placeholder="Contact Email *" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={cls} placeholder="Phone" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Country</label>
              <select value={country} onChange={(e) => setCountry(e.target.value)} className={cls}>
                {COUNTRY_OPTIONS.map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Timezone</label>
              <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={cls}>
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern (EST/EDT)</option>
                <option value="America/Chicago">Central (CST/CDT)</option>
                <option value="America/Los_Angeles">Pacific (PST/PDT)</option>
                <option value="Europe/London">London (GMT/BST)</option>
                <option value="Europe/Paris">Paris (CET/CEST)</option>
                <option value="Asia/Dubai">Dubai (GST)</option>
                <option value="Asia/Kolkata">India (IST)</option>
                <option value="Asia/Singapore">Singapore (SGT)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Plan</label>
              <select value={plan} onChange={(e) => setPlan(e.target.value)} className={cls}>
                <option value="basic">Basic</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={cls}>
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="suspended">Suspended</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Module Access */}
        <hr className="border-slate-100 my-5" />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Module Access</p>
        <div className="grid grid-cols-2 gap-2">
          {MODULES.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleModule(key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                modules[key]
                  ? "bg-blue-50 border-blue-300 text-blue-800"
                  : "bg-slate-50 border-slate-200 text-slate-400 line-through"
              }`}
            >
              <span className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${modules[key] ? "bg-blue-500" : "bg-slate-300"}`} />
              {label}
            </button>
          ))}
        </div>

        {/* Tenant Admin */}
        <hr className="border-slate-100 my-5" />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Tenant Admin</p>

        {currentAdmin && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
              {(currentAdmin.full_name ?? currentAdmin.email ?? "A").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{currentAdmin.full_name ?? "—"}</p>
              <p className="text-xs text-slate-500">{currentAdmin.email} · Current admin</p>
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Change Admin
            {usersLoading && <span className="ml-1 text-slate-400 font-normal">(loading users…)</span>}
          </label>
          {usersError ? (
            <p className="text-xs text-red-500 py-2">Failed to load users. Check server logs.</p>
          ) : (
            <select
              value={newAdminId}
              onChange={(e) => setNewAdminId(e.target.value)}
              disabled={usersLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">— Keep current admin —</option>
              {allUsers
                .filter((u) => u.id !== currentAdmin?.id)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name ?? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim()} ({u.email}) · {u.role}
                  </option>
                ))}
            </select>
          )}
          {!usersLoading && !usersError && allUsers.length <= 1 && (
            <p className="text-xs text-slate-400 mt-1">No users found.</p>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !name || !email}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-lg text-sm"
          >
            {mutation.isPending ? "Saving…" : "Save Changes"}
          </button>
          <button onClick={onClose} className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2.5 rounded-lg text-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
