"use client";

import {
  ArrowRightIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  CheckIcon,
  CloudIcon,
  CodeIcon,
  CopyIcon,
  GlobeIcon,
  LayoutTemplateIcon,
  LinkIcon,
  MailIcon,
  MegaphoneIcon,
  ServerIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { SetupStatus } from "../page";

type GettingStartedDashboardProps = {
  orgSlug: string;
  organizationName: string;
  setupStatus: SetupStatus;
  completionPercent: number;
};

const SDK_CODE = `import { Wraps } from '@wraps.dev/email';

const wraps = new Wraps();

await wraps.emails.send({
  from: 'hello@yourdomain.com',
  to: 'user@example.com',
  subject: 'Welcome!',
  html: '<h1>Hello from Wraps!</h1>',
});`;

const INSTALL_CODE = "npm install @wraps.dev/email";

type ChecklistItemProps = {
  title: string;
  description: string;
  isComplete: boolean;
  href?: string;
  icon: React.ReactNode;
  isOptional?: boolean;
};

function ChecklistItem({
  title,
  description,
  isComplete,
  href,
  icon,
  isOptional,
}: ChecklistItemProps) {
  const content = (
    <div
      className={cn(
        "flex items-start gap-4 rounded-lg border p-4 transition-colors",
        href && !isComplete && "cursor-pointer hover:bg-accent",
        isComplete && "bg-muted/30"
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          isComplete
            ? "bg-green-500/10 text-green-600"
            : "bg-primary/10 text-primary"
        )}
      >
        {isComplete ? <CheckCircle2Icon className="h-5 w-5" /> : icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4
            className={cn("font-medium", isComplete && "text-muted-foreground")}
          >
            {title}
          </h4>
          {isOptional && (
            <Badge className="text-xs" variant="secondary">
              Optional
            </Badge>
          )}
          {isComplete && (
            <Badge
              className="text-xs text-green-600 border-green-200 bg-green-50"
              variant="outline"
            >
              Complete
            </Badge>
          )}
        </div>
        <p
          className={cn(
            "mt-1 text-sm",
            isComplete ? "text-muted-foreground/70" : "text-muted-foreground"
          )}
        >
          {description}
        </p>
      </div>
      {href && !isComplete && (
        <ArrowRightIcon className="h-5 w-5 text-muted-foreground shrink-0" />
      )}
    </div>
  );

  if (href && !isComplete) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      className="h-8 w-8 shrink-0"
      onClick={handleCopy}
      size="icon"
      variant="ghost"
    >
      {copied ? (
        <CheckIcon className="h-4 w-4 text-green-600" />
      ) : (
        <CopyIcon className="h-4 w-4" />
      )}
    </Button>
  );
}

export function GettingStartedDashboard({
  orgSlug,
  organizationName,
  setupStatus,
  completionPercent,
}: GettingStartedDashboardProps) {
  const {
    hasAwsAccount,
    hasPlatformConnection,
    hasVerifiedDomain,
    hasSentEmail,
    hasTemplate,
    hasBroadcast,
    verifiedDomains,
    awsRegion,
  } = setupStatus;

  return (
    <>
      {/* Page Header */}
      <div className="px-4 lg:px-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-bold text-2xl tracking-tight">
            Welcome to {organizationName}
          </h1>
          <p className="text-muted-foreground">
            Complete these steps to start sending emails with your own AWS
            infrastructure.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="@container/main px-4 lg:px-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Setup Checklist */}
          <div className="lg:col-span-2 space-y-6">
            {/* Progress Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Setup Progress</CardTitle>
                    <CardDescription>
                      {completionPercent === 100
                        ? "All set! You're ready to send emails."
                        : `${completionPercent}% complete`}
                    </CardDescription>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <span className="font-bold text-primary text-lg">
                      {completionPercent}%
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Progress className="h-2" value={completionPercent} />
              </CardContent>
            </Card>

            {/* Checklist */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Getting Started Checklist
                </CardTitle>
                <CardDescription>
                  Complete these steps to unlock the full power of Wraps
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ChecklistItem
                  description="Set up AWS SES, DynamoDB, and event tracking in your account"
                  href={hasAwsAccount ? undefined : `/${orgSlug}/onboarding`}
                  icon={<CloudIcon className="h-5 w-5" />}
                  isComplete={hasAwsAccount}
                  title="Deploy email infrastructure"
                />

                <ChecklistItem
                  description="Run 'wraps platform connect' (v2.5.0+) to stream events and grant dashboard access"
                  href={
                    hasPlatformConnection
                      ? undefined
                      : "https://wraps.dev/docs/platform-connection"
                  }
                  icon={<LinkIcon className="h-5 w-5" />}
                  isComplete={hasPlatformConnection}
                  title="Connect to platform"
                />

                <ChecklistItem
                  description="Configure DNS records to send emails from your domain"
                  href={
                    hasVerifiedDomain
                      ? undefined
                      : `/${orgSlug}/settings/aws-accounts`
                  }
                  icon={<GlobeIcon className="h-5 w-5" />}
                  isComplete={hasVerifiedDomain}
                  title="Verify your domain"
                />

                <ChecklistItem
                  description="Use the SDK to send a test email and see it tracked"
                  href={hasSentEmail ? undefined : "/docs/quickstart"}
                  icon={<MailIcon className="h-5 w-5" />}
                  isComplete={hasSentEmail}
                  title="Send your first email"
                />

                <ChecklistItem
                  description="Build reusable templates with our visual editor"
                  href={
                    hasTemplate ? undefined : `/${orgSlug}/emails/templates/new`
                  }
                  icon={<LayoutTemplateIcon className="h-5 w-5" />}
                  isComplete={hasTemplate}
                  isOptional
                  title="Create an email template"
                />

                <ChecklistItem
                  description="Send emails to multiple recipients at once"
                  href={
                    hasBroadcast
                      ? undefined
                      : `/${orgSlug}/emails/broadcasts/new`
                  }
                  icon={<MegaphoneIcon className="h-5 w-5" />}
                  isComplete={hasBroadcast}
                  isOptional
                  title="Send a broadcast"
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Status & Quick Start */}
          <div className="space-y-6">
            {/* Integration Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Integration Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ServerIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">AWS Account</span>
                  </div>
                  {hasAwsAccount ? (
                    <Badge
                      className="text-green-600 border-green-200 bg-green-50"
                      variant="outline"
                    >
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Not connected</Badge>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Platform Events</span>
                  </div>
                  {hasPlatformConnection ? (
                    <Badge
                      className="text-green-600 border-green-200 bg-green-50"
                      variant="outline"
                    >
                      Streaming
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Not configured</Badge>
                  )}
                </div>

                {awsRegion && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GlobeIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Region</span>
                    </div>
                    <span className="text-sm font-mono">{awsRegion}</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MailIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Verified Domains</span>
                  </div>
                  <span className="text-sm">{verifiedDomains.length}</span>
                </div>

                {verifiedDomains.length > 0 && (
                  <div className="border-t pt-3">
                    <p className="text-xs text-muted-foreground mb-2">
                      Domains
                    </p>
                    <div className="space-y-1">
                      {verifiedDomains.map((domain) => (
                        <div
                          className="flex items-center gap-2 text-sm"
                          key={domain}
                        >
                          <CheckCircle2Icon className="h-3.5 w-3.5 text-green-600" />
                          <span className="font-mono text-xs">{domain}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!hasAwsAccount && (
                  <Button asChild className="w-full mt-2">
                    <Link href={`/${orgSlug}/onboarding`}>
                      Connect AWS Account
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Quick Start Code */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CodeIcon className="h-5 w-5" />
                  Quick Start
                </CardTitle>
                <CardDescription>
                  Install the SDK and send your first email
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      1. Install
                    </p>
                    <CopyButton value={INSTALL_CODE} />
                  </div>
                  <pre className="rounded-lg bg-secondary p-3 overflow-x-auto">
                    <code className="text-xs">{INSTALL_CODE}</code>
                  </pre>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      2. Send an email
                    </p>
                    <CopyButton value={SDK_CODE} />
                  </div>
                  <pre className="rounded-lg bg-secondary p-3 overflow-x-auto max-h-48">
                    <code className="text-xs whitespace-pre">{SDK_CODE}</code>
                  </pre>
                </div>

                <Button asChild className="w-full" variant="outline">
                  <a
                    href="/docs/quickstart"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <BookOpenIcon className="mr-2 h-4 w-4" />
                    View Full Documentation
                  </a>
                </Button>
              </CardContent>
            </Card>

            {/* Help Card */}
            <Card className="bg-muted/30">
              <CardContent className="pt-6">
                <h3 className="font-semibold text-sm mb-2">Need help?</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Our team is here to help you get started.
                </p>
                <div className="space-y-2">
                  <Button
                    asChild
                    className="w-full justify-start"
                    size="sm"
                    variant="outline"
                  >
                    <a href="/docs" rel="noopener noreferrer" target="_blank">
                      <BookOpenIcon className="mr-2 h-4 w-4" />
                      Documentation
                    </a>
                  </Button>
                  <Button
                    asChild
                    className="w-full justify-start"
                    size="sm"
                    variant="outline"
                  >
                    <a
                      href="https://discord.gg/wraps"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <svg
                        aria-label="Discord"
                        className="mr-2 h-4 w-4"
                        fill="currentColor"
                        role="img"
                        viewBox="0 0 24 24"
                      >
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z" />
                      </svg>
                      Discord Community
                    </a>
                  </Button>
                  <Button
                    asChild
                    className="w-full justify-start"
                    size="sm"
                    variant="outline"
                  >
                    <a href="mailto:support@wraps.dev">
                      <MailIcon className="mr-2 h-4 w-4" />
                      Email Support
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
