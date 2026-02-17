/**
 * Claude Code context content for template scaffolding.
 *
 * These constants are written to .claude/ when running `wraps email templates init`.
 */

/** Section added to .claude/CLAUDE.md */
export const TEMPLATES_CLAUDE_MD_SECTION = `
## Templates

Email templates live at \`wraps/templates/*.tsx\` and use [React Email](https://react.email) components with metadata exports.

### Key Commands

- \`wraps email templates push\` — Push templates to SES + Wraps dashboard
- \`wraps email templates preview\` — Preview templates in the browser
- \`wraps email templates push --template welcome\` — Push a single template

### Quick Reference

- Each template file exports \`subject\`, \`emailType\`, \`previewText\`, \`testData\`, and a default React component
- Variables use \`{{varName}}\` in subject strings and props in the component
- Shared components go in \`wraps/templates/_components/\`
- Brand config is in \`wraps/brand.ts\`
- See the \`wraps-templates\` skill for the full API reference
`;

/** Full skill content written to .claude/skills/wraps-templates/SKILL.md */
export const TEMPLATES_SKILL_CONTENT = `
# Wraps Email Templates

You are an expert at writing Wraps email templates using React Email components with the templates-as-code system.

## File Structure

Templates live at \`wraps/templates/*.tsx\`. Each file is a self-contained email template:

\`\`\`
wraps/
├── wraps.config.ts          # Project configuration
├── brand.ts                 # Brand colors, fonts, company info
├── templates/
│   ├── welcome.tsx          # Template files
│   ├── cart-recovery.tsx
│   └── _components/         # Shared components (prefixed with _)
│       └── footer.tsx
└── workflows/               # Workflow automation files
\`\`\`

## Required Exports

Every template file must export these named values plus a default component:

\`\`\`typescript
// ── Metadata ──

export const subject = 'Welcome to {{companyName}}, {{firstName}}!';
export const emailType = 'transactional' as const;  // or 'marketing'
export const previewText = 'We\\'re glad to have you on board.';

// ── Test Data (for preview) ──

export const testData = {
  firstName: 'Jane',
  companyName: 'Acme',
  unsubscribeUrl: 'https://example.com/unsubscribe',
};

// ── Template ──

interface Props {
  firstName: string;
  companyName: string;
  unsubscribeUrl: string;
}

export default function WelcomeEmail({ firstName, companyName, unsubscribeUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body>
        {/* ... */}
      </Body>
    </Html>
  );
}
\`\`\`

### Export Details

| Export | Type | Description |
|--------|------|-------------|
| \`subject\` | \`string\` | Email subject line. Use \`{{varName}}\` for variables. |
| \`emailType\` | \`'transactional' \\| 'marketing'\` | Determines sending behavior and compliance rules. |
| \`previewText\` | \`string\` | Preview text shown in email clients (inbox preview). |
| \`testData\` | \`Record<string, unknown>\` | Sample data for \`wraps email templates preview\`. |
| \`default\` | React component | The email template component. Receives variables as props. |

## Variable Syntax

- **In \`subject\`**: Use \`{{variableName}}\` mustache syntax
- **In the component**: Variables are passed as React props

\`\`\`typescript
export const subject = 'Hi {{firstName}}, your order #{{orderId}} shipped!';

interface Props {
  firstName: string;
  orderId: string;
  trackingUrl: string;
}

export default function OrderShipped({ firstName, orderId, trackingUrl }: Props) {
  // Use variables directly as props
  return <Text>Hi {firstName}, track order #{orderId}</Text>;
}
\`\`\`

## React Email Components

Import components from \`@react-email/components\`:

\`\`\`typescript
import {
  Body,
  Button,
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
  Text,
} from '@react-email/components';
\`\`\`

### Common Components

| Component | Usage |
|-----------|-------|
| \`<Html>\` | Root wrapper (required) |
| \`<Head />\` | Email head (required) |
| \`<Preview>\` | Inbox preview text |
| \`<Body>\` | Email body wrapper |
| \`<Container>\` | Centered content container |
| \`<Section>\` | Content section |
| \`<Heading>\` | Heading text (h1-h6) |
| \`<Text>\` | Paragraph text |
| \`<Button>\` | Call-to-action button |
| \`<Link>\` | Hyperlink |
| \`<Img>\` | Image |
| \`<Hr />\` | Horizontal rule |
| \`<Row>\` / \`<Column>\` | Table-based layout |

## Configuration Files

### wraps.config.ts

\`\`\`typescript
import { defineConfig } from '@wraps.dev/client';

export default defineConfig({
  org: 'my-org',                      // Organization slug
  from: { email: 'hello@app.com', name: 'My App' },
  region: 'us-east-1',               // AWS region
  templatesDir: './templates',        // Templates directory
  brandFile: './brand.ts',            // Brand config file
});
\`\`\`

### brand.ts

\`\`\`typescript
import { defineBrand } from '@wraps.dev/client';

export default defineBrand({
  primaryColor: '#5046e5',
  secondaryColor: '#6366f1',
  backgroundColor: '#ffffff',
  textColor: '#1f2937',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  buttonStyle: 'rounded',
  buttonRadius: '6px',
  companyName: 'Your Company',
  companyAddress: '123 Main St, City, ST 12345',
  logoUrl: 'https://yourapp.com/logo.png',
  socialLinks: [
    { platform: 'twitter', url: 'https://twitter.com/yourcompany' },
    { platform: 'github', url: 'https://github.com/yourcompany' },
  ],
});
\`\`\`

## Shared Components

Place shared components in \`wraps/templates/_components/\`. Files prefixed with \`_\` are treated as components, not templates.

\`\`\`typescript
// wraps/templates/_components/footer.tsx
import { Hr, Link, Section, Text } from '@react-email/components';

interface FooterProps {
  unsubscribeUrl: string;
}

export function Footer({ unsubscribeUrl }: FooterProps) {
  return (
    <Section style={{ padding: '20px 40px', textAlign: 'center' }}>
      <Hr />
      <Text style={{ fontSize: '12px', color: '#9ca3af' }}>
        Your Company &bull; 123 Main St
      </Text>
      <Link href={unsubscribeUrl} style={{ fontSize: '12px', color: '#9ca3af' }}>
        Unsubscribe
      </Link>
    </Section>
  );
}
\`\`\`

## Styling

Use inline styles (React Email renders to email-safe HTML):

\`\`\`typescript
const heading = {
  fontSize: '24px',
  fontWeight: '600' as const,
  color: '#1f2937',
  margin: '0 0 16px',
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '1.6',
  color: '#4b5563',
  margin: '0 0 12px',
};

const button = {
  backgroundColor: '#5046e5',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '6px',
  fontSize: '16px',
  fontWeight: '600' as const,
  textDecoration: 'none',
};
\`\`\`

## Complete Example

\`\`\`typescript
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import { Footer } from './_components/footer';

// ── Metadata ──

export const subject = 'Welcome to {{companyName}}, {{firstName}}!';
export const emailType = 'transactional' as const;
export const previewText = 'We\\'re glad to have you on board.';

// ── Test Data ──

export const testData = {
  firstName: 'Jane',
  companyName: 'Acme',
  dashboardUrl: 'https://app.example.com/dashboard',
  unsubscribeUrl: 'https://example.com/unsubscribe',
};

// ── Template ──

interface Props {
  firstName: string;
  companyName: string;
  dashboardUrl: string;
  unsubscribeUrl: string;
}

export default function WelcomeEmail({
  firstName,
  companyName,
  dashboardUrl,
  unsubscribeUrl,
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={content}>
            <Heading style={heading}>Welcome, {firstName}!</Heading>
            <Text style={paragraph}>
              Thanks for signing up for {companyName}. We&apos;re excited to
              have you on board.
            </Text>
            <Button href={dashboardUrl} style={button}>
              Go to Dashboard
            </Button>
          </Section>
          <Footer unsubscribeUrl={unsubscribeUrl} />
        </Container>
      </Body>
    </Html>
  );
}

// ── Styles ──

const body = {
  backgroundColor: '#f6f9fc',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '40px 0',
  maxWidth: '580px',
};

const content = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  padding: '40px',
};

const heading = {
  fontSize: '24px',
  fontWeight: '600' as const,
  color: '#1f2937',
  margin: '0 0 16px',
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '1.6',
  color: '#4b5563',
  margin: '0 0 24px',
};

const button = {
  backgroundColor: '#5046e5',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '6px',
  fontSize: '16px',
  fontWeight: '600' as const,
  textDecoration: 'none',
};
\`\`\`

## Key Commands

\`\`\`bash
wraps email templates init                     # Initialize templates-as-code
wraps email templates push                     # Push all templates
wraps email templates push --template welcome  # Push a specific template
wraps email templates preview                  # Preview in browser
\`\`\`
`;
