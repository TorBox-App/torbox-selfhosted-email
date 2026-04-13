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

export const subject = "Continue setting up {{orgName}} on your computer";
export const emailType = "transactional" as const;
export const previewText =
  "Your organization is ready. Open this link on your computer to finish setup.";

// ── Test Data (for preview) ──

export const testData = {
  orgName: "Acme Corp",
  dashboardUrl: "https://app.wraps.dev/acme-corp/onboarding",
};

// ── Template ──

type Props = {
  orgName: string;
  dashboardUrl: string;
};

export default function MobileRescue(_props: Props) {
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
                Continue on your computer
              </Heading>
              <Text className="m-0 mb-5 text-base leading-relaxed text-gray-600">
                Your organization <strong>{"{{orgName}}"}</strong> has been
                created. To finish setting up, you&apos;ll connect your AWS
                account and start sending emails from your desktop.
              </Text>
              <Section className="my-7 text-center">
                <Button
                  className="rounded-md bg-[#f97316] px-6 py-3 text-base font-semibold text-white no-underline"
                  href="{{dashboardUrl}}"
                >
                  Continue Setup
                </Button>
              </Section>
              <Text className="m-0 mb-2 text-sm leading-relaxed text-gray-400">
                Or copy and paste this link into your browser:
              </Text>
              <Text
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "#f97316",
                  wordBreak: "break-all",
                  backgroundColor: "#f9fafb",
                  padding: "12px",
                  borderRadius: "6px",
                }}
              >
                {"{{dashboardUrl}}"}
              </Text>
            </Section>
            <Section className="px-10 py-5 text-center">
              <Hr className="mb-5 border-gray-200" />
              <Text className="m-0 mb-2 text-xs text-gray-400">
                Wraps &bull; Boulder, CO
              </Text>
              <Link
                className="text-xs text-gray-400 underline"
                href="mailto:support@wraps.dev"
              >
                Contact support
              </Link>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
