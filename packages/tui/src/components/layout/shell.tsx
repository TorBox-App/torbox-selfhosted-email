import type { ReactNode } from "react";
import type { Route } from "../../types";
import { Footer } from "./footer";
import { Header } from "./header";

type ShellProps = {
  route: Route;
  region: string | null;
  children: ReactNode;
};

export function Shell({ route, region, children }: ShellProps) {
  return (
    <box flexDirection="column" height="100%" width="100%">
      <Header region={region} route={route} />
      <box flexGrow={1} width="100%">
        {children}
      </box>
      <Footer route={route} />
    </box>
  );
}
