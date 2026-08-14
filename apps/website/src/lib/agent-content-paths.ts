// Paths that have a real markdown representation in AGENT_CONTENT.
// Kept separate from agent-content.ts so middleware (edge bundle) doesn't
// pull in the full content strings.
export const AGENT_CONTENT_PATHS: readonly string[] = [
  "/pricing",
  "/pricing.md",
  "/tools/ses-calculator",
  "/",
  "/docs/quickstart/email",
  "/docs/quickstart/email/agents",
  "/docs/mcp-reference",
  "/docs/quickstart/email/nextjs",
  "/docs/quickstart/sms",
  "/docs/quickstart/platform",
  "/docs/sdk-reference",
  "/docs/cli-reference",
  "/docs/cli-reference/email",
  "/docs/guides/domain-verification",
  "/docs/guides/webhooks",
];
