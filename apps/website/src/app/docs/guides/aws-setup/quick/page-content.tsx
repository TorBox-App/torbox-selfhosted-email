"use client";

import { ArrowRight, CheckCircle2, Clock, Info } from "lucide-react";
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

const verifyCommand = "aws sts get-caller-identity";

const deployCommand = "npx @wraps.dev/cli email init";

const doctorCommand = "npx @wraps.dev/cli aws doctor";

const requiredPermissions = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ses:*",
        "iam:CreateRole",
        "iam:CreatePolicy",
        "iam:AttachRolePolicy",
        "iam:PutRolePolicy",
        "iam:GetRole",
        "iam:PassRole",
        "iam:DeleteRole",
        "iam:DeleteRolePolicy",
        "iam:DetachRolePolicy",
        "iam:CreateOpenIDConnectProvider",
        "iam:DeleteOpenIDConnectProvider",
        "iam:GetOpenIDConnectProvider",
        "dynamodb:CreateTable",
        "dynamodb:DeleteTable",
        "dynamodb:DescribeTable",
        "dynamodb:UpdateTimeToLive",
        "lambda:CreateFunction",
        "lambda:DeleteFunction",
        "lambda:GetFunction",
        "lambda:UpdateFunctionCode",
        "lambda:UpdateFunctionConfiguration",
        "lambda:AddPermission",
        "lambda:CreateEventSourceMapping",
        "lambda:DeleteEventSourceMapping",
        "sqs:CreateQueue",
        "sqs:DeleteQueue",
        "sqs:GetQueueAttributes",
        "sqs:SetQueueAttributes",
        "events:PutRule",
        "events:PutTargets",
        "events:DeleteRule",
        "events:RemoveTargets",
        "events:DescribeRule"
      ],
      "Resource": "*"
    }
  ]
}`;

export default function QuickStartPageContent() {
  return (
    <DocsLayout>
      {/* Page Header */}
      <div className="mb-12">
        <Badge className="mb-4" variant="outline">
          Quick Start
        </Badge>
        <h1 className="mb-4 font-bold text-4xl tracking-tight">
          AWS Quick Start
        </h1>
        <p className="text-lg text-muted-foreground">
          For users with existing AWS CLI configured. Verify your setup and
          deploy in under 2 minutes.
        </p>
        <div className="mt-4 flex items-center gap-4 text-muted-foreground text-sm">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />2 min
          </span>
        </div>
      </div>

      {/* Step 1: Verify */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            1
          </div>
          Verify Your AWS Setup
        </h2>
        <p className="mb-4 text-muted-foreground">
          Confirm your AWS CLI is configured and credentials are working:
        </p>
        <CodeBlock
          className="mb-4 h-auto"
          data={[
            {
              language: "bash",
              filename: "terminal.sh",
              code: verifyCommand,
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

        <p className="text-muted-foreground text-sm">
          You should see your account ID, user ID, and ARN. If you get an error,
          see the{" "}
          <a
            className="font-medium text-primary underline"
            href="/docs/guides/aws-setup/troubleshooting"
          >
            troubleshooting guide
          </a>
          .
        </p>
      </section>

      {/* Step 2: Deploy */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            2
          </div>
          Deploy Email Infrastructure
        </h2>
        <p className="mb-4 text-muted-foreground">
          Run the init command to deploy Wraps to your AWS account:
        </p>
        <CodeBlock
          className="mb-4 h-auto"
          data={[
            {
              language: "bash",
              filename: "terminal.sh",
              code: deployCommand,
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

        <p className="text-muted-foreground text-sm">
          The wizard will guide you through choosing your hosting provider,
          region, and configuration preset.
        </p>
      </section>

      {/* Permissions */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Required Permissions</h2>
        <p className="mb-4 text-muted-foreground">
          The CLI needs permissions to create IAM roles, SES configuration,
          DynamoDB tables, Lambda functions, and SQS queues. If you can't use
          AdministratorAccess, here's the minimum required policy:
        </p>

        <details className="group rounded-lg border">
          <summary className="flex cursor-pointer items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">View IAM Policy JSON</span>
            </div>
            <span className="text-muted-foreground transition-transform group-open:rotate-180">
              ▼
            </span>
          </summary>
          <div className="border-t p-4">
            <CodeBlock
              className="h-auto"
              data={[
                {
                  language: "json",
                  filename: "policy.json",
                  code: requiredPermissions,
                },
              ]}
              defaultValue="json"
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
        </details>
      </section>

      {/* Diagnostics */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Having Issues?</h2>
        <p className="mb-4 text-muted-foreground">
          Run our diagnostics tool to identify and fix common problems:
        </p>
        <CodeBlock
          className="mb-4 h-auto"
          data={[
            {
              language: "bash",
              filename: "terminal.sh",
              code: doctorCommand,
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
      </section>

      {/* Checklist */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Quick Checklist</h2>
        <Card>
          <CardContent className="p-6">
            <ul className="space-y-3">
              <li className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span>AWS CLI installed and configured</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span>
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    aws sts get-caller-identity
                  </code>{" "}
                  returns your account
                </span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span>
                  User has required permissions (AdministratorAccess or custom
                  policy)
                </span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span>
                  Run{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    npx @wraps.dev/cli email init
                  </code>
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>
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
                <Link href="/docs/guides/domain-verification">
                  Domain Setup
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">Production Access</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Move out of sandbox mode to send to any recipient.
              </p>
              <Button asChild variant="outline">
                <Link href="/docs/guides/production-access">
                  Get Production Access
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
