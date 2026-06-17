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

const wranglerConfig = `{
  "name": "email-worker",
  "main": "src/index.ts",
  "compatibility_date": "2026-06-16",
  "vars": {
    "AWS_REGION": "us-east-1"
  }
}`;

const workerCode = `import { SESError, ValidationError, WrapsEmail } from '@wraps.dev/email/workers';

type Env = {
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_REGION: string;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Instantiate per request — \`env\` isn't available at module scope.
    // Workers have no AWS credential chain (no filesystem, no ~/.aws,
    // no instance metadata), so pass credentials explicitly from the env
    // binding — Wrangler secrets for the keys, a var for the region.
    const email = new WrapsEmail({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    });

    try {
      const { to, subject, html } = await request.json<{
        to: string;
        subject: string;
        html: string;
      }>();

      const result = await email.send({
        from: 'hello@yourdomain.com',
        to,
        subject,
        html,
      });

      return Response.json({ success: true, messageId: result.messageId });
    } catch (error) {
      if (error instanceof ValidationError) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      if (error instanceof SESError) {
        return Response.json(
          { error: error.message, code: error.code },
          { status: error.retryable ? 503 : 400 },
        );
      }
      throw error;
    }
  },
};`;

function FileCode({
  code,
  filename,
  language = "typescript",
}: {
  code: string;
  filename: string;
  language?: string;
}) {
  return (
    <CodeBlock
      className="h-auto"
      data={[{ language, filename, code }]}
      defaultValue={language}
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

export default function CloudflareQuickstartPageContent() {
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
          Quickstart / Cloudflare Workers
        </Badge>
        <h1 className="mb-4 font-bold text-4xl tracking-tight">
          Send Email from Cloudflare Workers
        </h1>
        <p className="text-lg text-muted-foreground">
          Deploy email infrastructure to your AWS account and send your first
          email from a Cloudflare Worker running at the edge.
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
            <li>A Cloudflare account with Wrangler installed</li>
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

      {/* Step 3: Create a Worker and Install the SDK */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            3
          </div>
          Create a Worker and Install the SDK
        </h2>
        <p className="mb-4 text-muted-foreground">
          Scaffold a new Worker if you don&apos;t have one, then install the{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            @wraps.dev/email
          </code>{" "}
          package:
        </p>
        <CLICommand command="npm create cloudflare@latest email-worker -- --type hello-world" />
        <div className="mt-4">
          <CLICommand command="cd email-worker && npm install @wraps.dev/email" />
        </div>
      </section>

      {/* Step 4: Configure Wrangler */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            4
          </div>
          Configure Wrangler
        </h2>
        <p className="mb-4 text-muted-foreground">
          The{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            @wraps.dev/email/workers
          </code>{" "}
          entry uses Web Crypto and{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">fetch</code> — no
          Node.js APIs — so you don&apos;t need{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">nodejs_compat</code>.
          Just set a region variable in your Wrangler config:
        </p>
        <FileCode
          code={wranglerConfig}
          filename="wrangler.jsonc"
          language="json"
        />
        <div className="mt-4 rounded-lg border-primary border-l-4 bg-primary/10 p-4">
          <p className="font-medium text-sm">No Node.js Compat Needed</p>
          <p className="mt-2 text-muted-foreground text-sm">
            The <code className="rounded bg-muted px-1.5 py-0.5">/workers</code>{" "}
            entry is self-contained (~5 KB bundled) and runs on plain workerd
            with no polyfills. Drop the{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">
              nodejs_compat
            </code>{" "}
            flag entirely — it&apos;s not required and adds unnecessary
            overhead.
          </p>
        </div>
      </section>

      {/* Step 5: Store AWS Credentials as Secrets */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            5
          </div>
          Store AWS Credentials as Secrets
        </h2>
        <p className="mb-4 text-muted-foreground">
          Workers have no filesystem and no AWS credential chain, so you
          can&apos;t rely on{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">~/.aws</code> or
          instance metadata. Store your IAM keys as encrypted Wrangler secrets:
        </p>
        <CLICommand command="npx wrangler secret put AWS_ACCESS_KEY_ID" />
        <div className="mt-4">
          <CLICommand command="npx wrangler secret put AWS_SECRET_ACCESS_KEY" />
        </div>
        <div className="mt-4 rounded-lg border-primary border-l-4 bg-primary/10 p-4">
          <p className="font-medium text-sm">Local Development</p>
          <p className="mt-2 text-muted-foreground text-sm">
            For{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">wrangler dev</code>
            , put the same keys in a{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">.dev.vars</code>{" "}
            file (and add it to{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">.gitignore</code>).
            Scope the IAM user to{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">
              ses:SendEmail
            </code>{" "}
            only.
          </p>
        </div>
      </section>

      {/* Step 6: Send Email from the Worker */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            6
          </div>
          Send Email from the Worker
        </h2>
        <p className="mb-4 text-muted-foreground">
          Build a{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">WrapsEmail</code>{" "}
          instance inside the fetch handler, passing credentials from the{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">env</code> binding.
          The handler below accepts a JSON body and returns the SES message ID:
        </p>
        <FileCode code={workerCode} filename="src/index.ts" />
        <div className="mt-4 rounded-lg border-primary border-l-4 bg-primary/10 p-4">
          <p className="font-medium text-sm">Error Types</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground text-sm">
            <li>
              <strong>ValidationError</strong> — Invalid email parameters
              (missing fields, bad format)
            </li>
            <li>
              <strong>SESError</strong> — AWS SES errors (throttling, bounces,
              invalid identity); check{" "}
              <code className="rounded bg-muted px-1.5 py-0.5">retryable</code>{" "}
              to decide whether to retry
            </li>
          </ul>
        </div>
      </section>

      {/* Step 7: Deploy */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            7
          </div>
          Deploy
        </h2>
        <p className="mb-4 text-muted-foreground">
          Ship the Worker to Cloudflare&apos;s edge network:
        </p>
        <CLICommand command="npx wrangler deploy" />
        <p className="mt-4 text-muted-foreground">
          Send a test request to your Worker URL:
        </p>
        <div className="mt-4">
          <CLICommand
            command={`curl -X POST https://email-worker.<your-subdomain>.workers.dev \\
  -H "Content-Type: application/json" \\
  -d '{"to":"you@example.com","subject":"Hello from the edge","html":"<h1>It works</h1>"}'`}
          />
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
