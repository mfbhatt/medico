import { BarChart3, Users, Calendar, Pill, Stethoscope, Home, LogOut, Settings, MessageSquare } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useState } from "react";

interface NavItem {
  label: string;
  icon?: React.ReactNode;
  path?: string;
  submenu?: NavItem[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", icon: <Home className="w-5 h-5" />, path: "/dashboard" },
  { label: "Appointments", icon: <Calendar className="w-5 h-5" />, path: "/appointments" },
  { label: "Patients", icon: <Users className="w-5 h-5" />, path: "/patients" },
  { label: "Doctors", icon: <Stethoscope className="w-5 h-5" />, path: "/doctors" },
  { label: "Prescriptions", icon: <Pill className="w-5 h-5" />, path: "/prescriptions" },
  { label: "Lab Orders", icon: <BarChart3 className="w-5 h-5" />, path: "/lab" },
  { label: "Billing", icon: <BarChart3 className="w-5 h-5" />, path: "/billing" },
  { label: "Analytics", icon: <BarChart3 className="w-5 h-5" />, path: "/analytics" },
  { label: "Pharmacy", icon: <Pill className="w-5 h-5" />, path: "/pharmacy" },
  { label: "Notifications", icon: <MessageSquare className="w-5 h-5" />, path: "/notifications" },
  {
    label: "Admin",
    icon: <Settings className="w-5 h-5" />,
    submenu: [
      { label: "Tenants", path: "/admin/tenants" },
      { label: "Clinics", path: "/admin/clinics" },
      { label: "Users", path: "/admin/users" },
      { label: "Settings", path: "/settings" },
    ],
  },
];

interface SidebarProps {
  collapsed?: boolean;
}

export default function Sidebar({ collapsed = false }: SidebarProps) {
  const location = useLocation();
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

  return (
    <div className={`bg-indigo-900 text-white h-screen flex flex-col transition-all ${collapsed ? "w-20" : "w-64"}`}>
      {/* Logo */}
      <div className="p-4 border-b border-indigo-700">
        <h2 className={`font-bold text-xl ${collapsed ? "text-center" : ""}`}>{collapsed ? "CM" : "ClinicMgmt"}</h2>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path?.split("/")[1] || "");
          const hasSubmenu = item.submenu && item.submenu.length > 0;

          return (
            <div key={item.label}>
              {item.path ? (
                <Link to={item.path} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${isActive ? "bg-indigo-700" : "hover:bg-indigo-800"} ${collapsed ? "justify-center" : ""}`} title={collapsed ? item.label : ""}>
                  {item.icon}
                  {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                </Link>
              ) : (
                <button
                  onClick={() => setExpandedMenu(expandedMenu === item.label ? null : item.label)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition hover:bg-indigo-800 ${collapsed ? "justify-center" : ""}`}
                  title={collapsed ? item.label : ""}
                >
                  {item.icon}
                  {!collapsed && (
                    <>
                      <span className="text-sm font-medium flex-1 text-left">{item.label}</span>
                      <span className={`text-xs transition ${expandedMenu === item.label ? "rotate-180" : ""}`}>▼</span>
                    </>
                  )}
                </button>
              )}

              {/* Submenu */}
              {hasSubmenu && expandedMenu === item.label && !collapsed && (
                <div className="ml-4 space-y-1 mt-1">
                  {item.submenu!.map((subitem) => (
                    <Link key={subitem.label} to={subitem.path!} className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition ${location.pathname === subitem.path ? "bg-indigo-700" : "hover:bg-indigo-800"}`}>
                      <span className="text-xs">•</span>
                      {subitem.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-indigo-700 p-4">
        <button className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-indigo-800 transition text-sm ${collapsed ? "justify-center" : ""}`}>
          <LogOut className="w-5 h-5" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
}
