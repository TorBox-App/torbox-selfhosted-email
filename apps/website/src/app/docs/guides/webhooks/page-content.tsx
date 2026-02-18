"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Info,
  RefreshCw,
  Settings,
  Shield,
  Zap,
} from "lucide-react";
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

const upgradeCommand = "npx @wraps.dev/cli email upgrade";

const webhookPayloadExample = `{
  "event": "Delivery",
  "detail": {
    "delivery": {
      "timestamp": "2024-01-15T10:30:00.000Z",
      "processingTimeMillis": 1234,
      "recipients": ["user@example.com"],
      "smtpResponse": "250 2.0.0 OK",
      "reportingMTA": "a]8-31.smtp-out.amazonses.com"
    },
    "mail": {
      "messageId": "abc-123-def",
      "source": "hello@yourapp.com",
      "destination": ["user@example.com"]
    }
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "messageId": "abc-123-def",
  "source": "wraps"
}`;

const expressAuthExample = `import express from "express";
import crypto from "crypto";

const app = express();
app.use(express.json());

const WEBHOOK_SECRET = process.env.WRAPS_WEBHOOK_SECRET;

function verifySignature(req) {
  const signature = req.headers["x-wraps-signature"];
  if (!signature || !WEBHOOK_SECRET) return false;

  // Use constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(WEBHOOK_SECRET)
  );
}`;

const expressHandlerExample = `app.post("/webhooks/email", (req, res) => {
  if (!verifySignature(req)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const { event, detail, messageId } = req.body;

  switch (event) {
    case "Delivery":
      console.log(\`Email \${messageId} delivered\`);
      break;
    case "Bounce":
      const bounceType = detail.bounce?.bounceType;
      console.log(\`Email \${messageId} bounced: \${bounceType}\`);
      // Remove hard-bounced addresses from your list
      if (bounceType === "Permanent") {
        // markAddressAsBounced(detail.bounce.bouncedRecipients);
      }
      break;
    case "Complaint":
      console.log(\`Email \${messageId} received complaint\`);
      // Unsubscribe the user immediately
      // unsubscribeUser(detail.complaint.complainedRecipients);
      break;
    default:
      console.log(\`Received \${event} for \${messageId}\`);
  }

  res.status(200).json({ received: true });
});

app.listen(3000);`;

const nextjsHandlerExample = `import crypto from "crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const WEBHOOK_SECRET = process.env.WRAPS_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-wraps-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing signature" },
      { status: 401 }
    );
  }

  // Constant-time comparison
  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(WEBHOOK_SECRET)
  );

  if (!isValid) {
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const { event, detail, messageId } = body;

  switch (event) {
    case "Delivery":
      console.log(\`Email \${messageId} delivered\`);
      break;
    case "Bounce":
      const bounceType = detail.bounce?.bounceType;
      if (bounceType === "Permanent") {
        // markAddressAsBounced(detail.bounce.bouncedRecipients);
      }
      break;
    case "Complaint":
      // unsubscribeUser(detail.complaint.complainedRecipients);
      break;
  }

  return NextResponse.json({ received: true });
}`;

export default function WebhooksPageContent() {
  return (
    <DocsLayout>
      {/* Page Header */}
      <div className="mb-12">
        <Badge className="mb-4" variant="outline">
          Guide
        </Badge>
        <h1 className="mb-4 font-bold text-4xl tracking-tight">Webhooks</h1>
        <p className="text-lg text-muted-foreground">
          Receive real-time SES email events at your HTTPS endpoint. Get
          notified about deliveries, bounces, complaints, opens, clicks, and
          more.
        </p>
        <div className="mt-4 flex items-center gap-4 text-muted-foreground text-sm">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />5 min read
          </span>
        </div>
      </div>

      {/* Overview */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Overview</h2>
        <p className="mb-4 text-muted-foreground">
          Wraps can forward SES email events directly to your application via an
          HTTPS webhook. Under the hood, this creates an{" "}
          <a
            className="font-medium text-primary underline"
            href="https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-api-destinations.html"
            rel="noopener noreferrer"
            target="_blank"
          >
            EventBridge API Destination
          </a>{" "}
          in your AWS account that POSTs events to your endpoint in real time.
        </p>
        <p className="mb-4 text-muted-foreground">
          Events flow through the same EventBridge rule that powers the Wraps
          dashboard, so your webhook receives the same data you see in the UI
          &mdash; send, delivery, bounce, open, click, complaint, and more.
        </p>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Zap className="h-8 w-8 shrink-0 text-primary" />
              <div>
                <h3 className="font-medium">Event Flow</h3>
                <p className="mt-2 font-mono text-muted-foreground text-sm">
                  SES &rarr; EventBridge &rarr; API Destination &rarr; Your
                  Endpoint
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Prerequisites */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Prerequisites</h2>
        <Card>
          <CardContent className="p-6">
            <ul className="space-y-3">
              <li className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
                <span>
                  Wraps email infrastructure deployed (
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    wraps email init
                  </code>
                  )
                </span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
                <span>
                  Event tracking enabled (Production preset or higher, or
                  manually via{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    wraps email upgrade
                  </code>
                  )
                </span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
                <span>An HTTPS endpoint ready to receive POST requests</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Setup */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Setup</h2>

        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              1
            </div>
            <div className="flex-1">
              <h3 className="mb-2 font-medium text-lg">
                Run the upgrade command
              </h3>
              <CodeBlock
                className="h-auto"
                data={[
                  {
                    language: "bash",
                    filename: "terminal.sh",
                    code: upgradeCommand,
                  },
                ]}
                defaultValue="bash"
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
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              2
            </div>
            <div className="flex-1">
              <h3 className="mb-2 font-medium text-lg">
                Select "Configure webhook endpoint"
              </h3>
              <p className="text-muted-foreground">
                The CLI will display a list of available upgrades. Choose the
                webhook option.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              3
            </div>
            <div className="flex-1">
              <h3 className="mb-2 font-medium text-lg">Enter your HTTPS URL</h3>
              <p className="text-muted-foreground">
                Provide the full URL where you want to receive events (e.g.{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  https://yourapp.com/webhooks/email
                </code>
                ).
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              4
            </div>
            <div className="flex-1">
              <h3 className="mb-2 font-medium text-lg">
                Save the generated secret
              </h3>
              <p className="text-muted-foreground">
                The CLI will display a secret value for authenticating requests.
                Store it securely &mdash; it is only displayed once.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-lg border-primary border-l-4 bg-primary/10 p-4">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="font-medium text-sm">
                Event tracking enabled automatically
              </p>
              <p className="mt-1 text-muted-foreground text-sm">
                If event tracking isn't enabled yet, the CLI will prompt you to
                enable it automatically before configuring the webhook.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Webhook Payload */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Webhook Payload</h2>
        <p className="mb-4 text-muted-foreground">
          Every event is delivered as a JSON POST request with the following
          shape:
        </p>
        <CodeBlock
          className="mb-6 h-auto"
          data={[
            {
              language: "json",
              filename: "payload.json",
              code: webhookPayloadExample,
            },
          ]}
          defaultValue="json"
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

        <h3 className="mb-3 font-medium text-lg">Field Reference</h3>
        <Card className="mb-4">
          <CardContent className="p-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-2 text-left">Field</th>
                  <th className="pb-2 text-left">Type</th>
                  <th className="pb-2 text-left">Description</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b">
                  <td className="py-2 font-medium text-foreground">
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      event
                    </code>
                  </td>
                  <td className="py-2">string</td>
                  <td className="py-2">
                    SES event type (Send, Delivery, Bounce, Open, Click, etc.)
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-medium text-foreground">
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      detail
                    </code>
                  </td>
                  <td className="py-2">object</td>
                  <td className="py-2">Full SES event detail payload</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-medium text-foreground">
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      timestamp
                    </code>
                  </td>
                  <td className="py-2">string</td>
                  <td className="py-2">ISO 8601 timestamp from EventBridge</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-medium text-foreground">
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      messageId
                    </code>
                  </td>
                  <td className="py-2">string</td>
                  <td className="py-2">
                    SES message ID from{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      mail.messageId
                    </code>
                  </td>
                </tr>
                <tr>
                  <td className="py-2 font-medium text-foreground">
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      source
                    </code>
                  </td>
                  <td className="py-2">string</td>
                  <td className="py-2">
                    Always{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      "wraps"
                    </code>
                  </td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        <p className="text-muted-foreground text-sm">
          For the full payload shape of each event type, see the{" "}
          <a
            className="font-medium text-primary underline"
            href="/docs/infrastructure/events"
          >
            EventBridge Events
          </a>{" "}
          reference.
        </p>
      </section>

      {/* Authenticating Requests */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Shield className="h-6 w-6 text-primary" />
          Authenticating Requests
        </h2>
        <p className="mb-4 text-muted-foreground">
          Every webhook request includes an{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            X-Wraps-Signature
          </code>{" "}
          header containing the secret value generated during setup. To validate
          incoming requests:
        </p>
        <ul className="mb-6 space-y-2 text-muted-foreground">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
            Read the{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">
              X-Wraps-Signature
            </code>{" "}
            header from the incoming request
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
            Compare it against the secret stored in your environment variables
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
            Use constant-time comparison to prevent timing attacks
          </li>
        </ul>

        <CodeBlock
          className="h-auto"
          data={[
            {
              language: "typescript",
              filename: "verify.ts",
              code: expressAuthExample,
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

      {/* Example: Express.js Handler */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Example: Express.js Handler</h2>
        <p className="mb-4 text-muted-foreground">
          A complete Express.js route that validates the signature and handles
          different event types:
        </p>
        <CodeBlock
          className="h-auto"
          data={[
            {
              language: "typescript",
              filename: "server.ts",
              code: expressHandlerExample,
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

      {/* Example: Next.js Route Handler */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">
          Example: Next.js Route Handler
        </h2>
        <p className="mb-4 text-muted-foreground">
          A Next.js App Router route handler with the same validation and event
          handling:
        </p>
        <CodeBlock
          className="h-auto"
          data={[
            {
              language: "typescript",
              filename: "app/api/webhooks/email/route.ts",
              code: nextjsHandlerExample,
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

      {/* Managing Your Webhook */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Settings className="h-6 w-6 text-primary" />
          Managing Your Webhook
        </h2>
        <p className="mb-4 text-muted-foreground">
          Run{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            wraps email upgrade
          </code>{" "}
          and select "Manage webhook endpoint" to access these options:
        </p>
        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <h3 className="mb-1 font-medium">Change URL</h3>
            <p className="text-muted-foreground text-sm">
              Update the endpoint URL where events are delivered.
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="mb-1 flex items-center gap-2 font-medium">
              <RefreshCw className="h-4 w-4" />
              Regenerate Secret
            </h3>
            <p className="text-muted-foreground text-sm">
              Generate a new secret for authenticating requests.
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="mb-1 font-medium">Disable</h3>
            <p className="text-muted-foreground text-sm">
              Stop sending events to your endpoint. The API Destination is
              removed from your AWS account.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border-yellow-500 border-l-4 bg-yellow-500/10 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
            <div>
              <p className="font-medium text-sm">
                Regenerating invalidates immediately
              </p>
              <p className="mt-1 text-muted-foreground text-sm">
                Regenerating the secret invalidates the previous one
                immediately. Update your endpoint's stored secret before
                regenerating to avoid rejected requests.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Troubleshooting */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Troubleshooting</h2>
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Events not arriving</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              <ul className="list-disc space-y-1 pl-4">
                <li>
                  Verify event tracking is enabled (Production preset or higher)
                </li>
                <li>Ensure your URL uses HTTPS and is publicly accessible</li>
                <li>
                  Check that your endpoint returns a 2xx status code &mdash;
                  EventBridge retries on failure but will eventually stop
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">401/403 errors</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              <ul className="list-disc space-y-1 pl-4">
                <li>
                  Verify the{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    X-Wraps-Signature
                  </code>{" "}
                  header value matches your stored secret exactly
                </li>
                <li>
                  Check that you haven't regenerated the secret without updating
                  your endpoint
                </li>
                <li>
                  Ensure you're reading the header name correctly
                  (case-insensitive)
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Duplicate events</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              <ul className="list-disc space-y-1 pl-4">
                <li>
                  EventBridge may retry delivery if your endpoint returns a
                  non-2xx response
                </li>
                <li>
                  Make your handler idempotent by deduplicating on{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    messageId
                  </code>{" "}
                  +{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5">event</code>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Rate limiting</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              The API Destination is rate-limited to 300 requests per second. If
              you're sending high volumes, events are queued and delivered in
              order.
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Next Steps */}
      <section className="mb-12">
        <h2 className="mb-6 font-bold text-2xl">Next Steps</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">EventBridge Events</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Full payload reference for every SES event type including
                bounces, complaints, and delivery delays.
              </p>
              <Button asChild variant="outline">
                <Link href="/docs/infrastructure/events">
                  Event Reference
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">Configuration Presets</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Learn about the Starter, Production, and Enterprise presets and
                how to enable event tracking.
              </p>
              <Button asChild variant="outline">
                <Link href="/docs/guides/configuration-presets">
                  View Presets
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
