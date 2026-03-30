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
  "March Update — Broadcast Analytics, Onboarding Rebuild, AI Editor & more";
export const emailType = "marketing" as const;
export const previewText =
  "Sankey engagement funnels, rebuilt onboarding, standalone CLI binary, and 16 releases.";

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

export default function MarchUpdateEmail({
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
              By the Wraps Team • March 2026
            </Text>

            {/* Intro */}
            <Text className="my-8 text-[15px] leading-relaxed text-gray-700">
              March was our biggest month yet — 291 commits, 16 CLI
              releases, and a ground-up rebuild of the onboarding flow. The
              theme: making Wraps more reliable, more observable, and easier
              to get started with.
            </Text>

            {/* ── Broadcast Engagement Analytics ── */}

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              Broadcast Engagement Analytics
            </Heading>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              Broadcasts now show a full engagement funnel — sent,
              delivered, opened, clicked — rendered as a Sankey diagram.
              Per-link click tracking lets you see which URLs drive engagement,
              and bot opens are filtered from all metrics so the numbers reflect
              real human engagement.
            </Text>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              Workflow executions got the same treatment: each step now shows
              its own open/click breakdown, so you can see exactly where a
              sequence loses engagement.
            </Text>

            <Section className="mt-5">
              <Button
                className="rounded-md border border-solid border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 no-underline"
                href="https://app.wraps.dev"
              >
                View Your Analytics
              </Button>
            </Section>

            {/* ── Onboarding Rebuild ── */}

            <Hr className="my-8 border-gray-200" />

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              Onboarding Rebuild
            </Heading>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              We rebuilt the onboarding flow from scratch. A new "Choose
              Your Path" step lets you pick between deploying from the
              CLI or connecting via CloudFormation. Billing moves to the first
              step so you're never blocked mid-setup. A go-live banner
              with AWS action gates keeps you on track until everything is
              connected.
            </Text>

            <Section className="mb-4">
              <Text className="m-0 mb-1.5 pl-4 text-[15px] leading-normal text-gray-700">
                •&ensp;Activation score tracking across onboarding
                milestones
              </Text>
              <Text className="m-0 mb-1.5 pl-4 text-[15px] leading-normal text-gray-700">
                •&ensp;Dedicated{" "}
                <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                  /setup
                </code>{" "}
                page with infrastructure checklist
              </Text>
              <Text className="m-0 mb-1.5 pl-4 text-[15px] leading-normal text-gray-700">
                •&ensp;6 starter templates available at project creation
              </Text>
              <Text className="m-0 mb-1.5 pl-4 text-[15px] leading-normal text-gray-700">
                •&ensp;Mobile signup rescue gate for better mobile
                conversion
              </Text>
              <Text className="m-0 mb-1.5 pl-4 text-[15px] leading-normal text-gray-700">
                •&ensp;Invite team members step with activation loop
              </Text>
            </Section>

            {/* ── CLI ── */}

            <Hr className="my-8 border-gray-200" />

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              CLI (v2.17.5 → v2.17.20)
            </Heading>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              16 releases this month. The headline: the CLI now ships as a
              standalone binary with bundled Node.js — install with a
              single{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                curl
              </code>{" "}
              command, no Node.js required.
            </Text>

            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                wraps deploy
              </code>{" "}
              pre-flight scan catches resource conflicts before touching AWS
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                wraps email doctor
              </code>{" "}
              validates your entire SES setup end-to-end
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;Metadata deep-merge preserves inbound, alerts, and
              webhook config on partial updates
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;Unified release workflows across core, CDK, and
              Pulumi packages
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;Email failure statuses now surfaced during template
              push
            </Text>

            {/* ── AI Template Editor ── */}

            <Hr className="my-8 border-gray-200" />

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              AI Template Editor Upgrades
            </Heading>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              The AI code editor gained three big capabilities: conversation
              history now persists across sessions so you can resume where you
              left off, brand kit support lets the AI apply your colors and
              fonts automatically, and a version history panel lets you diff
              and restore past iterations.
            </Text>

            {/* ── Dashboard ── */}

            <Hr className="my-8 border-gray-200" />

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              Dashboard Upgrades
            </Heading>

            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;Cancel and retry buttons for workflow executions
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;Subject line override on workflow send-email steps
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;Workflow builder ghost preview on drag-over with
              improved drop positioning
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;Subject and preview text columns in the templates
              table
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;Skeleton loaders for sidebar navigation
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;Docs link and "Need Help" dropdown in
              sidebar footer
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;Pino structured logging shipped to Axiom with
              request ID correlation
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;Analytics fallback to PostgreSQL when
              CloudWatch/DynamoDB unavailable
            </Text>

            {/* ── SDK ── */}

            <Hr className="my-8 border-gray-200" />

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              SDK (client v0.7.0)
            </Heading>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              The client SDK gained{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                wraps.track()
              </code>{" "}
              and{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                wraps.trackBatch()
              </code>{" "}
              methods for emitting events directly from your application code.
              Combined with the new cascade helper, you can trigger
              multi-channel automations from any event in your app.
            </Text>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              All SDK packages were also updated with improved npm
              descriptions and keywords for better discoverability in AI
              tooling and agent contexts.
            </Text>

            {/* ── Website ── */}

            <Hr className="my-8 border-gray-200" />

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              Website {"&"} Docs
            </Heading>

            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;New{" "}
              <Link
                className="text-gray-900 underline"
                href="https://wraps.dev/sdk"
              >
                /sdk
              </Link>{" "}
              page, linked from navbar
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;Landing page reworked with problem-contrast section
              and simplified pricing
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;Navbar reorganized: Products / Resources / Pricing
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;API reference docs with OpenAPI spec, plus{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                agent.json
              </code>{" "}
              and{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                llms.txt
              </code>{" "}
              for AI discoverability
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;"How Email Actually Works" interactive
              blog post
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;GIFs converted to MP4 — 80% static asset size
              reduction
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;Space Grotesk + JetBrains Mono font pairing
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
                    291
                  </Text>
                  <Text className="m-0 text-center text-xs text-gray-400">
                    commits shipped
                  </Text>
                </Column>
                <Column align="center" className="w-1/3">
                  <Text className="m-0 text-center text-3xl font-bold text-white">
                    16
                  </Text>
                  <Text className="m-0 text-center text-xs text-gray-400">
                    CLI releases
                  </Text>
                </Column>
                <Column align="center" className="w-1/3">
                  <Text className="m-0 text-center text-3xl font-bold text-white">
                    6
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
                You're receiving this email because you have an account
                with Wraps. If you don't want to receive these updates,
                unsubscribe below — you'll continue to receive
                important account-related emails.
              </Text>
              <Text className="m-0 mb-1 text-[13px] font-semibold text-gray-400">
                <Link
                  className="text-gray-400 no-underline"
                  href="https://wraps.dev"
                >
                  Wraps
                </Link>
                {"\u00A0"}•{"\u00A0"} Boulder, CO
              </Text>
              <Text className="m-0 text-xs text-gray-400">
                <Link
                  className="text-xs text-gray-400 underline"
                  href={unsubscribeUrl}
                >
                  Unsubscribe
                </Link>
                {"\u00A0"}•{"\u00A0"}
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
