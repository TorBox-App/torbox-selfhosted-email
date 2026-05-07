"use client";

import { Badge } from "@wraps/ui/components/ui/badge";
import { Button } from "@wraps/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@wraps/ui/components/ui/card";
import { ArrowRight, CheckCircle2, Clock, Info, KeyRound } from "lucide-react";
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

function CLICommand({ command }: { command: string }) {
  return (
    <CodeBlock
      className="h-auto"
      data={[{ language: "bash", filename: "terminal", code: command }]}
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

const nodemailerExample = `import nodemailer from "nodemailer";

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  secure: false, // STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

await transport.sendMail({
  from: "hello@yourdomain.com",
  to: "user@example.com",
  subject: "Hello from Wraps",
  html: "<h1>It works!</h1>",
});`;

const phpExample = `<?php
// PHPMailer
use PHPMailer\\PHPMailer\\PHPMailer;

$mail = new PHPMailer(true);
$mail->isSMTP();
$mail->Host       = getenv('SMTP_HOST');
$mail->SMTPAuth   = true;
$mail->Username   = getenv('SMTP_USER');
$mail->Password   = getenv('SMTP_PASS');
$mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
$mail->Port       = 587;

$mail->setFrom('hello@yourdomain.com');
$mail->addAddress('user@example.com');
$mail->Subject = 'Hello from Wraps';
$mail->Body    = '<h1>It works!</h1>';
$mail->isHTML(true);

$mail->send();`;

const wordpressNote = `# WP Mail SMTP plugin settings:
#
# Mailer:      Other SMTP
# SMTP Host:   email-smtp.{region}.amazonaws.com
# Encryption:  TLS
# SMTP Port:   587
# Authentication: On
# Username:    (your SMTP_USER)
# Password:    (your SMTP_PASS)`;

const envVars = `SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=AKIA...
SMTP_PASS=BQADz...`;

export default function SMTPPageContent() {
  return (
    <DocsLayout>
      {/* Header */}
      <div className="mb-12">
        <Badge className="mb-4" variant="outline">
          Guide
        </Badge>
        <h1 className="mb-4 font-bold text-4xl tracking-tight">
          SMTP Credentials
        </h1>
        <p className="text-lg text-muted-foreground">
          Generate SMTP credentials for legacy systems, WordPress, or any
          application that sends email over SMTP instead of the AWS SDK.
        </p>
        <div className="mt-4 flex items-center gap-2 text-muted-foreground text-sm">
          <Clock className="h-4 w-4" />
          <span>5 min setup</span>
        </div>
      </div>

      {/* When to Use SMTP */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">When to Use SMTP</h2>
        <p className="mb-4 text-muted-foreground">
          Most applications should use the{" "}
          <a className="text-primary underline" href="/docs/sdk-reference">
            Wraps SDK
          </a>{" "}
          or the{" "}
          <a className="text-primary underline" href="/docs/sdk-reference">
            AWS SES API
          </a>{" "}
          directly. SMTP credentials are for systems that only support the SMTP
          protocol:
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <CardContent className="p-4">
              <p className="font-medium text-sm">WordPress</p>
              <p className="text-muted-foreground text-sm">
                WP Mail SMTP plugin or similar
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="font-medium text-sm">PHP applications</p>
              <p className="text-muted-foreground text-sm">
                PHPMailer, SwiftMailer, Laravel Mail
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="font-medium text-sm">Nodemailer</p>
              <p className="text-muted-foreground text-sm">
                Node.js SMTP transport
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="font-medium text-sm">Legacy systems</p>
              <p className="text-muted-foreground text-sm">
                Any SMTP-compatible client or appliance
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Prerequisites */}
      <section className="mb-12">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Prerequisites
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-muted-foreground">
              Before enabling SMTP credentials:
            </p>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>
                Email infrastructure deployed via{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  wraps email init
                </code>
              </li>
              <li>
                At least one verified sending domain (check with{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  wraps email status
                </code>
                )
              </li>
              <li>
                CLI v2.18.4 or later (
                <code className="rounded bg-muted px-1.5 py-0.5">
                  wraps --version
                </code>
                )
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Enable SMTP */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            1
          </div>
          Enable SMTP Credentials
        </h2>
        <p className="mb-4 text-muted-foreground">
          Run the upgrade command and select{" "}
          <strong>Enable SMTP credentials</strong>:
        </p>
        <CLICommand command="wraps email upgrade" />
        <p className="mt-4 mb-4 text-muted-foreground">
          This creates a dedicated IAM user (
          <code className="rounded bg-muted px-1.5 py-0.5">
            wraps-email-smtp-user
          </code>
          ) with permission to send email via SES, then generates an access key
          and derives the SMTP password.
        </p>
        <div className="rounded-lg border-yellow-500 border-l-4 bg-yellow-500/10 p-4">
          <p className="font-medium text-sm">
            Save your credentials immediately
          </p>
          <p className="mt-2 text-muted-foreground text-sm">
            The SMTP password is derived from the IAM secret key and displayed
            once. It cannot be retrieved later. If you lose it, you&apos;ll need
            to rotate credentials.
          </p>
        </div>
      </section>

      {/* Connection Details */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            2
          </div>
          Connection Details
        </h2>
        <p className="mb-4 text-muted-foreground">
          After enabling SMTP, the CLI outputs your connection details. Store
          them as environment variables:
        </p>
        <CLICommand command={envVars} />

        <Card className="mt-6">
          <CardContent className="p-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-2 text-left">Setting</th>
                  <th className="pb-2 text-left">Value</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b">
                  <td className="py-2 font-medium text-foreground">Server</td>
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      email-smtp.&#123;region&#125;.amazonaws.com
                    </code>
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-medium text-foreground">Port</td>
                  <td className="py-2">587 (STARTTLS) or 465 (TLS Wrapper)</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-medium text-foreground">
                    Encryption
                  </td>
                  <td className="py-2">Required (TLS or STARTTLS)</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-medium text-foreground">Username</td>
                  <td className="py-2">
                    IAM access key ID (starts with{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5">AKIA</code>
                    )
                  </td>
                </tr>
                <tr>
                  <td className="py-2 font-medium text-foreground">Password</td>
                  <td className="py-2">
                    Derived SMTP password (base64 string, not your AWS secret
                    key)
                  </td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="mt-4 rounded-lg border-primary border-l-4 bg-primary/10 p-4">
          <p className="flex items-center gap-2 font-medium text-sm">
            <Info className="h-4 w-4" />
            SMTP password is not your AWS secret key
          </p>
          <p className="mt-2 text-muted-foreground text-sm">
            SES derives the SMTP password from your IAM secret access key using
            HMAC-SHA256. The CLI does this automatically. Never use your raw AWS
            secret key as the SMTP password.
          </p>
        </div>
      </section>

      {/* Usage Examples */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            3
          </div>
          Usage Examples
        </h2>

        <h3 className="mt-6 mb-3 font-medium text-lg">Nodemailer (Node.js)</h3>
        <CodeBlock
          className="h-auto"
          data={[
            {
              language: "typescript",
              filename: "send-email.ts",
              code: nodemailerExample,
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

        <h3 className="mt-8 mb-3 font-medium text-lg">PHPMailer (PHP)</h3>
        <CodeBlock
          className="h-auto"
          data={[
            { language: "php", filename: "send-email.php", code: phpExample },
          ]}
          defaultValue="php"
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

        <h3 className="mt-8 mb-3 font-medium text-lg">WordPress</h3>
        <p className="mb-3 text-muted-foreground">
          Install the{" "}
          <a
            className="text-primary underline"
            href="https://wordpress.org/plugins/wp-mail-smtp/"
            rel="noopener noreferrer"
            target="_blank"
          >
            WP Mail SMTP
          </a>{" "}
          plugin, then configure under{" "}
          <strong>WP Mail SMTP &rarr; Settings</strong>:
        </p>
        <CLICommand command={wordpressNote} />
      </section>

      {/* Rotating Credentials */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Managing Credentials</h2>

        <h3 className="mt-4 mb-3 font-medium text-lg">Rotate</h3>
        <p className="mb-4 text-muted-foreground">
          If credentials are compromised or you need a fresh set, run the
          upgrade command again and select{" "}
          <strong>Manage SMTP credentials</strong> &rarr;{" "}
          <strong>Rotate credentials</strong>. This invalidates the old
          credentials immediately and generates new ones.
        </p>
        <CLICommand command="wraps email upgrade" />

        <h3 className="mt-6 mb-3 font-medium text-lg">Disable</h3>
        <p className="mb-4 text-muted-foreground">
          To remove SMTP credentials entirely, select{" "}
          <strong>Disable SMTP credentials</strong> from the same menu. This
          deletes the IAM user and access keys.
        </p>
      </section>

      {/* IAM Details */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">What Gets Created</h2>
        <p className="mb-4 text-muted-foreground">
          Enabling SMTP credentials creates these resources in your AWS account:
        </p>
        <Card>
          <CardContent className="p-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-2 text-left">Resource</th>
                  <th className="pb-2 text-left">Name</th>
                  <th className="pb-2 text-left">Purpose</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b">
                  <td className="py-2 font-medium text-foreground">IAM User</td>
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      wraps-email-smtp-user
                    </code>
                  </td>
                  <td className="py-2">Dedicated user for SMTP auth</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-medium text-foreground">
                    IAM Policy
                  </td>
                  <td className="py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      wraps-smtp-send-policy
                    </code>
                  </td>
                  <td className="py-2">
                    Allows{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      ses:SendRawEmail
                    </code>{" "}
                    only
                  </td>
                </tr>
                <tr>
                  <td className="py-2 font-medium text-foreground">
                    Access Key
                  </td>
                  <td className="py-2">Generated per user</td>
                  <td className="py-2">
                    Username + secret used to derive SMTP password
                  </td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
        <p className="mt-4 text-muted-foreground text-sm">
          The IAM user has a single permission:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            ses:SendRawEmail
          </code>
          . It cannot read, delete, or modify any other AWS resources.
        </p>
      </section>

      {/* Next Steps */}
      <section className="mb-12">
        <h2 className="mb-6 font-bold text-2xl">Next Steps</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <KeyRound className="h-5 w-5" />
                Production Access
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Move your SES account out of sandbox mode to send to any
                recipient.
              </p>
              <Button asChild variant="outline">
                <Link href="/docs/guides/production-access">
                  Request production access
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle2 className="h-5 w-5" />
                Domain Verification
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Add and verify additional sending domains for your SMTP setup.
              </p>
              <Button asChild variant="outline">
                <Link href="/docs/guides/domain-verification">
                  Verify a domain
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
