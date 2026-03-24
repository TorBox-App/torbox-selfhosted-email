"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CloudIcon, ExternalLinkIcon } from "lucide-react";
import posthog from "posthog-js";
import { useMemo } from "react";
import { toast } from "sonner";
import { uuidv7 } from "uuidv7";
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

type AwsConnectStepProps = {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  organizationId: string;
};

export function AwsConnectStep({
  onNext,
  onBack,
  onSkip,
  organizationId,
}: AwsConnectStepProps) {
  const queryClient = useQueryClient();

  // Generate a unique external ID for this connection (stable across re-renders)
  // Using UUIDv7 ensures uniqueness and time-ordering
  const externalId = useMemo(() => `wraps_${uuidv7()}`, []);

  const cfTemplateUrl =
    "https://wraps-assets.s3.amazonaws.com/cloudformation/wraps-console-access-role.yaml";
  const awsConsoleUrl = `https://console.aws.amazon.com/cloudformation/home#/stacks/create/review?templateURL=${encodeURIComponent(cfTemplateUrl)}&stackName=wraps-console-access&param_ExternalId=${encodeURIComponent(externalId)}`;

  // Track back button
  const handleBack = () => {
    posthog.capture("onboarding_step_back", {
      step: 5,
      step_name: "AWS Connect",
      organization_id: organizationId,
    });
    onBack();
  };

  // Track skip button
  const handleSkip = () => {
    posthog.capture("onboarding_skipped", {
      step: 5,
      step_name: "AWS Connect",
      organization_id: organizationId,
    });
    onSkip();
  };

  // TanStack Query mutation for AWS validation
  const validateAwsMutation = useMutation({
    mutationFn: async (data: { roleArn: string; externalId: string }) => {
      const response = await fetch(`/api/${organizationId}/aws/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to validate AWS connection");
      }

      return response.json();
    },
    onSuccess: (_data) => {
      toast.success("AWS account connected successfully!");
      // Invalidate onboarding status query to reflect the change
      queryClient.invalidateQueries({
        queryKey: ["onboarding", organizationId],
      });
      posthog.capture("onboarding_aws_connected", {
        step: 5,
        step_name: "AWS Connect",
        organization_id: organizationId,
      });
      posthog.capture("onboarding_step_completed", {
        step: 5,
        step_name: "AWS Connect",
        organization_id: organizationId,
      });
      onNext();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to validate AWS connection");
      posthog.capture("onboarding_aws_connection_failed", {
        step: 5,
        step_name: "AWS Connect",
        organization_id: organizationId,
        error: error.message,
      });
    },
  });

  const form = useForm({
    defaultValues: {
      roleArn: "",
    },
    onSubmit: async ({ value }) => {
      // Include the generated externalId with the form submission
      validateAwsMutation.mutate({ ...value, externalId });
    },
    validators: {
      onSubmit: z.object({
        roleArn: z
          .string()
          .regex(/^arn:aws:iam::\d{12}:role\/.*$/, "Invalid IAM Role ARN"),
      }),
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <CloudIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Connect Your AWS Account</CardTitle>
            <CardDescription>
              Deploy a CloudFormation stack to grant dashboard access
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Step 1: Deploy CloudFormation */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">
            1. Deploy the CloudFormation stack
          </h3>
          <p className="text-muted-foreground text-sm">
            This creates an IAM role in your AWS account that allows Wraps to
            read email metrics and manage your SES configuration.
          </p>
          <Button asChild className="w-full" variant="outline">
            <a href={awsConsoleUrl} rel="noopener noreferrer" target="_blank">
              <ExternalLinkIcon className="mr-2 h-4 w-4" />
              Deploy to AWS Console
            </a>
          </Button>
        </div>

        {/* Step 2: Copy Outputs */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">
            2. Copy the Role ARN from Outputs
          </h3>
          <p className="text-muted-foreground text-sm">
            After CloudFormation shows{" "}
            <strong className="text-green-600 dark:text-green-400">
              CREATE_COMPLETE
            </strong>
            , click the <strong>Outputs</strong> tab and copy the{" "}
            <strong>RoleArn</strong> value below.
          </p>
        </div>

        {/* Step 3: Enter Details */}
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <h3 className="font-semibold text-sm">
            3. Enter the connection details
          </h3>

          <form.Field name="roleArn">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>IAM Role ARN</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="arn:aws:iam::123456789012:role/wraps-console-access"
                  value={field.state.value}
                />
                {field.state.meta.errors.map((error) => (
                  <p className="text-destructive text-sm" key={error?.message}>
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        </form>

        {/* What Does This Do? */}
        <div className="space-y-2 rounded-lg bg-muted/50 p-4">
          <h3 className="font-semibold text-sm">
            What permissions are granted?
          </h3>
          <ul className="list-inside list-disc space-y-1 text-muted-foreground text-sm">
            <li>Read-only access to CloudWatch metrics</li>
            <li>Read SES configuration and sending statistics</li>
            <li>Read DynamoDB tables for email events</li>
            <li>No ability to delete or modify resources</li>
          </ul>
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
        <form.Subscribe>
          {(state) => (
            <Button
              disabled={!state.canSubmit || validateAwsMutation.isPending}
              loading={state.isSubmitting || validateAwsMutation.isPending}
              onClick={() => form.handleSubmit()}
            >
              Validate & Continue
            </Button>
          )}
        </form.Subscribe>
      </CardFooter>
    </Card>
  );
}
