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

export const subject = "Verify your email address";
export const emailType = "transactional" as const;
export const previewText =
  "Click the link to verify your email and get started with Wraps.";

// ── Test Data (for preview) ──

export const testData = {
  name: "Jane",
  verificationUrl: "https://app.wraps.dev/verify?token=abc123",
};

// ── Template ──

type Props = {
  name: string;
  verificationUrl: string;
};

export default function EmailVerification(_props: Props) {
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
                Verify your email
              </Heading>
              <Text className="m-0 mb-5 text-base leading-relaxed text-gray-600">
                {"{{#if name}}Hi {{name}}, thanks{{else}}Thanks{{/if}}"} for
                signing up for Wraps. Please verify your email address to get
                started.
              </Text>
              <Section className="my-7 text-center">
                <Button
                  className="rounded-md bg-[#f97316] px-6 py-3 text-base font-semibold text-white no-underline"
                  href="{{verificationUrl}}"
                >
                  Verify Email Address
                </Button>
              </Section>
              <Text className="m-0 mb-2 text-sm leading-relaxed text-gray-400">
                This link expires in 24 hours. If you didn&apos;t create an
                account with Wraps, you can safely ignore this email.
              </Text>
              <Text className="m-0 text-sm text-gray-400">
                Need help?{" "}
                <Link
                  className="text-gray-400 underline"
                  href="mailto:support@wraps.dev"
                >
                  Contact support
                </Link>
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
