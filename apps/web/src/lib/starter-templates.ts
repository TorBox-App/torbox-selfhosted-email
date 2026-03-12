export type StarterTemplate = {
  id: string;
  name: string;
  description: string;
  iconName: string;
  category: string;
  subject: string;
  previewText: string;
  emailType: "marketing" | "transactional";
  source: string;
};

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "welcome",
    name: "Welcome Email",
    description: "Greet new users",
    iconName: "Mail",
    category: "Onboarding",
    subject: "Welcome to {{companyName}}!",
    previewText: "We're excited to have you on board",
    emailType: "marketing",
    source: `import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

export const subject = "Welcome to {{companyName}}!";
export const emailType = "marketing";
export const previewText = "We're excited to have you on board";

export default function WelcomeEmail({ companyName, firstName, ctaUrl }) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-white font-sans">
          <Container className="mx-auto max-w-[560px] px-4 py-8">
            <Heading className="text-2xl font-bold text-gray-900">
              Welcome aboard!
            </Heading>
            <Text className="text-base text-gray-600">
              Hi {firstName},
            </Text>
            <Text className="text-base text-gray-600">
              Thanks for joining {companyName}! We're excited to have you. Here's what you can do to get started:
            </Text>
            <Section className="my-6 rounded-lg bg-gray-50 p-6">
              <Text className="m-0 font-semibold text-gray-900">Quick Start</Text>
              <Text className="text-sm text-gray-600">
                Explore your dashboard, set up your profile, and start building.
              </Text>
            </Section>
            <Button
              className="rounded-md bg-indigo-600 px-6 py-3 text-sm font-semibold text-white"
              href={ctaUrl}
            >
              Get Started
            </Button>
            <Hr className="my-6 border-gray-200" />
            <Text className="text-xs text-gray-400">
              If you have any questions, just reply to this email. We're here to help.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}`,
  },
  {
    id: "newsletter",
    name: "Newsletter",
    description: "Weekly updates",
    iconName: "Newspaper",
    category: "Content",
    subject: "{{companyName}} Newsletter",
    previewText: "This week's highlights and updates",
    emailType: "marketing",
    source: `import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

export const subject = "{{companyName}} Newsletter";
export const emailType = "marketing";
export const previewText = "This week's highlights and updates";

export default function Newsletter({ companyName }) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-white font-sans">
          <Container className="mx-auto max-w-[560px] px-4 py-8">
            <Text className="text-sm font-semibold uppercase tracking-wider text-indigo-600">
              {companyName} Newsletter
            </Text>
            <Heading className="text-2xl font-bold text-gray-900">
              This Week's Highlights
            </Heading>
            <Hr className="my-4 border-gray-200" />

            <Section className="my-4">
              <Heading as="h3" className="text-lg font-semibold text-gray-900">
                Feature Update
              </Heading>
              <Text className="text-base text-gray-600">
                We've shipped some exciting improvements this week. Here's what's new and how it helps you.
              </Text>
              <Button
                className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white"
                href="https://example.com"
              >
                Read More
              </Button>
            </Section>

            <Hr className="my-4 border-gray-200" />

            <Section className="my-4">
              <Heading as="h3" className="text-lg font-semibold text-gray-900">
                Tip of the Week
              </Heading>
              <Text className="text-base text-gray-600">
                Did you know? You can use keyboard shortcuts to speed up your workflow. Try it out today.
              </Text>
            </Section>

            <Hr className="my-6 border-gray-200" />
            <Text className="text-xs text-gray-400">
              You're receiving this because you subscribed to {companyName} updates.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}`,
  },
  {
    id: "promotional",
    name: "Promotional",
    description: "Sales & offers",
    iconName: "Megaphone",
    category: "Marketing",
    subject: "Special Offer Inside",
    previewText: "Don't miss our limited-time deal",
    emailType: "marketing",
    source: `import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

export const subject = "Special Offer Inside";
export const emailType = "marketing";
export const previewText = "Don't miss our limited-time deal";

export default function Promotional({ firstName, companyName }) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-white font-sans">
          <Container className="mx-auto max-w-[560px] px-4 py-8">
            <Section className="rounded-lg bg-indigo-50 p-8 text-center">
              <Heading className="text-3xl font-bold text-gray-900">
                Limited Time Offer
              </Heading>
              <Text className="text-lg text-gray-600">
                Hi {firstName}, we've got something special for you.
              </Text>
              <Text className="text-4xl font-bold text-indigo-600">
                20% OFF
              </Text>
              <Text className="text-base text-gray-600">
                Use code <strong>SAVE20</strong> at checkout.
              </Text>
              <Button
                className="rounded-md bg-indigo-600 px-8 py-3 text-base font-semibold text-white"
                href="https://example.com/shop"
              >
                Shop Now
              </Button>
            </Section>
            <Hr className="my-6 border-gray-200" />
            <Text className="text-center text-xs text-gray-400">
              Offer valid for a limited time. Terms and conditions apply.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}`,
  },
  {
    id: "password-reset",
    name: "Password Reset",
    description: "Account security",
    iconName: "KeyRound",
    category: "Transactional",
    subject: "Reset Your Password",
    previewText: "You requested a password reset",
    emailType: "transactional",
    source: `import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

export const subject = "Reset Your Password";
export const emailType = "transactional";
export const previewText = "You requested a password reset";

export default function PasswordReset({ resetUrl, companyName }) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-white font-sans">
          <Container className="mx-auto max-w-[560px] px-4 py-8">
            <Heading className="text-2xl font-bold text-gray-900">
              Reset your password
            </Heading>
            <Text className="text-base text-gray-600">
              We received a request to reset the password for your {companyName} account. Click the button below to set a new password.
            </Text>
            <Section className="my-6 text-center">
              <Button
                className="rounded-md bg-indigo-600 px-6 py-3 text-sm font-semibold text-white"
                href={resetUrl}
              >
                Reset Password
              </Button>
            </Section>
            <Text className="text-sm text-gray-500">
              This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
            </Text>
            <Hr className="my-6 border-gray-200" />
            <Text className="text-xs text-gray-400">
              For security, this request was received from your account. If you did not make this request, please contact support.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}`,
  },
  {
    id: "order-confirmation",
    name: "Order Confirmation",
    description: "Purchase receipts",
    iconName: "Package",
    category: "Transactional",
    subject: "Order #{{orderNumber}} Confirmed",
    previewText: "Your order has been confirmed",
    emailType: "transactional",
    source: `import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

export const subject = "Order #{{orderNumber}} Confirmed";
export const emailType = "transactional";
export const previewText = "Your order has been confirmed";

export default function OrderConfirmation({
  firstName,
  orderNumber,
  orderTotal,
  orderUrl,
}) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-white font-sans">
          <Container className="mx-auto max-w-[560px] px-4 py-8">
            <Heading className="text-2xl font-bold text-gray-900">
              Order Confirmed
            </Heading>
            <Text className="text-base text-gray-600">
              Hi {firstName}, thank you for your order!
            </Text>
            <Section className="my-6 rounded-lg bg-gray-50 p-6">
              <Text className="m-0 text-sm text-gray-500">Order Number</Text>
              <Text className="m-0 text-lg font-semibold text-gray-900">
                #{orderNumber}
              </Text>
              <Hr className="my-3 border-gray-200" />
              <Text className="m-0 text-sm text-gray-500">Total</Text>
              <Text className="m-0 text-lg font-semibold text-gray-900">
                {orderTotal}
              </Text>
            </Section>
            <Button
              className="rounded-md bg-indigo-600 px-6 py-3 text-sm font-semibold text-white"
              href={orderUrl}
            >
              View Order
            </Button>
            <Hr className="my-6 border-gray-200" />
            <Text className="text-xs text-gray-400">
              If you have questions about your order, reply to this email or contact our support team.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}`,
  },
  {
    id: "product-update",
    name: "Product Update",
    description: "What's new",
    iconName: "Rocket",
    category: "Product",
    subject: "What's New at {{companyName}}",
    previewText: "Check out our latest features and improvements",
    emailType: "marketing",
    source: `import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

export const subject = "What's New at {{companyName}}";
export const emailType = "marketing";
export const previewText = "Check out our latest features and improvements";

export default function ProductUpdate({ companyName }) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-white font-sans">
          <Container className="mx-auto max-w-[560px] px-4 py-8">
            <Text className="text-sm font-semibold uppercase tracking-wider text-indigo-600">
              Product Update
            </Text>
            <Heading className="text-2xl font-bold text-gray-900">
              What's New at {companyName}
            </Heading>
            <Text className="text-base text-gray-600">
              We've been busy shipping improvements. Here's what's new:
            </Text>

            <Section className="my-4 rounded-lg border border-gray-200 p-4">
              <Text className="m-0 font-semibold text-gray-900">New Feature</Text>
              <Text className="text-sm text-gray-600">
                Description of the new feature and how it helps users accomplish their goals faster.
              </Text>
            </Section>

            <Section className="my-4 rounded-lg border border-gray-200 p-4">
              <Text className="m-0 font-semibold text-gray-900">Improvement</Text>
              <Text className="text-sm text-gray-600">
                Description of the improvement and the problem it solves for users.
              </Text>
            </Section>

            <Section className="my-4 rounded-lg border border-gray-200 p-4">
              <Text className="m-0 font-semibold text-gray-900">Bug Fix</Text>
              <Text className="text-sm text-gray-600">
                Description of the bug fix and what was affected.
              </Text>
            </Section>

            <Section className="my-6 text-center">
              <Button
                className="rounded-md bg-indigo-600 px-6 py-3 text-sm font-semibold text-white"
                href="https://example.com/changelog"
              >
                View Full Changelog
              </Button>
            </Section>
            <Hr className="my-6 border-gray-200" />
            <Text className="text-xs text-gray-400">
              You're receiving this because you're subscribed to {companyName} product updates.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}`,
  },
];
