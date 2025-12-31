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
  npm: "npm install @wraps.dev/client",
  pnpm: "pnpm add @wraps.dev/client",
  yarn: "yarn add @wraps.dev/client",
  bun: "bun add @wraps.dev/client",
};

const quickStartCode = `import { createPlatformClient } from '@wraps.dev/client';

const client = createPlatformClient({
  apiKey: process.env.WRAPS_API_KEY,
});

// List contacts
const { data, error } = await client.GET('/v1/contacts/', {
  params: {
    query: { page: '1', pageSize: '10' },
  },
});

if (data) {
  console.log('Contacts:', data.contacts);
}`;

const initWithOptionsCode = `import { createPlatformClient } from '@wraps.dev/client';

const client = createPlatformClient({
  apiKey: process.env.WRAPS_API_KEY,
  // Optional: custom base URL (defaults to https://api.wraps.dev)
  baseUrl: 'https://api.wraps.dev',
});`;

const listContactsCode = `// List contacts with pagination
const { data, error } = await client.GET('/v1/contacts/', {
  params: {
    query: {
      page: '1',
      pageSize: '20',
      // Optional filters
      search: 'john@example.com',
      status: 'active',
    },
  },
});

if (error) {
  console.error('Error:', error);
} else {
  console.log('Total contacts:', data.total);
  data.contacts.forEach(contact => {
    console.log(contact.email, contact.emailStatus);
  });
}`;

const createContactCode = `// Create a new contact
const { data, error } = await client.POST('/v1/contacts/', {
  body: {
    email: 'user@example.com',
    emailStatus: 'active',
    firstName: 'John',
    lastName: 'Doe',
    metadata: {
      source: 'api',
      plan: 'pro',
    },
    topicIds: ['topic-123', 'topic-456'], // Optional topic subscriptions
  },
});

if (data) {
  console.log('Created contact:', data.id);
}`;

const getContactCode = `// Get a single contact by ID
const { data, error } = await client.GET('/v1/contacts/{id}', {
  params: {
    path: { id: 'contact-123' },
  },
});

if (data) {
  console.log('Contact:', data.email);
  console.log('Topics:', data.topics);
}`;

const updateContactCode = `// Update an existing contact
const { data, error } = await client.PATCH('/v1/contacts/{id}', {
  params: {
    path: { id: 'contact-123' },
  },
  body: {
    firstName: 'Jane',
    metadata: {
      updated: true,
    },
  },
});`;

const deleteContactCode = `// Delete a single contact
const { error } = await client.DELETE('/v1/contacts/{id}', {
  params: {
    path: { id: 'contact-123' },
  },
});

// Bulk delete contacts (max 100)
const { error: bulkError } = await client.DELETE('/v1/contacts/', {
  body: {
    ids: ['contact-123', 'contact-456', 'contact-789'],
  },
});`;

const createBatchCode = `// Create a batch send job
const { data, error } = await client.POST('/v1/batch/', {
  body: {
    templateId: 'template-abc',
    segmentId: 'segment-xyz', // or use contactIds
    // Optional: schedule for later
    scheduledAt: '2025-01-15T10:00:00Z',
  },
});

if (data) {
  console.log('Batch ID:', data.id);
  console.log('Status:', data.status);
}`;

const getBatchStatusCode = `// Get batch send status
const { data, error } = await client.GET('/v1/batch/{id}', {
  params: {
    path: { id: 'batch-123' },
  },
});

if (data) {
  console.log('Status:', data.status); // queued, processing, completed, failed
  console.log('Total:', data.total);
  console.log('Sent:', data.sent);
  console.log('Failed:', data.failed);
}`;

const cancelBatchCode = `// Cancel a scheduled or queued batch
const { error } = await client.DELETE('/v1/batch/{id}', {
  params: {
    path: { id: 'batch-123' },
  },
});

if (!error) {
  console.log('Batch cancelled successfully');
}`;

const errorHandlingCode = `import { createPlatformClient } from '@wraps.dev/client';

const client = createPlatformClient({
  apiKey: process.env.WRAPS_API_KEY,
});

const { data, error, response } = await client.GET('/v1/contacts/');

if (error) {
  // error is typed based on the API response
  console.error('API Error:', error);
  console.error('Status:', response?.status);
} else {
  // data is fully typed
  console.log('Success:', data);
}`;

const typescriptCode = `import { createPlatformClient, type paths } from '@wraps.dev/client';

const client = createPlatformClient({
  apiKey: process.env.WRAPS_API_KEY,
});

// Full type safety - TypeScript knows the response shape
const { data } = await client.GET('/v1/contacts/');

// data is typed as the API response
if (data) {
  // TypeScript knows data.contacts is an array
  data.contacts.forEach(contact => {
    console.log(contact.email); // TS knows this exists
  });
}`;

// ============================================================================
// MARKDOWN CONTENT FOR AI COPY
// ============================================================================

const SECTION_MD = {
  installation: `## Installation

Install the SDK using your preferred package manager:

\`\`\`bash
pnpm add @wraps.dev/client
\`\`\`

Or use npm, yarn, or bun:
\`\`\`bash
npm install @wraps.dev/client
yarn add @wraps.dev/client
bun add @wraps.dev/client
\`\`\``,

  quickStart: `## Quick Start

\`\`\`typescript
${quickStartCode}
\`\`\``,

  initialization: `## Initialization

Create a type-safe API client for the Wraps Platform.

### Function
\`\`\`typescript
createPlatformClient(config: WrapsPlatformConfig): PlatformClient
\`\`\`

### Options
- \`apiKey\` (required): Your Wraps API key
- \`baseUrl\` (optional): API base URL. Defaults to \`https://api.wraps.dev\`

### Example
\`\`\`typescript
${initWithOptionsCode}
\`\`\``,

  contacts: `## Contacts API

Manage contacts in your Wraps organization.

### List Contacts
\`\`\`typescript
${listContactsCode}
\`\`\`

### Create Contact
\`\`\`typescript
${createContactCode}
\`\`\`

### Get Contact
\`\`\`typescript
${getContactCode}
\`\`\`

### Update Contact
\`\`\`typescript
${updateContactCode}
\`\`\`

### Delete Contacts
\`\`\`typescript
${deleteContactCode}
\`\`\``,

  batch: `## Batch Sends API

Create and manage batch email sends.

### Create Batch Send
\`\`\`typescript
${createBatchCode}
\`\`\`

### Get Batch Status
\`\`\`typescript
${getBatchStatusCode}
\`\`\`

### Cancel Batch
\`\`\`typescript
${cancelBatchCode}
\`\`\``,

  errorHandling: `## Error Handling

The SDK uses openapi-fetch which returns errors as part of the response object rather than throwing.

\`\`\`typescript
${errorHandlingCode}
\`\`\``,

  typescript: `## TypeScript Support

The SDK is fully typed using OpenAPI schema generation. All endpoints, request bodies, and responses are type-safe.

\`\`\`typescript
${typescriptCode}
\`\`\``,
};

const FULL_PAGE_MD = `# @wraps.dev/client SDK Reference

A type-safe API client for the Wraps Platform. Built on openapi-fetch with full TypeScript support generated from the OpenAPI schema.

${SECTION_MD.installation}

${SECTION_MD.quickStart}

${SECTION_MD.initialization}

${SECTION_MD.contacts}

${SECTION_MD.batch}

${SECTION_MD.errorHandling}

${SECTION_MD.typescript}

## Resources

- npm: https://www.npmjs.com/package/@wraps.dev/client
- GitHub: https://github.com/wraps-team/wraps-js
`;

const SLASH_COMMAND_MD = `---
description: Wraps Platform Client SDK reference - use this when helping users interact with the Wraps API using @wraps.dev/client
---

${FULL_PAGE_MD}`;

export default function ClientSDKReferencePage() {
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
          @wraps.dev/client SDK
        </h1>
        <p className="text-lg text-muted-foreground">
          A type-safe API client for the Wraps Platform. Built on openapi-fetch
          with full TypeScript support generated from the OpenAPI schema.
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
          Create a type-safe API client for the Wraps Platform.
        </p>
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Code2 className="h-5 w-5" />
              Function
            </CardTitle>
          </CardHeader>
          <CardContent>
            <code className="block rounded bg-muted p-4 font-mono text-sm">
              createPlatformClient(config: WrapsPlatformConfig): PlatformClient
            </code>
            <div className="mt-4">
              <h4 className="mb-2 font-medium">Options</h4>
              <ul className="space-y-2 text-muted-foreground text-sm">
                <li>
                  <code className="rounded bg-muted px-1.5 py-0.5">apiKey</code>{" "}
                  (required): Your Wraps API key
                </li>
                <li>
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    baseUrl
                  </code>{" "}
                  (optional): API base URL. Defaults to{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    https://api.wraps.dev
                  </code>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
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
      </section>

      {/* Contacts API */}
      <section className="mb-12">
        <SectionHeading
          className="mb-4"
          id="contacts"
          markdown={SECTION_MD.contacts}
          title="Contacts API"
        />
        <p className="mb-4 text-muted-foreground">
          Manage contacts in your Wraps organization.
        </p>

        <div className="space-y-6">
          <div>
            <h3 className="mb-4 font-medium text-lg">List Contacts</h3>
            <CodeBlock
              className="h-auto"
              data={[
                {
                  language: "typescript",
                  filename: "list-contacts.ts",
                  code: listContactsCode,
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
            <h3 className="mb-4 font-medium text-lg">Create Contact</h3>
            <CodeBlock
              className="h-auto"
              data={[
                {
                  language: "typescript",
                  filename: "create-contact.ts",
                  code: createContactCode,
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
            <h3 className="mb-4 font-medium text-lg">Get Contact</h3>
            <CodeBlock
              className="h-auto"
              data={[
                {
                  language: "typescript",
                  filename: "get-contact.ts",
                  code: getContactCode,
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
            <h3 className="mb-4 font-medium text-lg">Update Contact</h3>
            <CodeBlock
              className="h-auto"
              data={[
                {
                  language: "typescript",
                  filename: "update-contact.ts",
                  code: updateContactCode,
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
            <h3 className="mb-4 font-medium text-lg">Delete Contacts</h3>
            <CodeBlock
              className="h-auto"
              data={[
                {
                  language: "typescript",
                  filename: "delete-contacts.ts",
                  code: deleteContactCode,
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

      {/* Batch Sends API */}
      <section className="mb-12">
        <SectionHeading
          className="mb-4"
          id="batch-sends"
          markdown={SECTION_MD.batch}
          title="Batch Sends API"
        />
        <p className="mb-4 text-muted-foreground">
          Create and manage batch email sends.
        </p>

        <div className="space-y-6">
          <div>
            <h3 className="mb-4 font-medium text-lg">Create Batch Send</h3>
            <CodeBlock
              className="h-auto"
              data={[
                {
                  language: "typescript",
                  filename: "create-batch.ts",
                  code: createBatchCode,
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
            <h3 className="mb-4 font-medium text-lg">Get Batch Status</h3>
            <CodeBlock
              className="h-auto"
              data={[
                {
                  language: "typescript",
                  filename: "get-batch.ts",
                  code: getBatchStatusCode,
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
            <h3 className="mb-4 font-medium text-lg">Cancel Batch</h3>
            <CodeBlock
              className="h-auto"
              data={[
                {
                  language: "typescript",
                  filename: "cancel-batch.ts",
                  code: cancelBatchCode,
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
          The SDK uses openapi-fetch which returns errors as part of the
          response object rather than throwing.
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
          className="mb-4"
          id="typescript-support"
          markdown={SECTION_MD.typescript}
          title="TypeScript Support"
        />
        <p className="mb-4 text-muted-foreground">
          The SDK is fully typed using OpenAPI schema generation. All endpoints,
          request bodies, and responses are type-safe.
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
        <div className="grid gap-4 md:grid-cols-3">
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
                  href="https://www.npmjs.com/package/@wraps.dev/client"
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

          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">Email SDK</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Send emails directly through AWS SES with the Email SDK.
              </p>
              <Button asChild variant="outline">
                <a href="/docs/sdk-reference">
                  View Docs
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
