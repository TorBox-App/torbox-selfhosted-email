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

export const subject = "bring in your engineer";
export const emailType = "marketing" as const;
export const previewText =
  "Invite a teammate to handle the AWS connection while you keep building.";

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

export default function NudgeInviteTeam({ unsubscribeUrl }: Props) {
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
              Looks like you&apos;ve been exploring &mdash; nice. When
              you&apos;re ready to start sending for real, there&apos;s one
              step: connecting an AWS account.
            </Text>

            <Text className="text-[15px] leading-relaxed text-gray-800">
              If that&apos;s more your engineer&apos;s thing, you can{" "}
              <Link
                className="text-gray-800 underline"
                href="https://app.wraps.dev/settings/members"
              >
                invite them to your workspace
              </Link>
              . They&apos;ll get context on what you&apos;ve already set up and
              can run the CLI to connect AWS in a few minutes. You keep
              designing templates and building workflows.
            </Text>

            <Text className="text-[15px] leading-relaxed text-gray-800">
              Or if you want to handle it yourself, run{" "}
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
              to get credentials sorted, then{" "}
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
              to deploy SES.
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
