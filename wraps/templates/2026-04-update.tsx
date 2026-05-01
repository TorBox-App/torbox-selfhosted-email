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

export const subject = "April Update — SSO, RBAC, Reply Threading & more";
export const emailType = "marketing" as const;
export const previewText =
  "Okta SSO with SCIM provisioning, 6-role permissions, broadcast drafts, reply threading, and 19 CLI releases.";

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

export default function AprilUpdateEmail({
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
              By the Wraps Team • April 2026
            </Text>

            {/* Intro */}
            <Text className="my-8 text-[15px] leading-relaxed text-gray-700">
              April was our enterprise month — 211 commits, 19 CLI releases, and
              the two most-requested team features finally shipped: Okta SSO
              with SCIM provisioning and a full role-based permission model. We
              also shipped reply threading, broadcast drafts, contact
              externalIds, and a public deliverability CLI on npm.
            </Text>

            {/* ── Okta SSO + SCIM ── */}

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              Okta SSO + SCIM 2.0 Provisioning
            </Heading>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              Enterprise teams can now authenticate through Okta and provision
              users automatically via SCIM 2.0. Add someone in Okta, they appear
              in Wraps. Remove them, they're gone. No manual invite links, no
              account cleanup.
            </Text>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              Setup is guided — the dashboard walks you through the Okta
              application configuration, OIDC discovery URL, DNS TXT
              verification, and sign-in redirect URI in one flow. IdP-initiated
              SSO is supported so your team can log in directly from the Okta
              dashboard.
            </Text>

            <Section className="mt-5">
              <Button
                className="rounded-md border border-solid border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 no-underline"
                href="https://app.wraps.dev/settings/sso"
              >
                Configure SSO
              </Button>
            </Section>

            {/* ── RBAC ── */}

            <Hr className="my-8 border-gray-200" />

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              6-Role Permission Model
            </Heading>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              Wraps now ships a full RBAC system. Six roles with distinct
              capabilities — every action in the dashboard is gated at both the
              server and UI layer:
            </Text>

            <Section className="mb-4">
              <Text className="m-0 mb-1.5 pl-4 text-[15px] leading-normal text-gray-700">
                •&ensp;<strong>Owner</strong> — full control, billing, and org
                deletion
              </Text>
              <Text className="m-0 mb-1.5 pl-4 text-[15px] leading-normal text-gray-700">
                •&ensp;<strong>Admin</strong> — members, settings, all content
              </Text>
              <Text className="m-0 mb-1.5 pl-4 text-[15px] leading-normal text-gray-700">
                •&ensp;<strong>Member</strong> — create and manage content
              </Text>
              <Text className="m-0 mb-1.5 pl-4 text-[15px] leading-normal text-gray-700">
                •&ensp;<strong>Developer</strong> — API keys and integrations
              </Text>
              <Text className="m-0 mb-1.5 pl-4 text-[15px] leading-normal text-gray-700">
                •&ensp;<strong>Viewer</strong> — read-only access to everything
              </Text>
              <Text className="m-0 mb-1.5 pl-4 text-[15px] leading-normal text-gray-700">
                •&ensp;<strong>Billing</strong> — billing settings only
              </Text>
            </Section>

            {/* ── Reply Threading ── */}

            <Hr className="my-8 border-gray-200" />

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              Reply Threading
            </Heading>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              Inbound email now supports signed reply threading. When you call{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                inbox.reply()
              </code>
              , Wraps generates a cryptographically signed{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                Reply-To
              </code>{" "}
              address that routes future replies back to the correct thread in
              your inbound webhook. Build support systems, async conversations,
              and email-to-app integrations that can actually keep context.
            </Text>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              The CLI now surfaces your inbound webhook secret and thread
              routing setup details. The{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                @wraps.dev/email
              </code>{" "}
              SDK also gained{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                externalId
              </code>{" "}
              support on the client — pass your own identifier when sending and
              look up contacts without knowing their Wraps ID.
            </Text>

            {/* ── Broadcast Drafts ── */}

            <Hr className="my-8 border-gray-200" />

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              Broadcast Drafts &amp; Duplicate
            </Heading>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              Broadcasts can now be saved as drafts and duplicated. Write your
              campaign, step away, come back — your audience, template,
              schedule, and subject are all still there. Duplicating a broadcast
              copies everything except the send date, so cloning a previous
              campaign for a new audience takes seconds.
            </Text>

            {/* ── Contacts ── */}

            <Hr className="my-8 border-gray-200" />

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              Contact externalId &amp; Multi-Identifier Resolution
            </Heading>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              Contacts now have an{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                externalId
              </code>{" "}
              field — your user ID, database row, or any stable identifier from
              your system. The API can now resolve contacts by email, Wraps ID,
              or externalId interchangeably, which means you can upsert and
              trigger without a two-step lookup.
            </Text>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              Segment builder also gained numeric comparators for custom
              properties — filter contacts where{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                orders_count {">"} 5
              </code>{" "}
              or{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                lifetime_value {"<"} 100
              </code>{" "}
              alongside existing string and boolean filters.
            </Text>

            {/* ── email-check ── */}

            <Hr className="my-8 border-gray-200" />

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              @wraps.dev/email-check on npm
            </Heading>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              The standalone deliverability CLI is now publicly available on
              npm. Run it against any domain to check SPF, DKIM, DMARC, BIMI,
              blacklists, and MX configuration — scored and color-coded in your
              terminal. No Wraps account required.
            </Text>

            <Section className="mt-5">
              <Button
                className="rounded-md border border-solid border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 no-underline"
                href="https://www.npmjs.com/package/@wraps.dev/email-check"
              >
                npm install @wraps.dev/email-check
              </Button>
            </Section>

            {/* ── /agents ── */}

            <Hr className="my-8 border-gray-200" />

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              Wraps for AI Agents
            </Heading>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              We shipped a new{" "}
              <Link
                className="text-gray-900 underline"
                href="https://wraps.dev/agents"
              >
                /agents
              </Link>{" "}
              positioning page and quickstart docs for agent-driven email. Wraps
              is a natural fit for AI agents that need to send email on behalf
              of users — OIDC credential exchange means no secrets in your agent
              runtime, and the SDK is small enough to embed in any Lambda or
              edge function.
            </Text>

            {/* ── CLI ── */}

            <Hr className="my-8 border-gray-200" />

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              CLI (v2.17.23 → v2.19.4)
            </Heading>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              19 releases this month. Notable changes:
            </Text>

            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;Upgraded{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                @pulumi/aws
              </code>{" "}
              to 7.27.0 with proper DynamoDB GSI key schema support
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;Inbound webhook secret and thread routing details surfaced
              in{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                wraps email inbound status
              </code>
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;Signed reply-to threading with inbound verification
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;Full Pulumi error output surfaced on upgrade failures, sent
              to PostHog for diagnostics
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;DNSBL provider list updated: removed stale providers, added
              RFC 5782-compliant entries
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
              •&ensp;Refresh buttons on every list and analytics page
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;Email analytics rebuilt on PostgreSQL with bot filtering
              and a sqrt scale to prevent broadcast spikes from flattening daily
              volume
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;Email list redesigned: Activity column, sent date shown
              under subject
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;Permission errors now surfaced as toasts in the template
              gallery
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;Email sends are no longer plan-gated — analytics-only
              access included on all plans
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              •&ensp;Onboarding-rescue workflow to catch signups that stall
              mid-setup
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
                    211
                  </Text>
                  <Text className="m-0 text-center text-xs text-gray-400">
                    commits shipped
                  </Text>
                </Column>
                <Column align="center" className="w-1/3">
                  <Text className="m-0 text-center text-3xl font-bold text-white">
                    19
                  </Text>
                  <Text className="m-0 text-center text-xs text-gray-400">
                    CLI releases
                  </Text>
                </Column>
                <Column align="center" className="w-1/3">
                  <Text className="m-0 text-center text-3xl font-bold text-white">
                    7
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
                </Link>
                {" "}•{" "} Boulder, CO
              </Text>
              <Text className="m-0 text-xs text-gray-400">
                <Link
                  className="text-xs text-gray-400 underline"
                  href={unsubscribeUrl}
                >
                  Unsubscribe
                </Link>
                {" "}•{" "}
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
