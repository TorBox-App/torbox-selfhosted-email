"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, Clock } from "lucide-react";
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

const cliCommand = `aws sesv2 put-account-details \\
  --production-access-enabled \\
  --mail-type TRANSACTIONAL \\
  --website-url https://yourapp.com \\
  --additional-contact-email-addresses you@yourapp.com \\
  --contact-language EN`;

export default function ProductionAccessPageContent() {
  return (
    <DocsLayout>
      {/* Page Header */}
      <div className="mb-12">
        <Badge className="mb-4" variant="outline">
          Guide
        </Badge>
        <h1 className="mb-4 font-bold text-4xl tracking-tight">
          Moving to Production Access
        </h1>
        <p className="text-lg text-muted-foreground">
          Learn how to move out of the AWS SES sandbox and start sending emails
          to any recipient.
        </p>
        <div className="mt-4 flex items-center gap-4 text-muted-foreground text-sm">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />2 min read
          </span>
        </div>
      </div>

      {/* What is the Sandbox */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">What is the SES Sandbox?</h2>
        <p className="mb-4 text-muted-foreground">
          When you first set up AWS SES, your account is placed in{" "}
          <strong>sandbox mode</strong>. This is a safety measure to prevent
          abuse. You'll see this warning banner in your SES console:
        </p>
        <img
          alt="SES sandbox warning banner in AWS console"
          className="mb-4 rounded-lg border"
          src="/docs/ses-sandbox-banner.png"
        />
        <p className="mb-4 text-muted-foreground">
          While in the sandbox, you have these restrictions:
        </p>
        <Card className="mb-4">
          <CardContent className="p-6">
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" />
                <span className="text-muted-foreground">
                  <strong className="text-foreground">
                    Verified recipients only
                  </strong>{" "}
                  — You can only send to email addresses you've manually
                  verified
                </span>
              </li>
              <li className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" />
                <span className="text-muted-foreground">
                  <strong className="text-foreground">
                    200 emails per day
                  </strong>{" "}
                  — Maximum of 200 messages in a 24-hour period
                </span>
              </li>
              <li className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" />
                <span className="text-muted-foreground">
                  <strong className="text-foreground">
                    1 email per second
                  </strong>{" "}
                  — Sending rate is limited to 1 message per second
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>
        <p className="text-muted-foreground">
          Once you have production access, you can send to any recipient (your
          "From" address must still be verified).
        </p>
      </section>

      {/* Before You Request */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Before You Request</h2>
        <div className="rounded-lg border-primary border-l-4 bg-primary/10 p-4">
          <p className="font-medium text-sm">
            Verify your domain first for faster approval
          </p>
          <p className="mt-2 text-muted-foreground text-sm">
            AWS recommends verifying your sending domain before requesting
            production access. This significantly speeds up the approval
            process. See our{" "}
            <a
              className="font-medium text-primary underline"
              href="/docs/guides/domain-verification"
            >
              Domain Verification guide
            </a>{" "}
            for instructions.
          </p>
        </div>
      </section>

      {/* Request via Console */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Option 1: AWS Console</h2>
        <ol className="mb-4 list-decimal space-y-4 pl-6 text-muted-foreground">
          <li>
            Open the{" "}
            <a
              className="font-medium text-primary underline"
              href="https://console.aws.amazon.com/ses/"
              rel="noopener noreferrer"
              target="_blank"
            >
              Amazon SES console
            </a>
          </li>
          <li>
            Navigate to{" "}
            <strong className="text-foreground">Account dashboard</strong>
          </li>
          <li>
            Click{" "}
            <strong className="text-foreground">
              "Request production access"
            </strong>{" "}
            in the sandbox warning banner
          </li>
          <li>
            Fill out the form:
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                <strong className="text-foreground">Email type:</strong>{" "}
                Transactional or Marketing (choose what applies to most of your
                emails)
              </li>
              <li>
                <strong className="text-foreground">Website URL:</strong> Your
                application's URL
              </li>
              <li>
                <strong className="text-foreground">Contact emails:</strong> Up
                to 4 email addresses for account communications
              </li>
            </ul>
          </li>
          <li>Check the acknowledgement box and submit</li>
        </ol>
        <img
          alt="Requesting production access in SES console"
          className="rounded-lg border"
          src="/docs/ses-request-production-access.gif"
        />
      </section>

      {/* Request via CLI */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Option 2: AWS CLI</h2>
        <p className="mb-4 text-muted-foreground">
          You can also request production access using the AWS CLI:
        </p>
        <CodeBlock
          className="h-auto"
          data={[
            {
              language: "bash",
              filename: "terminal.sh",
              code: cliCommand,
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
        <p className="mt-4 text-muted-foreground text-sm">
          Replace{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">TRANSACTIONAL</code>{" "}
          with <code className="rounded bg-muted px-1.5 py-0.5">MARKETING</code>{" "}
          if you primarily send marketing emails.
        </p>
      </section>

      {/* What to Expect */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">What to Expect</h2>
        <Card className="mb-4">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">Review Timeline</h3>
                <p className="mt-1 text-muted-foreground">
                  AWS typically responds within <strong>24 hours</strong>. If
                  they need additional information, the review may take longer.
                  You cannot edit your request while it's under review.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <p className="mb-4 text-muted-foreground">
          Once approved, the sandbox warning will disappear from your dashboard:
        </p>
        <img
          alt="SES dashboard after production access is approved"
          className="rounded-lg border"
          src="/docs/ses-production-approved.png"
        />
      </section>

      {/* Tips for Approval */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Tips for Faster Approval</h2>
        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
            <span className="text-muted-foreground">
              <strong className="text-foreground">
                Verify your domain first
              </strong>{" "}
              — This is the biggest factor in approval speed
            </span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
            <span className="text-muted-foreground">
              <strong className="text-foreground">
                Use a real website URL
              </strong>{" "}
              — Helps AWS understand your use case
            </span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
            <span className="text-muted-foreground">
              <strong className="text-foreground">
                Provide accurate contact info
              </strong>{" "}
              — In case AWS needs to reach you
            </span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
            <span className="text-muted-foreground">
              <strong className="text-foreground">Acknowledge the terms</strong>{" "}
              — Confirm you'll only send to opted-in recipients and handle
              bounces/complaints properly
            </span>
          </li>
        </ul>
      </section>

      {/* Next Steps */}
      <section className="mb-12">
        <h2 className="mb-6 font-bold text-2xl">Next Steps</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">Verify Your Domain</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Set up DKIM, SPF, and DMARC for better deliverability.
              </p>
              <Button asChild variant="outline">
                <a href="/docs/guides/domain-verification">
                  Domain Verification
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">Send Your First Email</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Once approved, start sending with the Wraps SDK.
              </p>
              <Button asChild variant="outline">
                <a href="/docs/quickstart/email">
                  Email Quickstart
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </DocsLayout>
  );
}
