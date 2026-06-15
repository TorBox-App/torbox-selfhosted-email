"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@wraps/ui/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@wraps/ui/components/ui/collapsible";
import { Label } from "@wraps/ui/components/ui/label";
import {
  CalendarIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  CloudIcon,
  CopyIcon,
  ExternalLinkIcon,
  GlobeIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  TerminalIcon,
  ZapIcon,
} from "lucide-react";
import posthog from "posthog-js";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CliDeployConnectStepProps = {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onConnected?: () => void;
  organizationId: string;
};

const CLI_STEPS = [
  {
    label: "Install the CLI",
    command: "curl -fsSL https://get.wraps.dev | sh",
    altCommand: "npm install -g @wraps.dev/cli",
    time: "~1 min",
  },
  {
    label: "Authenticate",
    command: "wraps auth login",
    time: "~1 min",
  },
  {
    label: "Deploy infrastructure",
    command: "wraps email init",
    time: "~5 min",
  },
  {
    label: "Connect to platform",
    command: "wraps platform connect",
    time: "~2 min",
  },
];

const PREREQUISITES = [
  {
    label: "AWS CLI installed",
    href: "https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html",
  },
  {
    label: "AWS credentials configured",
    href: "https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html",
    hint: true,
  },
];

const CAL_BOOKING_URL = "https://cal.com/wraps/get-started-with-wraps";

/**
 * Generate a cryptographically secure webhook secret
 */
function generateSecureWebhookSecret(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate CloudFormation Quick Create URL
 */
function generateQuickCreateUrl(
  organizationId: string,
  webhookSecret: string
): string {
  const templateUrl =
    "https://wraps-assets.s3.amazonaws.com/cloudformation/wraps-email-infrastructure.yaml";

  const params = new URLSearchParams({
    templateURL: templateUrl,
    stackName: "wraps-email-infrastructure",
    param_EnableEventTracking: "true",
    param_EnableHistoryStorage: "true",
    param_HistoryRetentionDays: "90",
    param_EnableSMTP: "false",
    param_TLSRequired: "false",
    param_WrapsOrganizationId: organizationId,
    param_WrapsWebhookSecret: webhookSecret,
  });

  return `https://console.aws.amazon.com/cloudformation/home#/stacks/create/review?${params.toString()}`;
}

export function CliDeployConnectStep({
  onBack,
  onSkip,
  onConnected,
  organizationId,
}: CliDeployConnectStepProps) {
  const queryClient = useQueryClient();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [cfnDeployed, setCfnDeployed] = useState(false);

  // Generate a cryptographically secure webhook secret once on mount
  const [webhookSecret] = useState(() => generateSecureWebhookSecret());

  const quickCreateUrl = useMemo(
    () => generateQuickCreateUrl(organizationId, webhookSecret),
    [organizationId, webhookSecret]
  );

  // Manual connection check
  const [isChecking, setIsChecking] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const [validationError, setValidationError] = useState<{
    error: string;
    code: string;
    remediation: string;
  } | null>(null);

  const handleCheckConnection = async () => {
    setIsChecking(true);
    setCheckFailed(false);
    try {
      const res = await fetch(`/api/${organizationId}/connections`);
      if (!res.ok) {
        setCheckFailed(true);
        return;
      }
      const data = await res.json();
      if (data.connections?.length > 0) {
        toast.success("Connection detected!");
        posthog.capture("onboarding_cli_connection_detected", {
          step: 4,
          step_name: "Deploy & Connect",
          organization_id: organizationId,
        });
        posthog.capture("onboarding_step_completed", {
          step: 4,
          step_name: "Deploy & Connect",
          organization_id: organizationId,
          method: "cli",
        });
        queryClient.invalidateQueries({
          queryKey: ["onboarding-status", organizationId],
        });
        if (onConnected) {
          onConnected();
        }
      } else {
        setCheckFailed(true);
        toast.error(
          "No connection found yet. Make sure you've run all 4 commands."
        );
      }
    } catch {
      setCheckFailed(true);
      toast.error("Failed to check connection. Please try again.");
    } finally {
      setIsChecking(false);
    }
  };

  // CloudFormation validation mutation
  const validateAwsMutation = useMutation({
    mutationFn: async (data: { roleArn: string; externalId: string }) => {
      const response = await fetch(
        `/api/${organizationId}/aws/validate-infrastructure`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, webhookSecret }),
        }
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const err = new Error(
          body.error || "Failed to validate AWS connection"
        );
        (err as Error & { details?: unknown }).details = {
          code: body.code ?? "UNKNOWN",
          remediation: body.remediation ?? "",
        };
        throw err;
      }
      return response.json();
    },
    onMutate: () => setValidationError(null),
    onSuccess: () => {
      setValidationError(null);
      toast.success("Infrastructure connected successfully!");
      queryClient.invalidateQueries({
        queryKey: ["onboarding-status", organizationId],
      });
      posthog.capture("onboarding_step_completed", {
        step: 4,
        step_name: "Deploy & Connect",
        organization_id: organizationId,
        method: "cloudformation",
      });
      if (onConnected) {
        onConnected();
      }
    },
    onError: (
      error: Error & { details?: { code?: string; remediation?: string } }
    ) => {
      const code = error.details?.code ?? "UNKNOWN";
      const remediation = error.details?.remediation ?? "";
      setValidationError({ error: error.message, code, remediation });
      toast.error(error.message || "Failed to validate connection");
      posthog.capture("onboarding_connection_failed", {
        step: 4,
        step_name: "Deploy & Connect",
        organization_id: organizationId,
        method: "cloudformation",
        error_code: code,
      });
    },
  });

  const form = useForm({
    defaultValues: {
      roleArn: "",
      externalId: "",
    },
    onSubmit: async ({ value }) => {
      validateAwsMutation.mutate(value);
    },
    validators: {
      onSubmit: z.object({
        roleArn: z
          .string()
          .regex(/^arn:aws:iam::\d{12}:role\/.*$/, "Invalid IAM Role ARN"),
        externalId: z.string().min(1, "External ID is required"),
      }),
    },
  });

  const handleCopy = async (command: string, index: number) => {
    await navigator.clipboard.writeText(command);
    setCopiedIndex(index);
    toast.success("Copied to clipboard");
    posthog.capture("onboarding_cli_command_copied", {
      step: 4,
      step_name: "Deploy & Connect",
      organization_id: organizationId,
      command,
    });
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleBack = () => {
    posthog.capture("onboarding_step_back", {
      step: 4,
      step_name: "Deploy & Connect",
      organization_id: organizationId,
    });
    onBack();
  };

  const handleSkip = () => {
    posthog.capture("onboarding_skipped", {
      step: 4,
      step_name: "Deploy & Connect",
      organization_id: organizationId,
    });
    onSkip();
  };

  const handleCliExpanded = () => {
    posthog.capture("onboarding_deployment_method_selected", {
      step: 4,
      step_name: "Deploy & Connect",
      organization_id: organizationId,
      method: "cli",
    });
  };

  const handleCloudFormationDeploy = () => {
    posthog.capture("onboarding_deployment_started", {
      step: 4,
      step_name: "Deploy & Connect",
      organization_id: organizationId,
      method: "cloudformation",
    });
    window.open(quickCreateUrl, "_blank", "noopener,noreferrer");
    setCfnDeployed(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <CloudIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Deploy & Connect</CardTitle>
            <CardDescription>
              Deploy infrastructure to your AWS account and connect it to the
              platform
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* CloudFormation — primary path */}
        {cfnDeployed ? (
          <div className="space-y-6">
            <div className="flex items-center gap-2 rounded-lg bg-green-500/10 p-3 text-green-600">
              <CheckCircle2Icon className="h-5 w-5" />
              <span className="font-medium text-sm">
                CloudFormation deployment started
              </span>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-sm">
                Waiting for deployment to complete...
              </h3>
              <p className="text-muted-foreground text-sm">
                Once CloudFormation finishes, copy the{" "}
                <strong>ConsoleRoleArn</strong> and <strong>ExternalId</strong>{" "}
                from the Outputs tab and paste them below.
              </p>
            </div>

            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit();
              }}
            >
              <form.Field name="roleArn">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Console Role ARN</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="arn:aws:iam::123456789012:role/wraps-console-access-role"
                      value={field.state.value}
                    />
                    {field.state.meta.errors.map((error) => (
                      <p
                        className="text-destructive text-sm"
                        key={error?.message}
                      >
                        {error?.message}
                      </p>
                    ))}
                  </div>
                )}
              </form.Field>

              <form.Field name="externalId">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>External ID</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="wraps-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={field.state.value}
                    />
                    {field.state.meta.errors.map((error) => (
                      <p
                        className="text-destructive text-sm"
                        key={error?.message}
                      >
                        {error?.message}
                      </p>
                    ))}
                  </div>
                )}
              </form.Field>

              {validationError && (
                <div
                  className="space-y-1 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm"
                  role="alert"
                >
                  <p className="font-medium text-destructive">
                    {validationError.error}
                  </p>
                  {validationError.remediation && (
                    <p className="text-muted-foreground">
                      {validationError.remediation}
                    </p>
                  )}
                  <a
                    className="inline-block text-primary text-xs underline underline-offset-4"
                    href={CAL_BOOKING_URL}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Book a setup call
                  </a>
                </div>
              )}

              <form.Subscribe>
                {(state) => (
                  <Button
                    className="w-full"
                    disabled={!state.canSubmit || validateAwsMutation.isPending}
                    loading={
                      state.isSubmitting || validateAwsMutation.isPending
                    }
                    type="submit"
                  >
                    Validate Connection
                  </Button>
                )}
              </form.Subscribe>
            </form>

            <Button asChild className="w-full" variant="outline">
              <a
                href={quickCreateUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <CloudIcon className="mr-2 h-4 w-4" />
                Open AWS Console
              </a>
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Why CloudFormation */}
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center gap-1.5 rounded-lg bg-muted/50 p-3 text-center">
                <GlobeIcon className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-xs">Browser-based</span>
                <span className="text-muted-foreground text-xs">
                  No CLI or local tooling needed
                </span>
              </div>
              <div className="flex flex-col items-center gap-1.5 rounded-lg bg-muted/50 p-3 text-center">
                <ZapIcon className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-xs">One-click deploy</span>
                <span className="text-muted-foreground text-xs">
                  Pre-configured and ready to go
                </span>
              </div>
              <div className="flex flex-col items-center gap-1.5 rounded-lg bg-muted/50 p-3 text-center">
                <ShieldCheckIcon className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-xs">
                  Review before deploy
                </span>
                <span className="text-muted-foreground text-xs">
                  See every resource in the AWS Console
                </span>
              </div>
            </div>

            {/* What Gets Deployed */}
            <div className="space-y-2 rounded-lg bg-muted/50 p-4">
              <h4 className="font-semibold text-sm">What gets deployed?</h4>
              <ul className="list-inside list-disc space-y-1 text-muted-foreground text-sm">
                <li>Vercel OIDC provider for secure authentication</li>
                <li>IAM role with minimal required permissions</li>
                <li>SES configuration set with open/click tracking</li>
                <li>EventBridge for real-time event routing</li>
                <li>DynamoDB table for email history</li>
                <li>Lambda function for event processing</li>
              </ul>
            </div>

            <Button className="w-full" onClick={handleCloudFormationDeploy}>
              <ExternalLinkIcon className="mr-2 h-4 w-4" />
              Deploy with CloudFormation
            </Button>
          </div>
        )}

        {/* CLI — collapsible secondary path */}
        {!cfnDeployed && (
          <Collapsible onOpenChange={(open) => open && handleCliExpanded()}>
            <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg border border-dashed p-3 text-muted-foreground text-sm hover:bg-muted/50 hover:text-foreground transition-colors [&[data-state=open]>svg:last-child]:rotate-180">
              <TerminalIcon className="h-4 w-4" />
              <span className="font-medium">
                Need more control over your deployment?
              </span>
              <ChevronDownIcon className="ml-auto h-4 w-4 transition-transform" />
            </CollapsibleTrigger>

            <CollapsibleContent className="space-y-6 pt-4">
              <p className="text-muted-foreground text-sm">
                If you have Node.js and the AWS CLI configured locally, you can
                deploy and connect with four commands.
              </p>

              {/* Prerequisites */}
              <div className="space-y-2 rounded-lg bg-muted/50 p-4">
                <h4 className="font-semibold text-sm">Prerequisites</h4>
                <div className="space-y-1.5">
                  {PREREQUISITES.map((prereq) => (
                    <div key={prereq.label}>
                      <label className="flex items-center gap-2">
                        <input
                          className="h-4 w-4 rounded border-muted-foreground/25"
                          type="checkbox"
                        />
                        <span className="text-sm">{prereq.label}</span>
                        <a
                          className="text-primary text-xs underline underline-offset-4"
                          href={prereq.href}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          Guide
                        </a>
                      </label>
                      {"hint" in prereq && (
                        <p className="ml-6 mt-0.5 text-muted-foreground text-xs">
                          Run{" "}
                          <code className="rounded bg-muted px-1 py-0.5">
                            aws configure
                          </code>{" "}
                          or{" "}
                          <code className="rounded bg-muted px-1 py-0.5">
                            aws sso login
                          </code>
                          , then{" "}
                          <code className="rounded bg-muted px-1 py-0.5">
                            wraps aws doctor
                          </code>{" "}
                          to verify
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* CLI Commands */}
              <div className="space-y-3">
                {CLI_STEPS.map((item, index) => (
                  <div className="space-y-1.5" key={item.command}>
                    <h3 className="flex items-center gap-2 font-semibold text-sm">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                        {index + 1}
                      </span>
                      {item.label}
                      <span className="font-normal text-muted-foreground text-xs">
                        {item.time}
                      </span>
                    </h3>
                    <div className="relative">
                      <pre className="overflow-x-auto rounded-lg bg-secondary p-4 pr-12">
                        <code className="text-sm">{item.command}</code>
                      </pre>
                      <Button
                        aria-label={
                          copiedIndex === index
                            ? "Copied"
                            : `Copy ${item.label} command`
                        }
                        className="absolute top-2 right-2"
                        onClick={() => handleCopy(item.command, index)}
                        size="icon"
                        variant="ghost"
                      >
                        {copiedIndex === index ? (
                          <CheckCircle2Icon className="size-4 text-green-500" />
                        ) : (
                          <CopyIcon className="size-4" />
                        )}
                      </Button>
                    </div>
                    {"altCommand" in item && item.altCommand && (
                      <p className="text-muted-foreground text-xs">
                        Or via npm:{" "}
                        <button
                          className="font-mono underline underline-offset-2"
                          onClick={() =>
                            handleCopy(item.altCommand as string, index)
                          }
                          type="button"
                        >
                          {item.altCommand}
                        </button>
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Check Connection */}
              <div className="space-y-3">
                <Button
                  className="w-full"
                  loading={isChecking}
                  onClick={handleCheckConnection}
                >
                  <RefreshCwIcon className="mr-2 h-4 w-4" />
                  I&apos;ve finished — check connection
                </Button>
                {checkFailed && (
                  <p className="text-center text-muted-foreground text-sm">
                    No connection found. Make sure you&apos;ve run all 4
                    commands above, then try again.
                  </p>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Need help? */}
        <div className="rounded-lg border border-dashed p-4">
          <div className="flex items-start gap-3">
            <CalendarIcon className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div>
              <h4 className="font-medium text-sm">Need help getting set up?</h4>
              <p className="mt-1 text-muted-foreground text-sm">
                Free 15-minute walkthrough — we&apos;ll help you deploy and
                connect.
              </p>
              <Button asChild className="mt-2" size="sm" variant="outline">
                <a
                  href={CAL_BOOKING_URL}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Book a Setup Call
                </a>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button onClick={handleBack} variant="outline">
            Back
          </Button>
          <Button onClick={handleSkip} variant="ghost">
            Skip
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
