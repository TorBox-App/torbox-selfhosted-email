"use client";

import { ArrowLeft, ArrowRight, Terminal } from "lucide-react";
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

function CLICommand({ command }: { command: string }) {
  return (
    <CodeBlock
      className="h-auto"
      data={[{ language: "bash", filename: "terminal.sh", code: command }]}
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

export default function CLIReferenceEmailPage() {
  return (
    <DocsLayout>
      {/* Breadcrumb */}
      <div className="mb-6">
        <Button asChild className="gap-2" size="sm" variant="ghost">
          <a href="/docs/cli-reference">
            <ArrowLeft className="h-4 w-4" />
            CLI Reference
          </a>
        </Button>
      </div>

      {/* Page Header */}
      <div className="mb-12">
        <Badge className="mb-4" variant="outline">
          CLI Reference / Email
        </Badge>
        <h1 className="mb-4 font-bold text-4xl tracking-tight">
          Email Commands
        </h1>
        <p className="text-lg text-muted-foreground">
          Deploy and manage AWS SES email infrastructure with event tracking,
          analytics, and domain management.
        </p>
      </div>

      {/* wraps email init */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Terminal className="h-6 w-6 text-primary" />
          wraps email init
        </h2>
        <p className="mb-4 text-muted-foreground">
          Deploy new email infrastructure to your AWS account. This is the
          primary command for setting up Wraps email for the first time.
        </p>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <CLICommand command="npx @wraps.dev/cli email init [options]" />
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Options</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <code className="rounded bg-muted px-2 py-1">
                  -d, --domain &lt;domain&gt;
                </code>
                <p className="mt-2 text-muted-foreground text-sm">
                  Domain to configure for sending emails (e.g., yourdomain.com)
                </p>
              </div>
              <div>
                <code className="rounded bg-muted px-2 py-1">
                  -r, --region &lt;region&gt;
                </code>
                <p className="mt-2 text-muted-foreground text-sm">
                  AWS region to deploy infrastructure (default: us-east-1)
                </p>
              </div>
              <div>
                <code className="rounded bg-muted px-2 py-1">
                  --preset &lt;preset&gt;
                </code>
                <p className="mt-2 text-muted-foreground text-sm">
                  Configuration preset: starter, production, enterprise, or
                  custom
                </p>
              </div>
              <div>
                <code className="rounded bg-muted px-2 py-1">
                  -p, --provider &lt;provider&gt;
                </code>
                <p className="mt-2 text-muted-foreground text-sm">
                  Hosting provider: vercel, lambda, ecs, or ec2
                </p>
              </div>
              <div>
                <code className="rounded bg-muted px-2 py-1">--preview</code>
                <p className="mt-2 text-muted-foreground text-sm">
                  Preview infrastructure changes without deploying
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">What It Does</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
              <li>Validates your AWS credentials and account access</li>
              <li>
                Prompts for configuration preferences (if not provided via
                flags)
              </li>
              <li>
                Shows estimated monthly AWS costs based on selected features
              </li>
              <li>
                Deploys AWS SES, DynamoDB, Lambda, EventBridge, SQS, and IAM
                roles
              </li>
              <li>
                Sets up OIDC provider for Vercel deployments (if selected)
              </li>
              <li>Creates configuration metadata for future commands</li>
              <li>Takes 1-2 minutes to complete</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Examples</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-2 text-muted-foreground text-sm">
                Interactive setup (recommended for first time):
              </p>
              <CLICommand command="npx @wraps.dev/cli email init" />
            </div>
            <div className="mt-4">
              <p className="mb-2 text-muted-foreground text-sm">
                Non-interactive with all options:
              </p>
              <CLICommand command="npx @wraps.dev/cli email init --domain yourdomain.com --region us-west-2 --preset production --provider vercel" />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* wraps email status */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Terminal className="h-6 w-6 text-primary" />
          wraps email status
        </h2>
        <p className="mb-4 text-muted-foreground">
          Display detailed status for email infrastructure, including SES
          domains, verification status, and configuration details.
        </p>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <CLICommand command="npx @wraps.dev/cli email status" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What It Displays</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
              <li>SES domain verification and DKIM status</li>
              <li>MAIL FROM domain configuration</li>
              <li>Active features and preset</li>
              <li>Deployed AWS resources</li>
              <li>DNS records that need configuration</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* wraps email domains */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Terminal className="h-6 w-6 text-primary" />
          wraps email domains
        </h2>
        <p className="mb-4 text-muted-foreground">
          Manage domains in AWS SES. Add domains, list all configured domains,
          retrieve DKIM tokens, verify DNS records, and remove domains from SES.
        </p>

        {/* domains add */}
        <div className="mb-8 ml-4">
          <h3 className="mb-3 font-semibold text-xl">
            wraps email domains add
          </h3>
          <p className="mb-4 text-muted-foreground text-sm">
            Add a new domain to AWS SES with DKIM signing enabled.
          </p>
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-lg">Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <CLICommand command="npx @wraps.dev/cli email domains add -d <domain>" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Options</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li>
                  <code className="rounded bg-muted px-2 py-1">
                    -d, --domain &lt;domain&gt;
                  </code>{" "}
                  <span className="text-muted-foreground">
                    (required) Domain name to add
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* domains list */}
        <div className="mb-8 ml-4">
          <h3 className="mb-3 font-semibold text-xl">
            wraps email domains list
          </h3>
          <p className="mb-4 text-muted-foreground text-sm">
            List all domains configured in AWS SES with their verification and
            DKIM status.
          </p>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <CLICommand command="npx @wraps.dev/cli email domains list" />
            </CardContent>
          </Card>
        </div>

        {/* domains get-dkim */}
        <div className="mb-8 ml-4">
          <h3 className="mb-3 font-semibold text-xl">
            wraps email domains get-dkim
          </h3>
          <p className="mb-4 text-muted-foreground text-sm">
            Retrieve DKIM tokens for a domain to configure DNS records.
          </p>
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-lg">Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <CLICommand command="npx @wraps.dev/cli email domains get-dkim -d <domain>" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Options</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li>
                  <code className="rounded bg-muted px-2 py-1">
                    -d, --domain &lt;domain&gt;
                  </code>{" "}
                  <span className="text-muted-foreground">
                    (required) Domain name to get DKIM tokens for
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* domains verify */}
        <div className="mb-8 ml-4">
          <h3 className="mb-3 font-semibold text-xl">
            wraps email domains verify
          </h3>
          <p className="mb-4 text-muted-foreground text-sm">
            Check the DNS verification status of a domain, including DKIM, SPF,
            and DMARC records.
          </p>
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-lg">Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <CLICommand command="npx @wraps.dev/cli email domains verify -d <domain>" />
            </CardContent>
          </Card>
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-lg">What It Checks</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
                <li>SES domain verification status</li>
                <li>DKIM DNS records (3 CNAME records)</li>
                <li>SPF record (TXT record for sender verification)</li>
                <li>
                  DMARC record (TXT record for email authentication policy)
                </li>
                <li>MAIL FROM MX records (if custom MAIL FROM configured)</li>
                <li>Provides copy-paste ready DNS record values</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* domains remove */}
        <div className="mb-8 ml-4">
          <h3 className="mb-3 font-semibold text-xl">
            wraps email domains remove
          </h3>
          <p className="mb-4 text-muted-foreground text-sm">
            Remove a domain from AWS SES. This action cannot be undone.
          </p>
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-lg">Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <CLICommand command="npx @wraps.dev/cli email domains remove -d <domain>" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Options</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li>
                  <code className="rounded bg-muted px-2 py-1">
                    -d, --domain &lt;domain&gt;
                  </code>{" "}
                  <span className="text-muted-foreground">
                    (required) Domain name to remove
                  </span>
                </li>
                <li>
                  <code className="rounded bg-muted px-2 py-1">
                    -f, --force
                  </code>{" "}
                  <span className="text-muted-foreground">
                    Skip confirmation prompt
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* wraps email connect */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Terminal className="h-6 w-6 text-primary" />
          wraps email connect
        </h2>
        <p className="mb-4 text-muted-foreground">
          Connect to existing AWS SES resources and add Wraps features
          non-destructively. Never modifies your existing SES setup.
        </p>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <CLICommand command="npx @wraps.dev/cli email connect [options]" />
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Options</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <code className="rounded bg-muted px-2 py-1">
                  --region &lt;region&gt;
                </code>
                <p className="mt-2 text-muted-foreground text-sm">
                  AWS region to scan for existing resources
                </p>
              </div>
              <div>
                <code className="rounded bg-muted px-2 py-1">--preview</code>
                <p className="mt-2 text-muted-foreground text-sm">
                  Preview infrastructure changes without deploying
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What It Does</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
              <li>Scans existing SES domains and configuration sets</li>
              <li>Prompts for which features to add</li>
              <li>
                Creates new resources with{" "}
                <code className="rounded bg-muted px-1 py-0.5">wraps-</code>{" "}
                prefix
              </li>
              <li>Never modifies or deletes existing resources</li>
              <li>Configures event tracking and analytics</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* wraps email upgrade */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Terminal className="h-6 w-6 text-primary" />
          wraps email upgrade
        </h2>
        <p className="mb-4 text-muted-foreground">
          Add additional features to your existing Wraps deployment. Upgrade
          from Starter to Production, or add individual features incrementally.
        </p>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <CLICommand command="npx @wraps.dev/cli email upgrade [options]" />
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">What It Does</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
              <li>Shows currently enabled features</li>
              <li>Prompts for additional features to enable</li>
              <li>Deploys new resources incrementally</li>
              <li>Updates IAM policies with new permissions</li>
              <li>Shows updated cost estimates</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Example Upgrades</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
              <li>
                Starter → Production: Adds real-time event tracking and 90-day
                history
              </li>
              <li>
                Production → Enterprise: Adds dedicated IP and 1-year history
                retention
              </li>
              <li>
                Add individual features: Enable specific event types or extend
                storage
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* wraps email sync */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Terminal className="h-6 w-6 text-primary" />
          wraps email sync
        </h2>
        <p className="mb-4 text-muted-foreground">
          Synchronize your local configuration with deployed infrastructure.
          Useful after CLI updates.
        </p>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <CLICommand command="npx @wraps.dev/cli email sync [options]" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What It Does</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
              <li>
                Detects differences between local config and deployed
                infrastructure
              </li>
              <li>
                Applies CLI updates (bug fixes, new features) to resources
              </li>
              <li>Updates Lambda functions and IAM policies</li>
              <li>Does not change your configuration preset or features</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* wraps email restore */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Terminal className="h-6 w-6 text-primary" />
          wraps email restore
        </h2>
        <p className="mb-4 text-muted-foreground">
          Restore Wraps deployment from existing metadata. Useful if you've lost
          local configuration but infrastructure still exists in AWS.
        </p>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <CLICommand command="npx @wraps.dev/cli email restore [options]" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What It Does</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
              <li>Scans AWS for existing Wraps resources</li>
              <li>Reconstructs deployment metadata</li>
              <li>Re-imports Pulumi stack state</li>
              <li>Restores local configuration</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* wraps email destroy */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Terminal className="h-6 w-6 text-primary" />
          wraps email destroy
        </h2>
        <p className="mb-4 text-muted-foreground">
          Remove email infrastructure. Use this to remove only the email service
          while keeping other services intact.
        </p>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <CLICommand command="npx @wraps.dev/cli email destroy [options]" />
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Options</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <code className="rounded bg-muted px-2 py-1">-f, --force</code>
                <p className="mt-2 text-muted-foreground text-sm">
                  Skip confirmation prompt (use with caution)
                </p>
              </div>
              <div>
                <code className="rounded bg-muted px-2 py-1">--preview</code>
                <p className="mt-2 text-muted-foreground text-sm">
                  Preview what would be destroyed without making changes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What It Removes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
              <li>Email-specific IAM roles and policies</li>
              <li>DynamoDB tables (email history will be lost)</li>
              <li>Lambda functions for event processing</li>
              <li>EventBridge rules and SQS queues</li>
              <li>Route53 DNS records (DKIM, DMARC, MAIL FROM) if confirmed</li>
              <li>Local metadata for email service</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button asChild variant="outline">
          <a href="/docs/cli-reference">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to CLI Reference
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href="/docs/cli-reference/cdn">
            CDN Commands
            <ArrowRight className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </div>
    </DocsLayout>
  );
}
