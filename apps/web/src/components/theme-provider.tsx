"use client";

import { ThemeProviderContext } from "@wraps/ui/contexts/theme-context";
import * as React from "react";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

function setThemeCookie(resolvedTheme: "dark" | "light") {
  // Set cookie with 1 year expiry, accessible to server
  document.cookie = `theme=${resolvedTheme};path=/;max-age=31536000;SameSite=Lax`;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = React.useState<Theme>(
    () =>
      (typeof window !== "undefined" &&
        (localStorage.getItem(storageKey) as Theme)) ||
      defaultTheme
  );

  // Sync theme class and cookie on mount and when theme changes
  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const root = window.document.documentElement;
    const resolvedTheme =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme;

    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
    setThemeCookie(resolvedTheme);
  }, [theme]);

  // Listen for system theme changes when in "system" mode
  React.useEffect(() => {
    if (typeof window === "undefined" || theme !== "system") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      const root = window.document.documentElement;
      root.classList.remove("light", "dark");
      const newTheme = e.matches ? "dark" : "light";
      root.classList.add(newTheme);
      setThemeCookie(newTheme);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      if (typeof window !== "undefined") {
        localStorage.setItem(storageKey, theme);
      }
      setTheme(theme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}
