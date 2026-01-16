import {
  type ArchiveRetention,
  DEFAULT_EVENT_TYPES,
  DEFAULT_SUPPRESSION_REASONS,
} from "@wraps/core";
import * as cdk from "aws-cdk-lib";
import type { ResolvedConfig, WrapsEmailProps } from "./types.js";

// Re-export retentionToDays from core for convenience
export { retentionToDays } from "@wraps/core";

/**
 * Apply default values to WrapsEmailProps
 */
export function applyDefaults(props: WrapsEmailProps): ResolvedConfig {
  return {
    vercel: props.vercel,
    oidc: props.oidc,
    domain: props.domain,
    mailFromSubdomain: props.mailFromSubdomain ?? "mail",
    tracking: {
      enabled: props.tracking?.enabled ?? true,
      opens: props.tracking?.opens ?? true,
      clicks: props.tracking?.clicks ?? true,
      customRedirectDomain: props.tracking?.customRedirectDomain,
      httpsEnabled: props.tracking?.httpsEnabled ?? false,
      wafEnabled: props.tracking?.wafEnabled ?? false,
    },
    events: props.events
      ? {
          types: props.events.types ?? DEFAULT_EVENT_TYPES,
          storeHistory: props.events.storeHistory ?? true,
          retention: (props.events.retention ?? "90days") as ArchiveRetention,
        }
      : undefined,
    archiving: props.archiving,
    smtp: props.smtp,
    suppressionList: {
      enabled: props.suppressionList?.enabled ?? true,
      reasons: props.suppressionList?.reasons ?? DEFAULT_SUPPRESSION_REASONS,
    },
    reputationMetrics: props.reputationMetrics ?? true,
    tlsRequired: props.tlsRequired ?? false,
    dedicatedIp: props.dedicatedIp ?? false,
    sendingEnabled: props.sendingEnabled ?? true,
    webhook: props.webhook,
    removalPolicy: props.removalPolicy ?? cdk.RemovalPolicy.RETAIN,
  };
}
