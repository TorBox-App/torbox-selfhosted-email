"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2Icon,
  CloudIcon,
  CopyIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
  TerminalIcon,
} from "lucide-react";
import posthog from "posthog-js";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import z from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CliDeployConnectStepProps = {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onConnected?: () => void;
  organizationId: string;
};

type ViewState =
  | "CLI_FIRST"
  | "CLOUDFORMATION_CONFIG"
  | "CLOUDFORMATION_VALIDATE";

const CLI_COMMANDS = [
  { label: "Install the CLI", command: "npm install -g @wraps.dev/cli" },
  { label: "Authenticate", command: "wraps auth login" },
  { label: "Deploy infrastructure", command: "wraps email init" },
  { label: "Connect to platform", command: "wraps platform connect" },
];

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
  const [view, setView] = useState<ViewState>("CLI_FIRST");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Generate a cryptographically secure webhook secret once on mount
  const [webhookSecret] = useState(() => generateSecureWebhookSecret());

  const quickCreateUrl = useMemo(
    () => generateQuickCreateUrl(organizationId, webhookSecret),
    [organizationId, webhookSecret]
  );

  // Manual connection check
  const [isChecking, setIsChecking] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);

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
          step: 3,
          step_name: "Deploy & Connect",
          organization_id: organizationId,
        });
        posthog.capture("onboarding_step_completed", {
          step: 3,
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
        const error = await response.json();
        throw new Error(error.error || "Failed to validate AWS connection");
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success("Infrastructure connected successfully!");
      queryClient.invalidateQueries({
        queryKey: ["onboarding-status", organizationId],
      });
      posthog.capture("onboarding_step_completed", {
        step: 3,
        step_name: "Deploy & Connect",
        organization_id: organizationId,
        method: "cloudformation",
      });
      if (onConnected) {
        onConnected();
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to validate connection");
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
      step: 3,
      step_name: "Deploy & Connect",
      organization_id: organizationId,
      command,
    });
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleBack = () => {
    if (view !== "CLI_FIRST") {
      setView("CLI_FIRST");
      return;
    }
    posthog.capture("onboarding_step_back", {
      step: 3,
      step_name: "Deploy & Connect",
      organization_id: organizationId,
    });
    onBack();
  };

  const handleSkip = () => {
    posthog.capture("onboarding_skipped", {
      step: 3,
      step_name: "Deploy & Connect",
      organization_id: organizationId,
    });
    onSkip();
  };

  const handleCloudFormationDeploy = () => {
    posthog.capture("onboarding_deployment_started", {
      step: 3,
      step_name: "Deploy & Connect",
      organization_id: organizationId,
      method: "cloudformation",
    });
    window.open(quickCreateUrl, "_blank", "noopener,noreferrer");
    setView("CLOUDFORMATION_VALIDATE");
  };

  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <TerminalIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Deploy & Connect</CardTitle>
            <CardDescription>
              {view === "CLI_FIRST"
                ? "Run these commands to deploy infrastructure and connect your AWS account"
                : "Deploy via CloudFormation and validate the connection"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {view === "CLI_FIRST" && (
          <>
            {/* CLI Commands */}
            <div className="space-y-3">
              {CLI_COMMANDS.map((item, index) => (
                <div className="space-y-1.5" key={item.command}>
                  <h3 className="flex items-center gap-2 font-semibold text-sm">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                      {index + 1}
                    </span>
                    {item.label}
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
                  No connection found. Make sure you&apos;ve run all 4 commands
                  above, then try again.
                </p>
              )}
            </div>

            {/* CloudFormation Fallback */}
            <div className="text-center">
              <button
                className="text-muted-foreground text-sm underline underline-offset-4 hover:text-foreground"
                onClick={() => {
                  posthog.capture(
                    "onboarding_cloudformation_fallback_clicked",
                    {
                      step: 3,
                      step_name: "Deploy & Connect",
                      organization_id: organizationId,
                    }
                  );
                  setView("CLOUDFORMATION_CONFIG");
                }}
                type="button"
              >
                Deploy via CloudFormation instead
              </button>
            </div>
          </>
        )}

        {view === "CLOUDFORMATION_CONFIG" && (
          <>
            <p className="text-muted-foreground text-sm">
              Deploy from your browser using AWS CloudFormation. This will
              create email infrastructure with sensible defaults.
            </p>

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
              Deploy to AWS Console
            </Button>
          </>
        )}

        {view === "CLOUDFORMATION_VALIDATE" && (
          <>
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

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => setView("CLOUDFORMATION_CONFIG")}
                variant="ghost"
              >
                Back to Configuration
              </Button>
              <Button asChild className="flex-1" variant="outline">
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
          </>
        )}
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
