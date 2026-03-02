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
  "February Update — Inbound Email, Automations as Code, SMS & more";
export const emailType = "marketing" as const;
export const previewText =
  "Our biggest month yet: inbound email receiving, automations as code, multi-channel SMS, and 8 CLI releases.";

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

export default function FebruaryUpdateEmail({
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
              By the Wraps Team &bull; February 2026
            </Text>

            {/* Intro */}
            <Text className="my-8 text-[15px] leading-relaxed text-gray-700">
              February was our most productive month to date &mdash; 80+ commits
              across the platform and SDK repos, 8 CLI releases (v2.14 &rarr;
              v2.17), and the email SDK went from v0.7 to v0.10. Here&apos;s
              everything we shipped.
            </Text>

            {/* ── Inbound Email ── */}

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              Inbound Email Receiving
            </Heading>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              Receive emails on your domain, right in your AWS account. The CLI
              deploys SES MailManager rules, S3 storage, and EventBridge routing
              &mdash; one command, full inbound pipeline. The dashboard shows
              every inbound message with analytics charts, and root domain
              receiving is now supported.
            </Text>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              On the SDK side, new{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                inbox.forward()
              </code>{" "}
              and{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                inbox.reply()
              </code>{" "}
              methods let you programmatically respond to inbound messages.
              Build support ticket systems, auto-responders, or email-to-app
              integrations with a few lines of code.
            </Text>

            <Section className="mt-5">
              <Button
                className="rounded-md border border-solid border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 no-underline"
                href="https://wraps.dev/docs/quickstart/email/inbound"
              >
                Inbound Docs
              </Button>
            </Section>

            {/* ── Automations as Code ── */}

            <Hr className="my-8 border-gray-200" />

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              Automations as Code
            </Heading>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              Define multi-step automations in TypeScript and push them with the
              CLI. New SDK helpers make it easy to compose steps, conditions,
              and delays programmatically. Run{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                wraps email workflows init
              </code>{" "}
              to scaffold an automation file with the right types, then{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                wraps email workflows push
              </code>{" "}
              to deploy.
            </Text>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              The visual automation builder also got a big upgrade: undo/redo
              support, pre-enable readiness checks that validate your automation
              before going live, a searchable condition combobox, an unsaved
              changes guard, and auto-open settings for new automations.
            </Text>

            <Section className="mt-5">
              <Button
                className="rounded-md border border-solid border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 no-underline"
                href="https://wraps.dev/docs/guides/workflows"
              >
                Automations Docs
              </Button>
            </Section>

            {/* ── Automation Engine ── */}

            <Hr className="my-8 border-gray-200" />

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              Automation Engine Hardening
            </Heading>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              Major reliability work under the hood. We resolved 8 critical and
              high severity automation bugs in a single pass, including:
            </Text>

            <Section className="mb-4">
              <Text className="m-0 mb-1.5 pl-4 text-[15px] leading-normal text-gray-700">
                &bull;&ensp;DLQ consumer with CloudWatch alarms for failed
                automation and batch messages
              </Text>
              <Text className="m-0 mb-1.5 pl-4 text-[15px] leading-normal text-gray-700">
                &bull;&ensp;Fixed a dual-resume race condition in the automation
                processor
              </Text>
              <Text className="m-0 mb-1.5 pl-4 text-[15px] leading-normal text-gray-700">
                &bull;&ensp;Definition snapshots &mdash; in-flight executions
                are now immune to live dashboard edits
              </Text>
              <Text className="m-0 mb-1.5 pl-4 text-[15px] leading-normal text-gray-700">
                &bull;&ensp;Repaired broken EventBridge schedule chains with a
                reconciliation watchdog
              </Text>
              <Text className="m-0 mb-1.5 pl-4 text-[15px] leading-normal text-gray-700">
                &bull;&ensp;Hardened webhook SSRF validation &mdash; blocks
                loopback, link-local, and private network targets
              </Text>
            </Section>

            {/* ── Multi-Channel SMS ── */}

            <Hr className="my-8 border-gray-200" />

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              Multi-Channel SMS
            </Heading>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              SMS is no longer a waitlist &mdash; it&apos;s launched. The
              database schema now supports multi-channel templates, contacts,
              and automations. Cascade nodes in the automation builder enable
              multi-step, multi-channel sequences (email &rarr; wait &rarr; SMS,
              or any combination). The SMS SDK hit v0.1.2, and the SMS dashboard
              got a cleanup pass.
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
              &bull;&ensp;New unified overview page with channel-granular health
              monitoring
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;Universal Cmd-K command palette with server-side
              search
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;Analytics charts on contacts, events, emails, and
              inbound pages
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;CSV import with column mapping and custom properties
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;CSV export on all dashboard tables
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;Bulk template actions &mdash; select multiple to
              delete, publish, or change type
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;Natural language date input for broadcast scheduling
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;Send volume sparklines on API key cards
            </Text>

            {/* ── CLI ── */}

            <Hr className="my-8 border-gray-200" />

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              CLI (v2.14 &rarr; v2.17)
            </Heading>

            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;S3 remote state for multi-machine deploys &mdash; no
              more lost Pulumi state
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;Auto-clear Pulumi stack locks on deploy retry
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                --json
              </code>{" "}
              output on all commands for CI/CD integration
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;Guided multi-domain management with subdomain
              suggestions
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                wraps email templates preview
              </code>{" "}
              command with live reload
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;Hosting provider change in the upgrade menu
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;Terminal dashboard UI (TUI)
            </Text>

            {/* ── SDK ── */}

            <Hr className="my-8 border-gray-200" />

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              SDK (email v0.7 &rarr; v0.10)
            </Heading>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              The biggest SDK change: zero-config Vercel OIDC. The SDK
              auto-detects{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                AWS_ROLE_ARN
              </code>{" "}
              from your environment, so deploying on Vercel with OIDC requires
              zero credential configuration. No env vars, no secrets &mdash;
              just deploy.
            </Text>

            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                defineConfig
              </code>{" "}
              and{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                defineBrand
              </code>{" "}
              helpers for templates-as-code
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;Automation definition helpers for automations-as-code
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;Inbound email methods (forward, reply)
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;Security patch for fast-xml-parser
            </Text>

            <Section className="mt-5">
              <Button
                className="rounded-md border border-solid border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 no-underline"
                href="https://wraps.dev/docs/guides/vercel"
              >
                Vercel OIDC Guide
              </Button>
            </Section>

            {/* ── Security & Observability ── */}

            <Hr className="my-8 border-gray-200" />

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              Security &amp; Observability
            </Heading>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              Patched XSS, cross-org IDOR, and RCE vulnerabilities. Hardened
              webhook SSRF validation. Timing-safe secret comparison across all
              auth paths. Resolved 22 Dependabot alerts. Migrated the entire API
              to structured JSON logging with canonical log lines per request.
              Added PostHog error tracking.
            </Text>

            {/* ── Website & Docs ── */}

            <Hr className="my-8 border-gray-200" />

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              Website &amp; Docs
            </Heading>

            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;14 new documentation pages: inbound email, EventBridge
              events, Vercel setup, webhooks, and more
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;Redesigned pricing comparison section
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;New about and contact pages with author bylines
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;Inbound email marketing page
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;SEO-optimized SES cost calculator
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;Converted 13 large PNGs to WebP &mdash; 95% size
              reduction
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;Auto-discovering sitemap and Vercel Speed Insights
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
                    80+
                  </Text>
                  <Text className="m-0 text-center text-xs text-gray-400">
                    commits shipped
                  </Text>
                </Column>
                <Column align="center" className="w-1/3">
                  <Text className="m-0 text-center text-3xl font-bold text-white">
                    8
                  </Text>
                  <Text className="m-0 text-center text-xs text-gray-400">
                    CLI releases
                  </Text>
                </Column>
                <Column align="center" className="w-1/3">
                  <Text className="m-0 text-center text-3xl font-bold text-white">
                    14
                  </Text>
                  <Text className="m-0 text-center text-xs text-gray-400">
                    new doc pages
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
              Questions or feedback? Reply to this email &mdash; I read every
              response.
            </Text>

            <Text className="m-0 mb-1 text-[15px] text-gray-700">Cheers,</Text>
            <Text className="m-0 text-[15px] font-bold text-gray-900">
              Jarod from Wraps
            </Text>

            {/* Footer */}
            <Section className="pt-10 text-center">
              <Text className="m-0 mb-3 text-left text-[13px] italic leading-normal text-gray-400">
                You&apos;re receiving this email because you have an account
                with Wraps. If you don&apos;t want to receive these updates,
                unsubscribe below &mdash; you&apos;ll continue to receive
                important account-related emails.
              </Text>
              <Text className="m-0 mb-1 text-[13px] font-semibold text-gray-400">
                <Link
                  className="text-gray-400 no-underline"
                  href="https://wraps.dev"
                >
                  Wraps
                </Link>
                &nbsp;&bull;&nbsp; Boulder, CO
              </Text>
              <Text className="m-0 text-xs text-gray-400">
                <Link
                  className="text-xs text-gray-400 underline"
                  href={unsubscribeUrl}
                >
                  Unsubscribe
                </Link>
                &nbsp;&bull;&nbsp;
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
