import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import { Footer } from "./_components/footer";

// -- Metadata --

export const subject = "Automate your emails, {{firstName}}";
export const emailType = "marketing" as const;
export const previewText =
  "Set up a workflow and your emails send themselves. Here's how.";

// -- Test Data (for preview) --

export const testData = {
  firstName: "Jane",
  dashboardUrl: "https://app.wraps.dev",
  unsubscribeUrl: "https://wraps.dev/unsubscribe",
};

// -- Template --

type Props = {
  firstName: string;
  dashboardUrl: string;
  unsubscribeUrl: string;
};

export default function NudgeCreateWorkflow({
  firstName,
  dashboardUrl,
  unsubscribeUrl,
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-[#faf5ff] font-sans">
          <Container className="mx-auto max-w-[580px] py-10">
            <Section className="px-10 pt-5">
              <Img
                alt="Wraps"
                className="rounded-lg"
                height="40"
                src="https://wraps.dev/logo.png"
                width="40"
              />
            </Section>
            <Section className="rounded-lg bg-white p-10">
              <Heading className="m-0 mb-2 text-2xl font-semibold text-gray-800">
                Put your emails on autopilot, {firstName}.
              </Heading>
              <Text className="m-0 mb-6 text-base leading-relaxed text-gray-600">
                You&apos;ve sent emails manually &mdash; nice. But the real
                power is automation. Create a workflow and your emails send
                themselves based on triggers you define.
              </Text>

              {/* Visual workflow diagram */}
              <div
                style={{
                  backgroundColor: "#faf5ff",
                  borderRadius: "12px",
                  padding: "24px",
                  marginBottom: "24px",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  {/* Trigger */}
                  <div
                    style={{
                      display: "inline-block",
                      backgroundColor: "#7c3aed",
                      color: "white",
                      padding: "10px 20px",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: 600,
                    }}
                  >
                    User Signs Up
                  </div>
                  <Text
                    style={{
                      margin: "4px 0",
                      fontSize: "20px",
                      color: "#c4b5fd",
                    }}
                  >
                    &#8595;
                  </Text>
                  {/* Delay */}
                  <div
                    style={{
                      display: "inline-block",
                      backgroundColor: "#ffffff",
                      border: "2px solid #c4b5fd",
                      color: "#6d28d9",
                      padding: "10px 20px",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: 600,
                    }}
                  >
                    Wait 1 Day
                  </div>
                  <Text
                    style={{
                      margin: "4px 0",
                      fontSize: "20px",
                      color: "#c4b5fd",
                    }}
                  >
                    &#8595;
                  </Text>
                  {/* Send Email */}
                  <div
                    style={{
                      display: "inline-block",
                      backgroundColor: "#ffffff",
                      border: "2px solid #c4b5fd",
                      color: "#6d28d9",
                      padding: "10px 20px",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: 600,
                    }}
                  >
                    Send Welcome Email
                  </div>
                  <Text
                    style={{
                      margin: "4px 0",
                      fontSize: "20px",
                      color: "#c4b5fd",
                    }}
                  >
                    &#8595;
                  </Text>
                  {/* Condition */}
                  <div
                    style={{
                      display: "inline-block",
                      backgroundColor: "#ffffff",
                      border: "2px solid #c4b5fd",
                      color: "#6d28d9",
                      padding: "10px 20px",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: 600,
                    }}
                  >
                    Check Engagement
                  </div>
                </div>
              </div>

              <Hr className="my-6 border-gray-200" />
              <Text className="m-0 mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
                Popular Workflows
              </Text>
              <div
                style={{
                  padding: "12px 16px",
                  marginBottom: "8px",
                  borderLeft: "3px solid #8b5cf6",
                  backgroundColor: "#faf5ff",
                  borderRadius: "0 6px 6px 0",
                }}
              >
                <Text className="m-0 text-[15px] text-gray-700">
                  <strong>Welcome series</strong> &mdash; Onboard new contacts
                  with a drip sequence
                </Text>
              </div>
              <div
                style={{
                  padding: "12px 16px",
                  marginBottom: "8px",
                  borderLeft: "3px solid #a78bfa",
                  backgroundColor: "#faf5ff",
                  borderRadius: "0 6px 6px 0",
                }}
              >
                <Text className="m-0 text-[15px] text-gray-700">
                  <strong>Abandoned cart</strong> &mdash; Recover lost revenue
                  with automatic follow-ups
                </Text>
              </div>
              <div
                style={{
                  padding: "12px 16px",
                  marginBottom: "8px",
                  borderLeft: "3px solid #c4b5fd",
                  backgroundColor: "#faf5ff",
                  borderRadius: "0 6px 6px 0",
                }}
              >
                <Text className="m-0 text-[15px] text-gray-700">
                  <strong>Re-engagement</strong> &mdash; Win back inactive users
                  automatically
                </Text>
              </div>

              <Section className="my-7 text-center">
                <Button
                  className="rounded-md bg-[#7c3aed] px-6 py-3 text-base font-semibold text-white no-underline"
                  href={dashboardUrl}
                >
                  Create Your First Workflow
                </Button>
              </Section>
              <Text className="m-0 text-sm text-gray-400">
                Workflows run automatically once enabled. You can pause or edit
                them anytime from the dashboard.
              </Text>
            </Section>
            <Footer unsubscribeUrl={unsubscribeUrl} />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
