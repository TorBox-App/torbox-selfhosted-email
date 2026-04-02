import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/**
 * Template Editor — AI Chat + Code Editor + Live Preview
 * Matches the actual React Email code editor UX:
 * Left: AI chat panel generating TSX code
 * Right: Live preview of the compiled template
 */
export const TemplateEdit: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase timing
  const promptType = 15;
  const aiThinking = 40;
  const codeAppear = 55;
  const previewRender = 75;
  const applyButton = 95;

  const cardScale = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 150 },
  });

  // AI typing indicator
  const isThinking = frame >= aiThinking && frame < codeAppear;
  const thinkingDot = Math.floor(frame / 6) % 3;

  // Code lines appearing
  const codeProgress = interpolate(
    frame,
    [codeAppear, codeAppear + 30],
    [0, 1],
    {
      extrapolateRight: "clamp",
      extrapolateLeft: "clamp",
    }
  );
  const codeLines = Math.floor(codeProgress * 8);

  // Preview fading in
  const previewOpacity = interpolate(
    frame,
    [previewRender, previewRender + 12],
    [0, 1],
    {
      extrapolateRight: "clamp",
      extrapolateLeft: "clamp",
    }
  );

  // Apply button
  const applyScale =
    frame >= applyButton
      ? spring({
          frame: frame - applyButton,
          fps,
          config: { damping: 10, stiffness: 250 },
        })
      : 0;

  // Prompt typing
  const promptText = "Create a welcome email for new signups with a CTA button";
  const promptChars = interpolate(
    frame,
    [promptType, promptType + 20],
    [0, promptText.length],
    {
      extrapolateRight: "clamp",
      extrapolateLeft: "clamp",
    }
  );

  const CODE_LINES = [
    {
      indent: 0,
      tokens: [
        { text: "import", color: "var(--info)" },
        { text: " { Html, Button, Text } ", color: "var(--foreground)" },
        { text: "from", color: "var(--info)" },
        { text: " '@react-email/components'", color: "var(--success)" },
      ],
    },
    { indent: 0, tokens: [] },
    {
      indent: 0,
      tokens: [
        { text: "export default", color: "var(--info)" },
        { text: " function ", color: "var(--foreground)" },
        { text: "WelcomeEmail", color: "var(--warning)" },
        { text: "() {", color: "var(--foreground)" },
      ],
    },
    {
      indent: 1,
      tokens: [
        { text: "return", color: "var(--info)" },
        { text: " (", color: "var(--foreground)" },
      ],
    },
    { indent: 2, tokens: [{ text: "<Html>", color: "var(--destructive)" }] },
    {
      indent: 3,
      tokens: [
        { text: "<Text>", color: "var(--destructive)" },
        { text: "Welcome aboard!", color: "var(--foreground)" },
        { text: "</Text>", color: "var(--destructive)" },
      ],
    },
    {
      indent: 3,
      tokens: [
        { text: "<Button", color: "var(--destructive)" },
        { text: " href=", color: "var(--info)" },
        { text: '"https://app.acme.dev"', color: "var(--success)" },
        { text: ">", color: "var(--destructive)" },
      ],
    },
    {
      indent: 4,
      tokens: [{ text: "Get Started", color: "var(--foreground)" }],
    },
  ];

  return (
    <AbsoluteFill
      style={{
        background: "var(--background)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        style={{
          transform: `scale(${cardScale})`,
          width: "100%",
          maxWidth: 600,
          display: "flex",
          flexDirection: "column",
          borderRadius: 10,
          border: "1px solid var(--border)",
          overflow: "hidden",
          background: "var(--card)",
        }}
      >
        {/* Toolbar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 12px",
            borderBottom: "1px solid var(--border)",
            fontSize: 12,
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontWeight: 600, color: "var(--foreground)" }}>
              welcome-email
            </span>
            <span
              style={{
                padding: "1px 6px",
                borderRadius: 4,
                background: "var(--muted)",
                color: "var(--muted-foreground)",
                fontSize: 10,
              }}
            >
              Draft
            </span>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                borderRadius: 5,
                border: "1px solid var(--border)",
                overflow: "hidden",
                fontSize: 10,
              }}
            >
              <div
                style={{
                  padding: "3px 8px",
                  background: "var(--accent)",
                  color: "var(--foreground)",
                }}
              >
                Design
              </div>
              <div
                style={{ padding: "3px 8px", color: "var(--muted-foreground)" }}
              >
                Code
              </div>
            </div>
            <div
              style={{
                padding: "3px 10px",
                fontSize: 10,
                fontWeight: 600,
                borderRadius: 5,
                background: "oklch(0.646 0.222 41.116)",
                color: "white",
              }}
            >
              Publish
            </div>
          </div>
        </div>

        {/* Main content — AI Chat + Preview */}
        <div style={{ display: "flex", height: 380 }}>
          {/* Left: AI Chat Panel */}
          <div
            style={{
              width: 240,
              borderRight: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              fontSize: 11,
            }}
          >
            {/* AI Header */}
            <div
              style={{
                padding: "8px 10px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ fontSize: 12 }}>✨</span>
              <span
                style={{
                  fontWeight: 600,
                  color: "var(--foreground)",
                  fontSize: 11,
                }}
              >
                AI Assistant
              </span>
            </div>

            {/* Messages */}
            <div
              style={{
                flex: 1,
                padding: 10,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                overflow: "hidden",
              }}
            >
              {/* User message */}
              {frame >= promptType && (
                <div style={{ alignSelf: "flex-end", maxWidth: "85%" }}>
                  <div
                    style={{
                      padding: "6px 10px",
                      borderRadius: "10px 10px 2px 10px",
                      background: "var(--primary)",
                      color: "var(--primary-foreground)",
                      fontSize: 11,
                      lineHeight: 1.4,
                    }}
                  >
                    {promptText.substring(0, Math.floor(promptChars))}
                  </div>
                </div>
              )}

              {/* AI thinking */}
              {isThinking && (
                <div style={{ alignSelf: "flex-start" }}>
                  <div
                    style={{
                      padding: "6px 10px",
                      borderRadius: "10px 10px 10px 2px",
                      background: "var(--muted)",
                      color: "var(--muted-foreground)",
                      fontSize: 11,
                    }}
                  >
                    {".".repeat(thinkingDot + 1)}
                  </div>
                </div>
              )}

              {/* AI response with code */}
              {frame >= codeAppear && (
                <div style={{ alignSelf: "flex-start", maxWidth: "90%" }}>
                  <div
                    style={{
                      padding: "6px 10px",
                      borderRadius: "10px 10px 10px 2px",
                      background: "var(--muted)",
                      fontSize: 11,
                      lineHeight: 1.4,
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    <span style={{ color: "var(--foreground)" }}>
                      Here&apos;s your welcome email:
                    </span>
                    {/* Mini code block */}
                    <div
                      style={{
                        background: "var(--background)",
                        borderRadius: 4,
                        padding: "6px 8px",
                        fontFamily: "var(--font-mono)",
                        fontSize: 9,
                        lineHeight: 1.5,
                        overflow: "hidden",
                      }}
                    >
                      {CODE_LINES.slice(0, codeLines).map((line, i) => (
                        <div
                          key={i}
                          style={{
                            paddingLeft: line.indent * 12,
                            whiteSpace: "pre",
                            display: "flex",
                          }}
                        >
                          {line.tokens.map((token, j) => (
                            <span key={j} style={{ color: token.color }}>
                              {token.text}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Apply / Discard buttons */}
              {applyScale > 0 && (
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    transform: `scale(${applyScale})`,
                    transformOrigin: "left center",
                  }}
                >
                  <div
                    style={{
                      padding: "4px 12px",
                      fontSize: 10,
                      fontWeight: 600,
                      borderRadius: 5,
                      background: "oklch(0.646 0.222 41.116)",
                      color: "white",
                    }}
                  >
                    Apply
                  </div>
                  <div
                    style={{
                      padding: "4px 12px",
                      fontSize: 10,
                      borderRadius: 5,
                      border: "1px solid var(--border)",
                      color: "var(--muted-foreground)",
                    }}
                  >
                    Discard
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div
              style={{
                padding: "8px 10px",
                borderTop: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  fontSize: 10,
                  color: "var(--muted-foreground)",
                }}
              >
                Describe your template...
              </div>
            </div>
          </div>

          {/* Right: Live Preview */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              background: "var(--background)",
            }}
          >
            {/* Preview header */}
            <div
              style={{
                padding: "6px 10px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 10,
                color: "var(--muted-foreground)",
              }}
            >
              <span>Preview</span>
              <div style={{ display: "flex", gap: 4 }}>
                <span
                  style={{
                    padding: "1px 6px",
                    borderRadius: 3,
                    background: "var(--accent)",
                  }}
                >
                  Desktop
                </span>
                <span style={{ padding: "1px 6px", borderRadius: 3 }}>
                  Mobile
                </span>
              </div>
            </div>

            {/* Email preview */}
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
                opacity: previewOpacity,
              }}
            >
              <div
                style={{
                  width: "90%",
                  maxWidth: 280,
                  background: "var(--card)",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  overflow: "hidden",
                }}
              >
                {/* Email content */}
                <div style={{ padding: "16px 20px", textAlign: "center" }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      background: "oklch(0.646 0.222 41.116)",
                      margin: "0 auto 12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontWeight: 800,
                      fontSize: 14,
                    }}
                  >
                    A
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: "var(--foreground)",
                      marginBottom: 8,
                    }}
                  >
                    Welcome aboard!
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--muted-foreground)",
                      lineHeight: 1.5,
                      marginBottom: 16,
                    }}
                  >
                    We&apos;re excited to have you. Get started with your
                    account setup.
                  </div>
                  <div
                    style={{
                      display: "inline-block",
                      padding: "8px 20px",
                      borderRadius: 5,
                      background: "oklch(0.646 0.222 41.116)",
                      color: "white",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    Get Started
                  </div>
                </div>
                <div
                  style={{
                    padding: "8px 20px",
                    borderTop: "1px solid var(--border)",
                    textAlign: "center",
                    fontSize: 9,
                    color: "var(--muted-foreground)",
                  }}
                >
                  Acme Inc · Unsubscribe
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
