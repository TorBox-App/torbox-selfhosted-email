import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Tailwind,
  Text,
} from "@react-email/components";
import { Footer } from "./_components/footer";

// -- Metadata --

export const subject = "you're fast";
export const emailType = "transactional" as const;
export const previewText =
  "You hit every milestone before the nudge. That's rare.";

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

export default function ActivationPowerUser({ unsubscribeUrl }: Props) {
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
              You connected AWS, verified your domain, and sent your first email
              before we even had a chance to nudge you. That almost never
              happens.
            </Text>

            <Text className="text-[15px] leading-relaxed text-gray-800">
              You clearly know what you&apos;re building. If there&apos;s
              anything missing from the platform &mdash; a feature, an
              integration, better docs &mdash; I want to hear it. Hit reply.
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
