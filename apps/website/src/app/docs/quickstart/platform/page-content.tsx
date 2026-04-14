"use client";

import { Badge } from "@wraps/ui/components/ui/badge";
import { Button } from "@wraps/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@wraps/ui/components/ui/card";
import { ArrowRight, CheckCircle2, Target } from "lucide-react";
import Link from "next/link";
import { DocsLayout } from "@/components/docs-layout";
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

const setupClientCode = `import { createPlatformClient } from '@wraps.dev/client';

// Initialize the client with your API key
const client = createPlatformClient({
  apiKey: process.env.WRAPS_API_KEY,
});`;

const createContactCode = `// Create a new contact
const { data, error } = await client.POST('/v1/contacts/', {
  body: {
    email: 'user@example.com',
    emailStatus: 'active',
    firstName: 'John',
    lastName: 'Doe',
  },
});

if (data) {
  console.log('Contact created:', data.id);
} else {
  console.error('Error:', error);
}`;

const listContactsCode = `// List contacts with pagination
const { data, error } = await client.GET('/v1/contacts/', {
  params: {
    query: { page: '1', pageSize: '10' },
  },
});

if (data) {
  console.log('Total contacts:', data.total);
  data.contacts.forEach(contact => {
    console.log(contact.email, contact.emailStatus);
  });
}`;

const batchSendCode = `// Create a batch send job
const { data, error } = await client.POST('/v1/batch/', {
  body: {
    templateId: 'your-template-id',
    segmentId: 'your-segment-id',
  },
});

if (data) {
  console.log('Batch created:', data.id);
  console.log('Status:', data.status);
}`;

export default function PlatformQuickstartPageContent() {
  return (
    <DocsLayout>
      {/* Page Header */}
      <div className="mb-12">
        <Badge className="mb-4" variant="outline">
          Platform Quickstart
        </Badge>
        <h1 className="mb-4 font-bold text-4xl tracking-tight">
          Get Started with the Platform SDK
        </h1>
        <p className="text-lg text-muted-foreground">
          Use the type-safe Platform SDK to manage contacts, send batch emails,
          and interact with the Wraps API programmatically.
        </p>
      </div>

      {/* Outcome Preview */}
      <div className="mb-8 rounded-lg border bg-muted/50 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <p className="font-medium text-sm">What you'll build</p>
        </div>
        <ul className="mb-3 list-disc space-y-1 pl-5 text-muted-foreground text-sm">
          <li>
            A type-safe Platform SDK client connected to your organization
          </li>
          <li>Contact management with create and list operations</li>
          <li>Batch email sending to segments of contacts</li>
        </ul>
        <p className="text-muted-foreground text-xs">Time: ~3 minutes</p>
      </div>

      {/* Prerequisites */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Prerequisites
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-muted-foreground">
            Before you begin, make sure you have:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>Node.js 20 or later installed</li>
            <li>
              A Wraps account with an organization (
              <a
                className="text-primary underline"
                href="https://app.wraps.dev/auth?mode=signup"
                rel="noopener noreferrer"
                target="_blank"
              >
                sign up here
              </a>
              )
            </li>
            <li>An API key from your organization settings</li>
          </ul>
        </CardContent>
      </Card>

      {/* Step 1: Get API Key */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            1
          </div>
          Get Your API Key
        </h2>
        <p className="mb-4 text-muted-foreground">
          Create an API key from your organization's settings page:
        </p>
        <ol className="mb-4 list-decimal space-y-2 pl-6 text-muted-foreground">
          <li>
            Go to{" "}
            <a
              className="text-primary underline"
              href="https://app.wraps.dev"
              rel="noopener noreferrer"
              target="_blank"
            >
              app.wraps.dev
            </a>{" "}
            and sign in
          </li>
          <li>
            Navigate to <strong>Settings</strong> &rarr;{" "}
            <strong>API Keys</strong>
          </li>
          <li>
            Click <strong>Create API Key</strong>
          </li>
          <li>Give it a name and select the permissions you need</li>
          <li>Copy the API key (you won't see it again!)</li>
        </ol>
        <div className="rounded-lg border-primary border-l-4 bg-primary/10 p-4">
          <p className="font-medium text-sm">Security Tip</p>
          <p className="mt-2 text-muted-foreground text-sm">
            Store your API key securely in environment variables. Never commit
            it to version control or expose it in client-side code.
          </p>
        </div>
      </section>

      {/* Step 2: Install SDK */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            2
          </div>
          Install the SDK
        </h2>
        <p className="mb-4 text-muted-foreground">
          Install the{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            @wraps.dev/client
          </code>{" "}
          package:
        </p>
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

      {/* Step 3: Initialize Client */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            3
          </div>
          Initialize the Client
        </h2>
        <p className="mb-4 text-muted-foreground">
          Create a client instance with your API key:
        </p>
        <CodeBlock
          className="mb-4 h-auto"
          data={[
            {
              language: "typescript",
              filename: "client.ts",
              code: setupClientCode,
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
        <p className="text-muted-foreground text-sm">
          Set your API key in an environment variable:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            WRAPS_API_KEY=wraps_live_xxx...
          </code>
        </p>
      </section>

      {/* Step 4: Create a Contact */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            4
          </div>
          Create Your First Contact
        </h2>
        <p className="mb-4 text-muted-foreground">
          Use the client to create a contact in your organization:
        </p>
        <CodeBlock
          className="mb-4 h-auto"
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

      {/* Step 5: List Contacts */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            5
          </div>
          List Your Contacts
        </h2>
        <p className="mb-4 text-muted-foreground">
          Fetch contacts with pagination:
        </p>
        <CodeBlock
          className="mb-4 h-auto"
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

      {/* Bonus: Batch Sends */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
            +
          </div>
          Bonus: Send Batch Emails
        </h2>
        <p className="mb-4 text-muted-foreground">
          Create a batch send to email multiple contacts at once:
        </p>
        <CodeBlock
          className="mb-4 h-auto"
          data={[
            {
              language: "typescript",
              filename: "batch-send.ts",
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

      {/* Next Steps */}
      <section className="mb-12">
        <h2 className="mb-6 font-bold text-2xl">Next Steps</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">Platform SDK Reference</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Explore all available endpoints, parameters, and response types.
              </p>
              <Button asChild variant="outline">
                <Link href="/docs/client-sdk-reference">
                  View SDK Docs
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
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
                <Link href="/docs/sdk-reference">
                  View Email SDK
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Help Section */}
      <Card className="bg-muted/50">
        <CardContent className="p-8 text-center">
          <h3 className="mb-2 font-bold text-xl">Need Help?</h3>
          <p className="mb-4 text-muted-foreground">
            If you run into any issues, check our GitHub discussions or open an
            issue.
          </p>
          <Button asChild>
            <a
              href="https://github.com/wraps-team/wraps/discussions"
              rel="noopener noreferrer"
              target="_blank"
            >
              Get Help
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </DocsLayout>
  );
}
