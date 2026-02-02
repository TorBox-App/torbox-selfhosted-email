import { useTerminalDimensions } from "@opentui/react";
import type { Route } from "../../types";

function getBreadcrumb(route: Route): string {
  switch (route.view) {
    case "dashboard":
      return "";
    case "email":
      return ` > Email > ${capitalize(route.sub)}`;
    case "email.domains.add":
      return " > Email > Domains > Add";
    case "email.domains.verify":
      return ` > Email > Domains > Verify (${route.domain})`;
    case "email.domains.remove":
      return ` > Email > Domains > Remove (${route.domain})`;
    case "email.init":
      return " > Email > Deploy";
    case "templates":
      return " > Templates";
    case "workflows":
      return " > Workflows";
    case "monitoring":
      return " > Monitoring";
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type HeaderProps = {
  route: Route;
  region: string | null;
};

export function Header({ route, region }: HeaderProps) {
  const { width } = useTerminalDimensions();
  const title = "WRAPS v2.0.0";
  const breadcrumb = getBreadcrumb(route);
  const right = region ?? "...";
  const left = `${title}${breadcrumb}`;
  const gap = Math.max(1, width - left.length - right.length - 2);
  const spacer = " ".repeat(gap);

  return (
    <box flexDirection="column" width="100%">
      <box flexDirection="row" width="100%">
        <text fg="#00AAFF">
          <b>{` ${left}`}</b>
        </text>
        <text>{spacer}</text>
        <text fg="#888888">{`${right} `}</text>
      </box>
      <text fg="#444444">{` ${"━".repeat(Math.max(0, width - 2))}`}</text>
    </box>
  );
}
