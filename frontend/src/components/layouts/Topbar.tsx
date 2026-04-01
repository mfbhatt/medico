import { LogOut, Settings, Bell } from "lucide-react";
import { useState } from "react";

interface TopbarProps {
  userName?: string;
  userRole?: string;
  onLogout?: () => void;
  onSettings?: () => void;
}

export default function Topbar({ userName = "Admin User", userRole = "Admin", onLogout, onSettings }: TopbarProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Clinic Management</h1>
      </div>

      <div className="flex items-center gap-6">
        {/* Notifications */}
        <button className="relative p-2 hover:bg-gray-100 rounded-lg transition">
          <Bell className="w-5 h-5 text-gray-600" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* User Menu */}
        <div className="relative">
          <button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg transition">
            <div className="w-8 h-8 bg-indigo-200 rounded-full" />
            <div className="text-left hidden sm:block">
              <p className="text-sm font-semibold text-gray-900">{userName}</p>
              <p className="text-xs text-gray-600">{userRole}</p>
            </div>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
              <button onClick={onSettings} className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-gray-900 text-sm border-b border-gray-100">
                <Settings className="w-4 h-4" />
                Settings
              </button>
              <button onClick={onLogout} className="w-full flex items-center gap-2 px-4 py-2 hover:bg-red-50 text-red-600 text-sm">
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
