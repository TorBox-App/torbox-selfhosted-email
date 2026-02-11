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

export const subject = "Reach your audience, {{firstName}}";
export const emailType = "marketing" as const;
export const previewText =
  "You've got contacts and templates. Time to send your first broadcast.";

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

export default function NudgeSendBroadcast({
  firstName,
  dashboardUrl,
  unsubscribeUrl,
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-[#fff7ed] font-sans">
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
                    "linear-gradient(135deg, #ea580c 0%, #f97316 50%, #fb923c 100%)",
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
                  Ready to reach your audience?
                </Heading>
                <Text
                  style={{
                    margin: "8px 0 0 0",
                    fontSize: "15px",
                    color: "rgba(255,255,255,0.9)",
                  }}
                >
                  Your first broadcast is just 3 steps away
                </Text>
              </div>
              <div style={{ padding: "32px" }}>
                <Text className="m-0 mb-5 text-base leading-relaxed text-gray-600">
                  Hey {firstName}, you&apos;ve been sending emails and building
                  your list &mdash; great progress. The next step? Send a
                  broadcast to reach your entire audience at once.
                </Text>

                <Hr className="my-6 border-gray-200" />
                <Text className="m-0 mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
                  3 steps to your first broadcast
                </Text>

                {/* Step 1 */}
                <Row className="mb-3">
                  <Column width={40}>
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        backgroundColor: "#ea580c",
                        borderRadius: "50%",
                        textAlign: "center",
                        lineHeight: "28px",
                        color: "white",
                        fontSize: "14px",
                        fontWeight: 700,
                      }}
                    >
                      1
                    </div>
                  </Column>
                  <Column>
                    <Text className="m-0 text-[15px] leading-relaxed text-gray-600">
                      <strong>Pick a template</strong> &mdash; Choose from your
                      saved templates or create a new one
                    </Text>
                  </Column>
                </Row>

                {/* Step 2 */}
                <Row className="mb-3">
                  <Column width={40}>
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        backgroundColor: "#ea580c",
                        borderRadius: "50%",
                        textAlign: "center",
                        lineHeight: "28px",
                        color: "white",
                        fontSize: "14px",
                        fontWeight: 700,
                      }}
                    >
                      2
                    </div>
                  </Column>
                  <Column>
                    <Text className="m-0 text-[15px] leading-relaxed text-gray-600">
                      <strong>Select your audience</strong> &mdash; All
                      contacts, a segment, or a filtered list
                    </Text>
                  </Column>
                </Row>

                {/* Step 3 */}
                <Row className="mb-3">
                  <Column width={40}>
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        backgroundColor: "#ea580c",
                        borderRadius: "50%",
                        textAlign: "center",
                        lineHeight: "28px",
                        color: "white",
                        fontSize: "14px",
                        fontWeight: 700,
                      }}
                    >
                      3
                    </div>
                  </Column>
                  <Column>
                    <Text className="m-0 text-[15px] leading-relaxed text-gray-600">
                      <strong>Hit send</strong> &mdash; SES delivers to
                      everyone. Track opens and clicks in real-time.
                    </Text>
                  </Column>
                </Row>

                {/* Cost callout */}
                <div
                  style={{
                    backgroundColor: "#fff7ed",
                    borderRadius: "8px",
                    padding: "16px",
                    marginTop: "16px",
                    marginBottom: "8px",
                    textAlign: "center",
                  }}
                >
                  <Text
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      color: "#9a3412",
                      fontWeight: 600,
                    }}
                  >
                    1,000 emails = $0.10 via AWS SES
                  </Text>
                  <Text
                    style={{
                      margin: "4px 0 0 0",
                      fontSize: "12px",
                      color: "#c2410c",
                    }}
                  >
                    No Wraps markup. You pay AWS directly.
                  </Text>
                </div>

                <Section className="my-7 text-center">
                  <Button
                    className="rounded-md bg-[#ea580c] px-6 py-3 text-base font-semibold text-white no-underline"
                    href={dashboardUrl}
                  >
                    Send Your First Broadcast
                  </Button>
                </Section>
                <Text className="m-0 text-sm text-gray-400">
                  Broadcasts go out immediately or you can schedule them for
                  later. Your call.
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
