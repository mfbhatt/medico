import { Navigate, Routes, Route } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "./store";
import { useTokenRefresh } from "./hooks/useTokenRefresh";

import ProtectedRoute from "./components/auth/ProtectedRoute";
import AuthLayout from "./components/layouts/AuthLayout";
import DashboardLayout from "./components/layouts/DashboardLayout";
import PublicLayout from "./components/layouts/PublicLayout";

// ─── Auth pages ──────────────────────────────────────────────────────────────
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import PatientRegisterPage from "./pages/public/PatientRegisterPage";

// ─── Public pages ────────────────────────────────────────────────────────────
import LandingPage from "./pages/public/LandingPage";
import PublicClinicsPage from "./pages/public/PublicClinicsPage";
import PublicClinicDetailPage from "./pages/public/PublicClinicDetailPage";

// ─── Dashboard pages ─────────────────────────────────────────────────────────
import DashboardPage from "./pages/dashboard/DashboardPage";

// ─── Appointment pages ───────────────────────────────────────────────────────
import AppointmentsPage from "./pages/appointments/AppointmentsPage";
import NewAppointmentPage from "./pages/appointments/NewAppointmentPage";
import AppointmentDetailPage from "./pages/appointments/AppointmentDetailPage";
import CalendarPage from "./pages/appointments/CalendarPage";

// ─── Patient pages ───────────────────────────────────────────────────────────
import PatientsPage from "./pages/patients/PatientsPage";
import PatientDetailPage from "./pages/patients/PatientDetailPage";
import NewPatientPage from "./pages/patients/NewPatientPage";

// ─── Doctor pages ────────────────────────────────────────────────────────────
import DoctorsPage from "./pages/doctors/DoctorsPage";
import DoctorDetailPage from "./pages/doctors/DoctorDetailPage";
import DoctorSchedulePage from "./pages/doctors/DoctorSchedulePage";
import DoctorClinicsPage from "./pages/doctors/DoctorClinicsPage";
import DoctorStatsPage from "./pages/doctors/DoctorStatsPage";

// ─── Medical Records ─────────────────────────────────────────────────────────
import MedicalRecordPage from "./pages/medical-records/MedicalRecordPage";

// ─── Prescriptions ───────────────────────────────────────────────────────────
import PrescriptionsPage from "./pages/prescriptions/PrescriptionsPage";

// ─── Lab ─────────────────────────────────────────────────────────────────────
import LabOrdersPage from "./pages/lab/LabOrdersPage";
import LabReportPage from "./pages/lab/LabReportPage";

// ─── Billing ─────────────────────────────────────────────────────────────────
import BillingPage from "./pages/billing/BillingPage";
import InvoiceDetailPage from "./pages/billing/InvoiceDetailPage";

// ─── Pharmacy ────────────────────────────────────────────────────────────────
import PharmacyPage from "./pages/pharmacy/PharmacyPage";

// ─── Analytics ───────────────────────────────────────────────────────────────
import AnalyticsPage from "./pages/analytics/AnalyticsPage";

// ─── Admin pages ─────────────────────────────────────────────────────────────
import SuperAdminDashboard from "./pages/admin/SuperAdminDashboard";
import TenantsPage from "./pages/admin/TenantsPage";
import ClinicsPage from "./pages/admin/ClinicsPage";
import UsersPage from "./pages/admin/UsersPage";
import SettingsPage from "./pages/admin/SettingsPage";
import SpecializationsPage from "./pages/admin/SpecializationsPage";

// ─── Telemedicine ────────────────────────────────────────────────────────────
import TelemedicinePage from "./pages/telemedicine/TelemedicinePage";

// ─── Accounting ──────────────────────────────────────────────────────────────
import AccountingDashboard from "./pages/accounting/AccountingDashboard";
import ChartOfAccountsPage from "./pages/accounting/ChartOfAccountsPage";
import VoucherEntryPage from "./pages/accounting/VoucherEntryPage";
import VoucherListPage from "./pages/accounting/VoucherListPage";
import VoucherDetailPage from "./pages/accounting/VoucherDetailPage";
import DayBookPage from "./pages/accounting/DayBookPage";
import LedgerPage from "./pages/accounting/LedgerPage";
import TrialBalancePage from "./pages/accounting/TrialBalancePage";
import ProfitLossPage from "./pages/accounting/ProfitLossPage";
import BalanceSheetPage from "./pages/accounting/BalanceSheetPage";
import CashBankBookPage from "./pages/accounting/CashBankBookPage";
import ARAgingPage from "./pages/accounting/ARAgingPage";
import FiscalYearPage from "./pages/accounting/FiscalYearPage";
import GSTReportsPage from "./pages/accounting/GSTReportsPage";
import BankReconciliationPage from "./pages/accounting/BankReconciliationPage";
import BudgetPage from "./pages/accounting/BudgetPage";
import APAgingPage from "./pages/accounting/APAgingPage";
import CashFlowPage from "./pages/accounting/CashFlowPage";
import OutstandingPage from "./pages/accounting/OutstandingPage";
import ClosingEntryPage from "./pages/accounting/ClosingEntryPage";

/**
 * After login, redirect to role-appropriate home.
 * super_admin → /admin/dashboard..
 * everyone else → /dashboard
 */
function RoleBasedHome() {
  const { user } = useSelector((s: RootState) => s.auth);
  const to = user?.role === "super_admin" ? "/admin/dashboard" : user?.role === "patient" ? "/appointments" : "/dashboard";
  return <Navigate to={to} replace />;
}

export default function App() {
  // Silently refresh the access token before it expires and on tab focus.
  useTokenRefresh();

  return (
    <Routes>
      {/* ── Public routes (no auth required) ────────────────────────────── */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/clinics" element={<PublicClinicsPage />} />
        <Route path="/clinics/:id" element={<PublicClinicDetailPage />} />
      </Route>

      {/* ── Auth routes ──────────────────────────────────────────────────── */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<PatientRegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      {/* ── Protected routes (any authenticated user) ────────────────────── */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          {/* Role-aware default redirect */}
          <Route path="/home" element={<RoleBasedHome />} />

          {/* Dashboard — staff only; patients redirected to their appointments */}
          <Route element={<ProtectedRoute allowedRoles={["super_admin", "tenant_admin", "clinic_admin", "doctor", "nurse", "receptionist", "pharmacist", "lab_technician"]} redirectTo="/appointments" />}>
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>

          {/* Appointments */}
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/appointments/new" element={<NewAppointmentPage />} />
          <Route path="/appointments/calendar" element={<CalendarPage />} />
          <Route path="/appointments/:id" element={<AppointmentDetailPage />} />

          {/* Patients */}
          <Route path="/patients" element={<PatientsPage />} />
          <Route path="/patients/new" element={<NewPatientPage />} />
          <Route path="/patients/:id" element={<PatientDetailPage />} />

          {/* Doctors */}
          <Route path="/doctors" element={<DoctorsPage />} />
          <Route path="/doctors/:id" element={<DoctorDetailPage />} />
          <Route path="/doctors/:id/schedule" element={<DoctorSchedulePage />} />
          <Route path="/doctors/:id/clinics" element={<DoctorClinicsPage />} />
          <Route path="/doctors/:id/stats" element={<DoctorStatsPage />} />

          {/* Medical Records */}
          <Route path="/medical-records/:id" element={<MedicalRecordPage />} />

          {/* Prescriptions */}
          <Route path="/prescriptions" element={<PrescriptionsPage />} />

          {/* Lab */}
          <Route path="/lab" element={<LabOrdersPage />} />
          <Route path="/lab/reports/:id" element={<LabReportPage />} />

          {/* Billing */}
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/billing/invoices/:id" element={<InvoiceDetailPage />} />

          {/* Pharmacy */}
          <Route path="/pharmacy" element={<PharmacyPage />} />

          {/* Telemedicine */}
          <Route path="/telemedicine/:appointmentId" element={<TelemedicinePage />} />

          {/* Analytics (tenant_admin, clinic_admin, super_admin) */}
          <Route element={<ProtectedRoute allowedRoles={["super_admin", "tenant_admin", "clinic_admin"]} />}>
            <Route path="/analytics" element={<AnalyticsPage />} />
          </Route>

          {/* Accounting (tenant_admin, clinic_admin, super_admin) */}
          <Route element={<ProtectedRoute allowedRoles={["super_admin", "tenant_admin", "clinic_admin"]} />}>
            <Route path="/accounting" element={<AccountingDashboard />} />
            <Route path="/accounting/chart-of-accounts" element={<ChartOfAccountsPage />} />
            <Route path="/accounting/vouchers" element={<VoucherListPage />} />
            <Route path="/accounting/vouchers/new" element={<VoucherEntryPage />} />
            <Route path="/accounting/vouchers/:id" element={<VoucherDetailPage />} />
            <Route path="/accounting/vouchers/:id/edit" element={<VoucherEntryPage />} />
            <Route path="/accounting/day-book" element={<DayBookPage />} />
            <Route path="/accounting/ledger" element={<LedgerPage />} />
            <Route path="/accounting/reports/trial-balance" element={<TrialBalancePage />} />
            <Route path="/accounting/reports/profit-loss" element={<ProfitLossPage />} />
            <Route path="/accounting/reports/balance-sheet" element={<BalanceSheetPage />} />
            <Route path="/accounting/reports/cash-book" element={<CashBankBookPage />} />
            <Route path="/accounting/reports/ar-aging" element={<ARAgingPage />} />
            <Route path="/accounting/fiscal-years" element={<FiscalYearPage />} />
            <Route path="/accounting/gst-reports" element={<GSTReportsPage />} />
            <Route path="/accounting/bank-reconciliation" element={<BankReconciliationPage />} />
            <Route path="/accounting/budgets" element={<BudgetPage />} />
            <Route path="/accounting/reports/ap-aging" element={<APAgingPage />} />
            <Route path="/accounting/reports/cash-flow" element={<CashFlowPage />} />
            <Route path="/accounting/reports/outstanding" element={<OutstandingPage />} />
            <Route path="/accounting/closing-entry" element={<ClosingEntryPage />} />
          </Route>

          {/* ── Super-admin only ─────────────────────────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={["super_admin"]} />}>
            <Route path="/admin/dashboard" element={<SuperAdminDashboard />} />
            <Route path="/admin/tenants" element={<TenantsPage />} />
            <Route path="/admin/specializations" element={<SpecializationsPage />} />
          </Route>

          {/* ── Admin shared (super_admin + tenant_admin + clinic_admin) ─── */}
          <Route element={<ProtectedRoute allowedRoles={["super_admin", "tenant_admin", "clinic_admin"]} />}>
            <Route path="/admin/clinics" element={<ClinicsPage />} />
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Route>

      {/* ── Fallback ─────────────────────────────────────────────────────── */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
