"use client";

import { Badge } from "@wraps/ui/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@wraps/ui/components/ui/card";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  HelpCircle,
  Terminal,
} from "lucide-react";
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

const doctorCommand = "npx @wraps.dev/cli aws doctor";

const issues = [
  {
    title: "Unable to locate credentials",
    error:
      'Unable to locate credentials. You can configure credentials by running "aws configure".',
    causes: [
      "AWS CLI not configured",
      "No ~/.aws/credentials file",
      "AWS_PROFILE environment variable set to non-existent profile",
    ],
    solutions: [
      {
        label: "Run aws configure",
        code: "aws configure",
        description: "Enter your Access Key ID, Secret Key, and region",
      },
      {
        label: "Check AWS_PROFILE",
        code: "echo $AWS_PROFILE",
        description: "Make sure the profile exists or unset the variable",
      },
      {
        label: "Verify credentials file",
        code: "cat ~/.aws/credentials",
        description: "Should show [default] section with keys",
      },
    ],
  },
  {
    title: "Invalid security token",
    error: "The security token included in the request is invalid.",
    causes: [
      "Expired temporary credentials (SSO or assumed role)",
      "Access key was deleted in AWS Console",
      "Typo in access key or secret key",
    ],
    solutions: [
      {
        label: "Refresh SSO session",
        code: "aws sso login",
        description: "If using AWS SSO, re-authenticate",
      },
      {
        label: "Reconfigure credentials",
        code: "aws configure",
        description: "Enter fresh credentials from AWS Console",
      },
    ],
  },
  {
    title: "Access Denied",
    error:
      "An error occurred (AccessDenied) when calling the ... operation: User: ... is not authorized to perform: ...",
    causes: [
      "IAM user missing required permissions",
      "Service Control Policies (SCPs) blocking access",
      "Wrong AWS account",
    ],
    solutions: [
      {
        label: "Check current identity",
        code: "aws sts get-caller-identity",
        description: "Verify you're using the right account/user",
      },
      {
        label: "Add permissions",
        code: "",
        description:
          "Attach AdministratorAccess policy or the required permissions to your IAM user",
      },
    ],
  },
  {
    title: "Region not set",
    error:
      'You must specify a region. You can also configure your region by running "aws configure".',
    causes: [
      "No default region configured",
      "AWS_REGION environment variable not set",
    ],
    solutions: [
      {
        label: "Set region in shell",
        code: "export AWS_REGION=us-east-1",
        description: "Temporarily set region for current session",
      },
      {
        label: "Configure default region",
        code: "aws configure set region us-east-1",
        description: "Permanently set default region",
      },
    ],
  },
  {
    title: "SES in sandbox mode",
    error:
      "Email address is not verified. The following identities failed the check in region...",
    causes: [
      "New AWS accounts start in SES sandbox mode",
      "Sandbox limits sending to verified emails only",
    ],
    solutions: [
      {
        label: "Verify recipient email",
        code: "aws ses verify-email-identity --email-address recipient@example.com",
        description: "For testing, verify recipient addresses",
      },
      {
        label: "Request production access",
        code: "",
        description:
          "Submit a request to move out of sandbox: AWS Console → SES → Account Dashboard → Request Production Access",
      },
    ],
  },
  {
    title: "AWS CLI not found",
    error: "command not found: aws",
    causes: ["AWS CLI not installed", "Not in PATH"],
    solutions: [
      {
        label: "macOS installation",
        code: "brew install awscli",
        description: "Install via Homebrew",
      },
      {
        label: "Linux installation",
        code: 'curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && unzip awscliv2.zip && sudo ./aws/install',
        description: "Download and install from AWS",
      },
      {
        label: "Verify installation",
        code: "which aws && aws --version",
        description: "Check if AWS CLI is in PATH",
      },
    ],
  },
  {
    title: "Profile not found",
    error: "The config profile (profile-name) could not be found",
    causes: [
      "AWS_PROFILE set to non-existent profile",
      "Typo in profile name",
      "Profile not in ~/.aws/config or ~/.aws/credentials",
    ],
    solutions: [
      {
        label: "List available profiles",
        code: "cat ~/.aws/credentials | grep '\\[' && cat ~/.aws/config | grep '\\[profile'",
        description: "See all configured profiles",
      },
      {
        label: "Use default profile",
        code: "unset AWS_PROFILE",
        description: "Remove AWS_PROFILE to use default",
      },
    ],
  },
];

export default function TroubleshootingPageContent() {
  return (
    <DocsLayout>
      {/* Page Header */}
      <div className="mb-12">
        <Badge className="mb-4" variant="outline">
          Reference
        </Badge>
        <h1 className="mb-4 font-bold text-4xl tracking-tight">
          AWS Troubleshooting
        </h1>
        <p className="text-lg text-muted-foreground">
          Common AWS credential and setup issues with solutions.
        </p>
      </div>

      {/* Quick Diagnostic */}
      <section className="mb-12">
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-primary" />
              Quick Diagnostic
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-muted-foreground">
              Run our diagnostic tool to automatically detect and suggest fixes
              for common issues:
            </p>
            <CodeBlock
              className="h-auto"
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

      {/* Issues List */}
      <section className="mb-12">
        <h2 className="mb-6 font-bold text-2xl">Common Issues</h2>
        <div className="space-y-8">
          {issues.map((issue, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  {issue.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Error Message */}
                <div className="rounded-lg bg-red-500/10 p-3">
                  <code className="text-red-600 text-sm dark:text-red-400">
                    {issue.error}
                  </code>
                </div>

                {/* Causes */}
                <div>
                  <h4 className="mb-2 flex items-center gap-1 font-medium text-sm">
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    Possible Causes
                  </h4>
                  <ul className="list-disc space-y-1 pl-5 text-muted-foreground text-sm">
                    {issue.causes.map((cause, i) => (
                      <li key={i}>{cause}</li>
                    ))}
                  </ul>
                </div>

                {/* Solutions */}
                <div>
                  <h4 className="mb-2 flex items-center gap-1 font-medium text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Solutions
                  </h4>
                  <div className="space-y-3">
                    {issue.solutions.map((solution, i) => (
                      <div
                        className="rounded-lg border bg-muted/30 p-3"
                        key={i}
                      >
                        <p className="font-medium text-sm">{solution.label}</p>
                        {solution.code && (
                          <CodeBlock
                            className="mt-2 h-auto"
                            data={[
                              {
                                language: "bash",
                                filename: "terminal.sh",
                                code: solution.code,
                              },
                            ]}
                            defaultValue="bash"
                          >
                            <CodeBlockHeader>
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
                        )}
                        <p className="mt-2 text-muted-foreground text-xs">
                          {solution.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Additional Help */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Still Having Issues?</h2>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Clock className="h-6 w-6 shrink-0 text-primary" />
              <div>
                <h3 className="font-medium">Interactive Setup Wizard</h3>
                <p className="mt-1 text-muted-foreground text-sm">
                  Our setup wizard can detect your current state and guide you
                  through exactly what you need:
                </p>
                <CodeBlock
                  className="mt-3 h-auto"
                  data={[
                    {
                      language: "bash",
                      filename: "terminal.sh",
                      code: "npx @wraps.dev/cli aws setup",
                    },
                  ]}
                  defaultValue="bash"
                >
                  <CodeBlockHeader>
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
          </CardContent>
        </Card>

        <div className="mt-4 rounded-lg border p-4">
          <h3 className="font-medium">AWS Documentation</h3>
          <p className="mt-1 text-muted-foreground text-sm">
            For advanced configuration options, see the official AWS CLI
            documentation:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            <li>
              <a
                className="text-primary underline"
                href="https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html"
                rel="noopener noreferrer"
                target="_blank"
              >
                AWS CLI Configuration Basics
              </a>
            </li>
            <li>
              <a
                className="text-primary underline"
                href="https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html"
                rel="noopener noreferrer"
                target="_blank"
              >
                AWS SSO Configuration
              </a>
            </li>
            <li>
              <a
                className="text-primary underline"
                href="https://docs.aws.amazon.com/IAM/latest/UserGuide/troubleshoot.html"
                rel="noopener noreferrer"
                target="_blank"
              >
                IAM Troubleshooting
              </a>
            </li>
          </ul>
        </div>
      </section>
    </DocsLayout>
  );
}
