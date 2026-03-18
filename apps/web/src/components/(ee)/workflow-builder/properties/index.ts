import type { WorkflowStepConfig } from "@wraps/db";
import type { ComponentType } from "react";

import { ConditionConfig } from "./condition-config";
import { DelayConfig } from "./delay-config";
import { SendEmailConfig } from "./send-email-config";
import { SendSmsConfig } from "./send-sms-config";
import { TriggerConfig } from "./trigger-config";
import { UpdateContactConfig } from "./update-contact-config";
import { WaitForEmailEngagementConfig } from "./wait-for-email-engagement-config";
import { WaitForEventConfig } from "./wait-for-event-config";
import { WebhookConfig } from "./webhook-config";

export type NodeConfigProps = {
  nodeId: string;
  config: WorkflowStepConfig;
  onChange: (updates: Partial<WorkflowStepConfig>) => void;
  orgSlug: string;
};

// Registry mapping node types to their config components.
// Excludes: exit (no config), cascade (different props), subscribe_topic/unsubscribe_topic (extra props).
export const configComponents: Record<
  string,
  ComponentType<NodeConfigProps>
> = {
  trigger: TriggerConfig,
  send_email: SendEmailConfig,
  send_sms: SendSmsConfig,
  delay: DelayConfig,
  condition: ConditionConfig,
  update_contact: UpdateContactConfig,
  webhook: WebhookConfig,
  wait_for_event: WaitForEventConfig,
  wait_for_email_engagement: WaitForEmailEngagementConfig,
};
