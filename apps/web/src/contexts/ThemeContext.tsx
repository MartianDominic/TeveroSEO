"use client";

/**
 * Theme Context - Dark/Light mode management
 *
 * MED-25 FIX: Prevents theme hydration flash by:
 * 1. Providing a ThemeScript component that runs before React hydration
 * 2. The script reads localStorage and applies the theme class immediately
 * 3. This prevents the flash of wrong theme during SSR -> client transition
 */
import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => {},
});

/**
 * MED-25 FIX: Blocking script to prevent theme flash
 * This script runs before React hydration and immediately applies the correct theme.
 * Include this component in the <head> of your root layout.
 *
 * Security note: This uses dangerouslySetInnerHTML with a static string literal,
 * not user input, so XSS is not a concern here.
 */
export const ThemeScript: React.FC = () => {
  // This script is stringified and injected into the page
  // It runs immediately before React hydration to prevent flash
  const themeScript = `
    (function() {
      try {
        var theme = localStorage.getItem('agency-theme');
        if (theme === 'light') {
          document.documentElement.classList.remove('dark');
        } else {
          document.documentElement.classList.add('dark');
        }
      } catch (e) {
        document.documentElement.classList.add('dark');
      }
    })();
  `;

  return (
    <script
      dangerouslySetInnerHTML={{ __html: themeScript }}
      suppressHydrationWarning
    />
  );
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // MED-25 FIX: Initialize state by checking if dark class is present
  // This syncs with whatever the ThemeScript already applied
  const [theme, setTheme] = useState<Theme>(() => {
    // During SSR, default to dark (matches ThemeScript fallback)
    if (typeof window === "undefined") return "dark";
    // On client, check what ThemeScript already applied
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  });

  // Sync theme from localStorage after component mounts (client-side only)
  // This handles edge cases where classList might not match localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("agency-theme") as Theme | null;
      if (stored === "light" || stored === "dark") {
        setTheme(stored);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    try {
      localStorage.setItem("agency-theme", theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
