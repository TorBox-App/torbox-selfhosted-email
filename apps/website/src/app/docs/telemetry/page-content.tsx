"use client";

import { ArrowRight, Shield, Terminal } from "lucide-react";
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

export default function TelemetryPageContent() {
  return (
    <DocsLayout>
      {/* Page Header */}
      <div className="mb-12">
        <Badge className="mb-4" variant="outline">
          Privacy
        </Badge>
        <h1 className="mb-4 font-bold text-4xl tracking-tight">Telemetry</h1>
        <p className="text-lg text-muted-foreground">
          Wraps CLI collects anonymous usage data to help us improve the
          product. Your privacy is important to us.
        </p>
      </div>

      {/* Privacy Promise */}
      <section className="mb-12">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-4 p-6">
            <Shield className="mt-1 h-8 w-8 text-primary" />
            <div>
              <h2 className="mb-2 font-bold text-xl">Our Privacy Promise</h2>
              <p className="text-muted-foreground">
                We never collect personal information, domain names, AWS
                credentials, email content, or any data that could identify you
                or your users. Telemetry is completely optional and can be
                disabled at any time.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* What We Collect */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">What We Collect</h2>
        <Card className="mb-4">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div>
                <h3 className="mb-2 font-semibold">Command Usage</h3>
                <p className="text-muted-foreground text-sm">
                  Which CLI commands are used and whether they succeed or fail.
                  This helps us prioritize bug fixes and improvements.
                </p>
              </div>
              <div>
                <h3 className="mb-2 font-semibold">CLI Version</h3>
                <p className="text-muted-foreground text-sm">
                  The version of the Wraps CLI being used. This helps us
                  understand adoption of new releases.
                </p>
              </div>
              <div>
                <h3 className="mb-2 font-semibold">Operating System</h3>
                <p className="text-muted-foreground text-sm">
                  The platform (macOS, Linux, Windows) and Node.js version. This
                  helps us ensure compatibility.
                </p>
              </div>
              <div>
                <h3 className="mb-2 font-semibold">Error Codes</h3>
                <p className="text-muted-foreground text-sm">
                  When errors occur, we collect the error code (not the message)
                  to help identify common issues.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-destructive text-lg">
              What We Never Collect
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
              <li>Domain names or email addresses</li>
              <li>AWS credentials or account IDs</li>
              <li>Email content or recipient information</li>
              <li>IP addresses or location data</li>
              <li>Any personally identifiable information (PII)</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* How to Opt Out */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Terminal className="h-6 w-6 text-primary" />
          How to Opt Out
        </h2>
        <p className="mb-4 text-muted-foreground">
          You can disable telemetry at any time using any of these methods:
        </p>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Option 1: CLI Command</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Disable telemetry using the CLI:
            </p>
            <CLICommand command="npx @wraps.dev/cli telemetry disable" />
            <p className="text-muted-foreground text-sm">
              Re-enable telemetry:
            </p>
            <CLICommand command="npx @wraps.dev/cli telemetry enable" />
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">
              Option 2: Environment Variable
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Set the Wraps-specific environment variable:
            </p>
            <CLICommand command="export WRAPS_TELEMETRY_DISABLED=1" />
            <p className="text-muted-foreground text-sm">
              Or use the universal DO_NOT_TRACK standard:
            </p>
            <CLICommand command="export DO_NOT_TRACK=1" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Check Your Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              View your current telemetry settings:
            </p>
            <CLICommand command="npx @wraps.dev/cli telemetry" />
          </CardContent>
        </Card>
      </section>

      {/* Automatic Disabling */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Automatic Disabling</h2>
        <Card>
          <CardContent className="p-6">
            <p className="mb-4 text-muted-foreground">
              Telemetry is automatically disabled in certain environments to
              respect your privacy and avoid noise in automated pipelines:
            </p>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
              <li>
                <strong>CI/CD environments:</strong> Detected via common CI
                environment variables (CI, GITHUB_ACTIONS, GITLAB_CI, etc.)
              </li>
              <li>
                <strong>DO_NOT_TRACK=1:</strong> Respects the universal Do Not
                Track standard
              </li>
              <li>
                <strong>WRAPS_TELEMETRY_DISABLED=1:</strong> Wraps-specific
                opt-out
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Debug Mode */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Debug Mode</h2>
        <Card>
          <CardContent className="p-6">
            <p className="mb-4 text-muted-foreground">
              Want to see exactly what telemetry data would be sent? Enable
              debug mode to inspect events without sending them:
            </p>
            <CLICommand command="WRAPS_TELEMETRY_DEBUG=1 npx @wraps.dev/cli email init" />
            <p className="mt-4 text-muted-foreground text-sm">
              This will print the telemetry event to the console instead of
              sending it, so you can verify exactly what data would be
              collected.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Data Storage */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Data Storage & Retention</h2>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div>
                <h3 className="mb-2 font-semibold">Where Data is Stored</h3>
                <p className="text-muted-foreground text-sm">
                  Telemetry data is sent to our servers at wraps.dev and stored
                  in aggregate form. We do not share this data with third
                  parties.
                </p>
              </div>
              <div>
                <h3 className="mb-2 font-semibold">Anonymous IDs</h3>
                <p className="text-muted-foreground text-sm">
                  A random anonymous ID is generated locally and stored in your
                  config file (~/.wraps/telemetry.json). This ID is used only to
                  correlate events from the same installation and cannot be
                  traced back to you.
                </p>
              </div>
              <div>
                <h3 className="mb-2 font-semibold">Retention</h3>
                <p className="text-muted-foreground text-sm">
                  Telemetry data is retained for 90 days in raw form, then
                  aggregated into anonymous statistics.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Why We Collect */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Why We Collect Telemetry</h2>
        <Card>
          <CardContent className="p-6">
            <p className="mb-4 text-muted-foreground">
              As a small team building open-source tools, telemetry helps us:
            </p>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
              <li>
                <strong>Prioritize development:</strong> Understand which
                features are most used
              </li>
              <li>
                <strong>Fix bugs faster:</strong> Identify common errors and
                their frequency
              </li>
              <li>
                <strong>Improve compatibility:</strong> Know which platforms and
                Node.js versions to support
              </li>
              <li>
                <strong>Measure adoption:</strong> Track CLI version adoption to
                plan deprecations
              </li>
            </ul>
            <p className="mt-4 text-muted-foreground text-sm">
              We deeply appreciate users who leave telemetry enabled. It
              directly helps us make Wraps better for everyone.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Next Steps */}
      <section className="mb-12">
        <h2 className="mb-6 font-bold text-2xl">Related Documentation</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">CLI Reference</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Complete reference for all Wraps CLI commands.
              </p>
              <Button asChild variant="outline">
                <a href="/docs/cli-reference">
                  View CLI Docs
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">Getting Started</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                New to Wraps? Start with our quickstart guide.
              </p>
              <Button asChild variant="outline">
                <a href="/docs/quickstart">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Contact */}
      <Card className="bg-muted/50">
        <CardContent className="p-8 text-center">
          <h3 className="mb-2 font-bold text-xl">Questions About Privacy?</h3>
          <p className="mb-4 text-muted-foreground">
            If you have concerns about telemetry or data privacy, we'd love to
            hear from you.
          </p>
          <Button asChild>
            <a href="mailto:hey@wraps.sh">
              Contact Us
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </DocsLayout>
  );
}
