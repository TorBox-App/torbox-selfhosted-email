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

export const subject = "one step from sending";
export const emailType = "marketing" as const;
export const previewText =
  "Connect your AWS account and you're sending — here's the quickstart.";

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

export default function NudgeConnectAws({ unsubscribeUrl }: Props) {
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
              I noticed you signed up but haven&apos;t connected your AWS
              account yet. That&apos;s the one step that unlocks everything
              &mdash; verified domains, sending, workflows, all of it.
            </Text>

            <Text className="text-[15px] leading-relaxed text-gray-800">
              The whole flow is in the{" "}
              <Link
                className="text-gray-800 underline"
                href="https://wraps.dev/docs/quickstart/email"
              >
                quickstart guide
              </Link>{" "}
              &mdash; run{" "}
              <code
                style={{
                  backgroundColor: "#f3f4f6",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontSize: "14px",
                }}
              >
                wraps aws setup
              </code>{" "}
              to wire up credentials, then{" "}
              <code
                style={{
                  backgroundColor: "#f3f4f6",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontSize: "14px",
                }}
              >
                wraps email init
              </code>{" "}
              to deploy SES to your account. Most people are sending in under 10
              minutes.
            </Text>

            <Text className="text-[15px] leading-relaxed text-gray-800">
              Hit reply if you get stuck on anything.
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
