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

export const subject = "your first template is waiting";
export const emailType = "marketing" as const;
export const previewText =
  "Open the editor, pick a layout, and make it yours — no AWS needed.";

// -- Test Data (for preview) --

export const testData = {
  firstName: "Jane",
  dashboardUrl: "https://app.wraps.dev/emails/templates",
  unsubscribeUrl: "https://wraps.dev/unsubscribe",
};

// -- Template --

type Props = {
  firstName: string;
  dashboardUrl: string;
  unsubscribeUrl: string;
};

export default function NudgeCreateTemplate({
  dashboardUrl,
  unsubscribeUrl,
}: Props) {
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
              You set up your workspace &mdash; nice start. The next step is
              building your first email template.
            </Text>

            <Text className="text-[15px] leading-relaxed text-gray-800">
              The{" "}
              <Link className="text-gray-800 underline" href={dashboardUrl}>
                template editor
              </Link>{" "}
              has a few starter layouts you can customize, or you can start from
              scratch. Everything runs in sandbox mode &mdash; no AWS account
              needed to design and preview.
            </Text>

            <Text className="text-[15px] leading-relaxed text-gray-800">
              Reply if you want a hand getting started.
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
