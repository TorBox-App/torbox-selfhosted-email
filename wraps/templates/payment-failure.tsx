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

export const subject = "Payment failed for {{organizationName}}";
export const emailType = "transactional" as const;
export const previewText =
  "We couldn't process your payment. Update your billing info to keep your account active.";

// ── Test Data (for preview) ──

export const testData = {
  name: "Jane",
  amount: "USD $29.00",
  organizationName: "Acme Corp",
  billingUrl: "https://app.wraps.dev/acme-corp/settings/billing",
  invoiceUrl: "https://stripe.com/invoice/123",
};

// ── Template ──

type Props = {
  name: string;
  amount: string;
  organizationName: string;
  billingUrl: string;
  invoiceUrl?: string;
};

export default function PaymentFailure(_props: Props) {
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
                Payment failed
              </Heading>
              <Text className="m-0 mb-5 text-base leading-relaxed text-gray-600">
                {"{{#if name}}Hi {{name}}, we{{else}}We{{/if}}"} were unable to
                process the {"{{amount}}"} payment for{" "}
                <strong>{"{{organizationName}}"}</strong>.
              </Text>
              <div
                style={{
                  backgroundColor: "#fff7ed",
                  border: "1px solid #fed7aa",
                  borderRadius: "8px",
                  padding: "14px 16px",
                  marginBottom: "20px",
                }}
              >
                <Text className="m-0 text-sm leading-relaxed text-gray-600">
                  Your subscription is still active, but we&apos;ll need updated
                  billing information to avoid any interruption to your service.
                </Text>
              </div>
              <Section className="my-7 text-center">
                <Button
                  className="rounded-md bg-[#f97316] px-6 py-3 text-base font-semibold text-white no-underline"
                  href="{{billingUrl}}"
                >
                  Update Billing
                </Button>
              </Section>
              <Text className="m-0 text-sm text-gray-400">
                {"{{#if invoiceUrl}}"}
                <Link className="text-gray-400 underline" href="{{invoiceUrl}}">
                  View invoice on Stripe
                </Link>
                {" &bull; "}
                {"{{/if}}"}
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
