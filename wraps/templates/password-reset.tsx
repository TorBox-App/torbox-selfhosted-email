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

export const subject = "Reset your password";
export const emailType = "transactional" as const;
export const previewText = "Click the link to reset your Wraps password.";

// ── Test Data (for preview) ──

export const testData = {
  name: "Jane",
  email: "jane@example.com",
  resetPasswordUrl: "https://app.wraps.dev/reset-password?token=abc123",
  privacyUrl: "https://wraps.dev/privacy",
};

// ── Template ──

type Props = {
  name: string;
  email: string;
  resetPasswordUrl: string;
  privacyUrl: string;
};

export default function PasswordReset({ privacyUrl }: Props) {
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
                Reset your password
              </Heading>
              <Text className="m-0 mb-5 text-base leading-relaxed text-gray-600">
                {"{{#if name}}Hi {{name}}, we{{else}}We{{/if}}"} received a
                request to reset the password for your Wraps account (
                {"{{email}}"}).
              </Text>
              <Section className="my-7 text-center">
                <Button
                  className="rounded-md bg-[#f97316] px-6 py-3 text-base font-semibold text-white no-underline"
                  href="{{resetPasswordUrl}}"
                >
                  Reset Password
                </Button>
              </Section>
              <Text className="m-0 mb-2 text-sm leading-relaxed text-gray-400">
                This link expires in 1 hour. If you didn&apos;t request a
                password reset, you can safely ignore this email.
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
              <Text className="m-0 mb-2 text-xs text-gray-400">
                Wraps &bull; Boulder, CO
              </Text>
              <Link
                className="text-xs text-gray-400 underline"
                href={privacyUrl}
              >
                Privacy Policy
              </Link>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
