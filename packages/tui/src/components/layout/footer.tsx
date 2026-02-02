import { useTerminalDimensions } from "@opentui/react";
import { useShortcuts } from "../../contexts/shortcuts";
import type { Route, Shortcut } from "../../types";

function getShortcuts(route: Route): Shortcut[] {
  switch (route.view) {
    case "dashboard":
      return [
        { key: "e", label: "Email" },
        { key: "1/2/3", label: "24h/7d/30d" },
        { key: "r", label: "Refresh" },
        { key: "q", label: "Quit" },
      ];
    case "email":
      return [
        { key: "i", label: "Deploy" },
        { key: "a", label: "Add" },
        { key: "v", label: "Verify" },
        { key: "d", label: "Remove" },
        { key: "j/k", label: "Navigate" },
        { key: "esc", label: "Back" },
      ];
    case "email.domains.add":
      return [
        { key: "enter", label: "Submit" },
        { key: "esc", label: "Back" },
      ];
    case "email.domains.verify":
      return [
        { key: "r", label: "Refresh" },
        { key: "esc", label: "Back" },
      ];
    case "email.domains.remove":
      return [
        { key: "y", label: "Confirm" },
        { key: "n", label: "Cancel" },
        { key: "esc", label: "Back" },
      ];
    case "email.init":
      return [
        { key: "tab", label: "Switch" },
        { key: "j/k", label: "Select" },
        { key: "enter", label: "Next" },
        { key: "esc", label: "Back" },
      ];
    case "templates":
      return [
        { key: "esc", label: "Back" },
        { key: "j/k", label: "Navigate" },
        { key: "e", label: "Edit" },
        { key: "n", label: "New" },
        { key: "q", label: "Quit" },
      ];
    case "workflows":
      return [
        { key: "esc", label: "Back" },
        { key: "j/k", label: "Navigate" },
        { key: "r", label: "Run/Pause" },
        { key: "q", label: "Quit" },
      ];
    case "monitoring":
      return [
        { key: "s", label: "Start/Stop" },
        { key: "space", label: "Pause" },
        { key: "f", label: "Filter" },
        { key: "g", label: "Groups" },
        { key: "c", label: "Clear" },
        { key: "esc", label: "Back" },
      ];
  }
}

interface FooterProps {
  route: Route;
}

export function Footer({ route }: FooterProps) {
  const { width } = useTerminalDimensions();
  const { overrides } = useShortcuts();
  const shortcuts = overrides ?? getShortcuts(route);
  const parts = shortcuts.map((s) => `${s.key} ${s.label}`);
  const line = " " + parts.join("   ");

  return (
    <box flexDirection="column" width="100%">
      <text fg="#444444">{" " + "─".repeat(Math.max(0, width - 2))}</text>
      <text fg="#888888">{line}</text>
    </box>
  );
}
