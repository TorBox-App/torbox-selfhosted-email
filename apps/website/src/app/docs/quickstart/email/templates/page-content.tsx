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

const scaffoldOutput = `wraps/
├── wraps.config.ts          # Project configuration
├── templates/
│   └── welcome.tsx          # Example template
├── brand.ts                 # Brand kit (colors, fonts, logo)
└── _components/             # Shared components`;

const templateCode = `import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import { Footer } from './_components/footer';

export const subject = 'Welcome to {{companyName}}, {{firstName}}!';
export const emailType = 'transactional' as const;
export const previewText = "We're glad to have you on board.";

export const testData = {
  firstName: 'Jane',
  companyName: 'Acme',
  unsubscribeUrl: 'https://example.com/unsubscribe',
};

interface Props {
  firstName: string;
  companyName: string;
  unsubscribeUrl: string;
}

export default function WelcomeEmail({
  firstName,
  companyName,
  unsubscribeUrl,
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={{ backgroundColor: '#f6f9fc', fontFamily: 'system-ui, sans-serif' }}>
        <Container style={{ margin: '0 auto', padding: '40px 0', maxWidth: '580px' }}>
          <Section style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '40px' }}>
            <Heading style={{ fontSize: '24px', color: '#1f2937' }}>
              Welcome, {firstName}!
            </Heading>
            <Text style={{ fontSize: '16px', color: '#4b5563', lineHeight: '1.6' }}>
              Thanks for signing up for {companyName}. We're excited to have you on board.
            </Text>
          </Section>
          <Footer unsubscribeUrl={unsubscribeUrl} />
        </Container>
      </Body>
    </Html>
  );
}`;

const sendCode = `import { WrapsEmail } from '@wraps.dev/email';

const email = new WrapsEmail();

// Sending via the SDK calls SES directly from your AWS account.
// You provide the unsubscribe URL — it points at an endpoint you own.
// See "Unsubscribe handling" below for the platform-managed alternative.
await email.sendTemplate({
  from: 'hello@yourdomain.com',
  to: 'user@example.com',
  template: 'welcome',
  templateData: {
    firstName: 'Alice',
    companyName: 'Acme',
    unsubscribeUrl: 'https://yourdomain.com/unsubscribe?token=abc123',
  },
});`;

const broadcastTemplateCode = `export const emailType = 'marketing' as const;

// In any marketing template, reference the Wraps-managed placeholder.
// When sent via a broadcast or workflow, Wraps generates a signed,
// per-recipient URL and substitutes it at send time.
<Footer unsubscribeUrl={unsubscribeUrl} />

// {{preferencesUrl}} is also auto-injected if you want a
// "manage preferences" link instead of a hard unsubscribe.`;

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

export default function TemplatesQuickstartPageContent() {
  return (
    <DocsLayout>
      {/* Page Header */}
      <div className="mb-12">
        <Badge className="mb-4" variant="outline">
          Templates Quickstart
        </Badge>
        <h1 className="mb-4 font-bold text-4xl tracking-tight">
          Get Started with Templates
        </h1>
        <p className="text-lg text-muted-foreground">
          Build email templates as React components, preview them with
          hot-reload, and push to AWS SES — all from your codebase.
        </p>
      </div>

      {/* Outcome Preview */}
      <div className="mb-8 rounded-lg border bg-muted/50 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <p className="font-medium text-sm">What you'll build</p>
        </div>
        <ul className="mb-3 list-disc space-y-1 pl-5 text-muted-foreground text-sm">
          <li>A templates-as-code project with React Email components</li>
          <li>Hot-reload local preview for rapid iteration</li>
          <li>Templates pushed to AWS SES and ready to send</li>
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
            <li>Node.js 20 or later installed</li>
            <li>
              Email infrastructure deployed via{" "}
              <code className="rounded bg-muted px-1.5 py-0.5">
                wraps email init
              </code>{" "}
              (see the{" "}
              <Link
                className="font-medium text-primary underline"
                href="/docs/quickstart/email"
              >
                Email Quickstart
              </Link>
              )
            </li>
            <li>
              A Wraps account with an organization (
              <code className="rounded bg-muted px-1.5 py-0.5">
                wraps auth login
              </code>
              )
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Step 1: Initialize */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            1
          </div>
          Initialize Templates
        </h2>
        <p className="mb-4 text-muted-foreground">
          Run the scaffold command from your project root to create the
          templates directory:
        </p>
        <CodeExample
          code="npx @wraps.dev/cli email templates init"
          filename="terminal.sh"
          language="bash"
        />
        <p className="mt-4 mb-4 text-muted-foreground">
          This creates the following structure in your project:
        </p>
        <CodeExample
          code={scaffoldOutput}
          filename="Project Structure"
          language="text"
        />
        <div className="mt-4 rounded-lg border-primary border-l-4 bg-primary/10 p-4">
          <p className="font-medium text-sm">What gets scaffolded?</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground text-sm">
            <li>
              <code className="rounded bg-muted px-1.5 py-0.5">
                wraps.config.ts
              </code>{" "}
              — project config (org, sender address, template directory)
            </li>
            <li>
              <code className="rounded bg-muted px-1.5 py-0.5">brand.ts</code> —
              shared brand kit for colors, fonts, and logos
            </li>
            <li>
              <code className="rounded bg-muted px-1.5 py-0.5">
                templates/welcome.tsx
              </code>{" "}
              — a working example template
            </li>
          </ul>
        </div>
      </section>

      {/* Step 2: Write a Template */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            2
          </div>
          Write a Template
        </h2>
        <p className="mb-4 text-muted-foreground">
          Templates are React components built with{" "}
          <a
            className="font-medium text-primary underline"
            href="https://react.email"
            rel="noopener noreferrer"
            target="_blank"
          >
            React Email
          </a>
          . Each file exports the component as default, plus metadata for the
          subject line, email type, and preview text. Here is the scaffolded
          example:
        </p>
        <CodeExample
          code={templateCode}
          filename="wraps/templates/welcome.tsx"
          language="tsx"
        />
        <div className="mt-4 rounded-lg border-primary border-l-4 bg-primary/10 p-4">
          <p className="font-medium text-sm">Variable interpolation</p>
          <p className="mt-1 text-muted-foreground text-sm">
            Use{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">
              {"{{variableName}}"}
            </code>{" "}
            syntax in the{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">subject</code>{" "}
            export. These are replaced with values from{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">templateData</code>{" "}
            at send time.
          </p>
        </div>
      </section>

      {/* Step 3: Preview */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            3
          </div>
          Preview Locally
        </h2>
        <p className="mb-4 text-muted-foreground">
          Start the local preview server to see your templates rendered in the
          browser with hot-reload:
        </p>
        <CodeExample
          code={
            "npx @wraps.dev/cli email templates preview\n# Opens http://localhost:3333 with hot-reload"
          }
          filename="terminal.sh"
          language="bash"
        />
        <p className="mt-4 text-muted-foreground text-sm">
          The preview server watches for file changes and reloads automatically.
          Test data from the{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">testData</code>{" "}
          export is used to populate the template in the preview UI.
        </p>
      </section>

      {/* Step 4: Push */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            4
          </div>
          Push to Production
        </h2>
        <p className="mb-4 text-muted-foreground">
          Push your templates to both AWS SES and the Wraps dashboard. Only
          modified templates are pushed by default:
        </p>
        <CodeExample
          code={"npx @wraps.dev/cli email templates push"}
          filename="terminal.sh"
          language="bash"
        />
        <div className="mt-4 rounded-lg border-primary border-l-4 bg-primary/10 p-4">
          <p className="font-medium text-sm">Useful flags</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground text-sm">
            <li>
              <code className="rounded bg-muted px-1.5 py-0.5">
                --template welcome
              </code>{" "}
              — push a single template
            </li>
            <li>
              <code className="rounded bg-muted px-1.5 py-0.5">--dry-run</code>{" "}
              — see what would change without pushing
            </li>
            <li>
              <code className="rounded bg-muted px-1.5 py-0.5">--force</code> —
              re-push all templates regardless of changes
            </li>
          </ul>
        </div>
      </section>

      {/* Step 5: Send */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            5
          </div>
          Send Using the Template
        </h2>
        <p className="mb-4 text-muted-foreground">
          Once pushed, send emails using the template name and pass dynamic data
          via the SDK:
        </p>
        <CodeExample code={sendCode} filename="send.ts" language="typescript" />
        <p className="mt-4 text-muted-foreground text-sm">
          Template data is merged at send time. Variable placeholders in the
          subject line (like{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            {"{{firstName}}"}
          </code>
          ) are also replaced automatically.
        </p>
      </section>

      {/* Unsubscribe Handling */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Unsubscribe handling</h2>
        <p className="mb-6 text-muted-foreground">
          Every variable accessed on the template's props (including{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">unsubscribeUrl</code>
          ) is compiled into a{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            {"{{unsubscribeUrl}}"}
          </code>{" "}
          placeholder in the template pushed to SES. What fills that
          placeholder at send time depends on how you send:
        </p>

        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">SDK (your SES)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground text-sm">
              <p>
                <code className="rounded bg-muted px-1.5 py-0.5">
                  @wraps.dev/email
                </code>{" "}
                calls SES directly from your AWS account. Wraps is not in the
                path.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  You pass{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    unsubscribeUrl
                  </code>{" "}
                  in{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    templateData
                  </code>
                  — it points at an endpoint you own.
                </li>
                <li>
                  You run the unsubscribe handler and maintain your own
                  suppression list (or use{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    email.suppression
                  </code>
                  ).
                </li>
                <li>
                  No{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    List-Unsubscribe
                  </code>{" "}
                  headers are added for you — add them with the{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    headers
                  </code>{" "}
                  option if you need RFC 8058 one-click unsubscribe.
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Platform broadcasts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground text-sm">
              <p>
                When the send goes through a Wraps broadcast or workflow step,
                Wraps handles unsubscribe end-to-end.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  Wraps generates a signed, per-recipient URL and substitutes{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    {"{{unsubscribeUrl}}"}
                  </code>{" "}
                  at send time.
                </li>
                <li>
                  Clicks land on the hosted unsubscribe page, suppress the
                  contact, and emit a workflow event — no endpoint to build.
                </li>
                <li>
                  Requires{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    export const emailType = 'marketing' as const;
                  </code>{" "}
                  on the template. That flag also enables RFC 8058{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    List-Unsubscribe
                  </code>{" "}
                  and{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    List-Unsubscribe-Post
                  </code>{" "}
                  headers for Gmail/Apple Mail one-click unsubscribe.
                </li>
                <li>
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    {"{{preferencesUrl}}"}
                  </code>{" "}
                  is available alongside{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    {"{{unsubscribeUrl}}"}
                  </code>{" "}
                  if you prefer a preferences page over a hard unsubscribe.
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <p className="mb-3 text-muted-foreground">
          The template file itself is the same for both paths. Mark marketing
          templates with the <code>emailType</code> flag and reference the
          placeholder:
        </p>
        <CodeExample
          code={broadcastTemplateCode}
          filename="wraps/templates/newsletter.tsx"
          language="tsx"
        />
      </section>

      {/* Next Steps */}
      <section className="mb-12">
        <h2 className="mb-6 font-bold text-2xl">Next Steps</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">Templates Guide</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Configuration, brand kits, change detection, and advanced
                template patterns.
              </p>
              <Button asChild variant="outline">
                <Link href="/docs/guides/templates">
                  Full Guide
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">Email SDK Reference</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                All available methods for sending emails and managing templates
                programmatically.
              </p>
              <Button asChild variant="outline">
                <Link href="/docs/sdk-reference">
                  View SDK Docs
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
