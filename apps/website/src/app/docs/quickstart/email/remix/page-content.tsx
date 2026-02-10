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
import { CLICommand } from "@/components/docs/cli-command";

const remixActionCode = `import type { ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { Form, useActionData } from '@remix-run/react';
import { WrapsEmail } from '@wraps.dev/email';

const email = new WrapsEmail();

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const to = formData.get('email') as string;
  const name = formData.get('name') as string;

  const result = await email.send({
    from: 'hello@yourdomain.com',
    to,
    subject: \`Thanks for reaching out, \${name}!\`,
    html: \`<h1>We received your message</h1><p>We'll get back to you soon.</p>\`,
  });

  return json({ success: true, messageId: result.messageId });
}

export default function Contact() {
  const data = useActionData<typeof action>();

  return (
    <Form method="post">
      <input name="name" placeholder="Your name" required />
      <input name="email" type="email" placeholder="Your email" required />
      <button type="submit">Send</button>
      {data?.success && <p>Email sent!</p>}
    </Form>
  );
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

export default function RemixQuickstartPageContent() {
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
          Quickstart / Remix
        </Badge>
        <h1 className="mb-4 font-bold text-4xl tracking-tight">
          Send Email from Remix
        </h1>
        <p className="text-lg text-muted-foreground">
          Deploy email infrastructure and send your first email from a Remix
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
          package in your Remix project:
        </p>
        <CLICommand command="npm install @wraps.dev/email" />
      </section>

      {/* Step 4: Send from a Remix Action */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            4
          </div>
          Send from a Remix Action
        </h2>
        <p className="mb-4 text-muted-foreground">
          Create a route with a Remix action that sends an email when a form is
          submitted:
        </p>
        <TypeScriptCode
          code={remixActionCode}
          filename="app/routes/contact.tsx"
        />
        <div className="mt-4 rounded-lg border-primary border-l-4 bg-primary/10 p-4">
          <p className="font-medium text-sm">How it works</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground text-sm">
            <li>
              The <code className="rounded bg-muted px-1.5 py-0.5">action</code>{" "}
              function runs on the server when the form is submitted
            </li>
            <li>
              <code className="rounded bg-muted px-1.5 py-0.5">
                useActionData
              </code>{" "}
              gives you the result in the component for UI feedback
            </li>
            <li>
              The email client is initialized once at module level and reused
              across requests
            </li>
          </ul>
        </div>
      </section>

      {/* Step 5: Deploy */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            5
          </div>
          Deploy
        </h2>
        <p className="mb-4 text-muted-foreground">
          Deploy your Remix application using your preferred hosting provider.
          Set the following environment variables in your deployment
          configuration:
        </p>
        <div className="rounded-lg border-primary border-l-4 bg-primary/10 p-4">
          <p className="font-medium text-sm">Environment Variables</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground text-sm">
            <li>
              <code className="rounded bg-muted px-1.5 py-0.5">
                AWS_REGION
              </code>{" "}
              — The AWS region where your infrastructure is deployed
            </li>
            <li>
              <code className="rounded bg-muted px-1.5 py-0.5">
                AWS_ROLE_ARN
              </code>{" "}
              — The IAM role ARN for OIDC authentication (or use access keys)
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
                <a href="/docs/sdk-reference">
                  View SDK Docs
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
