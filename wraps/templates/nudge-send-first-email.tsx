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

export const subject = "Time to send your first email, {{firstName}}";
export const emailType = "marketing" as const;
export const previewText =
  "Your infrastructure is ready. Here's 5 lines of code to send your first email.";

// -- Test Data (for preview) --

export const testData = {
  firstName: "Jane",
  unsubscribeUrl: "https://wraps.dev/unsubscribe",
};

// -- Template --

type Props = {
  firstName: string;
  unsubscribeUrl: string;
};

export default function NudgeSendFirstEmail({
  firstName,
  unsubscribeUrl,
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-[#fdfdfd] font-sans">
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
            <Section className="rounded-lg bg-[#292524] p-10">
              {/* Terminal prompt */}
              <div
                style={{
                  backgroundColor: "#1c1917",
                  border: "1px solid #44403c",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  marginBottom: "24px",
                  fontFamily: "'Fira Code', 'Consolas', monospace",
                }}
              >
                <Text
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    color: "#22c55e",
                    fontWeight: 600,
                  }}
                >
                  $ wraps email status
                </Text>
                <Text
                  style={{
                    margin: "4px 0 0 0",
                    fontSize: "12px",
                    color: "#a8a29e",
                  }}
                >
                  SES configured &bull; Domain verified &bull; Ready to send
                </Text>
              </div>

              <Heading
                as="h1"
                style={{
                  margin: "0 0 16px 0",
                  fontSize: "24px",
                  fontWeight: 700,
                  color: "#fafaf9",
                }}
              >
                Your infra is live, {firstName}. Time to use it.
              </Heading>
              <Text
                style={{
                  margin: "0 0 20px 0",
                  fontSize: "16px",
                  lineHeight: "1.6",
                  color: "#a8a29e",
                }}
              >
                You finished onboarding a couple days ago and your email
                infrastructure is deployed and ready. The hardest part is
                done &mdash; sending your first email is just a few lines of
                code.
              </Text>

              <Hr style={{ borderColor: "#44403c", margin: "24px 0" }} />

              <Text
                style={{
                  margin: "0 0 16px 0",
                  fontSize: "13px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#78716c",
                }}
              >
                Send your first email
              </Text>

              <pre
                style={{
                  backgroundColor: "#1c1917",
                  color: "#e7e5e4",
                  padding: "16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontFamily: "'Fira Code', 'Consolas', monospace",
                  overflow: "auto",
                  margin: "0 0 24px 0",
                  border: "1px solid #44403c",
                }}
              >
                <code>
                  <span style={{ color: "#c084fc" }}>import</span>
                  {" { Wraps } "}
                  <span style={{ color: "#c084fc" }}>from</span>
                  {" '@wraps.dev/email'\n\n"}
                  <span style={{ color: "#c084fc" }}>const</span>
                  {" wraps = "}
                  <span style={{ color: "#c084fc" }}>new</span>
                  {" Wraps()\n\n"}
                  <span style={{ color: "#c084fc" }}>await</span>
                  {" wraps.emails.send({\n"}
                  {"  from: 'hello@yourdomain.com',\n"}
                  {"  to: 'you@example.com',\n"}
                  {"  subject: 'Hello from Wraps!',\n"}
                  {"  html: '<h1>It works!</h1>'\n"}
                  {"})"}
                </code>
              </pre>

              {/* Callout */}
              <div
                style={{
                  backgroundColor: "#451a03",
                  border: "1px solid #92400e",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  marginBottom: "24px",
                }}
              >
                <Text
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    color: "#fbbf24",
                    fontWeight: 600,
                  }}
                >
                  Pro tip
                </Text>
                <Text
                  style={{
                    margin: "4px 0 0 0",
                    fontSize: "13px",
                    color: "#a8a29e",
                    lineHeight: "1.5",
                  }}
                >
                  Send the first email to yourself. You&rsquo;ll see it arrive
                  in seconds and confirm everything is wired up correctly.
                </Text>
              </div>

              <Section style={{ textAlign: "center", margin: "28px 0" }}>
                <Button
                  href="https://wraps.dev/docs/quickstart/email"
                  style={{
                    backgroundColor: "#f59e0b",
                    color: "#1c1917",
                    padding: "12px 24px",
                    fontWeight: 600,
                    borderRadius: "6px",
                    textDecoration: "none",
                    display: "inline-block",
                    fontSize: "16px",
                  }}
                >
                  View Quickstart Guide
                </Button>
              </Section>

              <Text
                style={{
                  margin: "0 0 16px 0",
                  fontSize: "15px",
                  lineHeight: "1.6",
                  color: "#a8a29e",
                }}
              >
                If you hit any snags, just reply to this email. I read every
                one.
              </Text>

              <Text
                style={{
                  margin: "0 0 4px 0",
                  fontSize: "15px",
                  color: "#e7e5e4",
                }}
              >
                Cheers,
              </Text>
              <Text
                style={{
                  margin: 0,
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "#fafaf9",
                }}
              >
                Jarod from Wraps
              </Text>
            </Section>
            <Footer unsubscribeUrl={unsubscribeUrl} />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
