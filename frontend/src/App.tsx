import { lazy } from "react";
import { Navigate, Routes, Route } from "react-router-dom";
import { useTokenRefresh } from "./hooks/useTokenRefresh";

import ProtectedRoute from "./components/auth/ProtectedRoute";
import AuthLayout from "./components/layouts/AuthLayout";
import DashboardLayout from "./components/layouts/DashboardLayout";
import PublicLayout from "./components/layouts/PublicLayout";

// ─── Static imports (always needed — small, no benefit from lazy-loading) ────
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import PatientProfileCompletionPage from "./pages/auth/PatientProfileCompletionPage";
import PatientRegisterPage from "./pages/public/PatientRegisterPage";
import LandingPage from "./pages/public/LandingPage";
import PublicClinicsPage from "./pages/public/PublicClinicsPage";
import PublicClinicDetailPage from "./pages/public/PublicClinicDetailPage";
import PrivacyPolicyPage from "./pages/public/PrivacyPolicyPage";
import DataDeletionPage from "./pages/public/DataDeletionPage";

// ─── Lazy-loaded module pages (code-split per module) ────────────────────────

// Home
const HomePage = lazy(() => import("./pages/home/HomePage"));

// Dashboard (detailed analytics view — accessible from Analytics tile)
const DashboardPage = lazy(() => import("./pages/dashboard/DashboardPage"));

// Appointments
const AppointmentsPage    = lazy(() => import("./pages/appointments/AppointmentsPage"));
const NewAppointmentPage  = lazy(() => import("./pages/appointments/NewAppointmentPage"));
const AppointmentDetailPage = lazy(() => import("./pages/appointments/AppointmentDetailPage"));
const CalendarPage        = lazy(() => import("./pages/appointments/CalendarPage"));

// Patients
const PatientsPage        = lazy(() => import("./pages/patients/PatientsPage"));
const PatientDetailPage   = lazy(() => import("./pages/patients/PatientDetailPage"));
const NewPatientPage      = lazy(() => import("./pages/patients/NewPatientPage"));

// Doctors
const DoctorsPage         = lazy(() => import("./pages/doctors/DoctorsPage"));
const DoctorDetailPage    = lazy(() => import("./pages/doctors/DoctorDetailPage"));
const DoctorSchedulePage  = lazy(() => import("./pages/doctors/DoctorSchedulePage"));
const DoctorClinicsPage   = lazy(() => import("./pages/doctors/DoctorClinicsPage"));
const DoctorStatsPage     = lazy(() => import("./pages/doctors/DoctorStatsPage"));

// Clinical modules
const MedicalRecordPage       = lazy(() => import("./pages/medical-records/MedicalRecordPage"));
const PrescriptionsPage       = lazy(() => import("./pages/prescriptions/PrescriptionsPage"));
const PrescriptionDetailPage  = lazy(() => import("./pages/prescriptions/PrescriptionDetailPage"));
const LabOrdersPage       = lazy(() => import("./pages/lab/LabOrdersPage"));
const LabReportPage       = lazy(() => import("./pages/lab/LabReportPage"));
const BillingPage         = lazy(() => import("./pages/billing/BillingPage"));
const InvoiceDetailPage   = lazy(() => import("./pages/billing/InvoiceDetailPage"));
const PharmacyPage        = lazy(() => import("./pages/pharmacy/PharmacyPage"));

// Analytics & Telemedicine
const AnalyticsPage       = lazy(() => import("./pages/analytics/AnalyticsPage"));
const TelemedicinePage    = lazy(() => import("./pages/telemedicine/TelemedicinePage"));
const NotificationsPage   = lazy(() => import("./pages/notifications/NotificationsPage"));

// Admin
const SuperAdminDashboard = lazy(() => import("./pages/admin/SuperAdminDashboard"));
const TenantsPage         = lazy(() => import("./pages/admin/TenantsPage"));
const ClinicsPage         = lazy(() => import("./pages/admin/ClinicsPage"));
const UsersPage           = lazy(() => import("./pages/admin/UsersPage"));
const SettingsPage        = lazy(() => import("./pages/admin/SettingsPage"));
const SpecializationsPage = lazy(() => import("./pages/admin/SpecializationsPage"));

// Accounting (18 pages — single chunk thanks to lazy import)
const AccountingDashboard   = lazy(() => import("./pages/accounting/AccountingDashboard"));
const ChartOfAccountsPage   = lazy(() => import("./pages/accounting/ChartOfAccountsPage"));
const VoucherEntryPage      = lazy(() => import("./pages/accounting/VoucherEntryPage"));
const VoucherListPage       = lazy(() => import("./pages/accounting/VoucherListPage"));
const VoucherDetailPage     = lazy(() => import("./pages/accounting/VoucherDetailPage"));
const DayBookPage           = lazy(() => import("./pages/accounting/DayBookPage"));
const LedgerPage            = lazy(() => import("./pages/accounting/LedgerPage"));
const TrialBalancePage      = lazy(() => import("./pages/accounting/TrialBalancePage"));
const ProfitLossPage        = lazy(() => import("./pages/accounting/ProfitLossPage"));
const BalanceSheetPage      = lazy(() => import("./pages/accounting/BalanceSheetPage"));
const CashBankBookPage      = lazy(() => import("./pages/accounting/CashBankBookPage"));
const ARAgingPage           = lazy(() => import("./pages/accounting/ARAgingPage"));
const FiscalYearPage        = lazy(() => import("./pages/accounting/FiscalYearPage"));
const GSTReportsPage        = lazy(() => import("./pages/accounting/GSTReportsPage"));
const BankReconciliationPage = lazy(() => import("./pages/accounting/BankReconciliationPage"));
const BudgetPage            = lazy(() => import("./pages/accounting/BudgetPage"));
const APAgingPage           = lazy(() => import("./pages/accounting/APAgingPage"));
const CashFlowPage          = lazy(() => import("./pages/accounting/CashFlowPage"));
const OutstandingPage       = lazy(() => import("./pages/accounting/OutstandingPage"));
const ClosingEntryPage      = lazy(() => import("./pages/accounting/ClosingEntryPage"));

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  useTokenRefresh();

  return (
    <Routes>
      {/* ── Public routes ────────────────────────────────────────────────── */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/clinics" element={<PublicClinicsPage />} />
        <Route path="/clinics/:id" element={<PublicClinicDetailPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/data-deletion" element={<DataDeletionPage />} />
      </Route>

      {/* ── Auth routes ──────────────────────────────────────────────────── */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<PatientRegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      {/* ── Profile completion ───────────────────────────────────────────── */}
      <Route path="/complete-profile" element={<PatientProfileCompletionPage />} />

      {/* ── Protected routes ─────────────────────────────────────────────── */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          {/* ── Module-launcher home (all staff except patients) ──────────── */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  "super_admin", "tenant_admin", "clinic_admin",
                  "doctor", "nurse", "receptionist", "pharmacist", "lab_technician",
                ]}
                redirectTo="/appointments"
              />
            }
          >
            <Route path="/home" element={<HomePage />} />
            {/* /dashboard kept for backward-compat — redirects to /home */}
            <Route path="/dashboard" element={<Navigate to="/home" replace />} />
          </Route>

          {/* ── Appointments ─────────────────────────────────────────────── */}
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/appointments/new" element={<NewAppointmentPage />} />
          <Route path="/appointments/calendar" element={<CalendarPage />} />
          <Route path="/appointments/:id" element={<AppointmentDetailPage />} />

          {/* ── Patients ─────────────────────────────────────────────────── */}
          <Route path="/patients" element={<PatientsPage />} />
          <Route path="/patients/new" element={<NewPatientPage />} />
          <Route path="/patients/:id" element={<PatientDetailPage />} />

          {/* ── Doctors ──────────────────────────────────────────────────── */}
          <Route path="/doctors" element={<DoctorsPage />} />
          <Route path="/doctors/:id" element={<DoctorDetailPage />} />
          <Route path="/doctors/:id/schedule" element={<DoctorSchedulePage />} />
          <Route path="/doctors/:id/clinics" element={<DoctorClinicsPage />} />
          <Route path="/doctors/:id/stats" element={<DoctorStatsPage />} />

          {/* ── Clinical modules ─────────────────────────────────────────── */}
          <Route path="/medical-records/:id" element={<MedicalRecordPage />} />
          <Route path="/prescriptions" element={<PrescriptionsPage />} />
          <Route path="/prescriptions/:id" element={<PrescriptionDetailPage />} />
          <Route path="/lab" element={<LabOrdersPage />} />
          <Route path="/lab/reports/:id" element={<LabReportPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/billing/invoices/:id" element={<InvoiceDetailPage />} />
          <Route path="/pharmacy" element={<PharmacyPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/telemedicine/:appointmentId" element={<TelemedicinePage />} />

          {/* ── Analytics ────────────────────────────────────────────────── */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={["super_admin", "tenant_admin", "clinic_admin"]}
              />
            }
          >
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/dashboard/stats" element={<DashboardPage />} />
          </Route>

          {/* ── Accounting ───────────────────────────────────────────────── */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={["super_admin", "tenant_admin", "clinic_admin"]}
              />
            }
          >
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
          <Route
            element={<ProtectedRoute allowedRoles={["super_admin"]} />}
          >
            <Route path="/admin/dashboard" element={<SuperAdminDashboard />} />
            <Route path="/admin/tenants" element={<TenantsPage />} />
            <Route path="/admin/specializations" element={<SpecializationsPage />} />
          </Route>

          {/* ── Shared admin (super_admin + tenant_admin + clinic_admin) ──── */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={["super_admin", "tenant_admin", "clinic_admin"]}
              />
            }
          >
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
