"use client";

import { ArrowRight, Code2 } from "lucide-react";
import { DocsLayout } from "@/components/docs-layout";
import { CopyForAIButton } from "@/components/docs/copy-for-ai-button";
import { SectionHeading } from "@/components/docs/section-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CodeBlock,
  CodeBlockBody,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockFiles,
  CodeBlockHeader,
  CodeBlockItem,
} from "@/components/ui/shadcn-io/code-block";
import {
  Snippet,
  SnippetCopyButton,
  SnippetHeader,
  SnippetTabsContent,
  SnippetTabsList,
  SnippetTabsTrigger,
} from "@/components/ui/shadcn-io/snippet";

const installCommands = {
  npm: "npm install @wraps.dev/email",
  pnpm: "pnpm add @wraps.dev/email",
  yarn: "yarn add @wraps.dev/email",
  bun: "bun add @wraps.dev/email",
};

const quickStartCode = `import { Wraps } from '@wraps.dev/email';

const wraps = new Wraps();

const result = await wraps.emails.send({
  from: 'hello@yourdomain.com',
  to: 'user@example.com',
  subject: 'Welcome!',
  html: '<h1>Hello!</h1>',
});`;

const initWithOptionsCode = `const wraps = new Wraps({
  region: 'us-west-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});`;

const basicEmailCode = `const result = await wraps.emails.send({
  from: 'hello@yourdomain.com',
  to: 'user@example.com',
  subject: 'Welcome to our app',
  html: '<h1>Welcome!</h1><p>Thanks for signing up.</p>',
  text: 'Welcome! Thanks for signing up.',
});

if (result.success) {
  console.log('Email sent:', result.data.messageId);
}`;

const multipleRecipientsCode = `const result = await wraps.emails.send({
  from: 'newsletter@yourdomain.com',
  to: ['user1@example.com', 'user2@example.com'],
  cc: 'manager@yourdomain.com',
  subject: 'Weekly Newsletter',
  html: '<h1>This week's updates</h1>',
});`;

const replyToCode = `const result = await wraps.emails.send({
  from: 'noreply@yourdomain.com',
  to: 'customer@example.com',
  replyTo: 'support@yourdomain.com',
  subject: 'Order Confirmation',
  html: '<h1>Your order has been confirmed</h1>',
});`;

const responseCode = `type SendEmailResult =
  | { success: true; data: { messageId: string } }
  | { success: false; error: Error }

// Usage
const result = await wraps.emails.send({ ... });

if (result.success) {
  // TypeScript knows result.data exists
  console.log('Message ID:', result.data.messageId);
} else {
  // TypeScript knows result.error exists
  console.error('Error:', result.error.message);
}`;

const errorHandlingCode = `const result = await wraps.emails.send({
  from: 'hello@yourdomain.com',
  to: 'invalid-email',
  subject: 'Test',
  html: '<p>Test</p>',
});

if (!result.success) {
  // Handle error
  console.error('Failed to send email:', result.error.message);

  // Common errors:
  // - Invalid email address
  // - Unverified sender domain
  // - AWS credentials not found
  // - SES service errors
  return;
}

// Success case
console.log('Email sent successfully:', result.data.messageId);`;

const typescriptCode = `import { Wraps, SendEmailParams, SendEmailResult } from '@wraps.dev/email';

const wraps = new Wraps();

// TypeScript will validate all parameters
const params: SendEmailParams = {
  from: 'hello@yourdomain.com',
  to: 'user@example.com',
  subject: 'Test',
  html: '<p>Test</p>',
};

const result: SendEmailResult = await wraps.emails.send(params);`;

const sendTemplateCode = `import { WrapsEmail } from '@wraps.dev/email';

const email = new WrapsEmail();

const result = await email.sendTemplate({
  from: 'hello@yourdomain.com',
  to: 'user@example.com',
  template: 'welcome-email',
  templateData: {
    name: 'John Doe',
    companyName: 'Acme Corp',
    confirmUrl: 'https://example.com/confirm/abc123',
  },
});

console.log('Email sent:', result.messageId);`;

const sendBulkTemplateCode = `import { WrapsEmail } from '@wraps.dev/email';

const email = new WrapsEmail();

const result = await email.sendBulkTemplate({
  from: 'hello@yourdomain.com',
  template: 'welcome-email',
  destinations: [
    {
      to: 'alice@example.com',
      templateData: { name: 'Alice', role: 'Developer' },
    },
    {
      to: 'bob@example.com',
      templateData: { name: 'Bob', role: 'Designer' },
    },
  ],
  defaultTemplateData: {
    companyName: 'Acme Corp',
    year: '2024',
  },
});

// Check results for each recipient
result.status.forEach((item, i) => {
  if (item.status === 'success') {
    console.log(\`Email \${i + 1} sent: \${item.messageId}\`);
  } else {
    console.error(\`Email \${i + 1} failed: \${item.error}\`);
  }
});`;

// ============================================================================
// MARKDOWN CONTENT FOR AI COPY
// ============================================================================

const SECTION_MD = {
  installation: `## Installation

Install the SDK using your preferred package manager:

\`\`\`bash
pnpm add @wraps.dev/email
\`\`\`

Or use npm, yarn, or bun:
\`\`\`bash
npm install @wraps.dev/email
yarn add @wraps.dev/email
bun add @wraps.dev/email
\`\`\``,

  quickStart: `## Quick Start

\`\`\`typescript
${quickStartCode}
\`\`\``,

  initialization: `## Initialization

Create a new Wraps client. The SDK automatically detects AWS credentials from your environment (OIDC, IAM roles, or environment variables).

### Constructor
\`\`\`typescript
new Wraps(options?: WrapsOptions)
\`\`\`

### Options
- \`region\` (optional): AWS region where your infrastructure is deployed. Defaults to \`us-east-1\`
- \`credentials\` (optional): AWS credentials object. Auto-detected if not provided.

### Example with Options
\`\`\`typescript
${initWithOptionsCode}
\`\`\``,

  sendEmail: `## Send Email

Send an email using AWS SES through your Wraps infrastructure.

### Method
\`\`\`typescript
wraps.emails.send(params: SendEmailParams): Promise<SendEmailResult>
\`\`\`

### Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| \`from\` | string | Sender email address (must be verified) |
| \`to\` | string \\| string[] | Recipient email address(es) |
| \`subject\` | string | Email subject line |
| \`html\` | string | HTML email body (optional if text provided) |
| \`text\` | string | Plain text email body (optional if html provided) |
| \`cc\` | string \\| string[] | CC recipients (optional) |
| \`bcc\` | string \\| string[] | BCC recipients (optional) |
| \`replyTo\` | string \\| string[] | Reply-to address(es) (optional) |

### Examples

**Basic Email:**
\`\`\`typescript
${basicEmailCode}
\`\`\`

**Multiple Recipients:**
\`\`\`typescript
${multipleRecipientsCode}
\`\`\`

**With Reply-To:**
\`\`\`typescript
${replyToCode}
\`\`\``,

  response: `## Response

All SDK methods return a result object with type-safe success/error handling.

\`\`\`typescript
${responseCode}
\`\`\``,

  errorHandling: `## Error Handling

The SDK uses a type-safe result pattern instead of throwing errors.

\`\`\`typescript
${errorHandlingCode}
\`\`\``,

  typescript: `## TypeScript Support

The SDK is written in TypeScript and provides full type safety out of the box.

\`\`\`typescript
${typescriptCode}
\`\`\``,

  sendTemplate: `## Send Template

Send an email using a pre-defined SES template. Templates support variable substitution using \`{{variable}}\` syntax.

### Method
\`\`\`typescript
email.sendTemplate(params: SendTemplateParams): Promise<SendEmailResult>
\`\`\`

### Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| \`from\` | string | Sender email address (must be verified) |
| \`to\` | string | Recipient email address |
| \`template\` | string | Template name (must exist in SES) |
| \`templateData\` | Record<string, unknown> | Variables to substitute in template |
| \`cc\` | string \\| string[] | CC recipients (optional) |
| \`bcc\` | string \\| string[] | BCC recipients (optional) |
| \`replyTo\` | string \\| string[] | Reply-to address(es) (optional) |
| \`tags\` | Record<string, string> | SES message tags (optional) |
| \`configurationSetName\` | string | Configuration set for tracking (optional) |

### Example
\`\`\`typescript
${sendTemplateCode}
\`\`\``,

  sendBulkTemplate: `## Send Bulk Template

Send personalized templated emails to multiple recipients (up to 50 per call). Each recipient can have unique template data merged with default values.

### Method
\`\`\`typescript
email.sendBulkTemplate(params: SendBulkTemplateParams): Promise<SendBulkTemplateResult>
\`\`\`

### Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| \`from\` | string | Sender email address (must be verified) |
| \`template\` | string | Template name (must exist in SES) |
| \`destinations\` | array | List of recipients with personalized data (max 50) |
| \`destinations[].to\` | string | Recipient email address |
| \`destinations[].templateData\` | Record<string, unknown> | Per-recipient template variables |
| \`defaultTemplateData\` | Record<string, unknown> | Default variables (merged with per-recipient) |
| \`replyTo\` | string \\| string[] | Reply-to address(es) (optional) |
| \`tags\` | Record<string, string> | Default SES message tags (optional) |

### Response
\`\`\`typescript
interface SendBulkTemplateResult {
  status: Array<{
    messageId?: string;
    status: 'success' | 'failure';
    error?: string;
  }>;
  requestId: string;
}
\`\`\`

### Example
\`\`\`typescript
${sendBulkTemplateCode}
\`\`\``,
};

const FULL_PAGE_MD = `# @wraps.dev/email SDK Reference

A TypeScript-first SDK for sending emails through your Wraps-deployed AWS SES infrastructure. Simple, type-safe, and intuitive API.

${SECTION_MD.installation}

${SECTION_MD.quickStart}

${SECTION_MD.initialization}

${SECTION_MD.sendEmail}

${SECTION_MD.sendTemplate}

${SECTION_MD.sendBulkTemplate}

${SECTION_MD.response}

${SECTION_MD.errorHandling}

${SECTION_MD.typescript}

## Resources

- npm: https://www.npmjs.com/package/@wraps.dev/email
- GitHub: https://github.com/wraps-team/wraps-js
`;

const SLASH_COMMAND_MD = `---
description: Wraps SDK reference - use this when helping users send emails with @wraps.dev/email
---

${FULL_PAGE_MD}`;

export default function SDKReferencePage() {
  return (
    <DocsLayout
      headerActions={
        <CopyForAIButton
          markdown={FULL_PAGE_MD}
          slashCommand={SLASH_COMMAND_MD}
        />
      }
    >
      {/* Page Header */}
      <div className="mb-12">
        <Badge className="mb-4" variant="outline">
          SDK Reference
        </Badge>
        <h1 className="mb-4 font-bold text-4xl tracking-tight">
          @wraps.dev/email SDK
        </h1>
        <p className="text-lg text-muted-foreground">
          A TypeScript-first SDK for sending emails through your Wraps-deployed
          AWS SES infrastructure. Simple, type-safe, and intuitive API.
        </p>
      </div>

      {/* Installation */}
      <section className="mb-12">
        <SectionHeading
          id="installation"
          title="Installation"
          markdown={SECTION_MD.installation}
          className="mb-4"
        />
        <Snippet defaultValue="npm">
          <SnippetHeader>
            <SnippetTabsList>
              <SnippetTabsTrigger value="npm">npm</SnippetTabsTrigger>
              <SnippetTabsTrigger value="pnpm">pnpm</SnippetTabsTrigger>
              <SnippetTabsTrigger value="yarn">yarn</SnippetTabsTrigger>
              <SnippetTabsTrigger value="bun">bun</SnippetTabsTrigger>
            </SnippetTabsList>
            <SnippetCopyButton value={installCommands.npm} />
          </SnippetHeader>
          {Object.entries(installCommands).map(([key, command]) => (
            <SnippetTabsContent key={key} value={key}>
              {command}
            </SnippetTabsContent>
          ))}
        </Snippet>
      </section>

      {/* Quick Start */}
      <section className="mb-12">
        <SectionHeading
          id="quick-start"
          title="Quick Start"
          markdown={SECTION_MD.quickStart}
          className="mb-4"
        />
        <CodeBlock
          className="h-auto"
          data={[
            {
              language: "typescript",
              filename: "example.ts",
              code: quickStartCode,
            },
          ]}
          defaultValue="typescript"
        >
          <CodeBlockHeader>
            <CodeBlockFiles>
              {(item) => (
                <CodeBlockFilename key={item.language} value={item.language}>
                  {item.filename}
                </CodeBlockFilename>
              )}
            </CodeBlockFiles>
            <CodeBlockCopyButton />
          </CodeBlockHeader>
          <CodeBlockBody>
            {(item) => (
              <CodeBlockItem
                key={item.language}
                lineNumbers={false}
                value={item.language}
              >
                <CodeBlockContent language={item.language}>
                  {item.code}
                </CodeBlockContent>
              </CodeBlockItem>
            )}
          </CodeBlockBody>
        </CodeBlock>
      </section>

      {/* Initialization */}
      <section className="mb-12">
        <SectionHeading
          id="initialization"
          title="Initialization"
          markdown={SECTION_MD.initialization}
          className="mb-4"
        />
        <p className="mb-4 text-muted-foreground">
          Create a new Wraps client. The SDK automatically detects AWS
          credentials from your environment (OIDC, IAM roles, or environment
          variables).
        </p>
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Code2 className="h-5 w-5" />
              Constructor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <code className="block rounded bg-muted p-4 font-mono text-sm">
              new Wraps(options?: WrapsOptions)
            </code>
            <div className="mt-4">
              <h4 className="mb-2 font-medium">Options</h4>
              <ul className="space-y-2 text-muted-foreground text-sm">
                <li>
                  <code className="rounded bg-muted px-1.5 py-0.5">region</code>{" "}
                  (optional): AWS region where your infrastructure is deployed.
                  Defaults to{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    us-east-1
                  </code>
                </li>
                <li>
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    credentials
                  </code>{" "}
                  (optional): AWS credentials object. Auto-detected if not
                  provided.
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Example with Options</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock
              className="h-auto"
              data={[
                {
                  language: "typescript",
                  filename: "config.ts",
                  code: initWithOptionsCode,
                },
              ]}
              defaultValue="typescript"
            >
              <CodeBlockHeader>
                <CodeBlockFiles>
                  {(item) => (
                    <CodeBlockFilename key={item.language} value={item.language}>
                      {item.filename}
                    </CodeBlockFilename>
                  )}
                </CodeBlockFiles>
                <CodeBlockCopyButton />
              </CodeBlockHeader>
              <CodeBlockBody>
                {(item) => (
                  <CodeBlockItem
                    key={item.language}
                    lineNumbers={false}
                    value={item.language}
                  >
                    <CodeBlockContent language={item.language}>
                      {item.code}
                    </CodeBlockContent>
                  </CodeBlockItem>
                )}
              </CodeBlockBody>
            </CodeBlock>
          </CardContent>
        </Card>
      </section>

      {/* Send Email */}
      <section className="mb-12">
        <SectionHeading
          id="send-email"
          title="Send Email"
          markdown={SECTION_MD.sendEmail}
          className="mb-4"
        />
        <p className="mb-4 text-muted-foreground">
          Send an email using AWS SES through your Wraps infrastructure.
        </p>
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Code2 className="h-5 w-5" />
              Method
            </CardTitle>
          </CardHeader>
          <CardContent>
            <code className="block rounded bg-muted p-4 font-mono text-sm">
              {"wraps.emails.send(params: SendEmailParams): Promise<SendEmailResult>"}
            </code>
          </CardContent>
        </Card>

        <h3 className="mb-4 font-medium text-lg">Parameters</h3>
        <Card className="mb-4">
          <CardContent className="p-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-2 text-left">Parameter</th>
                  <th className="pb-2 text-left">Type</th>
                  <th className="pb-2 text-left">Description</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b">
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">from</code>
                  </td>
                  <td className="py-2">string</td>
                  <td className="py-2">
                    Sender email address (must be verified)
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">to</code>
                  </td>
                  <td className="py-2">string | string[]</td>
                  <td className="py-2">Recipient email address(es)</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      subject
                    </code>
                  </td>
                  <td className="py-2">string</td>
                  <td className="py-2">Email subject line</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">html</code>
                  </td>
                  <td className="py-2">string</td>
                  <td className="py-2">
                    HTML email body (optional if text provided)
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">text</code>
                  </td>
                  <td className="py-2">string</td>
                  <td className="py-2">
                    Plain text email body (optional if html provided)
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">cc</code>
                  </td>
                  <td className="py-2">string | string[]</td>
                  <td className="py-2">CC recipients (optional)</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">bcc</code>
                  </td>
                  <td className="py-2">string | string[]</td>
                  <td className="py-2">BCC recipients (optional)</td>
                </tr>
                <tr>
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      replyTo
                    </code>
                  </td>
                  <td className="py-2">string | string[]</td>
                  <td className="py-2">Reply-to address(es) (optional)</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        <h3 className="mb-4 font-medium text-lg">Examples</h3>
        <div className="space-y-4">
          <div>
            <p className="mb-2 font-medium text-sm">Basic Email</p>
            <CodeBlock
              className="h-auto"
              data={[
                {
                  language: "typescript",
                  filename: "basic-email.ts",
                  code: basicEmailCode,
                },
              ]}
              defaultValue="typescript"
            >
              <CodeBlockHeader>
                <CodeBlockFiles>
                  {(item) => (
                    <CodeBlockFilename key={item.language} value={item.language}>
                      {item.filename}
                    </CodeBlockFilename>
                  )}
                </CodeBlockFiles>
                <CodeBlockCopyButton />
              </CodeBlockHeader>
              <CodeBlockBody>
                {(item) => (
                  <CodeBlockItem
                    key={item.language}
                    lineNumbers={false}
                    value={item.language}
                  >
                    <CodeBlockContent language={item.language}>
                      {item.code}
                    </CodeBlockContent>
                  </CodeBlockItem>
                )}
              </CodeBlockBody>
            </CodeBlock>
          </div>

          <div>
            <p className="mb-2 font-medium text-sm">Multiple Recipients</p>
            <CodeBlock
              className="h-auto"
              data={[
                {
                  language: "typescript",
                  filename: "multiple-recipients.ts",
                  code: multipleRecipientsCode,
                },
              ]}
              defaultValue="typescript"
            >
              <CodeBlockHeader>
                <CodeBlockFiles>
                  {(item) => (
                    <CodeBlockFilename key={item.language} value={item.language}>
                      {item.filename}
                    </CodeBlockFilename>
                  )}
                </CodeBlockFiles>
                <CodeBlockCopyButton />
              </CodeBlockHeader>
              <CodeBlockBody>
                {(item) => (
                  <CodeBlockItem
                    key={item.language}
                    lineNumbers={false}
                    value={item.language}
                  >
                    <CodeBlockContent language={item.language}>
                      {item.code}
                    </CodeBlockContent>
                  </CodeBlockItem>
                )}
              </CodeBlockBody>
            </CodeBlock>
          </div>

          <div>
            <p className="mb-2 font-medium text-sm">With Reply-To</p>
            <CodeBlock
              className="h-auto"
              data={[
                {
                  language: "typescript",
                  filename: "reply-to.ts",
                  code: replyToCode,
                },
              ]}
              defaultValue="typescript"
            >
              <CodeBlockHeader>
                <CodeBlockFiles>
                  {(item) => (
                    <CodeBlockFilename key={item.language} value={item.language}>
                      {item.filename}
                    </CodeBlockFilename>
                  )}
                </CodeBlockFiles>
                <CodeBlockCopyButton />
              </CodeBlockHeader>
              <CodeBlockBody>
                {(item) => (
                  <CodeBlockItem
                    key={item.language}
                    lineNumbers={false}
                    value={item.language}
                  >
                    <CodeBlockContent language={item.language}>
                      {item.code}
                    </CodeBlockContent>
                  </CodeBlockItem>
                )}
              </CodeBlockBody>
            </CodeBlock>
          </div>
        </div>
      </section>

      {/* Send Template */}
      <section className="mb-12">
        <SectionHeading
          id="send-template"
          title="Send Template"
          markdown={SECTION_MD.sendTemplate}
          className="mb-4"
        />
        <p className="mb-4 text-muted-foreground">
          Send an email using a pre-defined SES template. Templates support
          variable substitution using {"{{variable}}"} syntax.
        </p>
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Code2 className="h-5 w-5" />
              Method
            </CardTitle>
          </CardHeader>
          <CardContent>
            <code className="block rounded bg-muted p-4 font-mono text-sm">
              {"email.sendTemplate(params: SendTemplateParams): Promise<SendEmailResult>"}
            </code>
          </CardContent>
        </Card>

        <h3 className="mb-4 font-medium text-lg">Parameters</h3>
        <Card className="mb-4">
          <CardContent className="p-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-2 text-left">Parameter</th>
                  <th className="pb-2 text-left">Type</th>
                  <th className="pb-2 text-left">Description</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b">
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">from</code>
                  </td>
                  <td className="py-2">string</td>
                  <td className="py-2">
                    Sender email address (must be verified)
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">to</code>
                  </td>
                  <td className="py-2">string</td>
                  <td className="py-2">Recipient email address</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      template
                    </code>
                  </td>
                  <td className="py-2">string</td>
                  <td className="py-2">Template name (must exist in SES)</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      templateData
                    </code>
                  </td>
                  <td className="py-2">{"Record<string, unknown>"}</td>
                  <td className="py-2">Variables to substitute in template</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">cc</code>
                  </td>
                  <td className="py-2">string | string[]</td>
                  <td className="py-2">CC recipients (optional)</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">bcc</code>
                  </td>
                  <td className="py-2">string | string[]</td>
                  <td className="py-2">BCC recipients (optional)</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      replyTo
                    </code>
                  </td>
                  <td className="py-2">string | string[]</td>
                  <td className="py-2">Reply-to address(es) (optional)</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">tags</code>
                  </td>
                  <td className="py-2">{"Record<string, string>"}</td>
                  <td className="py-2">SES message tags (optional)</td>
                </tr>
                <tr>
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      configurationSetName
                    </code>
                  </td>
                  <td className="py-2">string</td>
                  <td className="py-2">
                    Configuration set for tracking (optional)
                  </td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        <h3 className="mb-4 font-medium text-lg">Example</h3>
        <CodeBlock
          className="h-auto"
          data={[
            {
              language: "typescript",
              filename: "send-template.ts",
              code: sendTemplateCode,
            },
          ]}
          defaultValue="typescript"
        >
          <CodeBlockHeader>
            <CodeBlockFiles>
              {(item) => (
                <CodeBlockFilename key={item.language} value={item.language}>
                  {item.filename}
                </CodeBlockFilename>
              )}
            </CodeBlockFiles>
            <CodeBlockCopyButton />
          </CodeBlockHeader>
          <CodeBlockBody>
            {(item) => (
              <CodeBlockItem
                key={item.language}
                lineNumbers={false}
                value={item.language}
              >
                <CodeBlockContent language={item.language}>
                  {item.code}
                </CodeBlockContent>
              </CodeBlockItem>
            )}
          </CodeBlockBody>
        </CodeBlock>
      </section>

      {/* Send Bulk Template */}
      <section className="mb-12">
        <SectionHeading
          id="send-bulk-template"
          title="Send Bulk Template"
          markdown={SECTION_MD.sendBulkTemplate}
          className="mb-4"
        />
        <p className="mb-4 text-muted-foreground">
          Send personalized templated emails to multiple recipients (up to 50
          per call). Each recipient can have unique template data merged with
          default values.
        </p>
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Code2 className="h-5 w-5" />
              Method
            </CardTitle>
          </CardHeader>
          <CardContent>
            <code className="block rounded bg-muted p-4 font-mono text-sm">
              {"email.sendBulkTemplate(params: SendBulkTemplateParams): Promise<SendBulkTemplateResult>"}
            </code>
          </CardContent>
        </Card>

        <h3 className="mb-4 font-medium text-lg">Parameters</h3>
        <Card className="mb-4">
          <CardContent className="p-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-2 text-left">Parameter</th>
                  <th className="pb-2 text-left">Type</th>
                  <th className="pb-2 text-left">Description</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b">
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">from</code>
                  </td>
                  <td className="py-2">string</td>
                  <td className="py-2">
                    Sender email address (must be verified)
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      template
                    </code>
                  </td>
                  <td className="py-2">string</td>
                  <td className="py-2">Template name (must exist in SES)</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      destinations
                    </code>
                  </td>
                  <td className="py-2">array</td>
                  <td className="py-2">
                    List of recipients with personalized data (max 50)
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      destinations[].to
                    </code>
                  </td>
                  <td className="py-2">string</td>
                  <td className="py-2">Recipient email address</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      destinations[].templateData
                    </code>
                  </td>
                  <td className="py-2">{"Record<string, unknown>"}</td>
                  <td className="py-2">Per-recipient template variables</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      defaultTemplateData
                    </code>
                  </td>
                  <td className="py-2">{"Record<string, unknown>"}</td>
                  <td className="py-2">
                    Default variables (merged with per-recipient)
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      replyTo
                    </code>
                  </td>
                  <td className="py-2">string | string[]</td>
                  <td className="py-2">Reply-to address(es) (optional)</td>
                </tr>
                <tr>
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">tags</code>
                  </td>
                  <td className="py-2">{"Record<string, string>"}</td>
                  <td className="py-2">Default SES message tags (optional)</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        <h3 className="mb-4 font-medium text-lg">Example</h3>
        <CodeBlock
          className="h-auto"
          data={[
            {
              language: "typescript",
              filename: "send-bulk-template.ts",
              code: sendBulkTemplateCode,
            },
          ]}
          defaultValue="typescript"
        >
          <CodeBlockHeader>
            <CodeBlockFiles>
              {(item) => (
                <CodeBlockFilename key={item.language} value={item.language}>
                  {item.filename}
                </CodeBlockFilename>
              )}
            </CodeBlockFiles>
            <CodeBlockCopyButton />
          </CodeBlockHeader>
          <CodeBlockBody>
            {(item) => (
              <CodeBlockItem
                key={item.language}
                lineNumbers={false}
                value={item.language}
              >
                <CodeBlockContent language={item.language}>
                  {item.code}
                </CodeBlockContent>
              </CodeBlockItem>
            )}
          </CodeBlockBody>
        </CodeBlock>
      </section>

      {/* Response */}
      <section className="mb-12">
        <SectionHeading
          id="response"
          title="Response"
          markdown={SECTION_MD.response}
          className="mb-4"
        />
        <p className="mb-4 text-muted-foreground">
          All SDK methods return a result object with type-safe success/error
          handling.
        </p>
        <CodeBlock
          className="h-auto"
          data={[
            {
              language: "typescript",
              filename: "response.ts",
              code: responseCode,
            },
          ]}
          defaultValue="typescript"
        >
          <CodeBlockHeader>
            <CodeBlockFiles>
              {(item) => (
                <CodeBlockFilename key={item.language} value={item.language}>
                  {item.filename}
                </CodeBlockFilename>
              )}
            </CodeBlockFiles>
            <CodeBlockCopyButton />
          </CodeBlockHeader>
          <CodeBlockBody>
            {(item) => (
              <CodeBlockItem
                key={item.language}
                lineNumbers={false}
                value={item.language}
              >
                <CodeBlockContent language={item.language}>
                  {item.code}
                </CodeBlockContent>
              </CodeBlockItem>
            )}
          </CodeBlockBody>
        </CodeBlock>
      </section>

      {/* Error Handling */}
      <section className="mb-12">
        <SectionHeading
          id="error-handling"
          title="Error Handling"
          markdown={SECTION_MD.errorHandling}
          className="mb-4"
        />
        <p className="mb-4 text-muted-foreground">
          The SDK uses a type-safe result pattern instead of throwing errors.
        </p>
        <CodeBlock
          className="h-auto"
          data={[
            {
              language: "typescript",
              filename: "error-handling.ts",
              code: errorHandlingCode,
            },
          ]}
          defaultValue="typescript"
        >
          <CodeBlockHeader>
            <CodeBlockFiles>
              {(item) => (
                <CodeBlockFilename key={item.language} value={item.language}>
                  {item.filename}
                </CodeBlockFilename>
              )}
            </CodeBlockFiles>
            <CodeBlockCopyButton />
          </CodeBlockHeader>
          <CodeBlockBody>
            {(item) => (
              <CodeBlockItem
                key={item.language}
                lineNumbers={false}
                value={item.language}
              >
                <CodeBlockContent language={item.language}>
                  {item.code}
                </CodeBlockContent>
              </CodeBlockItem>
            )}
          </CodeBlockBody>
        </CodeBlock>
      </section>

      {/* TypeScript Support */}
      <section className="mb-12">
        <SectionHeading
          id="typescript-support"
          title="TypeScript Support"
          markdown={SECTION_MD.typescript}
          className="mb-4"
        />
        <p className="mb-4 text-muted-foreground">
          The SDK is written in TypeScript and provides full type safety out of
          the box.
        </p>
        <CodeBlock
          className="h-auto"
          data={[
            {
              language: "typescript",
              filename: "typed-usage.ts",
              code: typescriptCode,
            },
          ]}
          defaultValue="typescript"
        >
          <CodeBlockHeader>
            <CodeBlockFiles>
              {(item) => (
                <CodeBlockFilename key={item.language} value={item.language}>
                  {item.filename}
                </CodeBlockFilename>
              )}
            </CodeBlockFiles>
            <CodeBlockCopyButton />
          </CodeBlockHeader>
          <CodeBlockBody>
            {(item) => (
              <CodeBlockItem
                key={item.language}
                lineNumbers={false}
                value={item.language}
              >
                <CodeBlockContent language={item.language}>
                  {item.code}
                </CodeBlockContent>
              </CodeBlockItem>
            )}
          </CodeBlockBody>
        </CodeBlock>
      </section>

      {/* Next Steps */}
      <section className="mb-12">
        <h2 className="mb-6 font-bold text-2xl">Next Steps</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">View on npm</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Check out the package on npm for the latest version and
                changelog.
              </p>
              <Button asChild variant="outline">
                <a
                  href="https://www.npmjs.com/package/@wraps.dev/email"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  View Package
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">View on GitHub</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Explore the source code, report issues, or contribute.
              </p>
              <Button asChild variant="outline">
                <a
                  href="https://github.com/wraps-team/wraps-js"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  View Source
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </DocsLayout>
  );
}
