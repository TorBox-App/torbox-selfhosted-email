import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { Footer } from "./_components/footer";

// ── Metadata ──

export const subject = "Welcome to Wraps, {{firstName}}!";
export const emailType = "transactional" as const;
export const previewText =
  "Deploy email infrastructure to your AWS account in 30 seconds.";

// ── Test Data (for preview) ──

export const testData = {
  firstName: "Jane",
  dashboardUrl: "https://wraps.dev/dashboard",
  unsubscribeUrl: "https://wraps.dev/unsubscribe",
};

// ── Template ──

type Props = {
  firstName: string;
  dashboardUrl: string;
  unsubscribeUrl: string;
};

export default function WelcomeEmail({
  firstName,
  dashboardUrl,
  unsubscribeUrl,
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Img
              alt="Wraps"
              height="40"
              src="https://wraps.dev/logo.png"
              style={logo}
              width="40"
            />
          </Section>
          <Section style={content}>
            <Heading style={heading}>Welcome aboard, {firstName}!</Heading>
            <Text style={paragraph}>
              You just deployed production-ready email infrastructure to your
              AWS account. Here&apos;s what you can do next:
            </Text>
            <Text style={listItem}>
              <strong>1.</strong> Send your first email with the TypeScript SDK
            </Text>
            <Text style={listItem}>
              <strong>2.</strong> Set up domain verification for deliverability
            </Text>
            <Text style={listItem}>
              <strong>3.</strong> Explore templates and broadcasts in the
              dashboard
            </Text>
            <Section style={buttonContainer}>
              <Button href={dashboardUrl} style={button}>
                Open Dashboard
              </Button>
            </Section>
            <Text style={muted}>
              Need help? Just reply to this email — we read every message.
            </Text>
          </Section>
          <Footer unsubscribeUrl={unsubscribeUrl} />
        </Container>
      </Body>
    </Html>
  );
}

// ── Styles ──

const body = {
  backgroundColor: "#f6f9fc",
  fontFamily: "system-ui, -apple-system, sans-serif",
};

const container = {
  margin: "0 auto",
  padding: "40px 0",
  maxWidth: "580px",
};

const header = {
  padding: "20px 40px 0",
};

const logo = {
  borderRadius: "8px",
};

const content = {
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  padding: "40px",
};

const heading = {
  fontSize: "24px",
  fontWeight: "600" as const,
  color: "#1f2937",
  margin: "0 0 16px",
};

const paragraph = {
  fontSize: "16px",
  lineHeight: "1.6",
  color: "#4b5563",
  margin: "0 0 20px",
};

const listItem = {
  fontSize: "15px",
  lineHeight: "1.6",
  color: "#4b5563",
  margin: "0 0 8px",
  paddingLeft: "4px",
};

const buttonContainer = {
  textAlign: "center" as const,
  margin: "28px 0",
};

const button = {
  backgroundColor: "#5046e5",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "600" as const,
  padding: "12px 24px",
  textDecoration: "none",
};

const muted = {
  fontSize: "14px",
  color: "#9ca3af",
  margin: "0",
};
