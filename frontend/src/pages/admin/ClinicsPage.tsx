import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, MapPin, Phone, X, Building2, Pencil } from "lucide-react";
import api from "@/services/api";
import { useAppSelector } from "@/store/hooks";
import Pagination from "@/components/ui/Pagination";
import AddressFields, { type AddressValue } from "@/components/ui/AddressFields";
import { useEnabledCountries } from "@/hooks/useEnabledCountries";
import { ALL_COUNTRIES } from "@/utils/addressData";

function resolveStateName(countryCode: string, stateCode: string): string {
  if (!stateCode) return "";
  const country = ALL_COUNTRIES.find((c) => c.code === countryCode);
  if (!country || country.states.length === 0) return stateCode;
  const state = country.states.find((s) => s.code === stateCode);
  return state ? state.name : stateCode;
}

const PAGE_SIZE = 20;

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-600",
  temporarily_closed: "bg-yellow-100 text-yellow-700",
  suspended: "bg-red-100 text-red-700",
};

const SLOT_OPTIONS = [10, 15, 20, 25, 30];


export default function ClinicsPage() {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filterTenantId, setFilterTenantId] = useState("");
  const [page, setPage] = useState(1);
  const [showNewModal, setShowNewModal] = useState(false);
  const [editClinic, setEditClinic] = useState<any | null>(null);
  const role = useAppSelector((s) => s.auth.user?.role);
  const tenantId = useAppSelector((s) => s.auth.user?.tenant_id);
  const isSuperAdmin = role === "super_admin";

  // Tenant list for filter dropdown (super admin only)
  const { data: tenantsData } = useQuery({
    queryKey: ["tenants-list"],
    queryFn: () => api.get("/tenants/", { params: { page_size: 200 } }).then((r) => r.data.data),
    enabled: isSuperAdmin,
  });
  const tenants: any[] = Array.isArray(tenantsData) ? tenantsData : [];

  const { data: clinicsRaw, isLoading } = useQuery({
    queryKey: ["clinics", tenantId, filterTenantId, search, page],
    queryFn: () =>
      api.get("/clinics/", {
        params: {
          page,
          page_size: PAGE_SIZE,
          search: search || undefined,
          ...(isSuperAdmin && filterTenantId ? { tenant_id: filterTenantId } : {}),
        },
      }).then((r) => r.data),
    keepPreviousData: true,
  } as any);

  const filtered: any[] = Array.isArray((clinicsRaw as any)?.data) ? (clinicsRaw as any).data : [];
  const total: number = (clinicsRaw as any)?.meta?.total ?? 0;

  const handleSearch = () => { setSearch(searchInput); setPage(1); };

  const invalidate = () => qc.invalidateQueries({ queryKey: ["clinics", tenantId] });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clinics</h1>
          <p className="text-sm text-slate-500 mt-1">Manage clinic branches and locations</p>
        </div>
        <button onClick={() => setShowNewModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm">
          <Plus className="h-4 w-4" /> Add Clinic
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className={`grid gap-3 ${isSuperAdmin ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text" placeholder="Search by name or city…" value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button onClick={handleSearch} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg whitespace-nowrap">
            Search
          </button>
          {isSuperAdmin && (
            <select
              value={filterTenantId}
              onChange={(e) => { setFilterTenantId(e.target.value); setPage(1); }}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
            >
              <option value="">All tenants</option>
              {tenants.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {isLoading && <div className="text-center py-12 text-slate-400 text-sm">Loading clinics…</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filtered.map((c) => (
          <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{c.name}</h3>
                  {c.code && <p className="text-xs text-slate-500">{c.code}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {c.status?.replace(/_/g, " ")}
                </span>
                <button
                  onClick={() => setEditClinic(c)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                  title="Edit clinic"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            </div>

            {(c.address_line1 || c.city) && (
              <div className="flex items-start gap-2 text-sm text-slate-600 mb-2">
                <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5 text-slate-400" />
                <span>{[c.address_line1, c.city, resolveStateName(c.country, c.state)].filter(Boolean).join(", ")}</span>
              </div>
            )}

            {c.phone && (
              <div className="flex items-center gap-2 text-sm text-slate-600 mb-3">
                <Phone className="h-4 w-4 flex-shrink-0 text-slate-400" />
                <span>{c.phone}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Slot: {c.appointment_slot_duration ?? 15} min</span>
              {isSuperAdmin && c.tenant_id && (
                <span
                  className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full cursor-pointer hover:bg-blue-100 transition-colors"
                  onClick={() => setFilterTenantId(c.tenant_id === filterTenantId ? "" : c.tenant_id)}
                  title="Click to filter by this tenant"
                >
                  {tenants.find((t) => t.id === c.tenant_id)?.name ?? c.tenant_id.slice(0, 8) + "…"}
                </span>
              )}
              {c.email && !isSuperAdmin && <span>{c.email}</span>}
            </div>
          </div>
        ))}
      </div>

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-16 text-slate-400 text-sm">No clinics found.</div>
      )}

      {total > PAGE_SIZE && (
        <div className="mt-4 bg-white rounded-xl border border-slate-200">
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        </div>
      )}

      {showNewModal && (
        <ClinicModal
          isSuperAdmin={isSuperAdmin}
          onClose={() => setShowNewModal(false)}
          onSuccess={() => { setShowNewModal(false); invalidate(); }}
        />
      )}

      {editClinic && (
        <ClinicModal
          isSuperAdmin={isSuperAdmin}
          clinic={editClinic}
          onClose={() => setEditClinic(null)}
          onSuccess={() => { setEditClinic(null); invalidate(); }}
        />
      )}
    </div>
  );
}

function ClinicModal({
  isSuperAdmin,
  clinic,
  onClose,
  onSuccess,
}: {
  isSuperAdmin: boolean;
  clinic?: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!clinic;

  const [form, setForm] = useState({
    name: clinic?.name ?? "",
    code: clinic?.code ?? "",
    address_line1: clinic?.address_line1 ?? "",
    phone: clinic?.phone ?? "",
    email: clinic?.email ?? "",
    appointment_slot_duration: String(clinic?.appointment_slot_duration ?? 15),
    status: clinic?.status ?? "active",
    tenant_id: clinic?.tenant_id ?? "",
  });

  const [address, setAddress] = useState<AddressValue>({
    country: clinic?.country ?? "US",
    state: clinic?.state ?? "",
    city: clinic?.city ?? "",
    postal_code: clinic?.postal_code ?? "",
  });

  const { countries } = useEnabledCountries();

  const { data: tenantsData } = useQuery({
    queryKey: ["tenants-list"],
    queryFn: () => api.get("/tenants/").then((r) => r.data.data),
    enabled: isSuperAdmin,
  });
  const tenants: any[] = Array.isArray(tenantsData) ? tenantsData : [];

  const mutation = useMutation({
    mutationFn: () => {
      const payload: any = {
        name: form.name,
        code: form.code || undefined,
        address_line1: form.address_line1,
        country: address.country,
        city: address.city,
        state: address.state,
        postal_code: address.postal_code,
        phone: form.phone || undefined,
        email: form.email || undefined,
        appointment_slot_duration: Number(form.appointment_slot_duration),
        status: form.status,
      };
      if (isEdit) {
        return api.patch(`/clinics/${clinic.id}`, payload);
      }
      if (isSuperAdmin && form.tenant_id) {
        payload.tenant_id = form.tenant_id;
      }
      return api.post("/clinics/", payload);
    },
    onSuccess,
  });

  const cls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const f = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

  const canSubmit =
    form.name && form.address_line1 && address.country && address.city && address.postal_code &&
    (!isSuperAdmin || isEdit || form.tenant_id);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-slate-900">
            {isEdit ? "Edit Clinic" : "Add New Clinic"}
          </h3>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400 hover:text-slate-600" /></button>
        </div>

        {mutation.isError && (
          <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">
            {(mutation.error as any)?.response?.data?.message ?? "Failed to save clinic"}
          </div>
        )}

        <div className="space-y-3">
          {isSuperAdmin && !isEdit && (
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Tenant *</label>
              <select value={form.tenant_id} onChange={f("tenant_id")} className={cls} required>
                <option value="">Select a tenant…</option>
                {tenants.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Clinic Name *</label>
              <input placeholder="e.g. Downtown Branch" value={form.name} onChange={f("name")} required className={cls} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Clinic Code</label>
              <input placeholder="e.g. CLN-001" value={form.code} onChange={f("code")} className={cls} />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1 block">Street Address *</label>
            <input placeholder="Street address" value={form.address_line1} onChange={f("address_line1")} required className={cls} />
          </div>

          <AddressFields
            value={address}
            onChange={setAddress}
            countries={countries}
            required={{ country: true, city: true, postal_code: true }}
            inputCls={cls}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Phone</label>
              <input placeholder="+1 555 000 0000" value={form.phone} onChange={f("phone")} className={cls} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Email</label>
              <input type="email" placeholder="clinic@example.com" value={form.email} onChange={f("email")} className={cls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Appointment Slot Duration</label>
              <select value={form.appointment_slot_duration} onChange={f("appointment_slot_duration")} className={cls}>
                {SLOT_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m} minutes</option>
                ))}
              </select>
            </div>
            {isEdit && (
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Status</label>
                <select value={form.status} onChange={f("status")} className={cls}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="temporarily_closed">Temporarily Closed</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !canSubmit}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-lg text-sm"
          >
            {mutation.isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Clinic"}
          </button>
          <button onClick={onClose} className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2.5 rounded-lg text-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
