import { useState } from "react";
import { DEFAULT_THEME_ID } from "../config/themes";

const THEME_KEY = "app-theme";
const DARK_KEY  = "app-dark-mode";

// Apply saved theme + dark mode synchronously on module load (prevents flash on refresh)
const _initialTheme = localStorage.getItem(THEME_KEY) ?? DEFAULT_THEME_ID;
const _initialDark  = localStorage.getItem(DARK_KEY) === "true";
document.documentElement.setAttribute("data-theme", _initialTheme);
if (_initialDark) document.documentElement.classList.add("dark");

export function useTheme() {
  const [themeId, setThemeId] = useState<string>(_initialTheme);
  const [isDark,  setIsDark]  = useState<boolean>(_initialDark);

  const setTheme = (id: string) => {
    localStorage.setItem(THEME_KEY, id);
    document.documentElement.setAttribute("data-theme", id);
    setThemeId(id);
  };

  const toggleDark = () => {
    const next = !isDark;
    localStorage.setItem(DARK_KEY, String(next));
    document.documentElement.classList.toggle("dark", next);
    setIsDark(next);
  };

  return { themeId, setTheme, isDark, toggleDark };
}
