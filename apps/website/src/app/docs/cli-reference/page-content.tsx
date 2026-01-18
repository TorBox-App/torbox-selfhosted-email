"use client";

import {
  ArrowRight,
  HardDrive,
  Mail,
  MessageSquare,
  Terminal,
} from "lucide-react";
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

// Helper component for CLI command blocks
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

export default function CLIReferencePageContent() {
  return (
    <DocsLayout>
      {/* Page Header */}
      <div className="mb-12">
        <Badge className="mb-4" variant="outline">
          CLI Reference
        </Badge>
        <h1 className="mb-4 font-bold text-4xl tracking-tight">
          Wraps CLI Commands
        </h1>
        <p className="text-lg text-muted-foreground">
          Complete reference for all Wraps CLI commands. Deploy, manage, and
          monitor your AWS communication infrastructure.
        </p>
        <div className="mt-4 rounded-lg border bg-muted/50 p-4">
          <p className="text-muted-foreground text-sm">
            <strong>Multi-Service Architecture:</strong> Wraps commands are
            organized by service (e.g.,{" "}
            <code className="rounded bg-background px-1.5 py-0.5">
              wraps email init
            </code>
            ,{" "}
            <code className="rounded bg-background px-1.5 py-0.5">
              wraps cdn init
            </code>
            ,{" "}
            <code className="rounded bg-background px-1.5 py-0.5">
              wraps sms init
            </code>
            ).
          </p>
        </div>
      </div>

      {/* Service Commands */}
      <section className="mb-12">
        <h2 className="mb-6 font-bold text-2xl">Service Commands</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5 text-primary" />
                Email Commands
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Deploy and manage AWS SES email infrastructure with event
                tracking, analytics, and domain management.
              </p>
              <Button asChild className="w-full" variant="outline">
                <a href="/docs/cli-reference/email">
                  View Email Commands
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <HardDrive className="h-5 w-5 text-primary" />
                CDN Commands
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Deploy S3 + CloudFront CDN infrastructure with browser-based
                image optimization.
              </p>
              <Button asChild className="w-full" variant="outline">
                <a href="/docs/cli-reference/cdn">
                  View CDN Commands
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card className="opacity-60 transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                SMS Commands
                <Badge className="ml-auto text-xs" variant="secondary">
                  Soon
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Deploy AWS End User Messaging (Pinpoint) for SMS and MMS. Coming
                soon.
              </p>
              <Button className="w-full" disabled variant="outline">
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Global Options */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Global Options</h2>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div>
                <code className="rounded bg-muted px-2 py-1">--help, -h</code>
                <p className="mt-2 text-muted-foreground text-sm">
                  Display help information for any command
                </p>
              </div>
              <div>
                <code className="rounded bg-muted px-2 py-1">
                  --version, -v
                </code>
                <p className="mt-2 text-muted-foreground text-sm">
                  Display the CLI version
                </p>
              </div>
              <div>
                <code className="rounded bg-muted px-2 py-1">--preview</code>
                <p className="mt-2 text-muted-foreground text-sm">
                  Preview infrastructure changes without deploying. Shows what
                  resources would be created, updated, or deleted along with
                  cost estimates. Available on all deployment commands (init,
                  connect, upgrade, restore, destroy).
                </p>
              </div>
              <div>
                <code className="rounded bg-muted px-2 py-1">-y, --yes</code>
                <p className="mt-2 text-muted-foreground text-sm">
                  Skip confirmation prompts for non-destructive operations
                </p>
              </div>
              <div>
                <code className="rounded bg-muted px-2 py-1">-f, --force</code>
                <p className="mt-2 text-muted-foreground text-sm">
                  Force destructive operations without confirmation
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* wraps status */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Terminal className="h-6 w-6 text-primary" />
          wraps status
        </h2>
        <p className="mb-4 text-muted-foreground">
          Display the current status of your Wraps infrastructure across all
          services, including deployed resources, active features, and
          configuration details.
        </p>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <CLICommand command="npx @wraps.dev/cli status" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What It Displays</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
              <li>AWS account and region</li>
              <li>All deployed services (email, cdn, sms)</li>
              <li>Active configuration preset and features per service</li>
              <li>Deployed AWS resources</li>
              <li>Links to console and documentation</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* wraps console */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Terminal className="h-6 w-6 text-primary" />
          wraps console
        </h2>
        <p className="mb-4 text-muted-foreground">
          Launch the local Wraps console to view analytics, event tracking, and
          infrastructure status across all services.
        </p>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <CLICommand command="npx @wraps.dev/cli console" />
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
                  --port &lt;port&gt;
                </code>
                <p className="mt-2 text-muted-foreground text-sm">
                  Port to run the console on (default: 5555)
                </p>
              </div>
              <div>
                <code className="rounded bg-muted px-2 py-1">--no-open</code>
                <p className="mt-2 text-muted-foreground text-sm">
                  Don't automatically open browser
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Features</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
              <li>Email history and search</li>
              <li>Delivery rates and analytics</li>
              <li>Bounce and complaint tracking</li>
              <li>Open and click rates</li>
              <li>CDN file management and uploads</li>
              <li>Infrastructure resource viewer</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* wraps destroy */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Terminal className="h-6 w-6 text-primary" />
          wraps destroy
        </h2>
        <p className="mb-4 text-muted-foreground">
          Remove all Wraps infrastructure from your AWS account across all
          services. This is a destructive operation that requires confirmation.
        </p>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <CLICommand command="npx @wraps.dev/cli destroy [options]" />
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
            <CardTitle className="text-lg">Important Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-muted-foreground text-sm">
              <p>
                Use service-specific destroy commands to remove individual
                services:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    wraps email destroy
                  </code>{" "}
                  - Remove email infrastructure only
                </li>
                <li>
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    wraps cdn destroy
                  </code>{" "}
                  - Remove CDN infrastructure only
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* wraps telemetry */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Terminal className="h-6 w-6 text-primary" />
          wraps telemetry
        </h2>
        <p className="mb-4 text-muted-foreground">
          Manage anonymous telemetry settings. Wraps collects anonymous usage
          data to improve the CLI. No personal information, domains, or AWS
          credentials are ever collected.
        </p>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <CLICommand command="npx @wraps.dev/cli telemetry         # Show current status" />
            <CLICommand command="npx @wraps.dev/cli telemetry enable  # Enable telemetry" />
            <CLICommand command="npx @wraps.dev/cli telemetry disable # Disable telemetry" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What We Collect</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
              <li>Command names and success/failure status</li>
              <li>CLI version and operating system</li>
              <li>
                <strong>Never collected:</strong> domains, AWS credentials,
                email content, or any PII
              </li>
            </ul>
            <p className="mt-4 text-muted-foreground text-sm">
              You can also disable telemetry by setting the environment variable{" "}
              <code className="rounded bg-muted px-1 py-0.5">
                WRAPS_TELEMETRY_DISABLED=1
              </code>
            </p>
          </CardContent>
        </Card>
      </section>

      {/* wraps completion */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Terminal className="h-6 w-6 text-primary" />
          wraps completion
        </h2>
        <p className="mb-4 text-muted-foreground">
          Generate shell completion scripts for bash, zsh, or fish. Enables
          tab-completion for all Wraps commands and options.
        </p>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <CLICommand command="npx @wraps.dev/cli completion" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Setup</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-muted-foreground text-sm">
              Add the output to your shell configuration file:
            </p>
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">
                <strong>Bash:</strong> Add to ~/.bashrc
              </p>
              <p className="text-muted-foreground text-sm">
                <strong>Zsh:</strong> Add to ~/.zshrc
              </p>
              <p className="text-muted-foreground text-sm">
                <strong>Fish:</strong> Add to ~/.config/fish/config.fish
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Configuration Files */}
      <section className="mb-12">
        <h2 className="mb-6 font-bold text-2xl">Configuration Files</h2>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div>
                <code className="rounded bg-muted px-2 py-1">~/.wraps/</code>
                <p className="mt-2 text-muted-foreground text-sm">
                  Main configuration directory containing deployment metadata
                  and Pulumi state
                </p>
              </div>
              <div>
                <code className="rounded bg-muted px-2 py-1">
                  ~/.wraps/connections/
                </code>
                <p className="mt-2 text-muted-foreground text-sm">
                  Deployment metadata files (one per AWS account/region
                  combination)
                </p>
              </div>
              <div>
                <code className="rounded bg-muted px-2 py-1">
                  ~/.wraps/pulumi/
                </code>
                <p className="mt-2 text-muted-foreground text-sm">
                  Pulumi stack state files for infrastructure management
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Environment Variables */}
      <section className="mb-12">
        <h2 className="mb-6 font-bold text-2xl">Environment Variables</h2>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div>
                <code className="rounded bg-muted px-2 py-1">AWS_PROFILE</code>
                <p className="mt-2 text-muted-foreground text-sm">
                  AWS CLI profile to use for authentication
                </p>
              </div>
              <div>
                <code className="rounded bg-muted px-2 py-1">AWS_REGION</code>
                <p className="mt-2 text-muted-foreground text-sm">
                  Default AWS region (can be overridden with --region flag)
                </p>
              </div>
              <div>
                <code className="rounded bg-muted px-2 py-1">
                  AWS_ACCESS_KEY_ID
                </code>
                <p className="mt-2 text-muted-foreground text-sm">
                  AWS access key (not recommended, use IAM roles or profiles
                  instead)
                </p>
              </div>
              <div>
                <code className="rounded bg-muted px-2 py-1">
                  AWS_SECRET_ACCESS_KEY
                </code>
                <p className="mt-2 text-muted-foreground text-sm">
                  AWS secret key (not recommended, use IAM roles or profiles
                  instead)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
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
