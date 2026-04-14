"use client";

import { Badge } from "@wraps/ui/components/ui/badge";
import { Button } from "@wraps/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@wraps/ui/components/ui/card";
import { ArrowLeft, ArrowRight, Terminal } from "lucide-react";
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

export default function CLIReferenceAuthPageContent() {
  return (
    <DocsLayout>
      {/* Breadcrumb */}
      <div className="mb-6">
        <Button asChild className="gap-2" size="sm" variant="ghost">
          <Link href="/docs/cli-reference">
            <ArrowLeft className="h-4 w-4" />
            CLI Reference
          </Link>
        </Button>
      </div>

      {/* Page Header */}
      <div className="mb-12">
        <Badge className="mb-4" variant="outline">
          CLI Reference / Auth
        </Badge>
        <h1 className="mb-4 font-bold text-4xl tracking-tight">
          Auth Commands
        </h1>
        <p className="text-lg text-muted-foreground">
          Authenticate with the Wraps Platform for dashboard access, templates,
          and workflows.
        </p>
      </div>

      {/* wraps auth login */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Terminal className="h-6 w-6 text-primary" />
          wraps auth login
        </h2>
        <p className="mb-4 text-muted-foreground">
          Authenticate with the Wraps Platform using the device authorization
          flow. Opens your browser to authorize the CLI.
        </p>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <CLICommand command="npx @wraps.dev/cli auth login [options]" />
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
                  --token &lt;token&gt;
                </code>
                <p className="mt-2 text-muted-foreground text-sm">
                  Use an API token instead of the device authorization flow.
                  Useful for CI/CD environments.
                </p>
              </div>
              <div>
                <code className="rounded bg-muted px-2 py-1">--json</code>
                <p className="mt-2 text-muted-foreground text-sm">
                  Output result as JSON for scripting and automation
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
              <li>
                Opens your browser to{" "}
                <code className="rounded bg-muted px-1 py-0.5">
                  wraps.dev/device
                </code>{" "}
                for authorization
              </li>
              <li>
                Displays a one-time code in the terminal for you to confirm in
                the browser
              </li>
              <li>
                Polls for authorization until you approve or the code expires
              </li>
              <li>
                Stores the access token in{" "}
                <code className="rounded bg-muted px-1 py-0.5">
                  ~/.wraps/auth.json
                </code>
              </li>
              <li>Displays your account email and organization on success</li>
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
                Interactive login (recommended):
              </p>
              <CLICommand command="npx @wraps.dev/cli auth login" />
            </div>
            <div className="mt-4">
              <p className="mb-2 text-muted-foreground text-sm">
                Login with an API token (for CI/CD):
              </p>
              <CLICommand command="npx @wraps.dev/cli auth login --token wraps_sk_..." />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* wraps auth status */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Terminal className="h-6 w-6 text-primary" />
          wraps auth status
        </h2>
        <p className="mb-4 text-muted-foreground">
          Show your current authentication status, including account details and
          organization membership.
        </p>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <CLICommand command="npx @wraps.dev/cli auth status [options]" />
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Options</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <code className="rounded bg-muted px-2 py-1">--json</code>
                <p className="mt-2 text-muted-foreground text-sm">
                  Output result as JSON for scripting and automation
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
              <li>
                Reads the stored token from{" "}
                <code className="rounded bg-muted px-1 py-0.5">
                  ~/.wraps/auth.json
                </code>
              </li>
              <li>Validates the token with the Wraps Platform API</li>
              <li>
                Displays account email, organization name, and current plan
              </li>
              <li>
                Shows an error if not authenticated or if the token has expired
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* wraps auth logout */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Terminal className="h-6 w-6 text-primary" />
          wraps auth logout
        </h2>
        <p className="mb-4 text-muted-foreground">
          Clear stored authentication credentials and log out of the Wraps
          Platform.
        </p>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <CLICommand command="npx @wraps.dev/cli auth logout" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What It Does</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
              <li>
                Removes the access token from{" "}
                <code className="rounded bg-muted px-1 py-0.5">
                  ~/.wraps/auth.json
                </code>
              </li>
              <li>Confirms successful logout with a message in the terminal</li>
              <li>
                Does not revoke the token server-side (use the dashboard for
                that)
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Authentication Flow */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Authentication Flow</h2>
        <p className="mb-4 text-muted-foreground">
          The device authorization flow lets you authenticate securely without
          entering credentials in the terminal.
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Device Authorization Sequence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock
              className="h-auto"
              data={[
                {
                  language: "text",
                  filename: "flow.txt",
                  code: `CLI                          Browser                      API
 |                              |                           |
 |-- Request device code ------>|                           |
 |                              |<-- Open authorize URL --->|
 |-- Poll for token ----------->|                           |
 |                              |   User approves           |
 |<-- Receive access token -----|                           |
 |-- Store in ~/.wraps/ --------|                           |`,
                },
              ]}
              defaultValue="text"
            >
              <CodeBlockHeader>
                <CodeBlockFiles>
                  {(item) => (
                    <CodeBlockFilename
                      key={item.language}
                      value={item.language}
                    >
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
          </CardContent>
        </Card>
      </section>

      {/* Next Steps */}
      <section className="mb-12">
        <h2 className="mb-6 font-bold text-2xl">Next Steps</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="transition-colors hover:border-primary/50">
            <a className="block p-6" href="/docs/cli-reference/platform">
              <CardTitle className="mb-2 text-lg">Platform Commands</CardTitle>
              <p className="text-muted-foreground text-sm">
                Connect your AWS infrastructure to the Wraps Platform for
                dashboards, templates, and workflows.
              </p>
              <div className="mt-4 flex items-center text-primary text-sm">
                Learn more
                <ArrowRight className="ml-1 h-4 w-4" />
              </div>
            </a>
          </Card>
          <Card className="transition-colors hover:border-primary/50">
            <a className="block p-6" href="/docs/quickstart">
              <CardTitle className="mb-2 text-lg">Quickstart</CardTitle>
              <p className="text-muted-foreground text-sm">
                Get started with Wraps in under 5 minutes. Deploy email
                infrastructure and send your first email.
              </p>
              <div className="mt-4 flex items-center text-primary text-sm">
                Learn more
                <ArrowRight className="ml-1 h-4 w-4" />
              </div>
            </a>
          </Card>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button asChild variant="outline">
          <Link href="/docs/cli-reference">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to CLI Reference
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/docs/cli-reference/platform">
            Platform Commands
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </DocsLayout>
  );
}
