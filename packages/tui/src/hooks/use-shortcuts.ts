import { useKeyboard, useRenderer } from "@opentui/react";
import type { Route } from "../types";

interface UseShortcutsOptions {
  onNavigate: (route: Route) => void;
  onBack: () => void;
}

export function useShortcuts({ onNavigate, onBack }: UseShortcutsOptions) {
  const renderer = useRenderer();

  useKeyboard((key) => {
    if (key.name === "q") renderer.destroy();
    if (key.name === "escape") onBack();
    if (key.name === "e") onNavigate({ view: "email", sub: "overview" });
    if (key.name === "t") onNavigate({ view: "templates" });
    if (key.name === "w") onNavigate({ view: "workflows" });
    if (key.name === "m") onNavigate({ view: "monitoring" });
  });
}
