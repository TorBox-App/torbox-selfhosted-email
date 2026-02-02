import { useKeyboard, useRenderer } from "@opentui/react";
import { useState } from "react";
import { Dashboard } from "./components/dashboard/dashboard";
import { DomainsAdd } from "./components/email/domains-add";
import { DomainsRemove } from "./components/email/domains-remove";
import { DomainsVerify } from "./components/email/domains-verify";
import { EmailInit } from "./components/email/init/email-init";
import { EmailOverview } from "./components/email/overview";
import { Shell } from "./components/layout/shell";
import { Monitoring } from "./components/monitoring/monitoring";
import { FocusProvider, useFocus } from "./contexts/focus";
import { ShortcutsProvider } from "./contexts/shortcuts";
import { useAccount } from "./hooks/use-account";
import { useRouter } from "./hooks/use-router";
import type { Timespan } from "./types";

const TIMESPANS: Timespan[] = ["24h", "7d", "30d"];

function AppInner() {
  const [timespan, setTimespan] = useState<Timespan>("24h");
  const renderer = useRenderer();
  const { loading, error, data, refresh } = useAccount();
  const { route, navigate, back } = useRouter();
  const { inputActive } = useFocus();

  useKeyboard((key) => {
    if (inputActive) {
      return;
    }

    if (key.name === "q") {
      renderer.destroy();
    }

    // Monitoring and email init handle their own escape/navigation
    if (
      key.name === "escape" &&
      route.view !== "monitoring" &&
      route.view !== "email.init"
    ) {
      back();
    }

    // Dashboard-only shortcuts
    if (route.view === "dashboard") {
      if (key.name === "e") {
        navigate({ view: "email", sub: "overview" });
      }
      if (key.name === "t") {
        navigate({ view: "templates" });
      }
      if (key.name === "w") {
        navigate({ view: "workflows" });
      }
      if (key.name === "m") {
        navigate({ view: "monitoring" });
      }
      if (key.name === "1") {
        setTimespan("24h");
      }
      if (key.name === "2") {
        setTimespan("7d");
      }
      if (key.name === "3") {
        setTimespan("30d");
      }
      if (key.name === "tab") {
        setTimespan((prev) => {
          const idx = TIMESPANS.indexOf(prev);
          return TIMESPANS[(idx + 1) % TIMESPANS.length]!;
        });
      }
    }

    if (key.name === "r") {
      refresh();
    }
  });

  if (loading) {
    return (
      <Shell region={null} route={route}>
        <box
          alignItems="center"
          flexDirection="column"
          flexGrow={1}
          justifyContent="center"
          padding={1}
        >
          <text fg="#888888">Loading AWS data...</text>
        </box>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell region={null} route={route}>
        <box flexDirection="column" padding={1}>
          <text fg="#FF4444">
            <b>Error</b>
          </text>
          <text fg="#FF4444">{error}</text>
          <text> </text>
          <text fg="#888888">Check your AWS credentials and try again.</text>
          <text fg="#888888">
            Run `aws configure` or set AWS_PROFILE to fix.
          </text>
          <text> </text>
          <text fg="#888888">Press `r` to retry or `q` to quit.</text>
        </box>
      </Shell>
    );
  }

  const region = data?.region ?? "us-east-1";

  const renderRoute = () => {
    switch (route.view) {
      case "dashboard":
        return <Dashboard data={data!} timespan={timespan} />;

      case "email":
        return <EmailOverview data={data!} onNavigate={navigate} />;

      case "email.domains.add":
        return (
          <DomainsAdd
            onBack={back}
            onComplete={() => {
              refresh();
              back();
            }}
            region={region}
          />
        );

      case "email.domains.verify":
        return (
          <DomainsVerify domain={route.domain} onBack={back} region={region} />
        );

      case "email.domains.remove":
        return (
          <DomainsRemove
            domain={route.domain}
            onBack={back}
            onComplete={() => {
              refresh();
              back();
            }}
            region={region}
          />
        );

      case "email.init":
        return (
          <EmailInit
            data={data!}
            onBack={back}
            onComplete={() => {
              refresh();
              back();
            }}
          />
        );

      case "templates":
        return (
          <box flexDirection="column" padding={1}>
            <text fg="#FFFF00">Templates</text>
            <text fg="#888888">Coming soon — press ESC to go back</text>
          </box>
        );

      case "workflows":
        return (
          <box flexDirection="column" padding={1}>
            <text fg="#FFFF00">Workflows</text>
            <text fg="#888888">Coming soon — press ESC to go back</text>
          </box>
        );

      case "monitoring":
        return <Monitoring onBack={back} region={region} />;
    }
  };

  return (
    <Shell region={data?.region ?? null} route={route}>
      {renderRoute()}
    </Shell>
  );
}

export function App() {
  return (
    <FocusProvider>
      <ShortcutsProvider>
        <AppInner />
      </ShortcutsProvider>
    </FocusProvider>
  );
}
