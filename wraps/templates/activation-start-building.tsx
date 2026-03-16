import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Tailwind,
  Text,
} from "@react-email/components";
import { Footer } from "./_components/footer";

// -- Metadata --

export const subject = "your workspace is ready — let's build";
export const emailType = "transactional" as const;
export const previewText =
  "Start with a template. No AWS required — just open the editor and go.";

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

export default function ActivationStartBuilding({ unsubscribeUrl }: Props) {
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
              Welcome to Wraps. Your workspace is set up and ready to go.
            </Text>

            <Text className="text-[15px] leading-relaxed text-gray-800">
              The best place to start is the{" "}
              <Link
                className="text-gray-800 underline"
                href="https://app.wraps.dev/emails/templates"
              >
                template editor
              </Link>
              . You can design emails, preview them, and save drafts &mdash; no
              AWS account needed yet. Everything runs in sandbox mode until
              you&apos;re ready to go live.
            </Text>

            <Text className="text-[15px] leading-relaxed text-gray-800">
              You can also explore contacts, workflows, and broadcasts while
              you&apos;re getting familiar with the platform. When you&apos;re
              ready to start sending for real, connecting AWS takes about 5
              minutes.
            </Text>

            <Text className="text-[15px] leading-relaxed text-gray-800">
              Reply if you have any questions &mdash; I read every email.
            </Text>

            <Text className="text-[15px] leading-relaxed text-gray-800">
              -- Jarod
            </Text>

            <Footer unsubscribeUrl={unsubscribeUrl} />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
