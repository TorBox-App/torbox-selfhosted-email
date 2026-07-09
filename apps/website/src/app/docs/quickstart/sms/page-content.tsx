"use client";

import { Badge } from "@wraps/ui/components/ui/badge";
import { Button } from "@wraps/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@wraps/ui/components/ui/card";
import { ArrowRight, Target } from "lucide-react";
import Link from "next/link";
import { AwsCredentialsPrereqs } from "@/components/docs/aws-credentials-prereqs";
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
  npm: "npm install @wraps.dev/sms",
  pnpm: "pnpm add @wraps.dev/sms",
  yarn: "yarn add @wraps.dev/sms",
  bun: "bun add @wraps.dev/sms",
};

const sendSmsCode = `import { WrapsSMS } from '@wraps.dev/sms';

// Initialize the client
const sms = new WrapsSMS();

// Send an SMS
const result = await sms.send({
  to: '+14155551234',
  message: 'Your verification code is 123456',
});

console.log('SMS sent:', result.messageId);`;

export default function SmsQuickstartPageContent() {
  return (
    <DocsLayout>
      {/* Page Header */}
      <div className="mb-12">
        <Badge className="mb-4" variant="outline">
          SMS Quickstart
        </Badge>
        <h1 className="mb-4 font-bold text-4xl tracking-tight">
          Get Started with SMS
        </h1>
        <p className="text-lg text-muted-foreground">
          Deploy production-ready SMS infrastructure to your AWS account and
          send your first text message.
        </p>
      </div>

      {/* Prerequisites — must come before any command */}
      <AwsCredentialsPrereqs />

      {/* Outcome Preview */}
      <div className="mb-8 rounded-lg border bg-muted/50 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <p className="font-medium text-sm">What you'll build</p>
        </div>
        <ul className="mb-3 list-disc space-y-1 pl-5 text-muted-foreground text-sm">
          <li>AWS End User Messaging with a provisioned phone number</li>
          <li>Automatic opt-out management for compliance</li>
          <li>Your first SMS sent via the TypeScript SDK</li>
        </ul>
        <p className="text-muted-foreground text-xs">Time: ~3 minutes</p>
      </div>

      {/* Step 1: Deploy Infrastructure */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            1
          </div>
          Deploy Infrastructure
        </h2>
        <p className="mb-4 text-muted-foreground">
          Run the Wraps CLI to deploy SMS infrastructure to your AWS account:
        </p>
        <CodeBlock
          className="h-auto"
          data={[
            {
              language: "bash",
              filename: "terminal.sh",
              code: "npx @wraps.dev/cli sms init",
            },
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
              Provisions a toll-free number and sets up AWS End User Messaging
            </li>
            <li>Deploys IAM roles for secure OIDC authentication</li>
          </ul>
        </div>
      </section>

      {/* Step 2: Install SDK */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            2
          </div>
          Install the TypeScript SDK
        </h2>
        <p className="mb-4 text-muted-foreground">
          Install the{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">@wraps.dev/sms</code>{" "}
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

      {/* Step 3: Send Your First SMS */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            3
          </div>
          Send Your First SMS
        </h2>
        <p className="mb-4 text-muted-foreground">
          Create a new file and send an SMS using the SDK:
        </p>
        <CodeBlock
          className="mb-4 h-auto"
          data={[
            {
              language: "typescript",
              filename: "send-sms.ts",
              code: sendSmsCode,
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
        <div className="rounded-lg border-primary border-l-4 bg-primary/10 p-4">
          <p className="font-medium text-sm">Note: Phone Number Format</p>
          <p className="mt-2 text-muted-foreground text-sm">
            Phone numbers must be in E.164 format (e.g.,{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">+14155551234</code>
            ). The SDK will validate the format before sending.
          </p>
        </div>
      </section>

      {/* Next Steps */}
      <section className="mb-12">
        <h2 className="mb-6 font-bold text-2xl">Next Steps</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">SMS SDK Reference</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Learn about batch sending, opt-out management, and advanced
                features.
              </p>
              <Button asChild variant="outline">
                <Link href="/docs/sms-sdk-reference">
                  View SDK Docs
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">CLI Commands</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Explore all CLI commands for managing your SMS infrastructure.
              </p>
              <Button asChild variant="outline">
                <Link href="/docs/cli-reference">
                  View CLI Docs
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">SMS Infrastructure</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                See exactly what AWS resources get deployed to your account.
              </p>
              <Button asChild variant="outline">
                <Link href="/docs/infrastructure/sms">
                  View Infrastructure
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">Infrastructure as Code</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Deploy with{" "}
                <Link
                  className="text-primary underline"
                  href="/docs/cdk-reference"
                >
                  CDK
                </Link>{" "}
                or{" "}
                <Link
                  className="text-primary underline"
                  href="/docs/pulumi-reference"
                >
                  Pulumi
                </Link>{" "}
                instead of the CLI.
              </p>
              <Button asChild variant="outline">
                <Link href="/docs/cdk-reference">
                  View CDK Docs
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
