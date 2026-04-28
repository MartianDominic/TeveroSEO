import * as React from "react";

export type ThemePreference = "system" | "light" | "dark";

const THEME_STORAGE_KEY = "theme-preference";
const THEME_CHANGE_EVENT = "theme-preference-change";

function readThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
    return "system";
  } catch {
    return "system";
  }
}

function writeThemePreference(themePreference: ThemePreference) {
  try {
    if (themePreference === "system") {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, themePreference);
    }
  } catch {
    // localStorage unavailable
  }
}

function resolveIsDark(themePreference: ThemePreference): boolean {
  if (themePreference === "light") return false;
  if (themePreference === "dark") return true;
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyThemePreference(themePreference: ThemePreference) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolveIsDark(themePreference));
}

function subscribeToThemePreference(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const handleThemeChange = () => onStoreChange();
  const handleStorage = (event: StorageEvent) => {
    if (event.key && event.key !== THEME_STORAGE_KEY) return;
    onStoreChange();
  };
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleMediaChange = () => {
    applyThemePreference(readThemePreference());
    onStoreChange();
  };

  window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
  window.addEventListener("storage", handleStorage);
  mediaQuery.addEventListener("change", handleMediaChange);

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    window.removeEventListener("storage", handleStorage);
    mediaQuery.removeEventListener("change", handleMediaChange);
  };
}

export function useThemePreference() {
  const themePreference = React.useSyncExternalStore<ThemePreference>(
    subscribeToThemePreference,
    readThemePreference,
    () => "system",
  );

  React.useEffect(() => {
    applyThemePreference(themePreference);
  }, [themePreference]);

  const setThemePreference = React.useCallback(
    (nextThemePreference: ThemePreference) => {
      writeThemePreference(nextThemePreference);
      applyThemePreference(nextThemePreference);
      window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    },
    [],
  );

  return { themePreference, setThemePreference };
}

export const themePreferenceInitScript = `(() => {
  try {
    var p = window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var isDark;
    if (p === "light") isDark = false;
    else if (p === "dark") isDark = true;
    else isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", isDark);
  } catch {
    // silently fail
  }
})();`;
