/**
 * Module Registry — single source of truth for all application modules.
 *
 * To add a new module:
 *   1. Add an entry to MODULE_REGISTRY below.
 *   2. Add lazy route imports in App.tsx.
 *   That's it — navigation, tiles, and access control all derive from here.
 */

import type { ElementType } from 'react';
import {
  Calendar,
  CalendarPlus,
  CalendarDays,
  Users,
  UserPlus,
  UserCog,
  Pill,
  FlaskConical,
  CreditCard,
  Package,
  BarChart3,
  BookOpen,
  Settings,
  Building2,
  Shield,
  Stethoscope,
  Layers,
  Globe,
  LayoutDashboard,
  FilePlus,
  ClipboardList,
  ReceiptText,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole =
  | 'super_admin'
  | 'tenant_admin'
  | 'clinic_admin'
  | 'doctor'
  | 'nurse'
  | 'receptionist'
  | 'pharmacist'
  | 'lab_technician'
  | 'patient';

export interface ModuleNavItem {
  name: string;
  href: string;
  icon: ElementType;
  end?: boolean;
  /** If set, only render this nav item for users with one of these roles. */
  roles?: UserRole[];
}

export interface AppModule {
  id: string;
  name: string;
  description: string;
  icon: ElementType;
  /** Tailwind gradient classes for the module tile background. */
  gradient: string;
  /** Roles that can see this module tile on the home page. */
  allowedRoles: UserRole[];
  /** Tenant/user feature flag key — tile is hidden if the flag is explicitly false. */
  requiresFeature?: string;
  /** Where clicking the module tile navigates to. */
  defaultPath: string;
  /**
   * URL path prefixes that "belong" to this module.
   * Used to determine which module is active and drive the sidebar.
   * Empty array = tile-only module (no sidebar matching needed).
   */
  basePaths: string[];
  /**
   * Nav items shown in the sidebar when the user is inside this module.
   * Accounting uses an empty array because AccountingSubNav handles its own rendering.
   */
  navItems: ModuleNavItem[];
}

// ─── Registry ────────────────────────────────────────────────────────────────

export const MODULE_REGISTRY: AppModule[] = [

  // ── Appointments ────────────────────────────────────────────────────────────
  {
    id: 'appointments',
    name: 'Appointments',
    description: 'Schedule, track and manage patient appointments',
    icon: Calendar,
    gradient: 'from-blue-500 to-blue-600',
    allowedRoles: ['tenant_admin', 'clinic_admin', 'doctor', 'nurse', 'receptionist'],
    requiresFeature: 'appointments',
    defaultPath: '/appointments',
    basePaths: ['/appointments'],
    navItems: [
      { name: 'All Appointments', href: '/appointments', icon: Calendar, end: true },
      {
        name: 'New Appointment',
        href: '/appointments/new',
        icon: CalendarPlus,
        roles: ['tenant_admin', 'clinic_admin', 'doctor', 'nurse', 'receptionist'],
      },
      { name: 'Calendar', href: '/appointments/calendar', icon: CalendarDays },
    ],
  },

  // ── Patients ────────────────────────────────────────────────────────────────
  {
    id: 'patients',
    name: 'Patients',
    description: 'Manage patient records, demographics and history',
    icon: Users,
    gradient: 'from-emerald-500 to-green-600',
    allowedRoles: ['tenant_admin', 'clinic_admin', 'doctor', 'nurse', 'receptionist'],
    requiresFeature: 'patients',
    defaultPath: '/patients',
    // /medical-records is reached through patient context — keep same sidebar
    basePaths: ['/patients', '/medical-records'],
    navItems: [
      { name: 'All Patients', href: '/patients', icon: Users, end: true },
      {
        name: 'Register Patient',
        href: '/patients/new',
        icon: UserPlus,
        roles: ['tenant_admin', 'clinic_admin', 'nurse', 'receptionist'],
      },
    ],
  },

  // ── Doctors ─────────────────────────────────────────────────────────────────
  {
    id: 'doctors',
    name: 'Doctors',
    description: 'Manage doctor profiles, schedules and clinic assignments',
    icon: UserCog,
    gradient: 'from-violet-500 to-purple-600',
    allowedRoles: ['tenant_admin', 'clinic_admin', 'receptionist'],
    requiresFeature: 'doctors',
    defaultPath: '/doctors',
    basePaths: ['/doctors'],
    navItems: [
      { name: 'All Doctors', href: '/doctors', icon: UserCog, end: true },
    ],
  },

  // ── Prescriptions ───────────────────────────────────────────────────────────
  {
    id: 'prescriptions',
    name: 'Prescriptions',
    description: 'Create and manage digital prescriptions',
    icon: Pill,
    gradient: 'from-pink-500 to-rose-600',
    allowedRoles: ['tenant_admin', 'clinic_admin', 'doctor', 'pharmacist', 'nurse'],
    requiresFeature: 'prescriptions',
    defaultPath: '/prescriptions',
    basePaths: ['/prescriptions'],
    navItems: [
      { name: 'All Prescriptions', href: '/prescriptions', icon: Pill, end: true },
    ],
  },

  // ── Laboratory ──────────────────────────────────────────────────────────────
  {
    id: 'lab',
    name: 'Laboratory',
    description: 'Manage lab orders, samples and test results',
    icon: FlaskConical,
    gradient: 'from-cyan-500 to-sky-600',
    allowedRoles: ['tenant_admin', 'clinic_admin', 'doctor', 'lab_technician', 'nurse'],
    requiresFeature: 'lab',
    defaultPath: '/lab',
    basePaths: ['/lab'],
    navItems: [
      { name: 'Lab Orders', href: '/lab', icon: FlaskConical, end: true },
    ],
  },

  // ── Billing ─────────────────────────────────────────────────────────────────
  {
    id: 'billing',
    name: 'Billing',
    description: 'Manage invoices, payments and insurance claims',
    icon: CreditCard,
    gradient: 'from-amber-500 to-orange-600',
    allowedRoles: ['tenant_admin', 'clinic_admin', 'receptionist'],
    requiresFeature: 'billing',
    defaultPath: '/billing',
    basePaths: ['/billing'],
    navItems: [
      { name: 'Invoices', href: '/billing', icon: CreditCard, end: true },
    ],
  },

  // ── Pharmacy ────────────────────────────────────────────────────────────────
  {
    id: 'pharmacy',
    name: 'Pharmacy',
    description: 'Drug inventory, dispensing and point-of-sale',
    icon: Package,
    gradient: 'from-teal-500 to-green-600',
    allowedRoles: ['tenant_admin', 'clinic_admin', 'pharmacist'],
    requiresFeature: 'pharmacy',
    defaultPath: '/pharmacy',
    basePaths: ['/pharmacy'],
    navItems: [
      { name: 'Pharmacy', href: '/pharmacy', icon: Package, end: true },
    ],
  },

  // ── Analytics ───────────────────────────────────────────────────────────────
  {
    id: 'analytics',
    name: 'Analytics',
    description: 'Operational dashboards, metrics and business reports',
    icon: BarChart3,
    gradient: 'from-indigo-500 to-blue-700',
    allowedRoles: ['super_admin', 'tenant_admin', 'clinic_admin'],
    requiresFeature: 'analytics',
    defaultPath: '/analytics',
    basePaths: ['/analytics'],
    navItems: [
      { name: 'Analytics', href: '/analytics', icon: BarChart3, end: true },
    ],
  },

  // ── Accounting ──────────────────────────────────────────────────────────────
  // navItems intentionally empty — AccountingSubNav in DashboardLayout renders
  // the full grouped accounting sidebar with section headers.
  {
    id: 'accounting',
    name: 'Accounting',
    description: 'Financial accounting, vouchers, ledger and reports',
    icon: BookOpen,
    gradient: 'from-slate-600 to-gray-700',
    allowedRoles: ['super_admin', 'tenant_admin', 'clinic_admin'],
    requiresFeature: 'accounting',
    defaultPath: '/accounting',
    basePaths: ['/accounting'],
    navItems: [
      { name: 'Dashboard', href: '/accounting', icon: BookOpen, end: true },
      { name: 'Chart of Accounts', href: '/accounting/chart-of-accounts', icon: ClipboardList },
      { name: 'New Voucher', href: '/accounting/vouchers/new', icon: FilePlus },
      { name: 'All Vouchers', href: '/accounting/vouchers', icon: ReceiptText },
    ],
  },

  // ── Administration (tenant_admin / clinic_admin) ─────────────────────────────
  {
    id: 'administration',
    name: 'Administration',
    description: 'Manage clinics, staff users and system settings',
    icon: Settings,
    gradient: 'from-gray-600 to-slate-700',
    allowedRoles: ['tenant_admin', 'clinic_admin'],
    defaultPath: '/admin/clinics',
    basePaths: ['/admin', '/settings'],
    navItems: [
      { name: 'Clinics', href: '/admin/clinics', icon: Building2 },
      { name: 'Staff & Users', href: '/admin/users', icon: Shield },
      { name: 'Settings', href: '/settings', icon: Settings },
    ],
  },

  // ── Super-admin tiles ────────────────────────────────────────────────────────
  // basePaths is empty for each: super_admin keeps the full SUPER_ADMIN_NAV in
  // their sidebar (these entries exist only to drive the home-page tile grid).
  {
    id: 'platform_overview',
    name: 'Platform',
    description: 'System health, activity and platform overview',
    icon: LayoutDashboard,
    gradient: 'from-purple-600 to-violet-700',
    allowedRoles: ['super_admin'],
    defaultPath: '/admin/dashboard',
    basePaths: [],
    navItems: [],
  },
  {
    id: 'tenants',
    name: 'Tenants',
    description: 'Manage clinic groups and subscription plans',
    icon: Layers,
    gradient: 'from-blue-600 to-indigo-700',
    allowedRoles: ['super_admin'],
    defaultPath: '/admin/tenants',
    basePaths: [],
    navItems: [],
  },
  {
    id: 'system_clinics',
    name: 'All Clinics',
    description: 'View and manage clinics across all tenants',
    icon: Globe,
    gradient: 'from-teal-600 to-cyan-700',
    allowedRoles: ['super_admin'],
    defaultPath: '/admin/clinics',
    basePaths: [],
    navItems: [],
  },
  {
    id: 'system_users',
    name: 'System Users',
    description: 'Manage all users and permissions across the platform',
    icon: Shield,
    gradient: 'from-red-500 to-rose-600',
    allowedRoles: ['super_admin'],
    defaultPath: '/admin/users',
    basePaths: [],
    navItems: [],
  },
  {
    id: 'specializations',
    name: 'Specializations',
    description: 'Manage doctor specializations and clinical categories',
    icon: Stethoscope,
    gradient: 'from-emerald-600 to-green-700',
    allowedRoles: ['super_admin'],
    defaultPath: '/admin/specializations',
    basePaths: [],
    navItems: [],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Return the module that owns the given pathname for the given role.
 * Returns null for super_admin and patient — they use their own legacy nav.
 * Uses longest-prefix matching so /accounting/reports beats /accounting.
 */
export function getModuleForPath(pathname: string, role: string): AppModule | null {
  if (role === 'super_admin' || role === 'patient') return null;

  let best: AppModule | null = null;
  let bestLen = -1;

  for (const m of MODULE_REGISTRY) {
    if (!m.allowedRoles.includes(role as UserRole)) continue;
    for (const base of m.basePaths) {
      if (pathname === base || pathname.startsWith(base + '/')) {
        if (base.length > bestLen) {
          bestLen = base.length;
          best = m;
        }
      }
    }
  }

  return best;
}

/**
 * Return all modules the user can access, filtered by role and feature flags.
 * This drives the home-page module tile grid.
 */
export function getModulesForUser(
  role: string,
  tenantFeatures: Record<string, boolean>,
  userFeatures: Record<string, boolean>,
): AppModule[] {
  return MODULE_REGISTRY.filter((m) => {
    if (!m.allowedRoles.includes(role as UserRole)) return false;
    if (m.requiresFeature) {
      if (tenantFeatures[m.requiresFeature] === false) return false;
      if (userFeatures[m.requiresFeature] === false) return false;
    }
    return true;
  });
}
