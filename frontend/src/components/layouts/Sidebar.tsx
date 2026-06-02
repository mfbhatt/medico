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
  {
    label: "Pharmacy",
    icon: <Pill className="w-5 h-5" />,
    submenu: [
      { label: "Point of Sale", path: "/pharmacy?tab=pos" },
      { label: "Inventory", path: "/pharmacy?tab=inventory" },
      { label: "Purchase Orders", path: "/pharmacy?tab=orders" },
      { label: "Sales History", path: "/pharmacy?tab=sales" },
      { label: "Reports", path: "/pharmacy?tab=reports" },
      { label: "Expiry Tracker", path: "/pharmacy?tab=expiry" },
      { label: "Alerts", path: "/pharmacy?tab=alerts" },
    ],
  },
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

interface SidebarNavItemProps {
  readonly item: NavItem;
  readonly collapsed: boolean;
  readonly expandedMenu: string | null;
  readonly toggleMenu: (label: string) => void;
  readonly currentLocation: string;
  readonly currentPath: string;
}

interface SidebarNavSubmenuProps {
  readonly submenu: NavItem[];
  readonly currentLocation: string;
}

function SidebarNavSubmenu({ submenu, currentLocation }: SidebarNavSubmenuProps) {
  return (
    <div className="ml-4 space-y-1 mt-1">
      {submenu.map((subitem) => {
        const isSubActive = currentLocation === subitem.path;
        return (
          <Link
            key={subitem.label}
            to={subitem.path!}
            className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition ${isSubActive ? "bg-indigo-700" : "hover:bg-indigo-800"}`}
          >
            <span className="text-xs">•</span>
            {subitem.label}
          </Link>
        );
      })}
    </div>
  );
}

function SidebarNavItem({ item, collapsed, expandedMenu, toggleMenu, currentLocation, currentPath }: SidebarNavItemProps) {
  const submenu = item.submenu ?? [];
  const hasSubmenu = submenu.length > 0;
  const isActive = Boolean(item.path && currentPath === item.path);
  const submenuPaths = submenu.map((subitem) => subitem.path ?? '');
  const submenuBasePaths = submenu.map((subitem) => subitem.path?.split('?')[0] ?? '');
  const isSubmenuActive = submenuPaths.includes(currentLocation);
  const isGroupActive = submenuBasePaths.includes(currentPath);
  const isExpanded = expandedMenu === item.label || isGroupActive;
  const activeClass = isSubmenuActive || isGroupActive ? "bg-indigo-700" : "hover:bg-indigo-800";

  if (item.path && !hasSubmenu) {
    return (
      <div key={item.label}>
        <Link
          to={item.path}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${isActive ? "bg-indigo-700" : "hover:bg-indigo-800"} ${collapsed ? "justify-center" : ""}`}
          title={collapsed ? item.label : ""}
        >
          {item.icon}
          {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
        </Link>
      </div>
    );
  }

  return (
    <div key={item.label}>
      <button
        onClick={() => toggleMenu(item.label)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${activeClass} ${collapsed ? "justify-center" : ""}`}
        title={collapsed ? item.label : ""}
      >
        {item.icon}
        {!collapsed && (
          <>
            <span className="text-sm font-medium flex-1 text-left">{item.label}</span>
            <span className={`text-xs transition ${isExpanded ? "rotate-180" : ""}`}>▼</span>
          </>
        )}
      </button>
      {hasSubmenu && isExpanded && !collapsed && <SidebarNavSubmenu submenu={submenu} currentLocation={currentLocation} />}
    </div>
  );
}

export default function Sidebar({ collapsed = false }: SidebarProps) {
  const location = useLocation();
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const currentLocation = location.pathname + location.search;

  const toggleMenu = (label: string) => setExpandedMenu((prev) => (prev === label ? null : label));

  return (
    <div className={`bg-indigo-900 text-white h-screen flex flex-col transition-all ${collapsed ? "w-20" : "w-64"}`}>
      {/* Logo */}
      <div className="p-4 border-b border-indigo-700">
        <h2 className={`font-bold text-xl ${collapsed ? "text-center" : ""}`}>{collapsed ? "CM" : "ClinicMgmt"}</h2>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-1">
        {navItems.map((item) => (
          <SidebarNavItem
            key={item.label}
            item={item}
            collapsed={collapsed}
            expandedMenu={expandedMenu}
            toggleMenu={toggleMenu}
            currentLocation={currentLocation}
            currentPath={location.pathname}
          />
        ))}
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
