import { Palette, Sun, Moon } from "lucide-react";
import { THEMES } from "../../config/themes";
import { useTheme } from "../../hooks/useTheme";

interface Props {
  variant?: "sidebar" | "popup";
}

export default function ThemeSwitcher({ variant = "sidebar" }: Props) {
  const { themeId, setTheme, isDark, toggleDark } = useTheme();
  const isPopup = variant === "popup";

  const labelCls = isPopup
    ? "text-xs font-medium text-slate-600 dark:text-slate-300"
    : "text-[10px] font-semibold text-white/40 uppercase tracking-wider";

  const iconCls = isPopup
    ? "h-3.5 w-3.5 text-slate-400 dark:text-slate-400"
    : "h-3.5 w-3.5 text-white/40";

  const ringCls = isPopup
    ? "ring-slate-400 dark:ring-slate-500"
    : "ring-white/80";

  return (
    <div className={isPopup ? "space-y-3 px-4 py-3" : "space-y-3"}>
      {/* Dark / light toggle */}
      <div className={`flex items-center justify-between ${isPopup ? "" : "px-1"}`}>
        <div className="flex items-center gap-1.5">
          {isDark
            ? <Moon className={iconCls} />
            : <Sun  className={iconCls} />}
          <span className={labelCls}>
            {isDark ? "Dark mode" : "Light mode"}
          </span>
        </div>
        <button
          onClick={toggleDark}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          className={`relative rounded-full transition-colors focus:outline-none ${
            isPopup
              ? `w-9 h-5 ${isDark ? "bg-primary-600" : "bg-gray-200 dark:bg-slate-600"}`
              : `w-8 h-4 ${isDark ? "bg-primary-600" : "bg-white/20"}`
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 bg-white rounded-full shadow transition-transform ${
              isPopup
                ? `w-4 h-4 ${isDark ? "translate-x-4" : "translate-x-0"}`
                : `w-3 h-3 ${isDark ? "translate-x-4" : "translate-x-0"}`
            }`}
          />
        </button>
      </div>

      {/* Color swatches */}
      <div>
        <div className={`flex items-center gap-1.5 mb-2 ${isPopup ? "" : "px-1"}`}>
          <Palette className={iconCls} />
          <span className={labelCls}>Accent color</span>
        </div>
        <div className={`flex items-center gap-2 flex-wrap ${isPopup ? "" : "px-1"}`}>
          {THEMES.map((t) => (
            <button
              key={t.id}
              title={t.name}
              onClick={() => setTheme(t.id)}
              className="relative w-5 h-5 rounded-full transition-transform hover:scale-125 focus:outline-none flex-shrink-0"
              style={{ background: t.color }}
            >
              {themeId === t.id && (
                <span className={`absolute inset-[-3px] rounded-full ring-2 ${ringCls}`} />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
