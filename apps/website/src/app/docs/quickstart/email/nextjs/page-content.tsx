"use client";

import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
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

const serverActionCode = `'use server'

import { WrapsEmail } from '@wraps.dev/email';

const email = new WrapsEmail();

export async function sendWelcomeEmail(to: string, name: string) {
  const result = await email.send({
    from: 'hello@yourdomain.com',
    to,
    subject: \`Welcome, \${name}!\`,
    html: \`<h1>Welcome to our app, \${name}!</h1><p>We're glad you're here.</p>\`,
  });

  return { messageId: result.messageId };
}`;

const apiRouteCode = `import { NextResponse } from 'next/server';
import { WrapsEmail } from '@wraps.dev/email';

const email = new WrapsEmail();

export async function POST(request: Request) {
  const { to, subject, html } = await request.json();

  const result = await email.send({
    from: 'hello@yourdomain.com',
    to,
    subject,
    html,
  });

  return NextResponse.json({ messageId: result.messageId });
}`;

function CLICommand({ command }: { command: string }) {
  return (
    <CodeBlock
      className="h-auto"
      data={[
        { language: "bash", filename: "terminal.sh", code: command },
      ]}
      defaultValue="bash"
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
  );
}

function TypeScriptCode({
  code,
  filename,
}: {
  code: string;
  filename: string;
}) {
  return (
    <CodeBlock
      className="h-auto"
      data={[{ language: "typescript", filename, code }]}
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
  );
}

export default function NextjsQuickstartPageContent() {
  return (
    <DocsLayout>
      {/* Breadcrumb */}
      <div className="mb-6">
        <Button asChild className="gap-2" size="sm" variant="ghost">
          <a href="/docs/quickstart/email">
            <ArrowLeft className="h-4 w-4" />
            Email Quickstart
          </a>
        </Button>
      </div>

      {/* Page Header */}
      <div className="mb-12">
        <Badge className="mb-4" variant="outline">
          Quickstart / Next.js
        </Badge>
        <h1 className="mb-4 font-bold text-4xl tracking-tight">
          Send Email from Next.js
        </h1>
        <p className="text-lg text-muted-foreground">
          Deploy email infrastructure and send your first email from a Next.js
          application in under 5 minutes.
        </p>
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
            <li>Node.js 18 or later installed</li>
            <li>
              AWS credentials configured (
              <a className="underline" href="/docs/guides/aws-setup">
                AWS Setup Guide
              </a>
              )
            </li>
            <li>A domain you own</li>
          </ul>
        </CardContent>
      </Card>

      {/* Step 1: Deploy Infrastructure */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            1
          </div>
          Deploy Infrastructure
        </h2>
        <p className="mb-4 text-muted-foreground">
          Run the Wraps CLI to deploy email infrastructure to your AWS account:
        </p>
        <CLICommand command="npx @wraps.dev/cli email init" />
        <div className="mt-4 rounded-lg border-primary border-l-4 bg-primary/10 p-4">
          <p className="font-medium text-sm">What happens during deployment?</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground text-sm">
            <li>Validates your AWS credentials</li>
            <li>
              Prompts you to choose a configuration preset (Starter, Production,
              or Enterprise)
            </li>
            <li>Shows estimated monthly AWS costs</li>
            <li>
              Deploys SES, DynamoDB, Lambda, EventBridge, and IAM roles to your
              AWS account
            </li>
            <li>Takes 1-2 minutes to complete</li>
          </ul>
        </div>
      </section>

      {/* Step 2: Add Your Domain */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            2
          </div>
          Add Your Domain
        </h2>
        <p className="mb-4 text-muted-foreground">
          Add and verify your sending domain with AWS SES:
        </p>
        <CLICommand command="npx @wraps.dev/cli email domains add -d yourdomain.com" />
        <div className="mt-4 rounded-lg border-primary border-l-4 bg-primary/10 p-4">
          <p className="font-medium text-sm">DNS Setup</p>
          <p className="mt-2 text-muted-foreground text-sm">
            The CLI will output DKIM records to add to your DNS provider. Once
            added, verify them with{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">
              npx @wraps.dev/cli email domains verify -d yourdomain.com
            </code>
          </p>
        </div>
      </section>

      {/* Step 3: Install SDK */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            3
          </div>
          Install the SDK
        </h2>
        <p className="mb-4 text-muted-foreground">
          Install the{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            @wraps.dev/email
          </code>{" "}
          package in your Next.js project:
        </p>
        <CLICommand command="npm install @wraps.dev/email" />
      </section>

      {/* Step 4: Send from a Server Action */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            4
          </div>
          Send from a Server Action
        </h2>
        <p className="mb-4 text-muted-foreground">
          Create a server action to send emails directly from your Next.js
          components:
        </p>
        <TypeScriptCode
          code={serverActionCode}
          filename="app/actions/send-email.ts"
        />
      </section>

      {/* Step 5: Send from an API Route */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            5
          </div>
          Send from an API Route
        </h2>
        <p className="mb-4 text-muted-foreground">
          Alternatively, create an API route for sending emails from any client:
        </p>
        <TypeScriptCode
          code={apiRouteCode}
          filename="app/api/send/route.ts"
        />
      </section>

      {/* Step 6: Deploy to Vercel */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            6
          </div>
          Deploy to Vercel
        </h2>
        <p className="mb-4 text-muted-foreground">
          Deploy your Next.js application to Vercel. Wraps uses OIDC for secure
          authentication with no AWS access keys needed.
        </p>
        <div className="rounded-lg border-primary border-l-4 bg-primary/10 p-4">
          <p className="font-medium text-sm">Vercel OIDC Authentication</p>
          <p className="mt-2 text-muted-foreground text-sm">
            When deploying to Vercel, Wraps uses OIDC for authentication — no
            AWS access keys needed. Just set{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">
              AWS_ROLE_ARN
            </code>{" "}
            in your Vercel environment variables.
          </p>
        </div>
      </section>

      {/* Next Steps */}
      <section className="mb-12">
        <h2 className="mb-6 font-bold text-2xl">Next Steps</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">Email SDK Reference</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Learn about all available methods, options, and advanced
                features.
              </p>
              <Button asChild variant="outline">
                <a href="/docs/sdk-reference">
                  View SDK Docs
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">Templates as Code</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Build reusable email templates with TypeScript and React.
              </p>
              <Button asChild variant="outline">
                <a href="/docs/guides/templates">
                  View Guide
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">Error Codes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Reference for all error codes and troubleshooting steps.
              </p>
              <Button asChild variant="outline">
                <a href="/docs/reference/errors">
                  View Errors
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
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
