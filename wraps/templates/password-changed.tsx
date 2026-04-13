import {
  Body,
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

export const subject = "Your password was changed";
export const emailType = "transactional" as const;
export const previewText =
  "Your Wraps password was successfully changed. If this wasn't you, contact support.";

// ── Test Data (for preview) ──

export const testData = {
  name: "Jane",
  email: "jane@example.com",
};

// ── Template ──

type Props = {
  name: string;
  email: string;
};

export default function PasswordChanged(_props: Props) {
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
                Password changed
              </Heading>
              <Text className="m-0 mb-5 text-base leading-relaxed text-gray-600">
                {"{{#if name}}Hi {{name}}, the{{else}}The{{/if}}"} password for
                your Wraps account ({"{{email}}"}) was successfully changed.
              </Text>
              <Text className="m-0 mb-8 text-base leading-relaxed text-gray-600">
                If you made this change, no further action is needed.
              </Text>
              <div
                style={{
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  padding: "20px 24px",
                  marginTop: "20px",
                }}
              >
                <Text className="m-0 text-sm leading-relaxed text-gray-600">
                  <strong>Didn&apos;t change your password?</strong> Please{" "}
                  <Link
                    className="text-[#f97316] underline"
                    href="mailto:support@wraps.dev"
                  >
                    contact support immediately
                  </Link>{" "}
                  to secure your account.
                </Text>
              </div>
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
