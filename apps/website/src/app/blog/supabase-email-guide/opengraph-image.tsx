import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "4 Email Flows Your Supabase App Needs Before Going Live";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function Card({ icon, label }: { icon: string; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "16px 20px",
        width: 220,
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 12,
        boxShadow: "inset 2px 0 10px -4px rgba(62,207,142,0.4)",
      }}
    >
      <span style={{ fontSize: 24, marginRight: 14 }}>{icon}</span>
      <span
        style={{
          fontSize: 20,
          color: "rgba(255,255,255,0.9)",
          fontWeight: 600,
          letterSpacing: "-0.02em",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function TerminalLine({
  text,
  isCommand,
}: {
  text: string;
  isCommand?: boolean;
}) {
  if (isCommand) {
    return (
      <div
        style={{
          display: "flex",
          marginBottom: 16,
          color: "white",
          fontWeight: 600,
          fontSize: 18,
        }}
      >
        $ {text}
      </div>
    );
  }
  return (
    <div
      style={{
        display: "flex",
        marginBottom: 8,
        fontSize: 18,
        color: "rgba(255,255,255,0.85)",
      }}
    >
      <span style={{ color: "#4ade80", marginRight: 12 }}>✓</span>
      {text}
    </div>
  );
}

export default async function Image() {
  const toDataUri = async (url: string) => {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");
    return `data:image/png;base64,${base64}`;
  };

  const [supabaseLogo, wrapsLogo] = await Promise.all([
    toDataUri("https://wraps.dev/logos/supabase-wordmark-dark.png"),
    toDataUri("https://wraps.dev/wraps-dark-logo.png"),
  ]);

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "#0a0a0f",
        fontFamily: "system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Dot grid background */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage:
            "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.06) 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Main content area */}
      <div
        style={{
          display: "flex",
          width: "100%",
          padding: "48px 64px 24px",
          justifyContent: "space-between",
          alignItems: "center",
          flex: 1,
        }}
      >
        {/* Left: 4 cards in 2x2 grid */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", gap: 16 }}>
            <Card icon="🔑" label="Auth" />
            <Card icon="🔔" label="Transactional" />
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <Card icon="📣" label="Broadcasts" />
            <Card icon="🔄" label="Automations" />
          </div>
        </div>

        {/* Right: Terminal */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 380,
            background: "rgba(17,17,21,0.9)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "20px 0 60px -15px rgba(249,115,22,0.12)",
          }}
        >
          {/* Terminal chrome */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "12px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.03)",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                background: "#ef4444",
              }}
            />
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                background: "#eab308",
              }}
            />
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                background: "#22c55e",
              }}
            />
          </div>
          {/* Terminal content */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              padding: "20px 24px",
            }}
          >
            <TerminalLine isCommand text="wraps email deploy" />
            <TerminalLine text="SES configured" />
            <TerminalLine text="DKIM verified" />
            <TerminalLine text="Templates ready" />
            <TerminalLine text="Workflows active" />
          </div>
        </div>
      </div>

      {/* Bottom: Title + logos */}
      <div
        style={{
          display: "flex",
          width: "100%",
          padding: "0 64px 40px",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        {/* Bottom left: Supabase logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            opacity: 0.8,
          }}
        >
          <img alt="Supabase" height={28} src={supabaseLogo} width={140} />
        </div>

        {/* Center: Title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 36,
              fontWeight: 800,
              color: "white",
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
            }}
          >
            4 Email Flows Your Supabase App Needs
          </div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 800,
              color: "#f97316",
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
              marginTop: 4,
            }}
          >
            Before Going Live
          </div>
        </div>

        {/* Bottom right: Wraps logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            opacity: 0.8,
          }}
        >
          <img alt="Wraps" height={24} src={wrapsLogo} width={100} />
        </div>
      </div>
    </div>,
    { ...size }
  );
}
