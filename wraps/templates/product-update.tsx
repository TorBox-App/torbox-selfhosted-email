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
  "What's new at Wraps — Templates as Code, AI Editor, CLI Auth & more...";
export const emailType = "marketing" as const;
export const previewText =
  "Write React Email templates as TSX, push to SES from your terminal, and edit with AI in the dashboard.";

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

export default function ProductUpdateEmail({
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
              Hello, welcome to this month&apos;s product update! This was a big
              one &mdash; we shipped the entire Templates as Code workflow
              end-to-end, from writing React Email in your editor to pushing to
              SES from your terminal.
            </Text>

            {/* ── Templates as Code ── */}

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              Templates as Code
            </Heading>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              Write email templates as React Email TSX components in your
              codebase, then deploy them to AWS SES and the Wraps dashboard with
              a single command. Your templates are version-controlled,
              type-safe, and live right next to your application code.
            </Text>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              Run{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                wraps email templates init
              </code>{" "}
              to scaffold a{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                wraps/
              </code>{" "}
              directory with example templates and a type-safe config. Then{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                wraps push
              </code>{" "}
              compiles your TSX to HTML, deploys to SES, and syncs with your
              dashboard &mdash; all in one step.
            </Text>

            <Section className="mb-4">
              <Text className="m-0 mb-1.5 pl-4 text-[15px] leading-normal text-gray-700">
                &bull;&ensp;Lockfile-based change detection with SHA256 hashing
                &mdash; only changed templates are pushed
              </Text>
              <Text className="m-0 mb-1.5 pl-4 text-[15px] leading-normal text-gray-700">
                &bull;&ensp;Conflict detection when templates are edited in both
                the CLI and dashboard
              </Text>
              <Text className="m-0 mb-1.5 pl-4 text-[15px] leading-normal text-gray-700">
                &bull;&ensp;Shared components via a{" "}
                <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                  _components/
                </code>{" "}
                directory for footers, headers, and brand elements
              </Text>
              <Text className="m-0 mb-1.5 pl-4 text-[15px] leading-normal text-gray-700">
                &bull;&ensp;Local preview server with live reload via{" "}
                <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                  wraps email templates preview
                </code>
              </Text>
            </Section>

            <Section className="mt-5">
              <Button
                className="rounded-md border border-solid border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 no-underline"
                href="https://wraps.dev/docs/guides/templates"
              >
                Read the Docs
              </Button>
            </Section>

            {/* ── AI Code Editor ── */}

            <Hr className="my-8 border-gray-200" />

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              AI Code Editor
            </Heading>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              Code templates pushed from the CLI now open in a full code editor
              in the dashboard. Edit your React Email TSX directly in the
              browser with a Monaco editor, live HTML preview, and device size
              toggles for desktop, tablet, and mobile.
            </Text>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              The big addition: an AI assistant powered by Claude that can
              generate and edit your email templates. Describe what you want in
              plain English, and it writes the React Email code. The resizable
              split view shows the AI chat alongside a live preview so you can
              iterate in real-time.
            </Text>

            <Section className="mb-4">
              <Text className="m-0 mb-1.5 pl-4 text-[15px] leading-normal text-gray-700">
                &bull;&ensp;AI-powered template generation and editing with
                Claude Sonnet
              </Text>
              <Text className="m-0 mb-1.5 pl-4 text-[15px] leading-normal text-gray-700">
                &bull;&ensp;Server-side TSX compilation via esbuild with instant
                preview
              </Text>
              <Text className="m-0 mb-1.5 pl-4 text-[15px] leading-normal text-gray-700">
                &bull;&ensp;Edit/Save/Discard workflow with Cmd+S keyboard
                shortcut
              </Text>
              <Text className="m-0 mb-1.5 pl-4 text-[15px] leading-normal text-gray-700">
                &bull;&ensp;Push conflict detection &mdash; CLI returns 409 when
                a template has been edited in the dashboard, with{" "}
                <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                  --force
                </code>{" "}
                to override
              </Text>
            </Section>

            <Section className="mt-5">
              <Button
                className="rounded-md border border-solid border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 no-underline"
                href="https://app.wraps.dev"
              >
                Try the Editor
              </Button>
            </Section>

            {/* ── CLI Authentication ── */}

            <Hr className="my-8 border-gray-200" />

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              CLI Authentication &amp; Platform Connect
            </Heading>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              The CLI now has first-class authentication. Run{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                wraps auth login
              </code>{" "}
              to authenticate via device flow, then{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                wraps platform connect
              </code>{" "}
              to link your AWS infrastructure to the dashboard automatically. No
              more copying external IDs or webhook URLs manually.
            </Text>

            <Text className="m-0 mb-4 text-[15px] leading-relaxed text-gray-700">
              We also rebuilt the web onboarding flow around the CLI. The new
              4-step flow guides you from account creation straight to running{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                wraps email init
              </code>{" "}
              in your terminal. CloudFormation remains as a fallback for teams
              that prefer it.
            </Text>

            <Section className="mt-5">
              <Button
                className="rounded-md border border-solid border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 no-underline"
                href="https://wraps.dev/docs/cli-reference/auth"
              >
                Set Up CLI Auth
              </Button>
            </Section>

            {/* ── New features & improvements ── */}

            <Hr className="my-8 border-gray-200" />

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              New features &amp; improvements
            </Heading>

            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;Deliverability checker now shows score-driven status
              badges, blacklist listings with delist links, and DMARC alignment
              details
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;Deliverability checker and SPF builder URLs are now
              shareable &mdash; send a link that auto-runs the check on load
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;Multi-domain management with guided subdomain
              suggestions (mail., news., notify.) for reputation isolation
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;Bulk actions for email templates &mdash; select
              multiple templates to delete, change type, or publish to SES in
              one step
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;Copy-to-clipboard on contact emails in the contacts
              table and detail view
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;CLI-first AWS account detail page replaces the legacy
              CloudFormation-oriented UI
            </Text>

            {/* ── Fixes ── */}

            <Hr className="my-8 border-gray-200" />

            <Heading
              as="h2"
              className="m-0 mb-4 text-[22px] font-bold leading-tight text-gray-900"
            >
              Fixes
            </Heading>

            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;Fixed{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                --force
              </code>{" "}
              flag overriding local change detection &mdash; it now only
              overrides dashboard conflict detection as intended
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;Fixed batch push showing incorrect results when some
              templates succeed and others conflict
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;Fixed AI-generated code not refreshing the preview
              immediately after applying
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;Fixed template cache invalidation using the wrong
              query key after saving code templates
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;Fixed onboarding flow showing success when
              infrastructure is not yet connected
            </Text>
            <Text className="m-0 mb-2 pl-4 text-[15px] leading-relaxed text-gray-700">
              &bull;&ensp;Replaced deterministic CloudFormation webhook secret
              with cryptographically random values
            </Text>

            {/* ── Closing + Sign-off ── */}

            <Hr className="my-8 border-gray-200" />

            <Text className="m-0 mb-6 text-[15px] leading-relaxed text-gray-700">
              Explore the latest updates and share your thoughts with us by
              replying to this email. Your feedback plays a key role in shaping
              what we build next.
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
