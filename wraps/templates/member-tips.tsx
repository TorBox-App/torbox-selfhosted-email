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

export const subject = "Getting the most out of Wraps";
export const emailType = "transactional" as const;
export const previewText =
  "A few things that make Wraps click once you're past the basics.";

// -- Test Data (for preview) --

export const testData = {
  firstName: "Jane",
  organizationName: "Acme Corp",
  unsubscribeUrl: "https://wraps.dev/unsubscribe",
};

// -- Template --

type Props = {
  firstName: string;
  organizationName: string;
  unsubscribeUrl: string;
};

export default function MemberTips({ unsubscribeUrl }: Props) {
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
              You&apos;ve had a few days in {"{{organizationName}}"} now. Here
              are the things that tend to make Wraps click once you&apos;re past
              the basics:
            </Text>

            <Text className="text-[15px] leading-relaxed text-gray-800">
              <strong>Templates are real React.</strong> The editor is a code +
              AI chat experience &mdash; describe what you want and edit the
              output directly. Anything you build is reusable across broadcasts
              and automations.
            </Text>

            <Text className="text-[15px] leading-relaxed text-gray-800">
              <strong>Workflows run on events.</strong> Welcome series,
              re-engagement, drip campaigns &mdash; they trigger off things your
              app or contacts do, not just a schedule.
            </Text>

            <Text className="text-[15px] leading-relaxed text-gray-800">
              <strong>Everything is yours.</strong> Sends go through{" "}
              {"{{organizationName}}"}&apos;s own AWS account, so you see the
              real delivery data and pay AWS pricing directly &mdash; nothing is
              hidden behind an abstraction.
            </Text>

            <Text className="text-[15px] leading-relaxed text-gray-800">
              If you ever build against Wraps programmatically, the{" "}
              <Link
                className="text-gray-800 underline"
                href="https://wraps.dev/docs"
              >
                SDK and docs
              </Link>{" "}
              cover the API, events, and contact management.
            </Text>

            <Text className="text-[15px] leading-relaxed text-gray-800">
              That&apos;s it from me &mdash; you&apos;re set. Reply anytime if
              you get stuck.
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
