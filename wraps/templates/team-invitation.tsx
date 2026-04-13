import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

// ── Metadata ──

export const subject = "Join {{organizationName}} on Wraps";
export const emailType = "transactional" as const;
export const previewText =
  "{{inviterName}} invited you to join {{organizationName}} on Wraps.";

// ── Test Data (for preview) ──

export const testData = {
  inviterName: "Jarod",
  organizationName: "Acme Corp",
  role: "admin",
  roleArticle: "an",
  inviteLink: "https://app.wraps.dev/invitations/abc123/accept",
  declineLink: "https://app.wraps.dev/invitations/abc123/decline",
  workspaceItemsHtml:
    '<li style="margin-bottom:4px;">3 email templates</li><li style="margin-bottom:4px;">150 contacts</li><li style="margin-bottom:4px;">AWS connected</li>',
  showAwsWarning: false,
};

// ── Template ──

type Props = {
  inviterName: string;
  organizationName: string;
  role: string;
  roleArticle: string;
  inviteLink: string;
  declineLink: string;
  workspaceItemsHtml?: string;
  showAwsWarning?: boolean;
};

export default function TeamInvitation(_props: Props) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-[#f6f9fc] font-sans">
          <Container className="mx-auto max-w-[580px] py-10">
            <Section className="px-10 pb-2 pt-5 text-center">
              <Img
                alt="Wraps"
                className="mx-auto pb-6"
                height="40"
                src="https://wraps.dev/wraps-light-logo.png"
                width="120"
              />
            </Section>
            <Section className="rounded-lg bg-white p-10">
              <Heading className="m-0 mb-4 text-2xl font-semibold text-gray-800">
                You&apos;re invited
              </Heading>
              <Text className="m-0 mb-5 text-base leading-relaxed text-gray-600">
                <strong>{"{{inviterName}}"}</strong> invited you to join{" "}
                <strong>{"{{organizationName}}"}</strong> on Wraps as{" "}
                {"{{roleArticle}}"} <strong>{"{{role}}"}</strong>.
              </Text>

              {/* Workspace context - only rendered if items exist */}
              {"{{#if workspaceItemsHtml}}"}
              <div
                style={{
                  backgroundColor: "#f9fafb",
                  padding: "20px 24px",
                  borderRadius: "8px",
                  borderLeft: "4px solid #f97316",
                  marginTop: "20px",
                  marginBottom: "20px",
                }}
              >
                <Text
                  style={{
                    margin: "0 0 8px 0",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#374151",
                  }}
                >
                  {"Here's what {{inviterName}} has set up:"}
                </Text>
                <ul
                  style={{
                    margin: 0,
                    padding: "0 0 0 20px",
                    fontSize: "14px",
                    color: "#6b7280",
                  }}
                >
                  {"{{{workspaceItemsHtml}}}"}
                </ul>
                {"{{#if showAwsWarning}}"}
                <Text
                  style={{
                    marginTop: "12px",
                    fontSize: "13px",
                    color: "#92400e",
                    backgroundColor: "#fffbeb",
                    padding: "8px 12px",
                    borderRadius: "4px",
                  }}
                >
                  AWS infrastructure hasn&apos;t been connected yet &mdash; your
                  help may be needed to deploy.
                </Text>
                {"{{/if}}"}
              </div>
              {"{{/if}}"}

              <Section className="my-7 text-center">
                <Button
                  className="rounded-md bg-[#f97316] px-6 py-3 text-base font-semibold text-white no-underline"
                  href="{{inviteLink}}"
                >
                  Accept Invitation
                </Button>
              </Section>
              <Text className="m-0 mb-5 text-center text-sm text-gray-400">
                <Link
                  className="text-gray-400 underline"
                  href="{{declineLink}}"
                >
                  Decline this invitation
                </Link>
              </Text>
              <Text className="m-0 text-sm leading-relaxed text-gray-400">
                This invitation expires in 7 days. If you didn&apos;t expect
                this invitation, you can safely ignore it.
              </Text>
            </Section>
            <Section className="px-10 py-5 text-center">
              <Hr className="mb-5 border-gray-200" />
              <Text className="m-0 text-xs text-gray-400">
                Wraps &bull; Boulder, CO
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
