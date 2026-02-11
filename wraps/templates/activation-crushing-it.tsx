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
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import { Footer } from "./_components/footer";

// -- Metadata --

export const subject = "You're crushing it, {{firstName}}!";
export const emailType = "transactional" as const;
export const previewText =
  "All 3 activation milestones complete. You're officially a Wraps power user.";

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

export default function ActivationCrushingIt({
  firstName,
  dashboardUrl,
  unsubscribeUrl,
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-[#f0fdf4] font-sans">
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
            <Section className="overflow-hidden rounded-lg bg-white">
              <div
                style={{
                  background:
                    "linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)",
                  padding: "32px",
                  textAlign: "center",
                }}
              >
                <Heading
                  as="h1"
                  style={{
                    margin: 0,
                    fontSize: "24px",
                    fontWeight: 700,
                    color: "#ffffff",
                  }}
                >
                  You&rsquo;re crushing it, {firstName}!
                </Heading>
                <Text
                  style={{
                    margin: "8px 0 0 0",
                    fontSize: "15px",
                    color: "rgba(255,255,255,0.9)",
                  }}
                >
                  All 3 activation milestones complete
                </Text>
              </div>
              <div style={{ padding: "32px" }}>
                <Text className="m-0 mb-5 text-base leading-relaxed text-gray-600">
                  You finished onboarding less than a week ago and
                  you&apos;ve already hit every milestone. That&apos;s
                  seriously impressive. Here&apos;s what you&apos;ve
                  accomplished:
                </Text>

                {/* Completed milestones checklist */}
                <div
                  style={{
                    backgroundColor: "#f0fdf4",
                    borderRadius: "12px",
                    padding: "20px 24px",
                    marginBottom: "24px",
                  }}
                >
                  <Row className="mb-3">
                    <Column width={36}>
                      <div
                        style={{
                          width: "24px",
                          height: "24px",
                          backgroundColor: "#22c55e",
                          borderRadius: "50%",
                          textAlign: "center",
                          lineHeight: "24px",
                          color: "white",
                          fontSize: "14px",
                        }}
                      >
                        &#10003;
                      </div>
                    </Column>
                    <Column>
                      <Text className="m-0 text-[15px] font-semibold text-gray-800">
                        Sent your first email
                      </Text>
                    </Column>
                  </Row>
                  <Row className="mb-3">
                    <Column width={36}>
                      <div
                        style={{
                          width: "24px",
                          height: "24px",
                          backgroundColor: "#22c55e",
                          borderRadius: "50%",
                          textAlign: "center",
                          lineHeight: "24px",
                          color: "white",
                          fontSize: "14px",
                        }}
                      >
                        &#10003;
                      </div>
                    </Column>
                    <Column>
                      <Text className="m-0 text-[15px] font-semibold text-gray-800">
                        Created a workflow
                      </Text>
                    </Column>
                  </Row>
                  <Row>
                    <Column width={36}>
                      <div
                        style={{
                          width: "24px",
                          height: "24px",
                          backgroundColor: "#22c55e",
                          borderRadius: "50%",
                          textAlign: "center",
                          lineHeight: "24px",
                          color: "white",
                          fontSize: "14px",
                        }}
                      >
                        &#10003;
                      </div>
                    </Column>
                    <Column>
                      <Text className="m-0 text-[15px] font-semibold text-gray-800">
                        Sent a broadcast
                      </Text>
                    </Column>
                  </Row>
                </div>

                <Hr className="my-6 border-gray-200" />
                <Text className="m-0 mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
                  What&apos;s next
                </Text>
                <div
                  style={{
                    padding: "12px 16px",
                    marginBottom: "8px",
                    borderLeft: "3px solid #22c55e",
                    backgroundColor: "#f0fdf4",
                    borderRadius: "0 6px 6px 0",
                  }}
                >
                  <Text className="m-0 text-[15px] text-gray-700">
                    <strong>Custom domains</strong> &mdash; Send from your
                    brand&apos;s domain for better deliverability
                  </Text>
                </div>
                <div
                  style={{
                    padding: "12px 16px",
                    marginBottom: "8px",
                    borderLeft: "3px solid #4ade80",
                    backgroundColor: "#f0fdf4",
                    borderRadius: "0 6px 6px 0",
                  }}
                >
                  <Text className="m-0 text-[15px] text-gray-700">
                    <strong>Advanced workflows</strong> &mdash; Add conditions,
                    branching, and multi-step sequences
                  </Text>
                </div>
                <div
                  style={{
                    padding: "12px 16px",
                    marginBottom: "8px",
                    borderLeft: "3px solid #86efac",
                    backgroundColor: "#f0fdf4",
                    borderRadius: "0 6px 6px 0",
                  }}
                >
                  <Text className="m-0 text-[15px] text-gray-700">
                    <strong>Analytics</strong> &mdash; Track opens, clicks, and
                    deliverability in real-time
                  </Text>
                </div>

                <Section className="my-7 text-center">
                  <Button
                    className="rounded-md bg-[#16a34a] px-6 py-3 text-base font-semibold text-white no-underline"
                    href={dashboardUrl}
                  >
                    Open Dashboard
                  </Button>
                </Section>
                <Text className="m-0 text-sm text-gray-400">
                  Thanks for choosing Wraps. We&apos;re building this for
                  developers like you.
                </Text>
              </div>
            </Section>
            <Footer unsubscribeUrl={unsubscribeUrl} />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
