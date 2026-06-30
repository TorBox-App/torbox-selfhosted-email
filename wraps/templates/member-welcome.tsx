import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import { Footer } from "./_components/footer";

// -- Metadata --

export const subject = "You're in — welcome to {{organizationName}} on Wraps";
export const emailType = "transactional" as const;
export const previewText =
  "Here's what Wraps is and what you can do now that you've joined {{organizationName}}.";

// -- Test Data (for preview) --

export const testData = {
  firstName: "Jane",
  organizationName: "Acme Corp",
  inviterName: "Jarod",
  unsubscribeUrl: "https://wraps.dev/unsubscribe",
};

// -- Template --

type Props = {
  firstName: string;
  organizationName: string;
  inviterName: string;
  unsubscribeUrl: string;
};

export default function MemberWelcome({ unsubscribeUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-white font-sans">
          <Container className="mx-auto max-w-[580px] px-4 py-10">
            <Text className="text-[15px] leading-relaxed text-gray-800">
              {"{{#if firstName}}Hey {{firstName}},{{else}}Hey there,{{/if}}"}
            </Text>

            <Text className="text-[15px] leading-relaxed text-gray-800">
              {"{{inviterName}}"} added you to{" "}
              <strong>{"{{organizationName}}"}</strong> on Wraps. Since you may
              be new to Wraps, here&apos;s the short version of what it does.
            </Text>

            <Text className="text-[15px] leading-relaxed text-gray-800">
              <strong>Wraps</strong> is how teams run their own email, SMS, and
              CDN infrastructure &mdash; on their own AWS account. Instead of
              renting a black-box sending service, {"{{organizationName}}"} owns
              the pipes: their data, their deliverability, AWS pricing, no
              vendor lock-in. Wraps gives everyone the dashboard, templates, and
              tooling to work on top of it.
            </Text>

            <Text className="text-[15px] leading-relaxed text-gray-800">
              The good news for you: the hard infrastructure setup is already
              handled. You&apos;re joining a workspace that&apos;s ready to use
              &mdash; you can jump straight to building templates, managing
              contacts, and sending.
            </Text>

            <Section className="my-7">
              <Button
                className="rounded-md bg-[#f97316] px-6 py-3 text-base font-semibold text-white no-underline"
                href="https://app.wraps.dev"
              >
                Open your workspace
              </Button>
            </Section>

            <Text className="text-[15px] leading-relaxed text-gray-800">
              I&apos;ll send a short note in a couple of days on how to find
              your way around. In the meantime, just reply if anything&apos;s
              unclear &mdash; I read every email.
            </Text>

            <Text className="text-[15px] leading-relaxed text-gray-800">
              -- Jarod
            </Text>

            <Text className="text-[13px] leading-relaxed text-gray-400">
              New to all this? The{" "}
              <Link
                className="text-gray-400 underline"
                href="https://wraps.dev/docs"
              >
                docs
              </Link>{" "}
              walk through every part of the platform.
            </Text>

            <Footer unsubscribeUrl={unsubscribeUrl} />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
