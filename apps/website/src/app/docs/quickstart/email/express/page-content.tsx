"use client";

import { Badge } from "@wraps/ui/components/ui/badge";
import { Button } from "@wraps/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@wraps/ui/components/ui/card";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { CLICommand } from "@/components/docs/cli-command";
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

const emailServiceCode = `import { WrapsEmail } from '@wraps.dev/email';

// Create a singleton instance — reuses AWS connections
export const email = new WrapsEmail({
  region: process.env.AWS_REGION || 'us-east-1',
});`;

const sendRouteCode = `import { Router } from 'express';
import { email } from '../services/email';

const router = Router();

router.post('/send', async (req, res, next) => {
  try {
    const { to, subject, html } = req.body;

    const result = await email.send({
      from: 'hello@yourdomain.com',
      to,
      subject,
      html,
    });

    res.json({ success: true, messageId: result.messageId });
  } catch (error) {
    next(error);
  }
});

export default router;`;

const errorHandlerCode = `import { SESError, ValidationError } from '@wraps.dev/email';

export function emailErrorHandler(err, req, res, next) {
  if (err instanceof ValidationError) {
    return res.status(400).json({ error: err.message, field: err.field });
  }
  if (err instanceof SESError) {
    const status = err.retryable ? 503 : 400;
    return res.status(status).json({ error: err.message, code: err.code });
  }
  next(err);
}`;

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

export default function ExpressQuickstartPageContent() {
  return (
    <DocsLayout>
      {/* Breadcrumb */}
      <div className="mb-6">
        <Button asChild className="gap-2" size="sm" variant="ghost">
          <Link href="/docs/quickstart/email">
            <ArrowLeft className="h-4 w-4" />
            Email Quickstart
          </Link>
        </Button>
      </div>

      {/* Page Header */}
      <div className="mb-12">
        <Badge className="mb-4" variant="outline">
          Quickstart / Express
        </Badge>
        <h1 className="mb-4 font-bold text-4xl tracking-tight">
          Send Email from Express
        </h1>
        <p className="text-lg text-muted-foreground">
          Deploy email infrastructure and send your first email from an Express
          application.
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
          package in your Express project:
        </p>
        <CLICommand command="npm install @wraps.dev/email" />
      </section>

      {/* Step 4: Create Email Service */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            4
          </div>
          Create Email Service
        </h2>
        <p className="mb-4 text-muted-foreground">
          Create a singleton email service that reuses AWS connections across
          requests:
        </p>
        <TypeScriptCode
          code={emailServiceCode}
          filename="src/services/email.ts"
        />
      </section>

      {/* Step 5: Add a Send Route */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            5
          </div>
          Add a Send Route
        </h2>
        <p className="mb-4 text-muted-foreground">
          Create an Express route that accepts email parameters and sends using
          the SDK:
        </p>
        <TypeScriptCode code={sendRouteCode} filename="src/routes/email.ts" />
      </section>

      {/* Step 6: Error Handling Middleware */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            6
          </div>
          Error Handling Middleware
        </h2>
        <p className="mb-4 text-muted-foreground">
          Add error handling middleware to return meaningful error responses for
          email failures:
        </p>
        <TypeScriptCode
          code={errorHandlerCode}
          filename="src/middleware/error-handler.ts"
        />
        <div className="mt-4 rounded-lg border-primary border-l-4 bg-primary/10 p-4">
          <p className="font-medium text-sm">Error Types</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground text-sm">
            <li>
              <strong>ValidationError</strong> — Invalid email parameters
              (missing fields, bad format)
            </li>
            <li>
              <strong>SESError</strong> — AWS SES errors (throttling, bounces,
              invalid identity)
            </li>
          </ul>
        </div>
      </section>

      {/* Next Steps */}
      <section className="mb-12">
        <h2 className="mb-6 font-bold text-2xl">Next Steps</h2>
        <div className="grid gap-4 md:grid-cols-2">
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
                <Link href="/docs/sdk-reference">
                  View SDK Docs
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
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
                <Link href="/docs/reference/errors">
                  View Errors
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
