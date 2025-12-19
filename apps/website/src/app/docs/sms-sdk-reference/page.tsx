"use client";

import { ArrowRight, Code2 } from "lucide-react";
import { CopyForAIButton } from "@/components/docs/copy-for-ai-button";
import { SectionHeading } from "@/components/docs/section-heading";
import { DocsLayout } from "@/components/docs-layout";
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
  npm: "npm install @wraps.dev/sms",
  pnpm: "pnpm add @wraps.dev/sms",
  yarn: "yarn add @wraps.dev/sms",
  bun: "bun add @wraps.dev/sms",
};

const quickStartCode = `import { WrapsSMS } from '@wraps.dev/sms';

const sms = new WrapsSMS();

const result = await sms.send({
  to: '+14155551234',
  message: 'Your verification code is 123456',
});

console.log(result.messageId);`;

const initWithOptionsCode = `const sms = new WrapsSMS({
  region: 'us-west-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});`;

const oidcAuthCode = `// OIDC authentication (Vercel, EKS, GitHub Actions)
const sms = new WrapsSMS({
  roleArn: process.env.AWS_ROLE_ARN,
});`;

const basicSendCode = `const result = await sms.send({
  to: '+14155551234',           // Required: E.164 format
  message: 'Hello!',            // Required: Message body
  messageType: 'TRANSACTIONAL', // Optional: TRANSACTIONAL or PROMOTIONAL
  from: '+18005551234',         // Optional: Override sender
  context: { userId: '123' },   // Optional: Custom metadata
  dryRun: true,                 // Optional: Validate without sending
});

// Result
console.log(result.messageId); // 'msg-abc123'
console.log(result.status);    // 'QUEUED'
console.log(result.segments);  // 1`;

const batchSendCode = `const result = await sms.sendBatch({
  messages: [
    { to: '+14155551234', message: 'Your order shipped!' },
    { to: '+14155555678', message: 'Your order shipped!' },
  ],
  messageType: 'TRANSACTIONAL',
});

// Result
console.log(\`Sent: \${result.queued}, Failed: \${result.failed}\`);

// Check individual results
result.results.forEach((r) => {
  if (r.status === 'QUEUED') {
    console.log(\`Sent to \${r.to}: \${r.messageId}\`);
  } else {
    console.log(\`Failed to send to \${r.to}: \${r.error}\`);
  }
});`;

const listNumbersCode = `const numbers = await sms.numbers.list();

// Result
numbers.forEach((n) => {
  console.log(n.phoneNumber);      // '+18005551234'
  console.log(n.numberType);       // 'TOLL_FREE'
  console.log(n.messageType);      // 'TRANSACTIONAL'
  console.log(n.twoWayEnabled);    // false
});`;

const optOutCheckCode = `// Check if a number has opted out
const isOptedOut = await sms.optOuts.check('+14155551234');

if (isOptedOut) {
  console.log('User has opted out');
}`;

const optOutManageCode = `// Add a phone number to the opt-out list
await sms.optOuts.add('+14155551234');

// Remove a phone number from the opt-out list
await sms.optOuts.remove('+14155551234');

// List all opted-out numbers
const optedOut = await sms.optOuts.list();
optedOut.forEach((entry) => {
  console.log(\`\${entry.phoneNumber} opted out at \${entry.optedOutAt}\`);
});`;

const errorHandlingCode = `import { WrapsSMS, SMSError, ValidationError, OptedOutError } from '@wraps.dev/sms';

try {
  await sms.send({ to: '+14155551234', message: 'Hello!' });
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Invalid input:', error.field);
  } else if (error instanceof OptedOutError) {
    console.log('User opted out:', error.phoneNumber);
  } else if (error instanceof SMSError) {
    console.log('AWS error:', error.code, error.message);
    if (error.retryable) {
      // Safe to retry
    }
  }
}`;

const utilitiesCode = `import { calculateSegments, validatePhoneNumber } from '@wraps.dev/sms';

// Calculate SMS segments
calculateSegments('Hello!');           // 1
calculateSegments('a'.repeat(200));    // 2
calculateSegments('Hello emojis!');    // 1 (Unicode)

// Validate phone numbers
validatePhoneNumber('+14155551234', 'to'); // OK
validatePhoneNumber('4155551234', 'to');   // Throws ValidationError`;

const typescriptCode = `import { WrapsSMS, SendOptions, SendResult } from '@wraps.dev/sms';

const sms = new WrapsSMS();

// TypeScript will validate all parameters
const options: SendOptions = {
  to: '+14155551234',
  message: 'Hello!',
  messageType: 'TRANSACTIONAL',
};

const result: SendResult = await sms.send(options);`;

// ============================================================================
// MARKDOWN CONTENT FOR AI COPY
// ============================================================================

const SECTION_MD = {
  installation: `## Installation

Install the SDK using your preferred package manager:

\`\`\`bash
pnpm add @wraps.dev/sms
\`\`\`

Or use npm, yarn, or bun:
\`\`\`bash
npm install @wraps.dev/sms
yarn add @wraps.dev/sms
bun add @wraps.dev/sms
\`\`\``,

  quickStart: `## Quick Start

\`\`\`typescript
${quickStartCode}
\`\`\``,

  initialization: `## Initialization

Create a new WrapsSMS client. The SDK automatically detects AWS credentials from your environment (OIDC, IAM roles, or environment variables).

### Constructor
\`\`\`typescript
new WrapsSMS(config?: WrapsSMSConfig)
\`\`\`

### Options
- \`region\` (optional): AWS region where your infrastructure is deployed. Auto-detected if not provided.
- \`credentials\` (optional): AWS credentials object. Auto-detected if not provided.
- \`roleArn\` (optional): IAM role ARN for OIDC authentication (Vercel, EKS, GitHub Actions).

### Example with Options
\`\`\`typescript
${initWithOptionsCode}
\`\`\`

### OIDC Authentication
\`\`\`typescript
${oidcAuthCode}
\`\`\``,

  send: `## Send SMS

Send a single SMS message.

### Method
\`\`\`typescript
sms.send(options: SendOptions): Promise<SendResult>
\`\`\`

### Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| \`to\` | string | Recipient phone number (E.164 format, e.g., +14155551234) |
| \`message\` | string | Message body |
| \`messageType\` | 'TRANSACTIONAL' \\| 'PROMOTIONAL' | Message type (optional, defaults to TRANSACTIONAL) |
| \`from\` | string | Override sender phone number (optional) |
| \`context\` | Record<string, string> | Custom metadata (optional) |
| \`dryRun\` | boolean | Validate without sending (optional) |

### Response
| Field | Type | Description |
|-------|------|-------------|
| \`messageId\` | string | Unique message identifier |
| \`status\` | 'QUEUED' | Message status |
| \`to\` | string | Recipient phone number |
| \`from\` | string | Sender phone number |
| \`segments\` | number | Number of SMS segments used |

### Example
\`\`\`typescript
${basicSendCode}
\`\`\``,

  sendBatch: `## Send Batch

Send SMS messages to multiple recipients.

### Method
\`\`\`typescript
sms.sendBatch(options: BatchOptions): Promise<BatchResult>
\`\`\`

### Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| \`messages\` | array | Array of messages with \`to\` and \`message\` fields |
| \`messageType\` | 'TRANSACTIONAL' \\| 'PROMOTIONAL' | Message type for all messages (optional) |
| \`from\` | string | Override sender for all messages (optional) |

### Response
| Field | Type | Description |
|-------|------|-------------|
| \`batchId\` | string | Unique batch identifier |
| \`total\` | number | Total messages in batch |
| \`queued\` | number | Successfully queued messages |
| \`failed\` | number | Failed messages |
| \`results\` | array | Individual message results |

### Example
\`\`\`typescript
${batchSendCode}
\`\`\``,

  numbers: `## Phone Numbers

List and manage phone numbers in your account.

### List Numbers
\`\`\`typescript
const numbers = await sms.numbers.list();
\`\`\`

### Get Number
\`\`\`typescript
const number = await sms.numbers.get('pn-123');
\`\`\`

### Response Fields
| Field | Type | Description |
|-------|------|-------------|
| \`phoneNumberId\` | string | Unique phone number identifier |
| \`phoneNumber\` | string | Phone number in E.164 format |
| \`numberType\` | string | Number type (TOLL_FREE, etc.) |
| \`messageType\` | string | Default message type |
| \`twoWayEnabled\` | boolean | Whether two-way messaging is enabled |

### Example
\`\`\`typescript
${listNumbersCode}
\`\`\``,

  optOuts: `## Opt-Out Management

Manage opt-out lists for compliance with messaging regulations.

### Check Opt-Out Status
\`\`\`typescript
${optOutCheckCode}
\`\`\`

### Manage Opt-Outs
\`\`\`typescript
${optOutManageCode}
\`\`\``,

  errorHandling: `## Error Handling

The SDK throws typed errors for different failure scenarios.

### Error Types
| Error | Description |
|-------|-------------|
| \`ValidationError\` | Invalid input parameters (includes \`field\` property) |
| \`OptedOutError\` | Recipient has opted out (includes \`phoneNumber\` property) |
| \`SMSError\` | AWS service error (includes \`code\`, \`retryable\` properties) |
| \`RateLimitError\` | Rate limit exceeded |

### Example
\`\`\`typescript
${errorHandlingCode}
\`\`\``,

  utilities: `## Utilities

Helper functions for common SMS operations.

### Calculate Segments
Calculate how many SMS segments a message will use.

### Validate Phone Numbers
Validate phone numbers are in E.164 format.

\`\`\`typescript
${utilitiesCode}
\`\`\``,

  messageTypes: `## Message Types

| Type | Use Case | Best Practices |
|------|----------|----------------|
| \`TRANSACTIONAL\` | OTP, alerts, notifications | Time-sensitive, user-initiated |
| \`PROMOTIONAL\` | Marketing, promotions | Requires explicit consent |`,

  typescript: `## TypeScript Support

The SDK is written in TypeScript and provides full type safety out of the box.

\`\`\`typescript
${typescriptCode}
\`\`\``,

  pricing: `## Pricing

AWS End User Messaging charges per message segment:

| Component | Cost (US) |
|-----------|-----------|
| Toll-free number | $2/month |
| Outbound SMS | ~$0.00849/segment |
| Carrier fees | ~$0.003-0.006/segment |`,
};

const FULL_PAGE_MD = `# @wraps.dev/sms SDK Reference

A TypeScript-first SDK for sending SMS through your Wraps-deployed AWS End User Messaging infrastructure. Simple, type-safe, and intuitive API.

${SECTION_MD.installation}

${SECTION_MD.quickStart}

${SECTION_MD.initialization}

${SECTION_MD.send}

${SECTION_MD.sendBatch}

${SECTION_MD.numbers}

${SECTION_MD.optOuts}

${SECTION_MD.errorHandling}

${SECTION_MD.utilities}

${SECTION_MD.messageTypes}

${SECTION_MD.typescript}

${SECTION_MD.pricing}

## Resources

- npm: https://www.npmjs.com/package/@wraps.dev/sms
- GitHub: https://github.com/wraps-team/wraps-js
`;

const SLASH_COMMAND_MD = `---
description: Wraps SMS SDK reference - use this when helping users send SMS with @wraps.dev/sms
---

${FULL_PAGE_MD}`;

export default function SMSSDKReferencePage() {
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
          @wraps.dev/sms SDK
        </h1>
        <p className="text-lg text-muted-foreground">
          A TypeScript-first SDK for sending SMS through your Wraps-deployed AWS
          End User Messaging infrastructure. Simple, type-safe, and intuitive
          API.
        </p>
      </div>

      {/* Installation */}
      <section className="mb-12">
        <SectionHeading
          className="mb-4"
          id="installation"
          markdown={SECTION_MD.installation}
          title="Installation"
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
          className="mb-4"
          id="quick-start"
          markdown={SECTION_MD.quickStart}
          title="Quick Start"
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
          className="mb-4"
          id="initialization"
          markdown={SECTION_MD.initialization}
          title="Initialization"
        />
        <p className="mb-4 text-muted-foreground">
          Create a new WrapsSMS client. The SDK automatically detects AWS
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
              new WrapsSMS(config?: WrapsSMSConfig)
            </code>
            <div className="mt-4">
              <h4 className="mb-2 font-medium">Options</h4>
              <ul className="space-y-2 text-muted-foreground text-sm">
                <li>
                  <code className="rounded bg-muted px-1.5 py-0.5">region</code>{" "}
                  (optional): AWS region where your infrastructure is deployed.
                  Auto-detected if not provided.
                </li>
                <li>
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    credentials
                  </code>{" "}
                  (optional): AWS credentials object. Auto-detected if not
                  provided.
                </li>
                <li>
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    roleArn
                  </code>{" "}
                  (optional): IAM role ARN for OIDC authentication (Vercel, EKS,
                  GitHub Actions).
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <div>
            <p className="mb-2 font-medium text-sm">Example with Options</p>
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
                    <CodeBlockFilename
                      key={item.language}
                      value={item.language}
                    >
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
            <p className="mb-2 font-medium text-sm">OIDC Authentication</p>
            <CodeBlock
              className="h-auto"
              data={[
                {
                  language: "typescript",
                  filename: "oidc-auth.ts",
                  code: oidcAuthCode,
                },
              ]}
              defaultValue="typescript"
            >
              <CodeBlockHeader>
                <CodeBlockFiles>
                  {(item) => (
                    <CodeBlockFilename
                      key={item.language}
                      value={item.language}
                    >
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

      {/* Send SMS */}
      <section className="mb-12">
        <SectionHeading
          className="mb-4"
          id="send"
          markdown={SECTION_MD.send}
          title="Send SMS"
        />
        <p className="mb-4 text-muted-foreground">
          Send a single SMS message through your Wraps infrastructure.
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
              {"sms.send(options: SendOptions): Promise<SendResult>"}
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
                    <code className="rounded bg-muted px-1.5 py-0.5">to</code>
                  </td>
                  <td className="py-2">string</td>
                  <td className="py-2">
                    Recipient phone number (E.164 format)
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      message
                    </code>
                  </td>
                  <td className="py-2">string</td>
                  <td className="py-2">Message body</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      messageType
                    </code>
                  </td>
                  <td className="py-2">string</td>
                  <td className="py-2">
                    TRANSACTIONAL or PROMOTIONAL (optional)
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">from</code>
                  </td>
                  <td className="py-2">string</td>
                  <td className="py-2">
                    Override sender phone number (optional)
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      context
                    </code>
                  </td>
                  <td className="py-2">{"Record<string, string>"}</td>
                  <td className="py-2">Custom metadata (optional)</td>
                </tr>
                <tr>
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      dryRun
                    </code>
                  </td>
                  <td className="py-2">boolean</td>
                  <td className="py-2">Validate without sending (optional)</td>
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
              filename: "send-sms.ts",
              code: basicSendCode,
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

      {/* Send Batch */}
      <section className="mb-12">
        <SectionHeading
          className="mb-4"
          id="send-batch"
          markdown={SECTION_MD.sendBatch}
          title="Send Batch"
        />
        <p className="mb-4 text-muted-foreground">
          Send SMS messages to multiple recipients efficiently.
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
              {"sms.sendBatch(options: BatchOptions): Promise<BatchResult>"}
            </code>
          </CardContent>
        </Card>

        <h3 className="mb-4 font-medium text-lg">Example</h3>
        <CodeBlock
          className="h-auto"
          data={[
            {
              language: "typescript",
              filename: "send-batch.ts",
              code: batchSendCode,
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

      {/* Phone Numbers */}
      <section className="mb-12">
        <SectionHeading
          className="mb-4"
          id="phone-numbers"
          markdown={SECTION_MD.numbers}
          title="Phone Numbers"
        />
        <p className="mb-4 text-muted-foreground">
          List and manage phone numbers in your AWS account.
        </p>
        <CodeBlock
          className="h-auto"
          data={[
            {
              language: "typescript",
              filename: "list-numbers.ts",
              code: listNumbersCode,
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

      {/* Opt-Out Management */}
      <section className="mb-12">
        <SectionHeading
          className="mb-4"
          id="opt-outs"
          markdown={SECTION_MD.optOuts}
          title="Opt-Out Management"
        />
        <p className="mb-4 text-muted-foreground">
          Manage opt-out lists for compliance with messaging regulations.
        </p>
        <div className="space-y-4">
          <div>
            <p className="mb-2 font-medium text-sm">Check Opt-Out Status</p>
            <CodeBlock
              className="h-auto"
              data={[
                {
                  language: "typescript",
                  filename: "check-optout.ts",
                  code: optOutCheckCode,
                },
              ]}
              defaultValue="typescript"
            >
              <CodeBlockHeader>
                <CodeBlockFiles>
                  {(item) => (
                    <CodeBlockFilename
                      key={item.language}
                      value={item.language}
                    >
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
            <p className="mb-2 font-medium text-sm">Manage Opt-Outs</p>
            <CodeBlock
              className="h-auto"
              data={[
                {
                  language: "typescript",
                  filename: "manage-optouts.ts",
                  code: optOutManageCode,
                },
              ]}
              defaultValue="typescript"
            >
              <CodeBlockHeader>
                <CodeBlockFiles>
                  {(item) => (
                    <CodeBlockFilename
                      key={item.language}
                      value={item.language}
                    >
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

      {/* Error Handling */}
      <section className="mb-12">
        <SectionHeading
          className="mb-4"
          id="error-handling"
          markdown={SECTION_MD.errorHandling}
          title="Error Handling"
        />
        <p className="mb-4 text-muted-foreground">
          The SDK throws typed errors for different failure scenarios.
        </p>
        <Card className="mb-4">
          <CardContent className="p-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-2 text-left">Error</th>
                  <th className="pb-2 text-left">Description</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b">
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      ValidationError
                    </code>
                  </td>
                  <td className="py-2">
                    Invalid input parameters (includes <code>field</code>{" "}
                    property)
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      OptedOutError
                    </code>
                  </td>
                  <td className="py-2">
                    Recipient has opted out (includes <code>phoneNumber</code>{" "}
                    property)
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      SMSError
                    </code>
                  </td>
                  <td className="py-2">
                    AWS service error (includes <code>code</code>,{" "}
                    <code>retryable</code> properties)
                  </td>
                </tr>
                <tr>
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      RateLimitError
                    </code>
                  </td>
                  <td className="py-2">Rate limit exceeded</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
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

      {/* Utilities */}
      <section className="mb-12">
        <SectionHeading
          className="mb-4"
          id="utilities"
          markdown={SECTION_MD.utilities}
          title="Utilities"
        />
        <p className="mb-4 text-muted-foreground">
          Helper functions for common SMS operations.
        </p>
        <CodeBlock
          className="h-auto"
          data={[
            {
              language: "typescript",
              filename: "utilities.ts",
              code: utilitiesCode,
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

      {/* Message Types */}
      <section className="mb-12">
        <SectionHeading
          className="mb-4"
          id="message-types"
          markdown={SECTION_MD.messageTypes}
          title="Message Types"
        />
        <Card>
          <CardContent className="p-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-2 text-left">Type</th>
                  <th className="pb-2 text-left">Use Case</th>
                  <th className="pb-2 text-left">Best Practices</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b">
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      TRANSACTIONAL
                    </code>
                  </td>
                  <td className="py-2">OTP, alerts, notifications</td>
                  <td className="py-2">Time-sensitive, user-initiated</td>
                </tr>
                <tr>
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      PROMOTIONAL
                    </code>
                  </td>
                  <td className="py-2">Marketing, promotions</td>
                  <td className="py-2">Requires explicit consent</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      {/* TypeScript Support */}
      <section className="mb-12">
        <SectionHeading
          className="mb-4"
          id="typescript-support"
          markdown={SECTION_MD.typescript}
          title="TypeScript Support"
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

      {/* Pricing */}
      <section className="mb-12">
        <SectionHeading
          className="mb-4"
          id="pricing"
          markdown={SECTION_MD.pricing}
          title="Pricing"
        />
        <p className="mb-4 text-muted-foreground">
          AWS End User Messaging charges per message segment:
        </p>
        <Card>
          <CardContent className="p-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-2 text-left">Component</th>
                  <th className="pb-2 text-left">Cost (US)</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b">
                  <td className="py-2">Toll-free number</td>
                  <td className="py-2">$2/month</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Outbound SMS</td>
                  <td className="py-2">~$0.00849/segment</td>
                </tr>
                <tr>
                  <td className="py-2">Carrier fees</td>
                  <td className="py-2">~$0.003-0.006/segment</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
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
                  href="https://www.npmjs.com/package/@wraps.dev/sms"
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
