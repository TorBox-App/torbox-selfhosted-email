"use client";

import { useTheme } from "@wraps/ui/hooks/use-theme";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect } from "react";

/**
 * Subscriber-facing light/dark/system switcher for the public preference
 * center pages. Only rendered when the org publishes colorScheme "system" —
 * with a forced Light or Dark scheme the serialized theme carries a single
 * token map, so flipping the app-level class would half-theme the page.
 *
 * Drives the app's own ThemeProvider (the same .dark class the scoped
 * `.dark [data-wraps-theme]` block and the globals.css fallbacks key off),
 * so org overrides and default tokens always flip together.
 */
export function PreferenceThemeToggle() {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "d" || e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const resolved =
        theme === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : theme;
      setTheme(resolved === "dark" ? "light" : "dark");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [theme, setTheme]);

  const options = [
    { value: "light", label: "Light theme", icon: Sun },
    { value: "dark", label: "Dark theme", icon: Moon },
    { value: "system", label: "Follow device theme", icon: Monitor },
  ] as const;

  return (
    <div className="fixed top-4 right-4 z-10 flex items-center gap-0.5 rounded-full border bg-background p-1 shadow-sm">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          aria-label={label}
          aria-pressed={theme === value}
          className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
            theme === value
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          key={value}
          onClick={() => setTheme(value)}
          title={`${label} (press "d" to toggle)`}
          type="button"
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
