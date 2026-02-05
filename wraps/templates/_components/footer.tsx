import { Hr, Link, Section, Text } from "@react-email/components";

type FooterProps = {
  unsubscribeUrl: string;
};

export function Footer({ unsubscribeUrl }: FooterProps) {
  return (
    <Section style={footer}>
      <Hr style={divider} />
      <Text style={footerText}>Wraps &bull; San Francisco, CA</Text>
      <Link href={unsubscribeUrl} style={unsubscribeLink}>
        Unsubscribe
      </Link>
    </Section>
  );
}

const footer = {
  padding: "20px 40px",
  textAlign: "center" as const,
};

const divider = {
  borderColor: "#e5e7eb",
  margin: "0 0 20px",
};

const footerText = {
  fontSize: "12px",
  color: "#9ca3af",
  margin: "0 0 8px",
};

const unsubscribeLink = {
  fontSize: "12px",
  color: "#9ca3af",
  textDecoration: "underline",
};
