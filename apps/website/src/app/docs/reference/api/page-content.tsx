"use client";

import { ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";
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

const curlExample = `curl -X GET https://api.wraps.dev/health

# Authenticated request
curl -X GET https://api.wraps.dev/contacts \\
  -H "Authorization: Bearer wraps_your_api_key"`;

const sdkExample = `import { WrapsClient } from '@wraps.dev/client';

const client = new WrapsClient({
  apiKey: process.env.WRAPS_API_KEY,
});

const contacts = await client.contacts.list();`;

// ============================================================================
// MARKDOWN CONTENT FOR AI COPY
// ============================================================================

const SECTION_MD = {
  baseUrl: `## Base URL

All API requests are made to:

\`\`\`
https://api.wraps.dev
\`\`\`

The API follows REST conventions and returns JSON responses.`,

  authentication: `## Authentication

Authenticate using a Bearer token in the \`Authorization\` header:

\`\`\`
Authorization: Bearer wraps_your_api_key
\`\`\`

Two authentication methods are supported:

| Method | Format | Use Case |
|--------|--------|----------|
| API Key | \`wraps_*\` prefix | Server-to-server, SDK usage |
| Session Token | better-auth session | Dashboard, browser-based |

API keys are created in the Wraps dashboard under Settings > API Keys.`,

  endpoints: `## Endpoints

| Group | Description | Auth Required |
|-------|-------------|---------------|
| Health | Health check and API info | No |
| Contacts | Create, update, delete, and list contacts | Yes |
| Batch | Batch email sending for broadcasts | Yes |
| Events | Custom event ingestion for triggering workflows | Yes |
| Workflows | API-triggered workflow execution | Yes |
| Connections | AWS account connection management | Yes |
| Webhooks | Receive SES delivery events | Secret-based |
| Unsubscribe | RFC 8058 one-click unsubscribe | Token-based |
| Tools | Free email deliverability tools | No |`,

  openapi: `## OpenAPI Spec

The full OpenAPI 3.0.3 specification is available at:

- **Interactive docs**: https://api.wraps.dev/swagger
- **JSON spec**: https://api.wraps.dev/swagger/json

Use the JSON spec with any OpenAPI-compatible tool (Postman, Insomnia, Scalar, etc.) to explore and test endpoints.`,
};

const FULL_PAGE_MD = `# API Reference

OpenAPI reference for the Wraps Platform API.

${SECTION_MD.baseUrl}

${SECTION_MD.authentication}

${SECTION_MD.endpoints}

${SECTION_MD.openapi}
`;

const SLASH_COMMAND_MD = `---
description: Wraps Platform API reference - use this for endpoint discovery, auth setup, and OpenAPI spec access
---

${FULL_PAGE_MD}`;

// ============================================================================
// PAGE CONTENT
// ============================================================================

const endpointGroups = [
  {
    name: "Health",
    description: "Health check and API info",
    auth: false,
    methods: ["GET"],
  },
  {
    name: "Contacts",
    description: "Create, update, delete, and list contacts",
    auth: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
  },
  {
    name: "Batch",
    description: "Batch email sending for broadcasts",
    auth: true,
    methods: ["POST"],
  },
  {
    name: "Events",
    description: "Custom event ingestion for triggering workflows",
    auth: true,
    methods: ["POST"],
  },
  {
    name: "Workflows",
    description: "API-triggered workflow execution",
    auth: true,
    methods: ["POST"],
  },
  {
    name: "Connections",
    description: "AWS account connection management",
    auth: true,
    methods: ["GET", "POST", "DELETE"],
  },
  {
    name: "Webhooks",
    description: "Receive SES delivery events",
    auth: false,
    methods: ["POST"],
  },
  {
    name: "Unsubscribe",
    description: "RFC 8058 one-click unsubscribe",
    auth: false,
    methods: ["GET", "POST"],
  },
  {
    name: "Tools",
    description: "Free email deliverability tools",
    auth: false,
    methods: ["GET", "POST"],
  },
];

export default function PageContent() {
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
          Reference
        </Badge>
        <h1 className="mb-4 font-bold text-4xl tracking-tight">
          API Reference
        </h1>
        <p className="text-lg text-muted-foreground">
          OpenAPI reference for the Wraps Platform API. Browse endpoints, auth,
          and the interactive spec.
        </p>
      </div>

      {/* Base URL */}
      <section className="mb-12">
        <SectionHeading
          className="mb-6"
          id="base-url"
          markdown={SECTION_MD.baseUrl}
          title="Base URL"
        />
        <p className="mb-4 text-muted-foreground">
          All API requests are made to:
        </p>
        <CodeBlock
          className="h-auto"
          data={[
            {
              language: "text",
              filename: "base url",
              code: "https://api.wraps.dev",
            },
          ]}
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

      {/* Authentication */}
      <section className="mb-12">
        <SectionHeading
          className="mb-6"
          id="authentication"
          markdown={SECTION_MD.authentication}
          title="Authentication"
        />
        <p className="mb-4 text-muted-foreground">
          Authenticate using a Bearer token in the{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
            Authorization
          </code>{" "}
          header. Two methods are supported:
        </p>
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">API Key</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-2 text-muted-foreground text-sm">
                Prefixed with{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  wraps_
                </code>
                . Best for server-to-server and SDK usage.
              </p>
              <p className="text-muted-foreground text-sm">
                Create keys in the dashboard under Settings &gt; API Keys.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Session Token</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                better-auth session token. Used by the dashboard and
                browser-based clients.
              </p>
            </CardContent>
          </Card>
        </div>

        <CodeBlock
          className="h-auto"
          data={[
            { language: "bash", filename: "curl examples", code: curlExample },
          ]}
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

      {/* Endpoints */}
      <section className="mb-12">
        <SectionHeading
          className="mb-6"
          id="endpoints"
          markdown={SECTION_MD.endpoints}
          title="Endpoints"
        />
        <p className="mb-4 text-muted-foreground">
          The API is organized into endpoint groups. See the interactive docs
          for full request/response schemas.
        </p>
        <div className="mb-6 space-y-3">
          {endpointGroups.map((group) => (
            <div
              className="flex items-start justify-between rounded-lg border border-border p-3"
              key={group.name}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground text-sm">
                    {group.name}
                  </span>
                  {!group.auth && (
                    <Badge className="text-xs" variant="outline">
                      Public
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-muted-foreground text-xs">
                  {group.description}
                </p>
              </div>
              <div className="flex gap-1">
                {group.methods.map((method) => (
                  <Badge className="text-xs" key={method} variant="secondary">
                    {method}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SDK Usage */}
      <section className="mb-12">
        <h2 className="mb-6 font-bold text-2xl" id="sdk-usage">
          SDK Usage
        </h2>
        <p className="mb-4 text-muted-foreground">
          The{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
            @wraps.dev/client
          </code>{" "}
          SDK provides a typed wrapper around the API.
        </p>
        <CodeBlock
          className="h-auto"
          data={[
            { language: "typescript", filename: "client.ts", code: sdkExample },
          ]}
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

      {/* OpenAPI Spec */}
      <section className="mb-12">
        <SectionHeading
          className="mb-6"
          id="openapi-spec"
          markdown={SECTION_MD.openapi}
          title="OpenAPI Spec"
        />
        <p className="mb-4 text-muted-foreground">
          The full OpenAPI 3.0.3 specification is auto-generated from route
          definitions. Use it with any OpenAPI-compatible tool.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Interactive Docs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-muted-foreground text-sm">
                Browse and test endpoints in the Swagger UI.
              </p>
              <Button asChild size="sm" variant="outline">
                <a
                  href="https://api.wraps.dev/swagger"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Open Swagger UI
                  <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </a>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">JSON Spec</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-muted-foreground text-sm">
                Import into Postman, Insomnia, Scalar, or any OpenAPI tool.
              </p>
              <Button asChild size="sm" variant="outline">
                <a
                  href="https://api.wraps.dev/swagger/json"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Download OpenAPI JSON
                  <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Next Steps */}
      <section>
        <h2 className="mb-4 font-semibold text-2xl" id="next-steps">
          Next Steps
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rate Limits</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-muted-foreground text-sm">
                Per-minute and daily limits by plan.
              </p>
              <Button asChild size="sm" variant="outline">
                <Link href="/docs/reference/rate-limits">
                  View Rate Limits <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Error Codes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-muted-foreground text-sm">
                Complete reference for CLI and SDK error codes.
              </p>
              <Button asChild size="sm" variant="outline">
                <Link href="/docs/reference/errors">
                  View Error Codes <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Platform SDK</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-muted-foreground text-sm">
                Typed TypeScript wrapper for the API.
              </p>
              <Button asChild size="sm" variant="outline">
                <Link href="/docs/client-sdk-reference">
                  View SDK Reference <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Environment Variables</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-muted-foreground text-sm">
                All env vars for CLI, SDKs, and CI/CD.
              </p>
              <Button asChild size="sm" variant="outline">
                <Link href="/docs/reference/environment-variables">
                  View Env Vars <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </DocsLayout>
  );
}
