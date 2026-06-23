import { useState, useEffect, Suspense } from "react";
import { Outlet, NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { STORAGE_KEYS, API_BASE_URL } from "../../utils/constants";
import api from "../../services/api";
import appConfig from "../../config/app";
import AppLogo from "../ui/AppLogo";
import { useDispatch, useSelector } from "react-redux";
import { switchTenantThunk, setActivePatient, ActivePatient } from "../../store/slices/authSlice";
import {
  Calendar,
  Pill,
  FlaskConical,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronDown,
  ChevronRight,
  Home,
  Shield,
  LayoutDashboard,
  Globe,
  Layers,
  Stethoscope,
  ArrowLeftRight,
  Check,
  Loader2,
  UserCircle,
  Baby,
  BookOpen,
} from "lucide-react";
import { RootState, AppDispatch } from "../../store";
import { logout } from "../../store/slices/authSlice";
import { setCurrency, setFeatureFlags, setUserFeatureFlags } from "../../store/slices/tenantSlice";
import { getModuleForPath, type UserRole } from "../../modules/registry";
import { useNavTracking } from "../../hooks/useNavTracking";

// ─── Navigation configs per role ────────────────────────────────────────────

const SUPER_ADMIN_NAV = [
  { name: "System Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { name: "Tenants", href: "/admin/tenants", icon: Layers },
  { name: "All Clinics", href: "/admin/clinics", icon: Globe },
  { name: "System Users", href: "/admin/users", icon: Shield },
  { name: "Specializations", href: "/admin/specializations", icon: Stethoscope },
  // { name: "Accounting", href: "/accounting", icon: BookOpen },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Settings", href: "/settings", icon: Settings },
];

const PATIENT_NAV = [
  { name: "My Appointments", href: "/appointments", icon: Calendar },
  { name: "My Prescriptions", href: "/prescriptions", icon: Pill },
  { name: "My Reports", href: "/lab", icon: FlaskConical },
];


// ─── Role metadata ───────────────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; badgeClass: string; sidebarAccent: string }> = {
  super_admin: {
    label: "Platform Admin",
    badgeClass: "bg-purple-500/20 text-purple-200 border border-purple-500/30",
    sidebarAccent: "bg-primary-600",
  },
  tenant_admin: {
    label: "Tenant Admin",
    badgeClass: "bg-blue-500/20 text-blue-200 border border-blue-500/30",
    sidebarAccent: "bg-primary-600",
  },
  clinic_admin: {
    label: "Clinic Admin",
    badgeClass: "bg-teal-500/20 text-teal-200 border border-teal-500/30",
    sidebarAccent: "bg-primary-600",
  },
  doctor: {
    label: "Doctor",
    badgeClass: "bg-green-500/20 text-green-200 border border-green-500/30",
    sidebarAccent: "bg-primary-600",
  },
  nurse: {
    label: "Nurse",
    badgeClass: "bg-sky-500/20 text-sky-200 border border-sky-500/30",
    sidebarAccent: "bg-primary-600",
  },
  receptionist: {
    label: "Receptionist",
    badgeClass: "bg-amber-500/20 text-amber-200 border border-amber-500/30",
    sidebarAccent: "bg-primary-600",
  },
  pharmacist: {
    label: "Pharmacist",
    badgeClass: "bg-orange-500/20 text-orange-200 border border-orange-500/30",
    sidebarAccent: "bg-primary-600",
  },
  lab_technician: {
    label: "Lab Tech",
    badgeClass: "bg-cyan-500/20 text-cyan-200 border border-cyan-500/30",
    sidebarAccent: "bg-primary-600",
  },
  patient: {
    label: "Patient",
    badgeClass: "bg-emerald-500/20 text-emerald-200 border border-emerald-500/30",
    sidebarAccent: "bg-primary-600",
  },
};

// ─── Accounting sub-nav items ────────────────────────────────────────────────

const ACCOUNTING_SUB_NAV = [
  { name: "Dashboard", href: "/accounting", group: "" },
  // ── Entry
  { name: "Chart of Accounts", href: "/accounting/chart-of-accounts", group: "Entry" },
  { name: "New Voucher", href: "/accounting/vouchers/new", group: "Entry" },
  { name: "All Vouchers", href: "/accounting/vouchers", group: "Entry" },
  // ── Reports
  { name: "Day Book", href: "/accounting/day-book", group: "Reports" },
  { name: "Ledger", href: "/accounting/ledger", group: "Reports" },
  { name: "Trial Balance", href: "/accounting/reports/trial-balance", group: "Reports" },
  { name: "Profit & Loss", href: "/accounting/reports/profit-loss", group: "Reports" },
  { name: "Balance Sheet", href: "/accounting/reports/balance-sheet", group: "Reports" },
  { name: "Cash Flow", href: "/accounting/reports/cash-flow", group: "Reports" },
  { name: "Cash / Bank Book", href: "/accounting/reports/cash-book", group: "Reports" },
  // ── Receivables / Payables
  { name: "AR Aging", href: "/accounting/reports/ar-aging", group: "Receivables/Payables" },
  { name: "AP Aging", href: "/accounting/reports/ap-aging", group: "Receivables/Payables" },
  { name: "Outstanding", href: "/accounting/reports/outstanding", group: "Receivables/Payables" },
  // ── Tax & Compliance
  { name: "GST Reports", href: "/accounting/gst-reports", group: "Tax" },
  { name: "Bank Reconciliation", href: "/accounting/bank-reconciliation", group: "Tax" },
  // ── Configuration
  { name: "Budgets", href: "/accounting/budgets", group: "Config" },
  { name: "Fiscal Years", href: "/accounting/fiscal-years", group: "Config" },
  { name: "Year-End Closing", href: "/accounting/closing-entry", group: "Config" },
];

function AccountingSubNav({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState(true);
  if (collapsed) return null;

  // Group items for section headers
  const groups: string[] = [];
  for (const item of ACCOUNTING_SUB_NAV) {
    if (item.group && !groups.includes(item.group)) groups.push(item.group);
  }

  const groupLabels: Record<string, string> = {
    "Entry": "Entry",
    "Reports": "Reports",
    "Receivables/Payables": "Receivables / Payables",
    "Tax": "Tax & Compliance",
    "Config": "Setup",
  };

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-white/50 hover:text-white/90 font-semibold uppercase tracking-wider"
      >
        <span className="flex items-center gap-2"><BookOpen className="h-3.5 w-3.5" /> Accounting</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="ml-3 border-l border-white/10 pl-3 mt-0.5">
          {/* Dashboard (no group) */}
          {ACCOUNTING_SUB_NAV.filter(i => !i.group).map(item => (
            <NavLink
              key={item.href}
              to={item.href}
              end
              className={({ isActive }) =>
                `block px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                  isActive ? 'text-white bg-white/10' : 'text-white/60 hover:text-white/90 hover:bg-white/[0.07]'
                }`
              }
            >
              {item.name}
            </NavLink>
          ))}
          {/* Grouped items */}
          {groups.map(grp => (
            <div key={grp} className="mt-2">
              <p className="px-2 py-1 text-[10px] uppercase tracking-widest text-white/30 font-semibold">
                {groupLabels[grp] ?? grp}
              </p>
              {ACCOUNTING_SUB_NAV.filter(i => i.group === grp).map(item => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  end={item.href === '/accounting'}
                  className={({ isActive }) =>
                    `block px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                      isActive ? 'text-white bg-white/10' : 'text-white/60 hover:text-white/90 hover:bg-white/[0.07]'
                    }`
                  }
                >
                  {item.name}
                </NavLink>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── NavItem ─────────────────────────────────────────────────────────────────

function NavItem({
  item,
  collapsed,
}: {
  item: { name: string; href: string; icon: React.ElementType };
  collapsed: boolean;
}) {
  const location = useLocation();
  const Icon = item.icon;

  // For items with query params (e.g. /pharmacy?tab=pos) match the full URL.
  // For plain paths, match pathname prefix so nested routes stay highlighted.
  const isActive = item.href.includes('?')
    ? location.pathname + location.search === item.href
    : location.pathname === item.href || location.pathname.startsWith(item.href + '/');

  return (
    <Link
      to={item.href}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all border-l-2 !pl-[10px] ${
        isActive
          ? "text-white bg-white/20 border-white/60"
          : "text-white/60 hover:bg-white/[0.07] hover:text-white border-transparent"
      }`}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      {!collapsed && <span>{item.name}</span>}
    </Link>
  );
}

// ─── DashboardLayout ─────────────────────────────────────────────────────────

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [tenantMenuOpen, setTenantMenuOpen] = useState(false);
  const [switchingTenant, setSwitchingTenant] = useState<string | null>(null);

  const { user, activePatient } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const role = user?.role || "";
  const meta = ROLE_META[role] ?? { label: role, badgeClass: "bg-white/10 text-white/80", sidebarAccent: "bg-primary-600" };

  const handleLogout = async () => {
    queryClient.clear();
    await dispatch(logout());
    navigate("/login");
  };

  const handleSwitchTenant = async (tenantId: string) => {
    setSwitchingTenant(tenantId);
    try {
      await dispatch(switchTenantThunk({ tenant_id: tenantId })).unwrap();
      queryClient.clear();
      setUserMenuOpen(false);
      setTenantMenuOpen(false);
      navigate("/home");
    } catch {
      // error is in redux state; nothing to do here
    } finally {
      setSwitchingTenant(null);
    }
  };

  // Tenants the current user belongs to (for tenant switcher)
  const { data: myTenantsData } = useQuery({
    queryKey: ["my-tenants", user?.id],
    queryFn: () => api.get("/auth/my-tenants").then((r) => r.data.data),
    enabled: !!user,
    staleTime: 60_000,
    retry: false,
  });
  // Override is_current using live Redux state so stale cache never causes a wrong switch
  const myTenants: any[] = (myTenantsData ?? []).map((t: any) => ({
    ...t,
    is_current: t.tenant_id === user?.tenant_id,
  }));
  const hasMultipleTenants = myTenants.length > 1;
  const currentTenantName = myTenants.find((t) => t.is_current)?.tenant_name ?? null;

  // Family members for patient profile switcher
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const { data: familyData } = useQuery({
    queryKey: ["my-family", user?.id],
    queryFn: () => api.get("/patients/me/family").then((r) => r.data.data),
    enabled: role === "patient",
    staleTime: 60_000,
    retry: false,
  });
  const familyMembers: ActivePatient[] = (familyData ?? []).map((f: any) => ({
    id: f.id,
    name: `${f.first_name} ${f.last_name}`.trim(),
    relationship_type: f.relationship_type,
    is_minor: f.is_minor ?? false,
  }));

  const handleSwitchProfile = (profile: ActivePatient | null) => {
    dispatch(setActivePatient(profile));
    setProfileMenuOpen(false);
  };

  // Fetch effective tenant settings to populate currency, features (module access) in Redux
  useQuery({
    queryKey: ["tenant-me-settings", user?.tenant_id],
    queryFn: () =>
      api.get("/tenants/me").then((r) => {
        const data = r.data.data;
        const settings = data?.settings ?? {};
        const c = settings.currency;
        if (c) dispatch(setCurrency(c));
        dispatch(setFeatureFlags(data?.features ?? {}));
        dispatch(setUserFeatureFlags(data?.user_features ?? {}));
        return data;
      }),
    enabled: !!user && role !== "super_admin",
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Live notification count — pushed via SSE (Server-Sent Events)
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (!token) return;

    const url = `${API_BASE_URL}/notifications/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    es.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (typeof payload.count === "number") setUnreadCount(payload.count);
      } catch {}
    };

    // EventSource auto-reconnects on error; no special handling needed
    return () => es.close();
  }, [user?.id]);

  // Track navigation for the dynamic quick-nav on the home page
  useNavTracking(user?.id, role);

  // Determine which module owns the current URL (drives the module-scoped sidebar).
  // Super-admin and patient bypass this — they use their own static nav.
  const { pathname } = useLocation();
  const currentModule = getModuleForPath(pathname, role);

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-900 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`print:hidden fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 lg:static lg:z-auto
          ${sidebarOpen ? "w-64" : "-translate-x-full lg:translate-x-0"}
          ${sidebarCollapsed ? "lg:w-16" : "lg:w-64"}
        `}
        style={{ background: "var(--sidebar-bg)" }}
      >
        {/* Logo / brand */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-white/10 flex-shrink-0">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0`}>
                <AppLogo iconSize={32} />
              </div>
              <div className="min-w-0">
                <p className="text-white font-bold text-sm leading-tight truncate">
                  {appConfig.name}
                </p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${meta.badgeClass}`}>
                  {meta.label}
                </span>
              </div>
            </div>
          )}
          {/* {sidebarCollapsed && (
            <div className={`w-8 h-8 ${meta.sidebarAccent} rounded-lg flex items-center justify-center mx-auto`}>
              <AppLogo iconSize={20} />
            </div>
          )} */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex text-white/50 hover:text-white flex-shrink-0"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-white/50 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {/* ── Super-admin: full static nav (they manage the whole platform) ── */}
          {role === "super_admin" && SUPER_ADMIN_NAV.map((item) => (
            <NavItem key={item.href} item={item} collapsed={sidebarCollapsed} />
          ))}

          {/* ── Patient: unchanged patient nav ──────────────────────────────── */}
          {role === "patient" && PATIENT_NAV.map((item) => (
            <NavItem key={item.href} item={item} collapsed={sidebarCollapsed} />
          ))}

          {/* ── All other staff: Home + module-scoped nav ────────────────────── */}
          {role !== "super_admin" && role !== "patient" && (
            <>
              {/* Always-visible Home link */}
              <NavItem
                item={{ name: "Home", href: "/home", icon: Home }}
                collapsed={sidebarCollapsed}
                             />

              {/* Module-specific nav when inside a module */}
              {currentModule && (
                <>
                  {!sidebarCollapsed && (
                    <p className="px-3 pt-4 pb-1 text-[10px] font-semibold text-white/40 uppercase tracking-wider">
                      {currentModule.name}
                    </p>
                  )}

                  {/* Accounting uses its own grouped sub-nav component */}
                  {currentModule.id === "accounting" ? (
                    <AccountingSubNav collapsed={sidebarCollapsed} />
                  ) : (
                    currentModule.navItems
                      .filter((item) => !item.roles || item.roles.includes(role as UserRole))
                      .map((item) => (
                        <NavItem
                          key={item.href}
                          item={item}
                          collapsed={sidebarCollapsed}
                                                 />
                      ))
                  )}
                </>
              )}
            </>
          )}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="print:hidden flex h-16 items-center justify-between bg-white dark:bg-slate-800 px-4 shadow-sm border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-slate-500 hover:text-slate-700"
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-4">
            {/* Patient profile switcher — only shown for patient role with linked dependents */}
            {role === "patient" && familyMembers.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setProfileMenuOpen((v) => !v)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-blue-400 text-sm text-slate-700 dark:text-slate-200 transition"
                >
                  {activePatient ? (
                    <Baby className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  ) : (
                    <UserCircle className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  )}
                  <span className="max-w-[120px] truncate font-medium">
                    {activePatient ? activePatient.name : "My Profile"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </button>

                {profileMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setProfileMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-50 py-1">
                      <p className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Book appointment for
                      </p>
                      {/* Self */}
                      <button
                        onClick={() => handleSwitchProfile(null)}
                        className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition ${!activePatient ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
                      >
                        <UserCircle className={`h-4 w-4 flex-shrink-0 ${!activePatient ? "text-blue-600" : "text-slate-400 dark:text-slate-500"}`} />
                        <div className="text-left min-w-0">
                          <p className={`font-medium truncate ${!activePatient ? "text-blue-700 dark:text-blue-400" : "text-slate-800 dark:text-slate-200"}`}>
                            My Profile
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">Self</p>
                        </div>
                        {!activePatient && <Check className="h-4 w-4 text-blue-600 ml-auto flex-shrink-0" />}
                      </button>
                      {/* Dependents */}
                      {familyMembers.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => handleSwitchProfile(m)}
                          className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition ${activePatient?.id === m.id ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
                        >
                          <Baby className={`h-4 w-4 flex-shrink-0 ${activePatient?.id === m.id ? "text-blue-600" : "text-slate-400 dark:text-slate-500"}`} />
                          <div className="text-left min-w-0">
                            <p className={`font-medium truncate ${activePatient?.id === m.id ? "text-blue-700 dark:text-blue-400" : "text-slate-800 dark:text-slate-200"}`}>
                              {m.name}
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 capitalize">{m.relationship_type.replace(/_/g, " ")}</p>
                          </div>
                          {activePatient?.id === m.id && <Check className="h-4 w-4 text-blue-600 ml-auto flex-shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Notifications */}
            <Link to="/notifications" className="relative text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[1rem] h-4 px-0.5 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-medium">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white"
              >
                <div className={`w-8 h-8 ${meta.sidebarAccent} rounded-full flex items-center justify-center text-white text-xs font-bold`}>
                  {user?.full_name?.charAt(0) ?? "U"}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-tight">{user?.full_name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">
                    {currentTenantName ? `${currentTenantName} · ${meta.label}` : meta.label}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-50 py-1">
                  {/* User info */}
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{user?.full_name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{user?.email}</p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                        role === "super_admin" ? "bg-purple-100 text-purple-700" :
                        role === "tenant_admin" ? "bg-blue-100 text-blue-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {meta.label}
                      </span>
                      {currentTenantName && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium truncate max-w-[140px]">
                          {currentTenantName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tenant switcher */}
                  {hasMultipleTenants && (
                    <>
                      <div className="py-1">
                        <button
                          onClick={() => setTenantMenuOpen((v) => !v)}
                          className="flex w-full items-center justify-between px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                          <div className="flex items-center gap-2">
                            <ArrowLeftRight className="h-4 w-4 text-slate-400" />
                            <span>Switch Tenant</span>
                          </div>
                          <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${tenantMenuOpen ? "rotate-90" : ""}`} />
                        </button>

                        {tenantMenuOpen && (
                          <div className="mx-2 mb-1 border border-slate-100 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-900">
                            {myTenants.map((t: any) => (
                              <button
                                key={t.tenant_id}
                                onClick={() => !t.is_current && handleSwitchTenant(t.tenant_id)}
                                disabled={t.is_current || switchingTenant === t.tenant_id}
                                className={`flex w-full items-center justify-between px-3 py-2.5 text-sm border-b last:border-0 border-slate-100 dark:border-slate-700 transition-colors
                                  ${t.is_current
                                    ? "bg-blue-50 dark:bg-blue-900/20 cursor-default"
                                    : "hover:bg-white dark:hover:bg-slate-700 cursor-pointer"
                                  }`}
                              >
                                <div className="text-left min-w-0">
                                  <p className={`font-medium truncate ${t.is_current ? "text-blue-700 dark:text-blue-400" : "text-slate-800 dark:text-slate-200"}`}>
                                    {t.tenant_name}
                                  </p>
                                  <p className="text-xs text-slate-400 dark:text-slate-500 capitalize">{t.role.replace(/_/g, " ")}</p>
                                </div>
                                {switchingTenant === t.tenant_id ? (
                                  <Loader2 className="h-4 w-4 text-blue-500 animate-spin flex-shrink-0 ml-2" />
                                ) : t.is_current ? (
                                  <Check className="h-4 w-4 text-blue-500 flex-shrink-0 ml-2" />
                                ) : null}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <hr className="border-slate-100 dark:border-slate-700" />
                    </>
                  )}

                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content — Suspense catches lazy-loaded module pages */}
        <main className="flex-1 overflow-y-auto p-6">
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
