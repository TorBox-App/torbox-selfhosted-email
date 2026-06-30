import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import { Footer } from "./_components/footer";

// -- Metadata --

export const subject = "Finding your way around {{organizationName}}";
export const emailType = "transactional" as const;
export const previewText =
  "Three things to try in your first week on Wraps — no setup required.";

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

function StepRow({
  number,
  children,
}: {
  number: number;
  children: React.ReactNode;
}) {
  return (
    <Row className="mb-4">
      <Column style={{ verticalAlign: "top" }} width={40}>
        <div
          style={{
            width: "28px",
            height: "28px",
            backgroundColor: "#f97316",
            borderRadius: "50%",
            textAlign: "center",
            lineHeight: "28px",
            color: "white",
            fontSize: "14px",
            fontWeight: 700,
          }}
        >
          {number}
        </div>
      </Column>
      <Column>
        <Text className="m-0 text-[15px] leading-relaxed text-gray-600">
          {children}
        </Text>
      </Column>
    </Row>
  );
}

export default function MemberGettingStarted({ unsubscribeUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-[#f6f9fc] font-sans">
          <Container className="mx-auto max-w-[580px] py-10">
            <Section className="px-10 pb-2 pt-5">
              <Img
                alt="Wraps"
                className="pb-4"
                height="40"
                src="https://wraps.dev/wraps-light-logo.png"
                width="120"
              />
            </Section>
            <Section className="rounded-lg bg-white p-10">
              <Heading className="m-0 mb-4 text-2xl font-semibold text-gray-800">
                {
                  "{{#if firstName}}A quick tour, {{firstName}}{{else}}A quick tour{{/if}}"
                }
              </Heading>
              <Text className="m-0 mb-5 text-[15px] leading-relaxed text-gray-600">
                Now that you&apos;re inside{" "}
                <strong>{"{{organizationName}}"}</strong>, here are three things
                worth doing first. All of them work right away &mdash; the
                team&apos;s AWS and sending domains are already connected, so
                there&apos;s nothing to set up.
              </Text>

              <Hr className="my-6 border-gray-200" />

              <StepRow number={1}>
                <strong>Browse what&apos;s already built.</strong> Open{" "}
                <Link
                  className="text-gray-800 underline"
                  href="https://app.wraps.dev/emails/templates"
                >
                  Templates
                </Link>{" "}
                to see the emails your team designed. Open one, hit preview, and
                you&apos;ll get a feel for how Wraps works.
              </StepRow>

              <StepRow number={2}>
                <strong>Look at the audience.</strong>{" "}
                <Link
                  className="text-gray-800 underline"
                  href="https://app.wraps.dev/contacts"
                >
                  Contacts
                </Link>{" "}
                is the list everything sends to &mdash; broadcasts, automations,
                and targeted campaigns all start here.
              </StepRow>

              <StepRow number={3}>
                <strong>Send something.</strong> Once you&apos;re comfortable,
                send a{" "}
                <Link
                  className="text-gray-800 underline"
                  href="https://app.wraps.dev/broadcasts"
                >
                  broadcast
                </Link>{" "}
                or wire up a{" "}
                <Link
                  className="text-gray-800 underline"
                  href="https://app.wraps.dev/workflows"
                >
                  workflow
                </Link>
                . It goes out through {"{{organizationName}}"}&apos;s own
                infrastructure.
              </StepRow>

              <Hr className="my-6 border-gray-200" />

              <Text className="m-0 text-[15px] leading-relaxed text-gray-600">
                Want the full picture of how Wraps works? The{" "}
                <Link
                  className="text-gray-800 underline"
                  href="https://wraps.dev/docs"
                >
                  docs
                </Link>{" "}
                cover everything from templates to the SDK.
              </Text>
            </Section>
            <Footer unsubscribeUrl={unsubscribeUrl} />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
