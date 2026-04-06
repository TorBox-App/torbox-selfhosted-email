"use client";

import { ArrowRight, CheckCircle2, Target } from "lucide-react";
import Link from "next/link";
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

const workflowCode = `import {
  defineWorkflow,
  sendEmail,
  delay,
  condition,
  exit,
} from '@wraps.dev/client';

export default defineWorkflow({
  name: 'Welcome Sequence',
  trigger: {
    type: 'contact_created',
  },

  steps: [
    sendEmail('send-welcome', { template: 'welcome-email' }),
    delay('wait-1-day', { days: 1 }),
    condition('check-activated', {
      field: 'contact.hasActivated',
      operator: 'equals',
      value: true,
      branches: {
        yes: [exit('already-active')],
        no: [
          sendEmail('send-tips', { template: 'getting-started-tips' }),
        ],
      },
    }),
  ],
});`;

const triggerCode = `import { Wraps } from '@wraps.dev/email';

const wraps = new Wraps();

// Trigger a workflow via the SDK
await wraps.workflows.trigger({
  workflow: 'welcome-sequence',
  contact: {
    email: 'user@example.com',
    firstName: 'Alex',
  },
});`;

function CodeExample({
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

export default function WorkflowsQuickstartPageContent() {
  return (
    <DocsLayout>
      {/* Page Header */}
      <div className="mb-12">
        <Badge className="mb-4" variant="outline">
          Workflows Quickstart
        </Badge>
        <h1 className="mb-4 font-bold text-4xl tracking-tight">
          Get Started with Workflows
        </h1>
        <p className="text-lg text-muted-foreground">
          Define automated email sequences as TypeScript and deploy them in
          minutes. No drag-and-drop builders, no YAML — just code.
        </p>
      </div>

      {/* Outcome Preview */}
      <div className="mb-8 rounded-lg border bg-muted/50 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <p className="font-medium text-sm">What you'll build</p>
        </div>
        <ul className="mb-3 list-disc space-y-1 pl-5 text-muted-foreground text-sm">
          <li>An automated email sequence defined as TypeScript</li>
          <li>Local validation to catch errors before deploying</li>
          <li>A production workflow triggered by contact events or the SDK</li>
        </ul>
        <p className="text-muted-foreground text-xs">Time: ~5 minutes</p>
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
            <li>
              Email infrastructure deployed via{" "}
              <code className="rounded bg-muted px-1.5 py-0.5">
                wraps email init
              </code>
            </li>
            <li>
              A Wraps Platform account (
              <a
                className="text-primary underline"
                href="https://app.wraps.dev/auth?mode=signup&plan=starter"
                rel="noopener noreferrer"
                target="_blank"
              >
                sign up
              </a>
              )
            </li>
            <li>
              At least one email template pushed via{" "}
              <code className="rounded bg-muted px-1.5 py-0.5">
                wraps email templates push
              </code>{" "}
              (workflows reference templates by slug)
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Step 1: Initialize Workflows */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            1
          </div>
          Initialize Workflows
        </h2>
        <p className="mb-4 text-muted-foreground">
          Scaffold the workflows directory with an example workflow and config:
        </p>
        <CodeExample
          code="npx @wraps.dev/cli email workflows init"
          filename="terminal.sh"
          language="bash"
        />
        <div className="mt-4 rounded-lg border-primary border-l-4 bg-primary/10 p-4">
          <p className="font-medium text-sm">What gets created</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground text-sm">
            <li>
              <code className="rounded bg-muted px-1 py-0.5">
                wraps/workflows/
              </code>{" "}
              — directory for your workflow files
            </li>
            <li>
              <code className="rounded bg-muted px-1 py-0.5">
                wraps/workflows/welcome.ts
              </code>{" "}
              — example welcome sequence
            </li>
            <li>
              <code className="rounded bg-muted px-1 py-0.5">
                wraps/wraps.config.ts
              </code>{" "}
              — project config (created if missing)
            </li>
          </ul>
        </div>
      </section>

      {/* Step 2: Write a Workflow */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            2
          </div>
          Write a Workflow
        </h2>
        <p className="mb-4 text-muted-foreground">
          Each workflow is a TypeScript file that exports a{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">defineWorkflow</code>{" "}
          call. Here is a welcome sequence that sends an email, waits a day,
          then branches based on whether the contact activated:
        </p>
        <CodeExample
          code={workflowCode}
          filename="wraps/workflows/welcome.ts"
          language="typescript"
        />
        <div className="mt-4 rounded-lg border-primary border-l-4 bg-primary/10 p-4">
          <p className="font-medium text-sm">Key concepts</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground text-sm">
            <li>
              <strong>Trigger</strong> — what starts the workflow (e.g.{" "}
              <code className="rounded bg-muted px-1 py-0.5">
                contact_created
              </code>
              , <code className="rounded bg-muted px-1 py-0.5">event</code>,{" "}
              <code className="rounded bg-muted px-1 py-0.5">schedule</code>)
            </li>
            <li>
              <strong>Steps</strong> — sequential actions:{" "}
              <code className="rounded bg-muted px-1 py-0.5">sendEmail</code>,{" "}
              <code className="rounded bg-muted px-1 py-0.5">delay</code>,{" "}
              <code className="rounded bg-muted px-1 py-0.5">condition</code>,{" "}
              <code className="rounded bg-muted px-1 py-0.5">waitForEvent</code>
              , <code className="rounded bg-muted px-1 py-0.5">exit</code>, and
              more
            </li>
            <li>
              <strong>Template slugs</strong> — reference templates you have
              already pushed (e.g.{" "}
              <code className="rounded bg-muted px-1 py-0.5">
                welcome-email
              </code>
              )
            </li>
            <li>
              <strong>Step IDs</strong> — unique kebab-case identifiers for each
              step
            </li>
          </ul>
        </div>
      </section>

      {/* Step 3: Validate Locally */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            3
          </div>
          Validate Locally
        </h2>
        <p className="mb-4 text-muted-foreground">
          Run validation to catch errors before pushing. This checks for unique
          step IDs, valid template references, correct trigger configuration,
          and more:
        </p>
        <CodeExample
          code="wraps email workflows validate"
          filename="terminal.sh"
          language="bash"
        />
        <p className="mt-4 text-muted-foreground text-sm">
          To validate a specific workflow, pass the{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">--workflow</code>{" "}
          flag:
        </p>
        <div className="mt-2">
          <CodeExample
            code="wraps email workflows validate --workflow welcome"
            filename="terminal.sh"
            language="bash"
          />
        </div>
      </section>

      {/* Step 4: Push to Production */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            4
          </div>
          Push to Production
        </h2>
        <p className="mb-4 text-muted-foreground">
          Push your workflows to the Wraps Platform where they will be executed
          automatically when their triggers fire:
        </p>
        <CodeExample
          code="wraps email workflows push"
          filename="terminal.sh"
          language="bash"
        />
        <div className="mt-4 rounded-lg border-primary border-l-4 bg-primary/10 p-4">
          <p className="font-medium text-sm">Useful flags</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground text-sm">
            <li>
              <code className="rounded bg-muted px-1 py-0.5">--dry-run</code> —
              preview changes without pushing
            </li>
            <li>
              <code className="rounded bg-muted px-1 py-0.5">--draft</code> —
              push as draft without enabling the workflow
            </li>
            <li>
              <code className="rounded bg-muted px-1 py-0.5">
                --workflow welcome
              </code>{" "}
              — push a specific workflow only
            </li>
          </ul>
        </div>
      </section>

      {/* Step 5: Trigger a Workflow */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            5
          </div>
          Trigger a Workflow
        </h2>
        <p className="mb-4 text-muted-foreground">
          Workflows with{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            contact_created
          </code>{" "}
          triggers fire automatically when contacts are added. For{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">event</code> or{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">api</code> triggers,
          use the SDK:
        </p>
        <CodeExample
          code={triggerCode}
          filename="trigger-workflow.ts"
          language="typescript"
        />
      </section>

      {/* Next Steps */}
      <section className="mb-12">
        <h2 className="mb-6 font-bold text-2xl">Next Steps</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">Building Workflows</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Full guide covering all step helpers, trigger types, conditions,
                and advanced patterns.
              </p>
              <Button asChild variant="outline">
                <Link href="/docs/guides/workflows">
                  Workflow Guide
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">Custom Events</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Trigger workflows from your own application events like
                purchases, signups, or cart abandonment.
              </p>
              <Button asChild variant="outline">
                <Link href="/docs/guides/custom-events">
                  Custom Events Guide
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">
                Cross-Channel Orchestration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Use cascade steps to coordinate email and SMS in a single
                workflow.
              </p>
              <Button asChild variant="outline">
                <Link href="/docs/guides/orchestration">
                  Orchestration Guide
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">Templates as Code</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Write the email templates your workflows reference as React
                components.
              </p>
              <Button asChild variant="outline">
                <Link href="/docs/guides/templates">
                  Template Guide
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
