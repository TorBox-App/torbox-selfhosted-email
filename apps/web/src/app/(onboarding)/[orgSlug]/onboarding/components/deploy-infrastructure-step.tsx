"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2Icon,
  CloudIcon,
  CodeIcon,
  CopyIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  InfoIcon,
  MailIcon,
  ServerIcon,
  ShieldIcon,
  TerminalIcon,
} from "lucide-react";
import posthog from "posthog-js";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import z from "zod";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type DeployInfrastructureStepProps = {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onConnected?: () => void;
  organizationId: string;
};

type InfrastructureConfig = {
  vercelTeamSlug: string;
  vercelProjectName: string;
  domain: string;
  route53HostedZoneId: string;
  enableEventTracking: boolean;
  enableHistoryStorage: boolean;
  historyRetentionDays: number;
  enableSMTP: boolean;
  tlsRequired: boolean;
};

const DEFAULT_CONFIG: InfrastructureConfig = {
  vercelTeamSlug: "",
  vercelProjectName: "",
  domain: "",
  route53HostedZoneId: "",
  enableEventTracking: true,
  enableHistoryStorage: true,
  historyRetentionDays: 90,
  enableSMTP: false,
  tlsRequired: false,
};

/**
 * Generate a deterministic webhook secret from organization ID
 * This is used to authenticate webhook calls from customer AWS accounts
 */
function generateWebhookSecret(organizationId: string): string {
  // Use a simple hash-like approach for the webhook secret
  // In production, this could be stored/retrieved from the database
  return `whsec_${organizationId.replace(/-/g, "")}`;
}

/**
 * Generate CloudFormation Quick Create URL with parameters
 */
function generateQuickCreateUrl(
  config: InfrastructureConfig,
  templateUrl: string,
  organizationId: string
): string {
  const webhookSecret = generateWebhookSecret(organizationId);

  const params = new URLSearchParams({
    templateURL: templateUrl,
    stackName: "wraps-email-infrastructure",
    param_EnableEventTracking: config.enableEventTracking.toString(),
    param_EnableHistoryStorage: config.enableHistoryStorage.toString(),
    param_HistoryRetentionDays: config.historyRetentionDays.toString(),
    param_EnableSMTP: config.enableSMTP.toString(),
    param_TLSRequired: config.tlsRequired.toString(),
    // Wraps platform integration
    param_WrapsOrganizationId: organizationId,
    param_WrapsWebhookSecret: webhookSecret,
  });

  // Only add Vercel OIDC params if provided (optional)
  if (config.vercelTeamSlug) {
    params.set("param_VercelTeamSlug", config.vercelTeamSlug);
  }
  if (config.vercelProjectName) {
    params.set("param_VercelProjectName", config.vercelProjectName);
  }

  // Only add domain if provided
  if (config.domain) {
    params.set("param_Domain", config.domain);
  }

  // Only add Route53 hosted zone ID if provided (auto-creates DKIM records)
  if (config.route53HostedZoneId) {
    params.set("param_Route53HostedZoneId", config.route53HostedZoneId);
  }

  return `https://console.aws.amazon.com/cloudformation/home#/stacks/create/review?${params.toString()}`;
}

/**
 * Estimate monthly cost based on configuration
 */
function estimateMonthlyCost(config: InfrastructureConfig): string {
  let cost = 0;

  // DynamoDB (if history storage enabled) - pay per request, minimal
  if (config.enableHistoryStorage) {
    cost += 1; // ~$1-5/mo for typical usage
  }

  // Lambda (if history storage enabled) - minimal for event processing
  if (config.enableHistoryStorage) {
    cost += 0.5; // ~$0.50/mo for typical usage
  }

  if (cost === 0) {
    return "From $0.10/1000 emails";
  }

  return `~$${cost.toFixed(0)}-${(cost * 3).toFixed(0)}/mo + $0.10/1000 emails`;
}

export function DeployInfrastructureStep({
  onNext,
  onBack,
  onSkip,
  onConnected,
  organizationId,
}: DeployInfrastructureStepProps) {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<InfrastructureConfig>(DEFAULT_CONFIG);
  const [deploymentMethod, setDeploymentMethod] = useState<
    "cli" | "cloudformation" | "iac"
  >("cli");
  const [cfDeploymentStarted, setCfDeploymentStarted] = useState(false);
  const [cliDeployed, setCliDeployed] = useState(false);
  const [copiedInstall, setCopiedInstall] = useState(false);
  const [copiedDeploy, setCopiedDeploy] = useState(false);

  const templateUrl =
    "https://wraps-assets.s3.amazonaws.com/cloudformation/wraps-email-infrastructure.yaml";

  const quickCreateUrl = useMemo(
    () => generateQuickCreateUrl(config, templateUrl, organizationId),
    [config, templateUrl, organizationId]
  );

  const estimatedCost = useMemo(() => estimateMonthlyCost(config), [config]);

  const installCommand = "npm install -g @wraps.dev/cli";
  const deployCommand = "wraps email init";

  // Track deployment method changes
  const handleDeploymentMethodChange = (
    method: "cli" | "cloudformation" | "iac"
  ) => {
    setDeploymentMethod(method);
    posthog.capture("onboarding_deployment_method_selected", {
      step: 3,
      step_name: "Deploy",
      organization_id: organizationId,
      method,
    });
  };

  // Track back button
  const handleBack = () => {
    posthog.capture("onboarding_step_back", {
      step: 3,
      step_name: "Deploy",
      organization_id: organizationId,
    });
    onBack();
  };

  // Track skip button
  const handleSkip = () => {
    posthog.capture("onboarding_skipped", {
      step: 3,
      step_name: "Deploy",
      organization_id: organizationId,
      deployment_method: deploymentMethod,
    });
    onSkip();
  };

  // Track CloudFormation deployment start and open AWS Console
  const handleCloudFormationDeploy = () => {
    setCfDeploymentStarted(true);
    posthog.capture("onboarding_deployment_started", {
      step: 3,
      step_name: "Deploy",
      organization_id: organizationId,
      method: "cloudformation",
      config: {
        vercel_team_slug: config.vercelTeamSlug,
        vercel_project_name: config.vercelProjectName,
        domain: config.domain || null,
        enable_event_tracking: config.enableEventTracking,
        enable_history_storage: config.enableHistoryStorage,
        history_retention_days: config.historyRetentionDays,
        enable_smtp: config.enableSMTP,
        tls_required: config.tlsRequired,
      },
      estimated_cost: estimatedCost,
    });

    // Open AWS Console in new tab - using window.open for reliable cross-browser behavior
    window.open(quickCreateUrl, "_blank", "noopener,noreferrer");
  };

  // Track CLI deployment confirmed
  const handleCliDeployedChange = (checked: boolean) => {
    setCliDeployed(checked);
    if (checked) {
      posthog.capture("onboarding_cli_deployment_confirmed", {
        step: 3,
        step_name: "Deploy",
        organization_id: organizationId,
        method: "cli",
      });
    }
  };

  // Track CLI continue (step completed via CLI)
  const handleCliContinue = () => {
    posthog.capture("onboarding_step_completed", {
      step: 3,
      step_name: "Deploy",
      organization_id: organizationId,
      method: "cli",
    });
    onNext();
  };

  const handleCopyInstall = async () => {
    await navigator.clipboard.writeText(installCommand);
    setCopiedInstall(true);
    toast.success("Copied to clipboard");
    posthog.capture("onboarding_cli_command_copied", {
      step: 3,
      step_name: "Deploy",
      organization_id: organizationId,
      command: "install",
    });
    setTimeout(() => setCopiedInstall(false), 2000);
  };

  const handleCopyDeploy = async () => {
    await navigator.clipboard.writeText(deployCommand);
    setCopiedDeploy(true);
    toast.success("Copied to clipboard");
    posthog.capture("onboarding_cli_command_copied", {
      step: 3,
      step_name: "Deploy",
      organization_id: organizationId,
      command: "deploy",
    });
    setTimeout(() => setCopiedDeploy(false), 2000);
  };

  // TanStack Query mutation for AWS validation
  const validateAwsMutation = useMutation({
    mutationFn: async (data: { roleArn: string; externalId: string }) => {
      const response = await fetch(
        `/api/${organizationId}/aws/validate-infrastructure`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
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
        queryKey: ["onboarding", organizationId],
      });
      posthog.capture("onboarding_infrastructure_validated", {
        step: 3,
        step_name: "Deploy",
        organization_id: organizationId,
        method: "cloudformation",
      });
      posthog.capture("onboarding_step_completed", {
        step: 3,
        step_name: "Deploy",
        organization_id: organizationId,
        method: "cloudformation",
      });
      // CloudFormation users skip the AwsConnectStep since they've already connected
      if (onConnected) {
        onConnected();
      } else {
        onNext();
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to validate connection");
      posthog.capture("onboarding_infrastructure_validation_failed", {
        step: 3,
        step_name: "Deploy",
        organization_id: organizationId,
        method: "cloudformation",
        error: error.message,
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

  const updateConfig = (updates: Partial<InfrastructureConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <ServerIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Deploy Email Infrastructure</CardTitle>
            <CardDescription>
              Deploy your email infrastructure to AWS
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Deployment Method Selection */}
        <Tabs
          onValueChange={(v) =>
            handleDeploymentMethodChange(v as "cli" | "cloudformation" | "iac")
          }
          value={deploymentMethod}
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger className="gap-2" value="cli">
              <TerminalIcon className="h-4 w-4" />
              CLI
              <span className="ml-1 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                Recommended
              </span>
            </TabsTrigger>
            <TabsTrigger className="gap-2" value="iac">
              <CodeIcon className="h-4 w-4" />
              Infra as Code
            </TabsTrigger>
            <TabsTrigger className="gap-2" value="cloudformation">
              <CloudIcon className="h-4 w-4" />
              AWS Console
            </TabsTrigger>
          </TabsList>

          {/* CLI Tab */}
          <TabsContent className="space-y-6 pt-4" value="cli">
            <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <CheckCircle2Icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
              <div className="space-y-1">
                <p className="font-medium text-sm">Best experience</p>
                <p className="text-muted-foreground text-sm">
                  The CLI provides interactive prompts, automatic AWS credential
                  detection, real-time progress, and built-in error handling.
                </p>
              </div>
            </div>

            {/* Install Command */}
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 font-semibold text-sm">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  1
                </span>
                Install the CLI
              </h3>
              <div className="relative">
                <pre className="overflow-x-auto rounded-lg bg-secondary p-4 pr-12">
                  <code className="text-sm">{installCommand}</code>
                </pre>
                <Button
                  aria-label={copiedInstall ? "Copied" : "Copy install command"}
                  className="absolute top-2 right-2"
                  onClick={handleCopyInstall}
                  size="icon"
                  variant="ghost"
                >
                  {copiedInstall ? (
                    <CheckCircle2Icon className="size-4 text-green-500" />
                  ) : (
                    <CopyIcon className="size-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Deploy Command */}
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 font-semibold text-sm">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  2
                </span>
                Run the deployment
              </h3>
              <div className="relative">
                <pre className="overflow-x-auto rounded-lg bg-secondary p-4 pr-12">
                  <code className="text-sm">{deployCommand}</code>
                </pre>
                <Button
                  aria-label={copiedDeploy ? "Copied" : "Copy deploy command"}
                  className="absolute top-2 right-2"
                  onClick={handleCopyDeploy}
                  size="icon"
                  variant="ghost"
                >
                  {copiedDeploy ? (
                    <CheckCircle2Icon className="size-4 text-green-500" />
                  ) : (
                    <CopyIcon className="size-4" />
                  )}
                </Button>
              </div>
              <p className="text-muted-foreground text-sm">
                The CLI will guide you through selecting a region, configuring
                features, and deploying your infrastructure.
              </p>
            </div>

            {/* What the CLI Does */}
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

            {/* Confirmation */}
            <div className="flex items-center space-x-2 rounded-lg border p-4">
              <Checkbox
                checked={cliDeployed}
                id="cliDeployed"
                onCheckedChange={(checked) =>
                  handleCliDeployedChange(checked as boolean)
                }
              />
              <label
                className="font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                htmlFor="cliDeployed"
              >
                I&apos;ve successfully deployed with the CLI
              </label>
            </div>

            <Button
              className="w-full"
              disabled={!cliDeployed}
              onClick={handleCliContinue}
            >
              Continue
            </Button>
          </TabsContent>

          {/* IaC Tab */}
          <TabsContent className="space-y-6 pt-4" value="iac">
            <p className="text-muted-foreground text-sm">
              For teams managing infrastructure with Pulumi, Terraform, or AWS
              CDK. Copy our templates and integrate with your existing IaC
              workflow.
            </p>

            {/* Pulumi Example */}
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 font-semibold text-sm">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  1
                </span>
                Choose your IaC tool
              </h3>

              <Accordion collapsible defaultValue="pulumi" type="single">
                <AccordionItem value="pulumi">
                  <AccordionTrigger className="text-sm">
                    Pulumi (TypeScript)
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      <p className="text-muted-foreground text-xs">
                        Install the Wraps Pulumi package:
                      </p>
                      <pre className="overflow-x-auto rounded-lg bg-secondary p-3 text-xs">
                        <code>npm install @wraps.dev/pulumi</code>
                      </pre>
                      <p className="text-muted-foreground text-xs">
                        Add to your Pulumi stack:
                      </p>
                      <pre className="overflow-x-auto rounded-lg bg-secondary p-3 text-xs">
                        <code>{`import { WrapsEmail } from "@wraps.dev/pulumi";

const email = new WrapsEmail("wraps-email", {
  domain: "example.com",
  vercel: {
    teamSlug: "my-team",
    projectName: "my-app",
  },
  features: {
    eventTracking: true,
    historyStorage: true,
    historyRetentionDays: 90,
  },
});

export const roleArn = email.roleArn;`}</code>
                      </pre>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="sst">
                  <AccordionTrigger className="text-sm">
                    SST (Ion)
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      <p className="text-muted-foreground text-xs">
                        SST v3 uses Pulumi under the hood. Install the package:
                      </p>
                      <pre className="overflow-x-auto rounded-lg bg-secondary p-3 text-xs">
                        <code>npm install @wraps.dev/pulumi</code>
                      </pre>
                      <p className="text-muted-foreground text-xs">
                        Add to your sst.config.ts:
                      </p>
                      <pre className="overflow-x-auto rounded-lg bg-secondary p-3 text-xs">
                        <code>{`import { WrapsEmail } from "@wraps.dev/pulumi";

export default $config({
  app(input) {
    return {
      name: "my-app",
      home: "aws",
    };
  },
  async run() {
    const email = new WrapsEmail("wraps-email", {
      domain: "example.com",
      vercel: {
        teamSlug: "my-team",
        projectName: "my-app",
      },
      features: {
        eventTracking: true,
        historyStorage: true,
        historyRetentionDays: 90,
      },
    });

    return { roleArn: email.roleArn };
  },
});`}</code>
                      </pre>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="cdk">
                  <AccordionTrigger className="text-sm">
                    AWS CDK
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      <p className="text-muted-foreground text-xs">
                        Install the Wraps CDK construct:
                      </p>
                      <pre className="overflow-x-auto rounded-lg bg-secondary p-3 text-xs">
                        <code>npm install @wraps.dev/cdk</code>
                      </pre>
                      <p className="text-muted-foreground text-xs">
                        Add to your CDK stack:
                      </p>
                      <pre className="overflow-x-auto rounded-lg bg-secondary p-3 text-xs">
                        <code>{`import { WrapsEmail } from "@wraps.dev/cdk";

const email = new WrapsEmail(this, "WrapsEmail", {
  domain: "example.com",
  vercel: {
    teamSlug: "my-team",
    projectName: "my-app",
  },
  features: {
    eventTracking: true,
    historyStorage: true,
    historyRetentionDays: 90,
  },
});

new cdk.CfnOutput(this, "RoleArn", {
  value: email.roleArn,
});`}</code>
                      </pre>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="terraform">
                  <AccordionTrigger className="text-sm">
                    Terraform
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      <p className="text-muted-foreground text-xs">
                        Use our CloudFormation template with Terraform&apos;s
                        aws_cloudformation_stack resource:
                      </p>
                      <pre className="overflow-x-auto rounded-lg bg-secondary p-3 text-xs">
                        <code>{`resource "aws_cloudformation_stack" "wraps_email" {
  name         = "wraps-email-infrastructure"
  template_url = "https://wraps-assets.s3.amazonaws.com/cloudformation/wraps-email-infrastructure.yaml"

  parameters = {
    VercelTeamSlug      = "my-team"
    VercelProjectName   = "my-app"
    Domain              = "example.com"
    EnableEventTracking = "true"
    EnableHistoryStorage = "true"
    HistoryRetentionDays = "90"
  }

  capabilities = ["CAPABILITY_IAM"]
}`}</code>
                      </pre>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Step 2: Deploy */}
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 font-semibold text-sm">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  2
                </span>
                Deploy with your IaC tool
              </h3>
              <p className="text-muted-foreground text-sm">
                Run your deployment command (pulumi up, terraform apply, cdk
                deploy) to provision the infrastructure.
              </p>
            </div>

            {/* Confirmation */}
            <div className="flex items-center space-x-2 rounded-lg border p-4">
              <Checkbox
                checked={cliDeployed}
                id="iacDeployed"
                onCheckedChange={(checked) =>
                  handleCliDeployedChange(checked as boolean)
                }
              />
              <label
                className="font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                htmlFor="iacDeployed"
              >
                I&apos;ve successfully deployed with my IaC tool
              </label>
            </div>

            <Button
              className="w-full"
              disabled={!cliDeployed}
              onClick={handleCliContinue}
            >
              Continue
            </Button>
          </TabsContent>

          {/* CloudFormation Tab */}
          <TabsContent className="space-y-6 pt-4" value="cloudformation">
            {cfDeploymentStarted ? (
              /* Post-deployment: Validate Connection */
              <div className="space-y-4">
                <div className="flex items-center gap-2 rounded-lg bg-green-500/10 p-3 text-green-600">
                  <CheckCircle2Icon className="h-5 w-5" />
                  <span className="text-sm font-medium">
                    CloudFormation deployment started
                  </span>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">
                    Waiting for deployment to complete...
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Once CloudFormation finishes (usually 2-3 minutes), copy the{" "}
                    <strong>ConsoleRoleArn</strong> and{" "}
                    <strong>ExternalId</strong> from the Outputs tab and paste
                    them below.
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
                          placeholder="arn:aws:cloudformation:us-east-1:123456789012:stack/..."
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
                        disabled={
                          !state.canSubmit || validateAwsMutation.isPending
                        }
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
                    onClick={() => setCfDeploymentStarted(false)}
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
              </div>
            ) : (
              <>
                <p className="text-muted-foreground text-sm">
                  Alternative: Deploy from your browser using AWS CloudFormation
                  if you can't install the CLI.
                </p>

                {/* Step 1: Vercel Configuration */}
                <div className="space-y-4">
                  <h3 className="flex items-center gap-2 font-semibold text-sm">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                      1
                    </span>
                    Vercel Project Details
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="vercelTeamSlug">Team Slug</Label>
                      <Input
                        id="vercelTeamSlug"
                        onChange={(e) =>
                          updateConfig({ vercelTeamSlug: e.target.value })
                        }
                        placeholder="my-team"
                        value={config.vercelTeamSlug}
                      />
                      <p className="text-muted-foreground text-xs">
                        Found in your Vercel team settings URL
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vercelProjectName">Project Name</Label>
                      <Input
                        id="vercelProjectName"
                        onChange={(e) =>
                          updateConfig({ vercelProjectName: e.target.value })
                        }
                        placeholder="my-app"
                        value={config.vercelProjectName}
                      />
                      <p className="text-muted-foreground text-xs">
                        Your Vercel project name
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step 2: Feature Configuration */}
                <div className="space-y-4">
                  <h3 className="flex items-center gap-2 font-semibold text-sm">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                      2
                    </span>
                    Configure Features
                  </h3>

                  <div className="space-y-4 rounded-lg border p-4">
                    {/* Domain (Optional) */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <MailIcon className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor="domain">
                          Sending Domain (Optional)
                        </Label>
                      </div>
                      <Input
                        id="domain"
                        onChange={(e) =>
                          updateConfig({ domain: e.target.value })
                        }
                        placeholder="example.com"
                        value={config.domain}
                      />
                      <p className="text-muted-foreground text-xs">
                        If provided, we&apos;ll set up DKIM signing for
                        deliverability
                      </p>
                    </div>

                    {/* Route53 Hosted Zone ID (Optional - only shown if domain is set) */}
                    {config.domain && (
                      <div className="ml-6 space-y-2">
                        <Label htmlFor="route53HostedZoneId">
                          Route53 Hosted Zone ID (Optional)
                        </Label>
                        <Input
                          id="route53HostedZoneId"
                          onChange={(e) =>
                            updateConfig({
                              route53HostedZoneId: e.target.value,
                            })
                          }
                          placeholder="Z1234567890ABC"
                          value={config.route53HostedZoneId}
                        />
                        <p className="text-muted-foreground text-xs">
                          If your domain is hosted in Route53, provide the
                          Hosted Zone ID to auto-create DKIM records
                        </p>
                      </div>
                    )}

                    {/* Event Tracking */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DatabaseIcon className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <Label>Event Tracking</Label>
                          <p className="text-muted-foreground text-xs">
                            Track sends, deliveries, opens, clicks, bounces
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={config.enableEventTracking}
                        onCheckedChange={(checked) =>
                          updateConfig({
                            enableEventTracking: checked,
                            enableHistoryStorage: checked
                              ? config.enableHistoryStorage
                              : false,
                          })
                        }
                      />
                    </div>

                    {/* History Storage */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DatabaseIcon className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <Label>Email History</Label>
                          <p className="text-muted-foreground text-xs">
                            Store events in DynamoDB for dashboard analytics
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={config.enableHistoryStorage}
                        disabled={!config.enableEventTracking}
                        onCheckedChange={(checked) =>
                          updateConfig({ enableHistoryStorage: checked })
                        }
                      />
                    </div>

                    {/* Retention Days */}
                    {config.enableHistoryStorage && (
                      <div className="ml-6 space-y-2">
                        <Label htmlFor="retentionDays">
                          Retention Period (days)
                        </Label>
                        <Input
                          className="w-24"
                          id="retentionDays"
                          max={3650}
                          min={1}
                          onChange={(e) =>
                            updateConfig({
                              historyRetentionDays:
                                Number.parseInt(e.target.value, 10) || 90,
                            })
                          }
                          type="number"
                          value={config.historyRetentionDays}
                        />
                      </div>
                    )}

                    {/* Advanced Options */}
                    <Accordion collapsible type="single">
                      <AccordionItem className="border-none" value="advanced">
                        <AccordionTrigger className="py-2 text-sm">
                          Advanced Options
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                          {/* SMTP */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <ServerIcon className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <Label>SMTP Credentials</Label>
                                <p className="text-muted-foreground text-xs">
                                  For legacy systems (WordPress, PHP, etc.)
                                </p>
                              </div>
                            </div>
                            <Switch
                              checked={config.enableSMTP}
                              onCheckedChange={(checked) =>
                                updateConfig({ enableSMTP: checked })
                              }
                            />
                          </div>

                          {/* TLS Required */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <ShieldIcon className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <Label>Require TLS</Label>
                                <p className="text-muted-foreground text-xs">
                                  Enforce TLS encryption for all outbound emails
                                </p>
                              </div>
                            </div>
                            <Switch
                              checked={config.tlsRequired}
                              onCheckedChange={(checked) =>
                                updateConfig({ tlsRequired: checked })
                              }
                            />
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>

                  {/* Cost Estimate */}
                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <InfoIcon className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            Costs are estimates based on typical usage. Actual
                            costs depend on your email volume and AWS pricing.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <span className="text-muted-foreground text-sm">
                      Estimated AWS cost: <strong>{estimatedCost}</strong>
                    </span>
                  </div>
                </div>

                {/* Step 3: Deploy */}
                <div className="space-y-4">
                  <h3 className="flex items-center gap-2 font-semibold text-sm">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                      3
                    </span>
                    Deploy to AWS
                  </h3>
                  <Button
                    className="w-full"
                    onClick={handleCloudFormationDeploy}
                  >
                    <ExternalLinkIcon className="mr-2 h-4 w-4" />
                    Deploy to AWS Console
                  </Button>
                </div>

                {/* What Gets Deployed */}
                <div className="space-y-2 rounded-lg bg-muted/50 p-4">
                  <h4 className="font-semibold text-sm">What gets deployed?</h4>
                  <ul className="list-inside list-disc space-y-1 text-muted-foreground text-sm">
                    <li>Vercel OIDC provider for secure authentication</li>
                    <li>IAM role with minimal required permissions</li>
                    <li>SES configuration set with tracking</li>
                    {config.domain && (
                      <li>Domain identity with DKIM signing</li>
                    )}
                    {config.enableEventTracking && (
                      <li>EventBridge for real-time event routing</li>
                    )}
                    {config.enableHistoryStorage && (
                      <>
                        <li>DynamoDB table for email history</li>
                        <li>Lambda function for event processing</li>
                        <li>SQS queues for reliable delivery</li>
                      </>
                    )}
                    {config.enableSMTP && (
                      <li>SMTP credentials for legacy systems</li>
                    )}
                  </ul>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
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
