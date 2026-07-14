"use client";

import { useTheme } from "@wraps/ui/hooks/use-theme";
import { useEffect } from "react";

/**
 * Press "d" anywhere (outside a text field) to toggle light/dark.
 * Toggles off the actual resolved theme so it works even when the
 * stored preference is "system".
 */
export function ThemeShortcut() {
  const { setTheme } = useTheme();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "d") {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      const isDark = document.documentElement.classList.contains("dark");
      setTheme(isDark ? "light" : "dark");
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setTheme]);

  return null;
}
