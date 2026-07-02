import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

// ── Metadata ──

export const subject =
  "May + June Update — Self-Hosted Wraps, Email Logs, MCP Server & more";
export const emailType = "marketing" as const;
export const previewText =
  "Run the entire Wraps control plane in your AWS, inspect email logs from the CLI, per-domain SES config, an MCP server, and Cloudflare Workers support.";

// ── Test Data (for preview) ──

export const testData = {
  unsubscribeUrl: "https://wraps.dev/unsubscribe",
  preferencesUrl: "https://wraps.dev/preferences",
};

// ── Template ──

type Props = {
  unsubscribeUrl: string;
  preferencesUrl: string;
};

export default function MayJuneUpdateEmail({
  unsubscribeUrl,
  preferencesUrl,
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-white font-sans">
          <Container className="mx-auto max-w-[560px] px-2.5 py-5">
            {/* Header */}
            <Section>
              <Row>
                <Column className="w-[80%]">
                  <Img
                    alt="Wraps"
                    className="rounded-md"
                    height="40"
                    src="https://wraps.dev/_next/image?url=%2Fwraps-light-logo.png&w=256&q=75"
                    width="120"
                  />
                </Column>
                <Column align="right">
                  <Row align="right">
                    <Column className="px-[6px]">
                      <Link href="https://wraps.dev/changelog">
                        <Img
                          alt="Changelog"
                          height="20"
                          src="https://wraps.dev/icons/changelog.png"
                          width="20"
                        />
                      </Link>
                    </Column>
                    <Column className="px-[6px]">
                      <Link href="https://github.com/wraps-team/wraps">
                        <Img
                          alt="GitHub"
                          height="20"
                          src="https://wraps.dev/logos/github.png"
                          width="20"
                        />
                      </Link>
                    </Column>
                  </Row>
                </Column>
              </Row>
            </Section>

            {/* Byline */}
            <Text className="mb-6 text-sm text-gray-500">
              By the Wraps Team • May &amp; June 2026
            </Text>

            {/* Intro */}
            <Text className="my-8 text-[15px] leading-relaxed text-gray-700">
              We skipped a month, so this one's a double issue. May and June
              were 292 commits and 36 CLI releases, anchored by the biggest
              thing we've shipped since launch: you can now run the entire Wraps
              control plane — API, dashboard, and database — in your own AWS
              account.
            </Text>

            {/* ── Self-Hosted Wraps ── */}

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              Self-Hosted Wraps
            </Heading>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              Until now, Wraps hosted the platform and your AWS handled the
              sending. That's still the default — but if you want everything in
              your own cloud,{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                wraps selfhost deploy
              </code>{" "}
              now deploys the full control plane to your AWS account: API,
              dashboard, and database. Provision a Postgres database
              interactively or bring your own.
            </Text>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              Deployment is fork-based. GitHub Actions workflows keep your fork
              in sync with upstream, so upgrades arrive as pull requests you
              review and merge — no mystery deploys. Companion commands handle
              the rest of the lifecycle:{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                selfhost login
              </code>
              ,{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                selfhost connect
              </code>
              ,{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                selfhost env
              </code>
              , and{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                selfhost destroy
              </code>
              . Plan limits are lifted entirely on self-hosted deployments.
            </Text>

            <Section className="mt-5">
              <Button
                className="rounded-md border border-solid border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 no-underline"
                href="https://wraps.dev/docs/guides/self-hosted"
              >
                Read the deployment guide
              </Button>
            </Section>

            {/* ── Email Logs CLI ── */}

            <Hr className="my-8 border-gray-200" />

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              Email Logs in Your Terminal
            </Heading>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                wraps email logs list
              </code>{" "}
              gives you a paginated table of sent emails — status, recipient,
              subject, message ID — and{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                wraps email logs get &lt;messageId&gt;
              </code>{" "}
              pulls full delivery detail for a single message, including bounce
              type and timestamps.
            </Text>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              Filter by status with{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                --status delivered
              </code>
              ,{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                --status bounced
              </code>
              , or{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                --status complained
              </code>
              , paginate large result sets with cursors, and use{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                --json
              </code>{" "}
              for scripting. Logs cover both SDK sends and batch broadcasts in
              one unified view.
            </Text>

            {/* ── Per-Domain Config Sets ── */}

            <Hr className="my-8 border-gray-200" />

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              Per-Domain SES Configuration
            </Heading>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              Different domains have different jobs — your marketing domain
              wants open and click tracking, your transactional domain probably
              doesn't.{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                wraps email domains config
              </code>{" "}
              now gives every sending domain its own SES configuration set,
              covering 7 groups of options: open/click tracking, TLS delivery,
              sending toggle, reputation metrics, bounce/complaint suppression,
              email archiving, and Virtual Deliverability Manager.
            </Text>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              Configure interactively or script it with boolean flags like{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                --opens
              </code>
              ,{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                --tls-required
              </code>
              , and{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                --archive
              </code>
              . Existing deployments migrate through{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                wraps email upgrade
              </code>{" "}
              with no DNS changes. Enabling archiving auto-creates a shared Mail
              Manager archive in your account.
            </Text>

            {/* ── MCP Server ── */}

            <Hr className="my-8 border-gray-200" />

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              @wraps.dev/mcp — Wraps for AI Agents
            </Heading>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              Wraps now ships an MCP server. Point Claude, Cursor, or any MCP
              client at{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                @wraps.dev/mcp
              </code>{" "}
              and your agent can send email, check delivery events, list
              suppressions, and verify domain status — with guardrails built in:
              a recipient allowlist, a send cap, and a from-override guard so an
              agent can't go off-script with your sending domain.
            </Text>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              The website got agent-ready too: every docs page is available as
              per-page markdown, OAuth 2.0 discovery metadata is published at{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                /.well-known/oauth-authorization-server
              </code>
              , and an RFC 9727 API catalog points agents at the OpenAPI spec
              and docs.
            </Text>

            <Section className="mt-5">
              <Button
                className="rounded-md border border-solid border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 no-underline"
                href="https://www.npmjs.com/package/@wraps.dev/mcp"
              >
                npm install @wraps.dev/mcp
              </Button>
            </Section>

            {/* ── Cloudflare Workers ── */}

            <Hr className="my-8 border-gray-200" />

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              Cloudflare Workers Support
            </Heading>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                @wraps.dev/email
              </code>{" "}
              v0.12 adds a dedicated edge build. Import from{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                @wraps.dev/email/workers
              </code>{" "}
              and the SDK runs on Cloudflare Workers — no Node-only APIs, and a
              slimmer validation bundle to keep your Worker small. There's a new
              quickstart to go with it.
            </Text>

            <Section className="mt-5">
              <Button
                className="rounded-md border border-solid border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 no-underline"
                href="https://wraps.dev/docs/quickstart/email/cloudflare"
              >
                Workers quickstart
              </Button>
            </Section>

            {/* ── Workflow + Broadcast Reliability ── */}

            <Hr className="my-8 border-gray-200" />

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              Workflow &amp; Broadcast Reliability
            </Heading>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              We spent June deliberately trying to break the workflow engine,
              then fixing what broke. The result:
            </Text>

            <Section className="mb-4">
              <Text className="m-0 mb-1.5 pl-4 text-[15px] leading-normal text-gray-700">
                •&ensp;A reaper automatically detects and recovers executions
                that stall mid-run
              </Text>
              <Text className="m-0 mb-1.5 pl-4 text-[15px] leading-normal text-gray-700">
                •&ensp;Atomic execution claims eliminate duplicate runs under
                concurrency
              </Text>
              <Text className="m-0 mb-1.5 pl-4 text-[15px] leading-normal text-gray-700">
                •&ensp;Cycle detection rejects workflow definitions that would
                loop forever
              </Text>
              <Text className="m-0 mb-1.5 pl-4 text-[15px] leading-normal text-gray-700">
                •&ensp;Failed executions retry with hardened semantics, and
                suppressed bounces now resume waiting workflows correctly
              </Text>
            </Section>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              Broadcasts got the same treatment: each message is now claimed
              before it's handed to SES, so a redelivered queue message can't
              double-send to your audience. And a new pre-flight check validates
              template variable coverage before a broadcast goes out, so an
              unfilled first-name placeholder gets caught before it reaches a
              real inbox.
            </Text>

            {/* ── Email Search & Delivery Visibility ── */}

            <Hr className="my-8 border-gray-200" />

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              Email Search &amp; Delivery Visibility
            </Heading>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              The emails page now has server-side search, so you can find a
              specific message across your full sending history instead of just
              the page you're looking at. Status filters were fixed to correctly
              surface suppressed and complained sends, and complaint status now
              takes priority over delivered in the list.
            </Text>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              Bounce and complaint health rates are now sourced from SES
              reputation metrics — the same numbers AWS uses to evaluate your
              account health — so what you see in Wraps matches what AWS sees.
            </Text>

            {/* ── CLI ── */}

            <Hr className="my-8 border-gray-200" />

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              CLI (v2.20.0 → v2.23.3)
            </Heading>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              36 releases across the two months. Notable changes beyond the
              features above:
            </Text>

            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                --preview
              </code>{" "}
              on every init, upgrade, and destroy command — see the plan before
              anything touches your account
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                -r/--region
              </code>{" "}
              now wired through every command that was ignoring it
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;EventBridge now forwards all SES event types — some
              subtypes were previously dropped
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;Connection metadata and secret files written with{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                0600
              </code>{" "}
              permissions
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;SQS event source mapping stays enabled on redeploy
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;Lambda runtime upgraded to Node.js 24
            </Text>

            {/* ── Dashboard ── */}

            <Hr className="my-8 border-gray-200" />

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              Dashboard
            </Heading>

            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;Audit logging now covers every dashboard action, written
              atomically with the mutation it records
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;Unsubscribe stats and grouped unsubscribe URLs in the
              broadcast Sankey diagram
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;Invited team members get their own onboarding flow instead
              of the org-setup path
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;Double-click to rename workflow nodes inline
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;IAM role health surfaced directly in the dashboard
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;Org switcher renders instantly — initial data is now
              server-rendered
            </Text>

            {/* ── By the Numbers ── */}

            <Section className="mt-8 rounded-lg bg-gray-900 px-6 py-8">
              <Heading
                as="h2"
                className="m-0 mb-6 text-center text-[22px] font-bold leading-tight text-white"
              >
                By the numbers
              </Heading>

              <Row>
                <Column align="center" className="w-1/3">
                  <Text className="m-0 text-center text-3xl font-bold text-white">
                    292
                  </Text>
                  <Text className="m-0 text-center text-xs text-gray-400">
                    commits shipped
                  </Text>
                </Column>
                <Column align="center" className="w-1/3">
                  <Text className="m-0 text-center text-3xl font-bold text-white">
                    36
                  </Text>
                  <Text className="m-0 text-center text-xs text-gray-400">
                    CLI releases
                  </Text>
                </Column>
                <Column align="center" className="w-1/3">
                  <Text className="m-0 text-center text-3xl font-bold text-white">
                    8
                  </Text>
                  <Text className="m-0 text-center text-xs text-gray-400">
                    major features
                  </Text>
                </Column>
              </Row>

              <Section className="mt-6 text-center">
                <Button
                  className="rounded-md bg-white px-8 py-3 text-sm font-semibold text-gray-900 no-underline"
                  href="https://wraps.dev/changelog"
                >
                  Read the full changelog
                </Button>
              </Section>
            </Section>

            {/* ── Closing ── */}

            <Hr className="my-8 border-gray-200" />

            <Text className="m-0 mb-6 text-[15px] leading-relaxed text-gray-700">
              Questions or feedback? Reply to this email — I read every
              response.
            </Text>

            <Text className="m-0 mb-1 text-[15px] text-gray-700">Cheers,</Text>
            <Text className="m-0 text-[15px] font-bold text-gray-900">
              Jarod from Wraps
            </Text>

            {/* Footer */}
            <Section className="pt-10 text-center">
              <Text className="m-0 mb-3 text-left text-[13px] italic leading-normal text-gray-400">
                You're receiving this email because you have an account with
                Wraps. If you don't want to receive these updates, unsubscribe
                below — you'll continue to receive important account-related
                emails.
              </Text>
              <Text className="m-0 mb-1 text-[13px] font-semibold text-gray-400">
                <Link
                  className="text-gray-400 no-underline"
                  href="https://wraps.dev"
                >
                  Wraps
                </Link>{" "}
                • Boulder, CO
              </Text>
              <Text className="m-0 text-xs text-gray-400">
                <Link
                  className="text-xs text-gray-400 underline"
                  href={unsubscribeUrl}
                >
                  Unsubscribe
                </Link>{" "}
                •{" "}
                <Link
                  className="text-xs text-gray-400 underline"
                  href={preferencesUrl}
                >
                  Manage Subscriptions
                </Link>
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
