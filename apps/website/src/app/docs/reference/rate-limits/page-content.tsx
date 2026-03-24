"use client";

import { ArrowRight } from "lucide-react";
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

const retryCode = `async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options);

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('Retry-After') ?? 60);
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      continue;
    }

    return response;
  }

  throw new Error('Rate limit exceeded after retries');
}`;

const headersExample = `HTTP/1.1 200 OK
X-RateLimit-Limit: 500
X-RateLimit-Remaining: 487`;

const rateLimitedExample = `HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-RateLimit-Limit: 500
X-RateLimit-Remaining: 0

{
  "error": "Rate limit exceeded: 500 requests per minute"
}`;

// ============================================================================
// MARKDOWN CONTENT FOR AI COPY
// ============================================================================

const SECTION_MD = {
  limitsByPlan: `## Limits by Plan

The Wraps Platform API enforces per-minute and daily rate limits based on your plan. Limits are applied per organization using DynamoDB-backed sliding windows.

| Plan | Per Minute | Per Day |
|------|-----------|---------|
| Free | 50 | 1,000 |
| Starter | 500 | 50,000 |
| Growth | 2,000 | 200,000 |
| Scale | 5,000 | 500,000 |`,

  publicEndpoints: `## Public Endpoints

Unauthenticated endpoints (health check, public tools) use IP-based rate limiting:

| Scope | Limit |
|-------|-------|
| Per minute per IP | 10 |
| Per hour per IP | 100 |`,

  responseHeaders: `## Response Headers

Every API response includes rate limit headers:

| Header | Description |
|--------|-------------|
| \`X-RateLimit-Limit\` | Maximum requests allowed in the current window |
| \`X-RateLimit-Remaining\` | Requests remaining in the current window |
| \`Retry-After\` | Seconds to wait before retrying (only on 429 responses) |

### Successful response
\`\`\`
${headersExample}
\`\`\`

### Rate limited response (429)
\`\`\`
${rateLimitedExample}
\`\`\``,

  handling429: `## Handling 429 Errors

When you receive a 429 status code:

1. Read the \`Retry-After\` header for the number of seconds to wait
2. Wait that duration before retrying
3. Use exponential backoff if retries continue to fail

\`\`\`typescript
${retryCode}
\`\`\``,
};

const FULL_PAGE_MD = `# API Rate Limits

Rate limits for the Wraps Platform API by plan, with response headers and error handling.

${SECTION_MD.limitsByPlan}

${SECTION_MD.publicEndpoints}

${SECTION_MD.responseHeaders}

${SECTION_MD.handling429}
`;

const SLASH_COMMAND_MD = `---
description: Wraps API rate limits - use this when debugging 429 errors or planning API usage
---

${FULL_PAGE_MD}`;

// ============================================================================
// PAGE CONTENT
// ============================================================================

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
          API Rate Limits
        </h1>
        <p className="text-lg text-muted-foreground">
          Rate limits for the Wraps Platform API by plan. Includes response
          headers and error handling.
        </p>
      </div>

      {/* Limits by Plan */}
      <section className="mb-12">
        <SectionHeading
          className="mb-6"
          id="limits-by-plan"
          markdown={SECTION_MD.limitsByPlan}
          title="Limits by Plan"
        />
        <p className="mb-4 text-muted-foreground">
          The Wraps Platform API enforces per-minute and daily rate limits based
          on your plan. Limits are applied per organization using
          DynamoDB-backed sliding windows.
        </p>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-2 text-left font-medium">Plan</th>
                    <th className="px-4 py-2 text-left font-medium">
                      Per Minute
                    </th>
                    <th className="px-4 py-2 text-left font-medium">Per Day</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  {[
                    { plan: "Free", minute: "50", daily: "1,000" },
                    { plan: "Starter", minute: "500", daily: "50,000" },
                    { plan: "Growth", minute: "2,000", daily: "200,000" },
                    { plan: "Scale", minute: "5,000", daily: "500,000" },
                  ].map((row, i) => (
                    <tr className={i < 3 ? "border-b" : ""} key={row.plan}>
                      <td className="px-4 py-2 font-medium text-foreground">
                        {row.plan}
                      </td>
                      <td className="px-4 py-2">
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {row.minute}
                        </code>{" "}
                        requests
                      </td>
                      <td className="px-4 py-2">
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {row.daily}
                        </code>{" "}
                        requests
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Public Endpoints */}
      <section className="mb-12">
        <SectionHeading
          className="mb-6"
          id="public-endpoints"
          markdown={SECTION_MD.publicEndpoints}
          title="Public Endpoints"
        />
        <p className="mb-4 text-muted-foreground">
          Unauthenticated endpoints (health check, public tools) use IP-based
          rate limiting:
        </p>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-2 text-left font-medium">Scope</th>
                    <th className="px-4 py-2 text-left font-medium">Limit</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b">
                    <td className="px-4 py-2">Per minute per IP</td>
                    <td className="px-4 py-2">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        10
                      </code>{" "}
                      requests
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Per hour per IP</td>
                    <td className="px-4 py-2">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        100
                      </code>{" "}
                      requests
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Response Headers */}
      <section className="mb-12">
        <SectionHeading
          className="mb-6"
          id="response-headers"
          markdown={SECTION_MD.responseHeaders}
          title="Response Headers"
        />
        <p className="mb-4 text-muted-foreground">
          Every API response includes rate limit headers so you can track your
          usage:
        </p>

        <Card className="mb-6">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-2 text-left font-medium">Header</th>
                    <th className="px-4 py-2 text-left font-medium">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b">
                    <td className="px-4 py-2">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        X-RateLimit-Limit
                      </code>
                    </td>
                    <td className="px-4 py-2">
                      Maximum requests allowed in the current window
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-4 py-2">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        X-RateLimit-Remaining
                      </code>
                    </td>
                    <td className="px-4 py-2">
                      Requests remaining in the current window
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        Retry-After
                      </code>
                    </td>
                    <td className="px-4 py-2">
                      Seconds to wait before retrying (only on 429 responses)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="mb-4">
          <h3 className="mb-3 font-medium text-lg" id="successful-response">
            Successful response
          </h3>
          <CodeBlock
            className="h-auto"
            data={[
              {
                language: "http",
                filename: "response headers",
                code: headersExample,
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
        </div>

        <div>
          <h3 className="mb-3 font-medium text-lg" id="rate-limited-response">
            Rate limited response (429)
          </h3>
          <CodeBlock
            className="h-auto"
            data={[
              {
                language: "http",
                filename: "429 response",
                code: rateLimitedExample,
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
        </div>
      </section>

      {/* Handling 429 Errors */}
      <section className="mb-12">
        <SectionHeading
          className="mb-6"
          id="handling-429"
          markdown={SECTION_MD.handling429}
          title="Handling 429 Errors"
        />
        <p className="mb-4 text-muted-foreground">
          When you receive a 429 status code:
        </p>
        <ol className="mb-6 list-inside list-decimal space-y-2 text-muted-foreground">
          <li>
            Read the{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              Retry-After
            </code>{" "}
            header for the number of seconds to wait
          </li>
          <li>Wait that duration before retrying</li>
          <li>Use exponential backoff if retries continue to fail</li>
        </ol>
        <CodeBlock
          className="h-auto"
          data={[
            {
              language: "typescript",
              filename: "retry.ts",
              code: retryCode,
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

      {/* Next Steps */}
      <section>
        <h2 className="mb-4 font-semibold text-2xl" id="next-steps">
          Next Steps
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
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
              <CardTitle className="text-base">SDK Reference</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-muted-foreground text-sm">
                Full API reference for the Email SDK.
              </p>
              <Button asChild size="sm" variant="outline">
                <Link href="/docs/sdk-reference">
                  View SDK Reference <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </DocsLayout>
  );
}
