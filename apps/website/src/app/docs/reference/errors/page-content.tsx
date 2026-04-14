"use client";

import { Badge } from "@wraps/ui/components/ui/badge";
import { Button } from "@wraps/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@wraps/ui/components/ui/card";
import { AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { CopyForAIButton } from "@/components/docs/copy-for-ai-button";
import { SectionHeading } from "@/components/docs/section-heading";
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

const retryPatternCode = `import { WrapsEmail, SESError } from '@wraps.dev/email';

const email = new WrapsEmail();

async function sendWithRetry(params, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await email.send(params);
    } catch (error) {
      if (error instanceof SESError && error.retryable && attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        continue;
      }
      throw error;
    }
  }
}`;

const errorHandlingCode = `import { WrapsEmail, SESError, DynamoDBError, ValidationError } from '@wraps.dev/email';

const email = new WrapsEmail();

try {
  await email.send({
    from: 'hello@yourdomain.com',
    to: 'user@example.com',
    subject: 'Hello',
    html: '<p>Hello!</p>',
  });
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Invalid input:', error.field, error.message);
  } else if (error instanceof SESError) {
    console.error('SES error:', error.code, error.retryable);
  } else if (error instanceof DynamoDBError) {
    console.error('DynamoDB error:', error.code, error.retryable);
  }
}`;

// ============================================================================
// MARKDOWN CONTENT FOR AI COPY
// ============================================================================

const SECTION_MD = {
  credentialErrors: `### Credential Errors

| Code | Message | Solution |
|------|---------|----------|
| CREDENTIALS_NOT_FOUND | AWS credentials not found | Run \`wraps aws setup\` or configure AWS CLI |
| CREDENTIALS_EXPIRED | AWS credentials have expired | Refresh with \`aws sso login\` or update access keys |
| INVALID_CREDENTIALS | AWS credentials are invalid | Check access key and secret key are correct |`,

  iamErrors: `### IAM & Permission Errors

| Code | Message | Solution |
|------|---------|----------|
| MISSING_PERMISSIONS | Insufficient IAM permissions | Run \`wraps permissions\` to see required permissions |
| ROLE_NOT_FOUND | IAM role not found | Run \`wraps email init\` to create the role |
| OIDC_PROVIDER_ERROR | Failed to create OIDC provider | Check if provider already exists in IAM console |`,

  stackErrors: `### Stack & Deployment Errors

| Code | Message | Solution |
|------|---------|----------|
| STACK_NOT_FOUND | Pulumi stack not found | Run \`wraps email init\` to create infrastructure |
| STACK_CONFLICT | Stack operation in progress | Wait for the current operation to complete |
| DEPLOYMENT_FAILED | Infrastructure deployment failed | Check AWS CloudFormation console for details |`,

  emailErrors: `### Email Errors

| Code | Message | Solution |
|------|---------|----------|
| DOMAIN_NOT_VERIFIED | Domain not verified in SES | Run \`wraps email domains verify -d yourdomain.com\` |
| SES_SANDBOX | SES is in sandbox mode | Follow production access guide |
| SENDING_DISABLED | Email sending not enabled | Run \`wraps email upgrade\` to enable sending |`,

  smsErrors: `### SMS Errors

| Code | Message | Solution |
|------|---------|----------|
| PHONE_NOT_VERIFIED | Phone number not verified | Run \`wraps sms verify-number\` |
| SMS_SANDBOX | SMS in sandbox mode | Register toll-free number with \`wraps sms register\` |
| OPT_OUT | Recipient opted out | Remove from opt-out list or use different number |`,

  smtpErrors: `### SMTP Errors

| Code | Message | Solution |
|------|---------|----------|
| SMTP_CREDENTIALS_FAILED | SMTP credentials creation failed | Check IAM permissions for SES |
| SMTP_CONNECTION_FAILED | Cannot connect to SMTP endpoint | Verify region and port (587 or 465) |`,

  stateErrors: `### State Errors

| Code | Message | Solution |
|------|---------|----------|
| METADATA_NOT_FOUND | Connection metadata not found | Run \`wraps email init\` or \`wraps email restore\` |
| METADATA_CORRUPT | Connection metadata is corrupt | Delete ~/.wraps/connections/ and re-init |
| CONFIG_NOT_FOUND | wraps.config.ts not found | Run \`wraps email templates init\` |`,

  templateErrors: `### Template Errors

| Code | Message | Solution |
|------|---------|----------|
| TEMPLATE_COMPILE_ERROR | Template compilation failed | Check React component syntax |
| TEMPLATE_NOT_FOUND | SES template not found | Run \`wraps email templates push\` |`,

  sdkEmailErrors: `## SDK Error Classes — Email SDK (@wraps.dev/email)

- **SESError** — AWS SES API error. Properties: \`code\` (string), \`requestId\` (string), \`retryable\` (boolean). Common codes: MessageRejected, Throttling, AccountSuspended, MailFromDomainNotVerified.
- **DynamoDBError** — Email history read/write error. Properties: \`code\` (string), \`requestId\` (string), \`retryable\` (boolean).
- **ValidationError** — Invalid input. Properties: \`field\` (string), \`message\` (string).`,

  sdkSmsErrors: `## SDK Error Classes — SMS SDK (@wraps.dev/sms)

- **SMSError** — AWS End User Messaging error. Properties: \`code\` (string), \`retryable\` (boolean).
- **ValidationError** — Invalid input. Properties: \`field\` (string), \`message\` (string).
- **OptedOutError** — Recipient opted out. Properties: \`phoneNumber\` (string).
- **RateLimitError** — Rate limit exceeded. Properties: \`retryAfter\` (number, seconds).`,

  retryPattern: `## Retry Pattern

The SDKs do NOT automatically retry failed requests. If \`retryable\` is \`true\`, implement your own retry logic.

\`\`\`typescript
${retryPatternCode}
\`\`\``,
};

const FULL_PAGE_MD = `# Error Codes & Troubleshooting

Complete reference for all CLI error codes and SDK error classes, with solutions for each.

## CLI Error Codes

${SECTION_MD.credentialErrors}

${SECTION_MD.iamErrors}

${SECTION_MD.stackErrors}

${SECTION_MD.emailErrors}

${SECTION_MD.smsErrors}

${SECTION_MD.smtpErrors}

${SECTION_MD.stateErrors}

${SECTION_MD.templateErrors}

${SECTION_MD.sdkEmailErrors}

${SECTION_MD.sdkSmsErrors}

${SECTION_MD.retryPattern}
`;

const SLASH_COMMAND_MD = `---
description: Wraps error codes and troubleshooting - use this when debugging CLI or SDK errors
---

${FULL_PAGE_MD}`;

// ============================================================================
// ERROR TABLE COMPONENT
// ============================================================================

function ErrorTable({
  rows,
}: {
  rows: { code: string; message: string; solution: string }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="px-4 py-2 text-left font-medium">Code</th>
            <th className="px-4 py-2 text-left font-medium">Message</th>
            <th className="px-4 py-2 text-left font-medium">Solution</th>
          </tr>
        </thead>
        <tbody className="text-muted-foreground">
          {rows.map((row, i) => (
            <tr
              className={i < rows.length - 1 ? "border-b" : ""}
              key={row.code}
            >
              <td className="px-4 py-2">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  {row.code}
                </code>
              </td>
              <td className="px-4 py-2">{row.message}</td>
              <td className="px-4 py-2">{row.solution}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// PAGE CONTENT
// ============================================================================

export default function PageContent() {
  return (
    <DocsLayout
      headerActions={
        <CopyForAIButton
          markdown={FULL_PAGE_MD}
          slashCommand={SLASH_COMMAND_MD}
        />
      }
    >
      {/* Page Header */}
      <div className="mb-12">
        <Badge className="mb-4" variant="outline">
          Reference
        </Badge>
        <h1 className="mb-4 font-bold text-4xl tracking-tight">
          Error Codes & Troubleshooting
        </h1>
        <p className="text-lg text-muted-foreground">
          Complete reference for all CLI error codes and SDK error classes, with
          solutions for each.
        </p>
      </div>

      {/* CLI Error Codes */}
      <section className="mb-12">
        <SectionHeading
          className="mb-6"
          id="cli-error-codes"
          markdown={`## CLI Error Codes\n\n${SECTION_MD.credentialErrors}\n\n${SECTION_MD.iamErrors}\n\n${SECTION_MD.stackErrors}\n\n${SECTION_MD.emailErrors}\n\n${SECTION_MD.smsErrors}\n\n${SECTION_MD.smtpErrors}\n\n${SECTION_MD.stateErrors}\n\n${SECTION_MD.templateErrors}`}
          title="CLI Error Codes"
        />

        {/* Credential Errors */}
        <div className="mb-8">
          <h3 className="mb-3 font-medium text-lg" id="credential-errors">
            Credential Errors
          </h3>
          <Card>
            <CardContent className="p-0">
              <ErrorTable
                rows={[
                  {
                    code: "CREDENTIALS_NOT_FOUND",
                    message: "AWS credentials not found",
                    solution: "Run wraps aws setup or configure AWS CLI",
                  },
                  {
                    code: "CREDENTIALS_EXPIRED",
                    message: "AWS credentials have expired",
                    solution:
                      "Refresh with aws sso login or update access keys",
                  },
                  {
                    code: "INVALID_CREDENTIALS",
                    message: "AWS credentials are invalid",
                    solution: "Check access key and secret key are correct",
                  },
                ]}
              />
            </CardContent>
          </Card>
        </div>

        {/* IAM & Permission Errors */}
        <div className="mb-8">
          <h3 className="mb-3 font-medium text-lg" id="iam-errors">
            IAM & Permission Errors
          </h3>
          <Card>
            <CardContent className="p-0">
              <ErrorTable
                rows={[
                  {
                    code: "MISSING_PERMISSIONS",
                    message: "Insufficient IAM permissions",
                    solution:
                      "Run wraps permissions to see required permissions",
                  },
                  {
                    code: "ROLE_NOT_FOUND",
                    message: "IAM role not found",
                    solution: "Run wraps email init to create the role",
                  },
                  {
                    code: "OIDC_PROVIDER_ERROR",
                    message: "Failed to create OIDC provider",
                    solution: "Check if provider already exists in IAM console",
                  },
                ]}
              />
            </CardContent>
          </Card>
        </div>

        {/* Stack & Deployment Errors */}
        <div className="mb-8">
          <h3 className="mb-3 font-medium text-lg" id="stack-errors">
            Stack & Deployment Errors
          </h3>
          <Card>
            <CardContent className="p-0">
              <ErrorTable
                rows={[
                  {
                    code: "STACK_NOT_FOUND",
                    message: "Pulumi stack not found",
                    solution: "Run wraps email init to create infrastructure",
                  },
                  {
                    code: "STACK_CONFLICT",
                    message: "Stack operation in progress",
                    solution: "Wait for the current operation to complete",
                  },
                  {
                    code: "DEPLOYMENT_FAILED",
                    message: "Infrastructure deployment failed",
                    solution: "Check AWS CloudFormation console for details",
                  },
                ]}
              />
            </CardContent>
          </Card>
        </div>

        {/* Email Errors */}
        <div className="mb-8">
          <h3 className="mb-3 font-medium text-lg" id="email-errors">
            Email Errors
          </h3>
          <Card>
            <CardContent className="p-0">
              <ErrorTable
                rows={[
                  {
                    code: "DOMAIN_NOT_VERIFIED",
                    message: "Domain not verified in SES",
                    solution:
                      "Run wraps email domains verify -d yourdomain.com",
                  },
                  {
                    code: "SES_SANDBOX",
                    message: "SES is in sandbox mode",
                    solution: "Follow production access guide",
                  },
                  {
                    code: "SENDING_DISABLED",
                    message: "Email sending not enabled",
                    solution: "Run wraps email upgrade to enable sending",
                  },
                ]}
              />
            </CardContent>
          </Card>
        </div>

        {/* SMS Errors */}
        <div className="mb-8">
          <h3 className="mb-3 font-medium text-lg" id="sms-errors">
            SMS Errors
          </h3>
          <Card>
            <CardContent className="p-0">
              <ErrorTable
                rows={[
                  {
                    code: "PHONE_NOT_VERIFIED",
                    message: "Phone number not verified",
                    solution: "Run wraps sms verify-number",
                  },
                  {
                    code: "SMS_SANDBOX",
                    message: "SMS in sandbox mode",
                    solution:
                      "Register toll-free number with wraps sms register",
                  },
                  {
                    code: "OPT_OUT",
                    message: "Recipient opted out",
                    solution:
                      "Remove from opt-out list or use different number",
                  },
                ]}
              />
            </CardContent>
          </Card>
        </div>

        {/* SMTP Errors */}
        <div className="mb-8">
          <h3 className="mb-3 font-medium text-lg" id="smtp-errors">
            SMTP Errors
          </h3>
          <Card>
            <CardContent className="p-0">
              <ErrorTable
                rows={[
                  {
                    code: "SMTP_CREDENTIALS_FAILED",
                    message: "SMTP credentials creation failed",
                    solution: "Check IAM permissions for SES",
                  },
                  {
                    code: "SMTP_CONNECTION_FAILED",
                    message: "Cannot connect to SMTP endpoint",
                    solution: "Verify region and port (587 or 465)",
                  },
                ]}
              />
            </CardContent>
          </Card>
        </div>

        {/* State Errors */}
        <div className="mb-8">
          <h3 className="mb-3 font-medium text-lg" id="state-errors">
            State Errors
          </h3>
          <Card>
            <CardContent className="p-0">
              <ErrorTable
                rows={[
                  {
                    code: "METADATA_NOT_FOUND",
                    message: "Connection metadata not found",
                    solution: "Run wraps email init or wraps email restore",
                  },
                  {
                    code: "METADATA_CORRUPT",
                    message: "Connection metadata is corrupt",
                    solution: "Delete ~/.wraps/connections/ and re-init",
                  },
                  {
                    code: "CONFIG_NOT_FOUND",
                    message: "wraps.config.ts not found",
                    solution: "Run wraps email templates init",
                  },
                ]}
              />
            </CardContent>
          </Card>
        </div>

        {/* Template Errors */}
        <div className="mb-8">
          <h3 className="mb-3 font-medium text-lg" id="template-errors">
            Template Errors
          </h3>
          <Card>
            <CardContent className="p-0">
              <ErrorTable
                rows={[
                  {
                    code: "TEMPLATE_COMPILE_ERROR",
                    message: "Template compilation failed",
                    solution: "Check React component syntax",
                  },
                  {
                    code: "TEMPLATE_NOT_FOUND",
                    message: "SES template not found",
                    solution: "Run wraps email templates push",
                  },
                ]}
              />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* SDK Error Classes */}
      <section className="mb-12">
        <SectionHeading
          className="mb-6"
          id="sdk-error-classes"
          markdown={`${SECTION_MD.sdkEmailErrors}\n\n${SECTION_MD.sdkSmsErrors}`}
          title="SDK Error Classes"
        />

        {/* Email SDK */}
        <div className="mb-8">
          <h3 className="mb-4 font-medium text-lg" id="email-sdk-errors">
            Email SDK (
            <code className="rounded bg-muted px-1.5 py-0.5">
              @wraps.dev/email
            </code>
            )
          </h3>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">SESError</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-muted-foreground text-sm">
                  Thrown when an AWS SES API call fails.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-2 text-left font-medium">
                          Property
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                          Type
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr className="border-b">
                        <td className="px-4 py-2">
                          <code className="rounded bg-muted px-1.5 py-0.5">
                            code
                          </code>
                        </td>
                        <td className="px-4 py-2">string</td>
                        <td className="px-4 py-2">
                          MessageRejected, Throttling, AccountSuspended,
                          MailFromDomainNotVerified
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="px-4 py-2">
                          <code className="rounded bg-muted px-1.5 py-0.5">
                            requestId
                          </code>
                        </td>
                        <td className="px-4 py-2">string</td>
                        <td className="px-4 py-2">AWS request identifier</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">
                          <code className="rounded bg-muted px-1.5 py-0.5">
                            retryable
                          </code>
                        </td>
                        <td className="px-4 py-2">boolean</td>
                        <td className="px-4 py-2">
                          Whether the request can be retried
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">DynamoDBError</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-muted-foreground text-sm">
                  Thrown when an email history read/write operation fails.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-2 text-left font-medium">
                          Property
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                          Type
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr className="border-b">
                        <td className="px-4 py-2">
                          <code className="rounded bg-muted px-1.5 py-0.5">
                            code
                          </code>
                        </td>
                        <td className="px-4 py-2">string</td>
                        <td className="px-4 py-2">DynamoDB error code</td>
                      </tr>
                      <tr className="border-b">
                        <td className="px-4 py-2">
                          <code className="rounded bg-muted px-1.5 py-0.5">
                            requestId
                          </code>
                        </td>
                        <td className="px-4 py-2">string</td>
                        <td className="px-4 py-2">AWS request identifier</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">
                          <code className="rounded bg-muted px-1.5 py-0.5">
                            retryable
                          </code>
                        </td>
                        <td className="px-4 py-2">boolean</td>
                        <td className="px-4 py-2">
                          Whether the request can be retried
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">ValidationError</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-muted-foreground text-sm">
                  Thrown when input parameters are invalid.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-2 text-left font-medium">
                          Property
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                          Type
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr className="border-b">
                        <td className="px-4 py-2">
                          <code className="rounded bg-muted px-1.5 py-0.5">
                            field
                          </code>
                        </td>
                        <td className="px-4 py-2">string</td>
                        <td className="px-4 py-2">
                          Which field failed validation
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">
                          <code className="rounded bg-muted px-1.5 py-0.5">
                            message
                          </code>
                        </td>
                        <td className="px-4 py-2">string</td>
                        <td className="px-4 py-2">
                          Human-readable error description
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* SMS SDK */}
        <div className="mb-8">
          <h3 className="mb-4 font-medium text-lg" id="sms-sdk-errors">
            SMS SDK (
            <code className="rounded bg-muted px-1.5 py-0.5">
              @wraps.dev/sms
            </code>
            )
          </h3>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">SMSError</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-muted-foreground text-sm">
                  Thrown when an AWS End User Messaging API call fails.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-2 text-left font-medium">
                          Property
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                          Type
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr className="border-b">
                        <td className="px-4 py-2">
                          <code className="rounded bg-muted px-1.5 py-0.5">
                            code
                          </code>
                        </td>
                        <td className="px-4 py-2">string</td>
                        <td className="px-4 py-2">AWS error code</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">
                          <code className="rounded bg-muted px-1.5 py-0.5">
                            retryable
                          </code>
                        </td>
                        <td className="px-4 py-2">boolean</td>
                        <td className="px-4 py-2">
                          Whether the request can be retried
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">ValidationError</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-muted-foreground text-sm">
                  Thrown when input parameters are invalid.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-2 text-left font-medium">
                          Property
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                          Type
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr className="border-b">
                        <td className="px-4 py-2">
                          <code className="rounded bg-muted px-1.5 py-0.5">
                            field
                          </code>
                        </td>
                        <td className="px-4 py-2">string</td>
                        <td className="px-4 py-2">
                          Which field failed validation
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">
                          <code className="rounded bg-muted px-1.5 py-0.5">
                            message
                          </code>
                        </td>
                        <td className="px-4 py-2">string</td>
                        <td className="px-4 py-2">
                          Human-readable error description
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">OptedOutError</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-muted-foreground text-sm">
                  Thrown when the recipient has opted out of receiving messages.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-2 text-left font-medium">
                          Property
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                          Type
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr>
                        <td className="px-4 py-2">
                          <code className="rounded bg-muted px-1.5 py-0.5">
                            phoneNumber
                          </code>
                        </td>
                        <td className="px-4 py-2">string</td>
                        <td className="px-4 py-2">
                          The phone number that opted out
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">RateLimitError</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-muted-foreground text-sm">
                  Thrown when the sending rate limit has been exceeded.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-2 text-left font-medium">
                          Property
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                          Type
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr>
                        <td className="px-4 py-2">
                          <code className="rounded bg-muted px-1.5 py-0.5">
                            retryAfter
                          </code>
                        </td>
                        <td className="px-4 py-2">number</td>
                        <td className="px-4 py-2">
                          Seconds to wait before retrying
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Important Callout */}
      <section className="mb-12">
        <div className="rounded-lg border-amber-500 border-l-4 bg-amber-500/10 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <p className="font-medium">No Automatic Retries</p>
              <p className="mt-1 text-muted-foreground text-sm">
                The SDKs do NOT automatically retry failed requests. If{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  retryable
                </code>{" "}
                is <code className="rounded bg-muted px-1.5 py-0.5">true</code>,
                implement your own retry logic using the pattern below.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Retry Pattern */}
      <section className="mb-12">
        <SectionHeading
          className="mb-4"
          id="retry-pattern"
          markdown={SECTION_MD.retryPattern}
          title="Retry Pattern"
        />
        <p className="mb-4 text-muted-foreground">
          Use exponential backoff when retrying failed requests. This example
          uses a simple retry loop with increasing delays.
        </p>
        <CodeBlock
          className="h-auto"
          data={[
            {
              language: "typescript",
              filename: "retry-pattern.ts",
              code: retryPatternCode,
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

      {/* Error Handling Example */}
      <section className="mb-12">
        <SectionHeading
          className="mb-4"
          id="error-handling-example"
          markdown={`## Error Handling Example\n\n\`\`\`typescript\n${errorHandlingCode}\n\`\`\``}
          title="Error Handling Example"
        />
        <p className="mb-4 text-muted-foreground">
          Catch and handle specific error types to provide appropriate responses
          in your application.
        </p>
        <CodeBlock
          className="h-auto"
          data={[
            {
              language: "typescript",
              filename: "error-handling.ts",
              code: errorHandlingCode,
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

      {/* Next Steps */}
      <section className="mb-12">
        <h2 className="mb-6 font-bold text-2xl">Next Steps</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">Email SDK</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Full API reference for the @wraps.dev/email TypeScript SDK.
              </p>
              <Button asChild variant="outline">
                <Link href="/docs/sdk-reference">
                  View Reference
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">SMS SDK</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Full API reference for the @wraps.dev/sms TypeScript SDK.
              </p>
              <Button asChild variant="outline">
                <Link href="/docs/sms-sdk-reference">
                  View Reference
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">AWS Setup</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Configure AWS credentials and permissions for Wraps.
              </p>
              <Button asChild variant="outline">
                <Link href="/docs/guides/aws-setup">
                  View Guide
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
