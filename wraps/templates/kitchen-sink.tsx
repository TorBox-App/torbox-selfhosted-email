import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

// -- Metadata --

// Self-referencing on purpose: the broadcast wizard supplies both, and the
// variable mapper binds them to its own Subject / Preview Text fields rather
// than asking for them a second time.
export const subject = "{{subject}}";
export const emailType = "marketing" as const;
export const previewText = "{{previewText}}";

// -- Test Data (for preview) --

export const testData = {
  subject: "Kitchen sink test",
  previewText: "Every variable form in one email",
  heading: "Rendering checklist",
  content:
    "Line one of the long-form value.\nLine two, after a newline.\nLine three.",
  bodyHtml:
    "Markup in a value: <strong>bold</strong>, then a break,<br />then a second line.",
  legalName: "O'Brien & Sons <Holdings>",
  firstName: "Jane",
  lastName: "Doe",
  company: "ACME Inc",
  jobTitle: "Head of Rendering",
  email: "jane@acme.test",
  ctaLabel: "Open the dashboard",
  ctaUrl: "https://app.wraps.dev",
};

// -- Template --

type Props = {
  heading: string;
  content: string;
  bodyHtml: string;
  legalName: string;
  firstName: string;
  lastName: string;
  company: string;
  jobTitle: string;
  email: string;
  ctaLabel: string;
  ctaUrl: string;
};

/**
 * Render-fidelity fixture. Every row exercises one variable form, so a single
 * send tells you whether the preview, the test send and the real broadcast all
 * agree. Push it into any account with:
 *
 *   wraps email templates push --template kitchen-sink
 *
 * Deliberately self-contained (no `_components` import) and styled inline
 * rather than with Tailwind: it is meant to be copied into other projects, and
 * this exact markup is what was diffed byte-for-byte against SES
 * `test-render-template` output.
 */
export default function KitchenSink({
  heading,
  content,
  bodyHtml,
  legalName,
  firstName,
  lastName,
  company,
  jobTitle,
  email,
  ctaLabel,
  ctaUrl,
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body
        style={{
          backgroundColor: "#ffffff",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <Container
          style={{ margin: "0 auto", maxWidth: "600px", padding: "24px 16px" }}
        >
          <Heading style={{ fontSize: "22px", margin: "0 0 4px" }}>
            {heading}
          </Heading>
          <Text
            style={{ color: "#6b7280", fontSize: "13px", margin: "0 0 20px" }}
          >
            Each row below exercises one part of the variable pipeline. A row
            still showing raw handlebars syntax did not resolve.
          </Text>

          <Hr style={{ borderColor: "#e5e7eb" }} />

          <Section>
            <Text
              style={{
                fontSize: "12px",
                color: "#6b7280",
                margin: "16px 0 2px",
              }}
            >
              0. Supplied by the broadcast, not by the mapper
            </Text>
            <Text style={{ fontSize: "14px", margin: 0 }}>
              {"Subject: {{subject}} · Preview: "}
              {previewText}
            </Text>
          </Section>

          <Section>
            <Text
              style={{
                fontSize: "12px",
                color: "#6b7280",
                margin: "16px 0 2px",
              }}
            >
              1. Long-form value (newlines) — white-space: pre-line
            </Text>
            {/* Inline whiteSpace, not a Tailwind class: HTML collapses raw
                newlines, so without this the multi-line value renders as one
                run-on line even though the newlines survived substitution. */}
            <Text
              style={{ fontSize: "14px", margin: 0, whiteSpace: "pre-line" }}
            >
              {content}
            </Text>
          </Section>

          <Section>
            <Text
              style={{
                fontSize: "12px",
                color: "#6b7280",
                margin: "16px 0 2px",
              }}
            >
              2. Markup in a value — should render as markup, not as text
            </Text>
            <Text style={{ fontSize: "14px", margin: 0 }}>{bodyHtml}</Text>
          </Section>

          <Section>
            <Text
              style={{
                fontSize: "12px",
                color: "#6b7280",
                margin: "16px 0 2px",
              }}
            >
              3. Entities — should read O&apos;Brien &amp; Sons, never &amp;amp;
              or &amp;#x27;
            </Text>
            <Text style={{ fontSize: "14px", margin: 0 }}>{legalName}</Text>
          </Section>

          <Section>
            <Text
              style={{
                fontSize: "12px",
                color: "#6b7280",
                margin: "16px 0 2px",
              }}
            >
              4. Contact-field mappable
            </Text>
            <Text style={{ fontSize: "14px", margin: 0 }}>
              {firstName} {lastName} — {jobTitle} at {company} ({email})
            </Text>
          </Section>

          <Section>
            <Text
              style={{
                fontSize: "12px",
                color: "#6b7280",
                margin: "16px 0 2px",
              }}
            >
              5. Fallback syntax — blank contacts should read &quot;there&quot;
            </Text>
            <Text style={{ fontSize: "14px", margin: 0 }}>
              {"Hi {{greetingName|there}}, welcome back."}
            </Text>
          </Section>

          <Section>
            <Text
              style={{
                fontSize: "12px",
                color: "#6b7280",
                margin: "16px 0 2px",
              }}
            >
              6. Conditional block
            </Text>
            <Text style={{ fontSize: "14px", margin: 0 }}>
              {"{{#if firstName}}"}
              Personalized branch taken.
              {"{{else}}"}
              Fallback branch taken.
              {"{{/if}}"}
            </Text>
          </Section>

          <Section>
            <Text
              style={{
                fontSize: "12px",
                color: "#6b7280",
                margin: "16px 0 2px",
              }}
            >
              7. Dotted paths — flattened by transformVariablesForSes
            </Text>
            <Text style={{ fontSize: "14px", margin: 0 }}>
              {"{{contact.firstName}} at {{organization.name}}"}
            </Text>
          </Section>

          <Section>
            <Text
              style={{
                fontSize: "12px",
                color: "#6b7280",
                margin: "16px 0 2px",
              }}
            >
              8. URL in an attribute
            </Text>
            <Link href={ctaUrl} style={{ fontSize: "14px", color: "#4f46e5" }}>
              {ctaLabel}
            </Link>
          </Section>

          <Hr style={{ borderColor: "#e5e7eb", margin: "24px 0 12px" }} />

          <Text style={{ fontSize: "12px", color: "#9ca3af", margin: 0 }}>
            9. System variables —{" "}
            <Link href="{{unsubscribeUrl}}" style={{ color: "#9ca3af" }}>
              Unsubscribe
            </Link>{" "}
            ·{" "}
            <Link href="{{preferencesUrl}}" style={{ color: "#9ca3af" }}>
              Email preferences
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
