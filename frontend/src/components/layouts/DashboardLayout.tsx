import { useState } from "react";
import { Outlet, NavLink, Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../services/api";
import { useDispatch, useSelector } from "react-redux";
import { switchTenantThunk, setActivePatient, ActivePatient } from "../../store/slices/authSlice";
import {
  Calendar,
  Users,
  UserCog,
  FileText,
  Pill,
  FlaskConical,
  CreditCard,
  Package,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Building2,
  Bell,
  ChevronDown,
  ChevronRight,
  Home,
  Shield,
  LayoutDashboard,
  Globe,
  Layers,
  UserCheck,
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

// ─── Navigation configs per role ────────────────────────────────────────────

const SUPER_ADMIN_NAV = [
  { name: "System Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { name: "Tenants", href: "/admin/tenants", icon: Layers },
  { name: "All Clinics", href: "/admin/clinics", icon: Globe },
  { name: "System Users", href: "/admin/users", icon: Shield },
  { name: "Specializations", href: "/admin/specializations", icon: Stethoscope },
  { name: "Accounting", href: "/accounting", icon: BookOpen },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Settings", href: "/settings", icon: Settings },
];

const TENANT_ADMIN_NAV = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "My Clinics", href: "/admin/clinics", icon: Building2 },
  { name: "Doctors", href: "/doctors", icon: UserCog },
  { name: "Patients", href: "/patients", icon: Users },
  { name: "Appointments", href: "/appointments", icon: Calendar },
  { name: "Staff & Users", href: "/admin/users", icon: UserCheck },
  { name: "Billing", href: "/billing", icon: CreditCard },
  { name: "Accounting", href: "/accounting", icon: BookOpen },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Settings", href: "/settings", icon: Settings },
];

const OPERATIONAL_NAV = [
  { name: "Dashboard", href: "/dashboard", icon: Home, roles: ["*"] },
  { name: "Appointments", href: "/appointments", icon: Calendar, roles: ["*"] },
  { name: "Patients", href: "/patients", icon: Users, roles: ["clinic_admin", "doctor", "nurse", "receptionist"] },
  { name: "Doctors", href: "/doctors", icon: UserCog, roles: ["clinic_admin", "receptionist"] },
  { name: "Medical Records", href: "/medical-records", icon: FileText, roles: ["doctor", "nurse", "clinic_admin"] },
  { name: "Prescriptions", href: "/prescriptions", icon: Pill, roles: ["doctor", "pharmacist", "nurse"] },
  { name: "Lab Reports", href: "/lab", icon: FlaskConical, roles: ["doctor", "lab_technician", "nurse"] },
  { name: "Billing", href: "/billing", icon: CreditCard, roles: ["receptionist", "clinic_admin"] },
  { name: "Pharmacy", href: "/pharmacy", icon: Package, roles: ["pharmacist", "clinic_admin"] },
  { name: "Accounting", href: "/accounting", icon: BookOpen, roles: ["clinic_admin"] },
  { name: "Analytics", href: "/analytics", icon: BarChart3, roles: ["clinic_admin"] },
];

const PATIENT_NAV = [
  { name: "My Appointments", href: "/appointments", icon: Calendar },
  { name: "My Prescriptions", href: "/prescriptions", icon: Pill },
  { name: "My Reports", href: "/lab", icon: FlaskConical },
];

const CLINIC_ADMIN_EXTRA = [
  { name: "Clinics", href: "/admin/clinics", icon: Building2 },
  { name: "Staff", href: "/admin/users", icon: Shield },
  { name: "Settings", href: "/settings", icon: Settings },
];

// ─── Role metadata ───────────────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; badgeClass: string; sidebarAccent: string }> = {
  super_admin: {
    label: "Platform Admin",
    badgeClass: "bg-purple-500/20 text-purple-200 border border-purple-500/30",
    sidebarAccent: "bg-purple-600",
  },
  tenant_admin: {
    label: "Tenant Admin",
    badgeClass: "bg-blue-500/20 text-blue-200 border border-blue-500/30",
    sidebarAccent: "bg-blue-600",
  },
  clinic_admin: {
    label: "Clinic Admin",
    badgeClass: "bg-teal-500/20 text-teal-200 border border-teal-500/30",
    sidebarAccent: "bg-teal-600",
  },
  doctor: {
    label: "Doctor",
    badgeClass: "bg-green-500/20 text-green-200 border border-green-500/30",
    sidebarAccent: "bg-blue-600",
  },
  nurse: {
    label: "Nurse",
    badgeClass: "bg-sky-500/20 text-sky-200 border border-sky-500/30",
    sidebarAccent: "bg-blue-600",
  },
  receptionist: {
    label: "Receptionist",
    badgeClass: "bg-amber-500/20 text-amber-200 border border-amber-500/30",
    sidebarAccent: "bg-blue-600",
  },
  pharmacist: {
    label: "Pharmacist",
    badgeClass: "bg-orange-500/20 text-orange-200 border border-orange-500/30",
    sidebarAccent: "bg-blue-600",
  },
  lab_technician: {
    label: "Lab Tech",
    badgeClass: "bg-cyan-500/20 text-cyan-200 border border-cyan-500/30",
    sidebarAccent: "bg-blue-600",
  },
  patient: {
    label: "Patient",
    badgeClass: "bg-emerald-500/20 text-emerald-200 border border-emerald-500/30",
    sidebarAccent: "bg-emerald-600",
  },
};

// ─── Accounting sub-nav items ────────────────────────────────────────────────

const ACCOUNTING_SUB_NAV = [
  { name: "Dashboard", href: "/accounting" },
  { name: "Chart of Accounts", href: "/accounting/chart-of-accounts" },
  { name: "Voucher Entry", href: "/accounting/vouchers/new" },
  { name: "All Vouchers", href: "/accounting/vouchers" },
  { name: "Day Book", href: "/accounting/day-book" },
  { name: "Ledger", href: "/accounting/ledger" },
  { name: "Trial Balance", href: "/accounting/reports/trial-balance" },
  { name: "Profit & Loss", href: "/accounting/reports/profit-loss" },
  { name: "Balance Sheet", href: "/accounting/reports/balance-sheet" },
  { name: "Cash / Bank Book", href: "/accounting/reports/cash-book" },
  { name: "AR Aging", href: "/accounting/reports/ar-aging" },
  { name: "GST Reports", href: "/accounting/gst-reports" },
  { name: "Bank Reconciliation", href: "/accounting/bank-reconciliation" },
  { name: "Budgets", href: "/accounting/budgets" },
  { name: "Fiscal Years", href: "/accounting/fiscal-years" },
];

function AccountingSubNav({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState(true);
  if (collapsed) return null;
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 font-semibold uppercase tracking-wider"
      >
        <span className="flex items-center gap-2"><BookOpen className="h-3.5 w-3.5" /> Accounting</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="ml-3 space-y-0.5 border-l border-slate-700 pl-3 mt-0.5">
          {ACCOUNTING_SUB_NAV.map(item => (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.href === '/accounting'}
              className={({ isActive }) =>
                `block px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                  isActive ? 'text-white bg-slate-700' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`
              }
            >
              {item.name}
            </NavLink>
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
  accentClass,
}: {
  item: { name: string; href: string; icon: React.ElementType };
  collapsed: boolean;
  accentClass: string;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.href}
      end={item.href === "/dashboard" || item.href === "/admin/dashboard"}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? `${accentClass} text-white`
            : "text-slate-300 hover:bg-slate-700 hover:text-white"
        }`
      }
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      {!collapsed && <span>{item.name}</span>}
    </NavLink>
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
  const meta = ROLE_META[role] ?? { label: role, badgeClass: "bg-slate-700 text-slate-200", sidebarAccent: "bg-blue-600" };

  const handleLogout = async () => {
    queryClient.clear();
    await dispatch(logout());
    navigate("/login");
  };

  const handleSwitchTenant = async (tenantId: string) => {
    setSwitchingTenant(tenantId);
    try {
      await dispatch(switchTenantThunk({ tenant_id: tenantId })).unwrap();
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

  // Live notification count — poll every 30 s
  const { data: unreadData } = useQuery({
    queryKey: ["notification-unread-count"],
    queryFn: () => api.get("/notifications/unread-count").then((r) => r.data.data),
    refetchInterval: 30_000,
    retry: false,
  });
  const unreadCount: number = unreadData?.count ?? 0;

  // Build navigation list for the current role
  const navItems = (() => {
    if (role === "super_admin") return SUPER_ADMIN_NAV;
    if (role === "tenant_admin") return TENANT_ADMIN_NAV;
    if (role === "patient") return PATIENT_NAV;
    // For other roles, filter operational nav
    const hasRole = (roles: string[]) => roles.includes("*") || roles.includes(role);
    return OPERATIONAL_NAV.filter((item) => hasRole(item.roles));
  })();

  // Extra admin section for clinic_admin
  const showClinicAdminExtra = role === "clinic_admin";

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`print:hidden fixed inset-y-0 left-0 z-50 flex flex-col bg-slate-900 transition-all duration-300 lg:static lg:z-auto
          ${sidebarOpen ? "w-64" : "-translate-x-full lg:translate-x-0"}
          ${sidebarCollapsed ? "lg:w-16" : "lg:w-64"}
        `}
      >
        {/* Logo / brand */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-slate-700 flex-shrink-0">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-8 h-8 ${meta.sidebarAccent} rounded-lg flex items-center justify-center flex-shrink-0`}>
                {role === "super_admin" ? (
                  <Shield className="h-5 w-5 text-white" />
                ) : (
                  <Building2 className="h-5 w-5 text-white" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-white font-bold text-sm leading-tight truncate">
                  {role === "super_admin" ? "ClinicHub" : "ClinicHub"}
                </p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${meta.badgeClass}`}>
                  {meta.label}
                </span>
              </div>
            </div>
          )}
          {sidebarCollapsed && (
            <div className={`w-8 h-8 ${meta.sidebarAccent} rounded-lg flex items-center justify-center mx-auto`}>
              {role === "super_admin" ? (
                <Shield className="h-5 w-5 text-white" />
              ) : (
                <Building2 className="h-5 w-5 text-white" />
              )}
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex text-slate-400 hover:text-white flex-shrink-0"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => (
            <NavItem key={item.href} item={item} collapsed={sidebarCollapsed} accentClass={meta.sidebarAccent} />
          ))}

          {/* Accounting sub-nav for admin roles */}
          {(role === "tenant_admin" || role === "clinic_admin" || role === "super_admin") && (
            <div className="pt-2">
              <AccountingSubNav collapsed={sidebarCollapsed} />
            </div>
          )}

          {/* Extra admin items for clinic_admin */}
          {showClinicAdminExtra && (
            <>
              {!sidebarCollapsed && (
                <p className="px-3 pt-4 pb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Administration
                </p>
              )}
              {CLINIC_ADMIN_EXTRA.map((item) => (
                <NavItem key={item.href} item={item} collapsed={sidebarCollapsed} accentClass={meta.sidebarAccent} />
              ))}
            </>
          )}
        </nav>

        {/* User / logout */}
        <div className="border-t border-slate-700 p-3 flex-shrink-0">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-3 px-3 py-2 mb-1">
              <div className={`w-7 h-7 ${meta.sidebarAccent} rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                {user?.full_name?.charAt(0) ?? "U"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white text-xs font-medium truncate">{user?.full_name}</p>
                <p className="text-slate-400 text-[10px] truncate">{user?.email}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="print:hidden flex h-16 items-center justify-between bg-white px-4 shadow-sm border-b border-slate-200 flex-shrink-0">
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
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-blue-400 text-sm text-slate-700 transition"
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
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 z-50 py-1">
                      <p className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Book appointment for
                      </p>
                      {/* Self */}
                      <button
                        onClick={() => handleSwitchProfile(null)}
                        className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-slate-50 transition ${!activePatient ? "bg-blue-50" : ""}`}
                      >
                        <UserCircle className={`h-4 w-4 flex-shrink-0 ${!activePatient ? "text-blue-600" : "text-slate-400"}`} />
                        <div className="text-left min-w-0">
                          <p className={`font-medium truncate ${!activePatient ? "text-blue-700" : "text-slate-800"}`}>
                            My Profile
                          </p>
                          <p className="text-xs text-slate-400">Self</p>
                        </div>
                        {!activePatient && <Check className="h-4 w-4 text-blue-600 ml-auto flex-shrink-0" />}
                      </button>
                      {/* Dependents */}
                      {familyMembers.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => handleSwitchProfile(m)}
                          className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-slate-50 transition ${activePatient?.id === m.id ? "bg-blue-50" : ""}`}
                        >
                          <Baby className={`h-4 w-4 flex-shrink-0 ${activePatient?.id === m.id ? "text-blue-600" : "text-slate-400"}`} />
                          <div className="text-left min-w-0">
                            <p className={`font-medium truncate ${activePatient?.id === m.id ? "text-blue-700" : "text-slate-800"}`}>
                              {m.name}
                            </p>
                            <p className="text-xs text-slate-400 capitalize">{m.relationship_type.replace(/_/g, " ")}</p>
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
            <Link to="/notifications" className="relative text-slate-500 hover:text-slate-700">
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
                className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
              >
                <div className={`w-8 h-8 ${meta.sidebarAccent} rounded-full flex items-center justify-center text-white text-xs font-bold`}>
                  {user?.full_name?.charAt(0) ?? "U"}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-slate-800 leading-tight">{user?.full_name}</p>
                  <p className="text-xs text-slate-500 leading-tight">
                    {currentTenantName ? `${currentTenantName} · ${meta.label}` : meta.label}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-white rounded-lg shadow-lg border border-slate-200 z-50 py-1">
                  {/* User info */}
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-800">{user?.full_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{user?.email}</p>
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
                          className="flex w-full items-center justify-between px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          <div className="flex items-center gap-2">
                            <ArrowLeftRight className="h-4 w-4 text-slate-400" />
                            <span>Switch Tenant</span>
                          </div>
                          <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${tenantMenuOpen ? "rotate-90" : ""}`} />
                        </button>

                        {tenantMenuOpen && (
                          <div className="mx-2 mb-1 border border-slate-100 rounded-lg overflow-hidden bg-slate-50">
                            {myTenants.map((t: any) => (
                              <button
                                key={t.tenant_id}
                                onClick={() => !t.is_current && handleSwitchTenant(t.tenant_id)}
                                disabled={t.is_current || switchingTenant === t.tenant_id}
                                className={`flex w-full items-center justify-between px-3 py-2.5 text-sm border-b last:border-0 border-slate-100 transition-colors
                                  ${t.is_current
                                    ? "bg-blue-50 cursor-default"
                                    : "hover:bg-white cursor-pointer"
                                  }`}
                              >
                                <div className="text-left min-w-0">
                                  <p className={`font-medium truncate ${t.is_current ? "text-blue-700" : "text-slate-800"}`}>
                                    {t.tenant_name}
                                  </p>
                                  <p className="text-xs text-slate-400 capitalize">{t.role.replace(/_/g, " ")}</p>
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
                      <hr className="border-slate-100" />
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

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
