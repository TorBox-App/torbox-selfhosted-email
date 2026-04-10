import type { WorkflowStepConfig } from "@wraps/db";
import { parseDurationToAmountUnit } from "@/lib/utils";

export type ConditionSummary = {
  title: string;
  description: string;
};

const operatorLabels: Record<string, string> = {
  equals: "equals",
  not_equals: "does not equal",
  contains: "contains",
  not_contains: "does not contain",
  starts_with: "starts with",
  ends_with: "ends with",
  greater_than: ">",
  less_than: "<",
  greater_than_or_equals: ">=",
  less_than_or_equals: "<=",
  is_set: "is set",
  is_not_set: "is not set",
  is_true: "is true",
  is_false: "is false",
};

const unaryOperators = new Set(["is_set", "is_not_set", "is_true", "is_false"]);

function stripStepPrefix(field: string): string {
  return field.replace(/^steps\.[a-f0-9-]+\./, "");
}

export function getConditionSummary(
  config: WorkflowStepConfig,
  sourceHandle: string | null | undefined
): ConditionSummary | null {
  if (!sourceHandle) {
    return null;
  }

  if (config.type === "condition") {
    if (!config.field) {
      return null;
    }

    const fieldLabel = stripStepPrefix(config.field);
    const op = operatorLabels[config.operator] || config.operator;
    const title = unaryOperators.has(config.operator)
      ? `${fieldLabel} ${op}`
      : `${fieldLabel} ${op} ${config.value}`;

    const description =
      sourceHandle === "no"
        ? "Contacts NOT matching this condition"
        : "Contacts matching this condition";

    return { title, description };
  }

  if (config.type === "wait_for_event") {
    const title = `Wait for: ${config.eventName}`;
    let description = "Event received";
    if (sourceHandle === "timeout" && config.timeoutSeconds) {
      const { amount, unit } = parseDurationToAmountUnit(config.timeoutSeconds);
      description = `Timeout after ${amount} ${unit}`;
    }
    return { title, description };
  }

  if (config.type === "wait_for_email_engagement") {
    const title = "Wait for email engagement";
    let description = "Engagement detected";
    if (sourceHandle === "timeout" && config.timeoutSeconds) {
      const { amount, unit } = parseDurationToAmountUnit(config.timeoutSeconds);
      description = `Timeout after ${amount} ${unit}`;
    }
    return { title, description };
  }

  return null;
}
