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

export const subject = "ready to go live?";
export const emailType = "marketing" as const;
export const previewText =
  "You've been building — connecting AWS is the last step to start sending.";

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

export default function NudgeConnectAwsReady({ unsubscribeUrl }: Props) {
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
              You&apos;ve been building &mdash; templates, workflows, the works.
              The last step to start sending real emails is connecting your AWS
              account.
            </Text>

            <Text className="text-[15px] leading-relaxed text-gray-800">
              It takes about 5 minutes. Run{" "}
              <code
                style={{
                  backgroundColor: "#f3f4f6",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontSize: "14px",
                }}
              >
                wraps auth connect
              </code>{" "}
              and follow the prompts, or{" "}
              <Link
                className="text-gray-800 underline"
                href="https://cal.com/wraps/get-started-with-wraps"
              >
                book 15 minutes with me
              </Link>{" "}
              and I&apos;ll walk you through it live. Most people are sending
              before we hang up.
            </Text>

            <Text className="text-[15px] leading-relaxed text-gray-800">
              Everything you&apos;ve built so far will just work once AWS is
              connected.
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
