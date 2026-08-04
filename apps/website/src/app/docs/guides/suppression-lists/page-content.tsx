"use client";

import { Badge } from "@wraps/ui/components/ui/badge";
import { Button } from "@wraps/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@wraps/ui/components/ui/card";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock } from "lucide-react";
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

const suppressionApiCode = `import { WrapsEmail } from "@wraps.dev/email";

const email = new WrapsEmail({ region: "us-east-1" });

// Check if an address is suppressed
const entry = await email.suppression.get("bounced@example.com");
if (entry) {
  console.log(\`Suppressed: \${entry.reason} on \${entry.lastUpdated}\`);
}

// Manually suppress an address. Only "BOUNCE" and "COMPLAINT" are valid —
// SES has no other reason codes.
await email.suppression.add("bad-actor@example.com", "COMPLAINT");

// Remove from the suppression list (e.g. after the user re-confirms)
await email.suppression.remove("reactivated@example.com");

// List suppressed addresses with filters
const { entries, nextToken } = await email.suppression.list({
  reason: "BOUNCE",
  startDate: new Date("2024-01-01"),
  maxResults: 100,
});

for (const e of entries) {
  console.log(\`\${e.email} - \${e.reason} - \${e.lastUpdated}\`);
}`;

const preflightCode = `import { WrapsEmail } from "@wraps.dev/email";

const email = new WrapsEmail({ region: "us-east-1" });

// Before a large campaign, drop addresses SES already refuses. Sending to
// them produces Permanent/OnAccountSuppressionList bounces that cost you
// money and clutter your event history for no delivery.
async function filterSuppressed(recipients: string[]) {
  const checks = await Promise.all(
    recipients.map(async (address) => ({
      address,
      suppressed: (await email.suppression.get(address)) !== null,
    })),
  );

  return checks.filter((c) => !c.suppressed).map((c) => c.address);
}

const sendable = await filterSuppressed(campaignRecipients);`;

const reinstateCode = `import { WrapsEmail } from "@wraps.dev/email";

const email = new WrapsEmail({ region: "us-east-1" });

// A user says "I'm not getting your emails." Do this, not a blind remove:
export async function reinstate(address: string) {
  const entry = await email.suppression.get(address);
  if (!entry) return { ok: true, reason: "not suppressed" };

  // Never re-enable a COMPLAINT. Someone marked you as spam; sending
  // again is how accounts get shut down.
  if (entry.reason === "COMPLAINT") {
    return { ok: false, reason: "complaint — do not resend" };
  }

  // For BOUNCE, require the user to re-confirm the address first.
  await email.suppression.remove(address);
  return { ok: true, reason: "reinstated after re-confirmation" };
}`;

export default function SuppressionListsPageContent() {
  return (
    <DocsLayout>
      {/* Page Header */}
      <div className="mb-12">
        <Badge className="mb-4" variant="outline">
          Guide
        </Badge>
        <h1 className="mb-4 font-bold text-4xl tracking-tight">
          Suppression Lists
        </h1>
        <p className="text-lg text-muted-foreground">
          SES maintains its own list of addresses it will refuse to send to —
          separate from, and invisible to, your application's unsubscribe logic.
          Understanding both layers is what keeps the two in sync.
        </p>
        <div className="mt-4 flex items-center gap-4 text-muted-foreground text-sm">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />4 min read
          </span>
        </div>
      </div>

      {/* Two lists */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">You Have Two Lists</h2>
        <p className="mb-4 text-muted-foreground">
          This is the part that catches people out. Suppression happens in two
          independent places, and neither one tells the other:
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                The SES account-level suppression list
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-muted-foreground text-sm">
                Managed by AWS in your account. SES adds addresses to it
                automatically when they hard bounce or complain, and then
                silently refuses to deliver to them.
              </p>
              <p className="text-muted-foreground text-sm">
                Two reason codes exist:{" "}
                <code className="rounded bg-muted px-1 text-xs">BOUNCE</code>{" "}
                and{" "}
                <code className="rounded bg-muted px-1 text-xs">COMPLAINT</code>
                . There is no third.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Your application's list
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-muted-foreground text-sm">
                Your own unsubscribes, preference-center opt-outs, and
                soft-bounce thresholds. SES knows nothing about any of it.
              </p>
              <p className="text-muted-foreground text-sm">
                A user who unsubscribes in your UI is not on the SES list. If
                your code has a bug and sends anyway, SES will deliver it.
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="mt-4 rounded-lg border-l-4 border-yellow-500 bg-yellow-500/10 p-4">
          <p className="flex items-center gap-2 font-medium text-sm">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            Suppressed sends still cost you
          </p>
          <p className="mt-2 text-muted-foreground text-sm">
            When you send to an address on the SES list, SES accepts the API
            call, bills you for the message, and returns a Permanent bounce with
            subtype{" "}
            <code className="rounded bg-muted px-1 text-xs">
              OnAccountSuppressionList
            </code>{" "}
            instead of delivering it. It does not count against your bounce
            rate, but it is not free and it is not delivery.
          </p>
        </div>
      </section>

      {/* API */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Managing the SES List</h2>
        <p className="mb-4 text-muted-foreground">
          The Wraps SDK exposes the account-level list directly. Because it
          lives in your AWS account, these calls hit SES with your credentials —
          Wraps never proxies your suppression data.
        </p>
        <CodeBlock
          className="h-auto"
          data={[
            {
              language: "typescript",
              filename: "suppression.ts",
              code: suppressionApiCode,
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
        <p className="mt-4 text-muted-foreground text-sm">
          You can also browse and search the list from the{" "}
          <a className="font-medium text-primary underline" href="/platform">
            Wraps dashboard
          </a>
          , or from an agent via the{" "}
          <a
            className="font-medium text-primary underline"
            href="/docs/mcp-reference"
          >
            <code className="rounded bg-muted px-1 text-xs">
              list_suppressions
            </code>{" "}
            MCP tool
          </a>
          .
        </p>
      </section>

      {/* Pre-flight */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Filter Before a Campaign</h2>
        <p className="mb-4 text-muted-foreground">
          Batch sends are where suppression drift shows up. Checking first turns
          a pile of billed non-deliveries into a clean send:
        </p>
        <CodeBlock
          className="h-auto"
          data={[
            {
              language: "typescript",
              filename: "preflight.ts",
              code: preflightCode,
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
      </section>

      {/* Removing */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">When to Remove an Address</h2>
        <p className="mb-4 text-muted-foreground">
          Removal is a real operation with real consequences — you are
          overriding a signal AWS recorded on your behalf. The reason code tells
          you whether that is defensible:
        </p>
        <Card className="mb-4 overflow-hidden py-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-4 text-left font-medium">Reason</th>
                  <th className="p-4 text-left font-medium">Safe to remove?</th>
                  <th className="p-4 text-left font-medium">Why</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="p-4">
                    <code className="text-xs">BOUNCE</code>
                  </td>
                  <td className="p-4 text-muted-foreground">
                    Sometimes, with re-confirmation
                  </td>
                  <td className="p-4 text-muted-foreground">
                    Addresses do get fixed — a typo corrected, a mailbox
                    recreated. Make the user prove it first.
                  </td>
                </tr>
                <tr>
                  <td className="p-4">
                    <code className="text-xs">COMPLAINT</code>
                  </td>
                  <td className="p-4 text-muted-foreground">
                    Essentially never
                  </td>
                  <td className="p-4 text-muted-foreground">
                    Someone marked you as spam. Sending again is the behavior
                    that gets sending paused.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
        <CodeBlock
          className="h-auto"
          data={[
            {
              language: "typescript",
              filename: "reinstate.ts",
              code: reinstateCode,
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
      </section>

      {/* Checklist */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Checklist</h2>
        <ul className="space-y-3">
          {[
            "Your unsubscribe flow writes to your own list — SES does not see it",
            "Hard bounces and complaints from your webhook also update your own list",
            "Large campaigns filter against the SES list before sending",
            "COMPLAINT suppressions are never removed programmatically",
            "BOUNCE removals require the user to re-confirm the address",
          ].map((item) => (
            <li className="flex items-start gap-3" key={item}>
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
              <span className="text-muted-foreground">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Next Steps */}
      <section className="mb-12">
        <h2 className="mb-6 font-bold text-2xl">Next Steps</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">Bounce Handling</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                What puts addresses on the list in the first place, and how to
                react to each event type.
              </p>
              <Button asChild variant="outline">
                <Link href="/docs/guides/bounce-handling">
                  Bounce Handling
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">SDK Reference</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Full API surface for{" "}
                <code className="rounded bg-muted px-1 text-xs">
                  email.suppression
                </code>{" "}
                and the rest of the SDK.
              </p>
              <Button asChild variant="outline">
                <Link href="/docs/sdk-reference">
                  SDK Reference
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </DocsLayout>
  );
}
