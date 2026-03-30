import { Link, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import { Building2, LogIn, LayoutDashboard, Menu, X } from "lucide-react";
import { useState } from "react";
import { RootState } from "../../store";

export default function PublicLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, user } = useSelector((s: RootState) => s.auth);

  const dashboardPath =
    user?.role === "super_admin" ? "/admin/dashboard" : "/dashboard";

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 flex-shrink-0">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">ClinicHub</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-8">
              <Link
                to="/clinics"
                className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
              >
                Find Clinics
              </Link>
              <a
                href="#how-it-works"
                className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
              >
                How it Works
              </a>
            </nav>

            {/* CTA */}
            <div className="hidden md:flex items-center gap-3">
              {isAuthenticated ? (
                <Link
                  to={dashboardPath}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-2"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/clinics"
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    Book Appointment
                  </Link>
                </>
              )}
            </div>

            {/* Mobile menu toggle */}
            <button
              className="md:hidden text-gray-600 hover:text-gray-900"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white px-4 py-4 space-y-3">
            <Link
              to="/clinics"
              className="block text-sm font-medium text-gray-700 hover:text-blue-600 py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Find Clinics
            </Link>
            {isAuthenticated ? (
              <Link
                to={dashboardPath}
                className="block text-sm font-medium text-blue-600 py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Dashboard
              </Link>
            ) : (
              <Link
                to="/login"
                className="block text-sm font-medium text-gray-700 hover:text-blue-600 py-2 flex items-center gap-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                <LogIn className="h-4 w-4" />
                Sign In
              </Link>
            )}
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-white" />
                </div>
                <span className="text-white font-bold">ClinicHub</span>
              </div>
              <p className="text-sm leading-relaxed">
                Find and book appointments at verified clinics near you.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">For Patients</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/clinics" className="hover:text-white transition-colors">
                    Find Clinics
                  </Link>
                </li>
                <li>
                  <Link to="/clinics" className="hover:text-white transition-colors">
                    Book Appointment
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">For Clinics</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/login" className="hover:text-white transition-colors">
                    Staff Login
                  </Link>
                </li>
                <li>
                  <span className="text-gray-500 text-xs">Contact sales to onboard</span>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">Support</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <span className="hover:text-white transition-colors cursor-pointer">Help Center</span>
                </li>
                <li>
                  <span className="hover:text-white transition-colors cursor-pointer">Privacy Policy</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 text-sm text-center">
            © {new Date().getFullYear()} ClinicHub. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
