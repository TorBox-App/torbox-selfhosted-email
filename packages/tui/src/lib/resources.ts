import type { FeatureConfig, Provider } from "../types";

export function getPlannedResources(
  provider: Provider,
  features: FeatureConfig
): string[] {
  const resources: string[] = [];

  if (provider === "vercel") {
    resources.push("OIDC Provider");
  }

  resources.push("IAM Role");
  resources.push("SES Domain Identity");
  resources.push("SES Configuration Set");

  if (features.eventTracking) {
    resources.push("EventBridge Rule");
    resources.push("SQS Queue + DLQ");
    resources.push("Lambda Function");
  }

  if (features.emailHistory) {
    resources.push("DynamoDB Table");
  }

  if (features.emailArchiving) {
    resources.push("Mail Manager Archive");
  }

  if (features.alerts) {
    resources.push("CloudWatch Alarms");
    resources.push("SNS Topic");
  }

  if (features.dedicatedIp) {
    resources.push("Dedicated IP");
  }

  return resources;
}
