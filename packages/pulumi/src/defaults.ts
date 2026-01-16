import {
  type ArchiveRetention,
  DEFAULT_EVENT_TYPES,
  DEFAULT_SUPPRESSION_REASONS,
  DEFAULT_TAGS,
  type DNSConfig,
  type SESEventType,
  type SuppressionReason,
} from "@wraps/core";
import type { ResolvedConfig, WrapsEmailArgs } from "./types.js";

/**
 * Apply default values to WrapsEmailArgs
 */
export function applyDefaults(args: WrapsEmailArgs): ResolvedConfig {
  // Extract values from pulumi.Input (for simple cases where we can unwrap)
  // Note: In practice, some of these will be pulumi.Output and need special handling
  const vercel = args.vercel as
    | { teamSlug: string; projectName: string }
    | undefined;
  const oidc = args.oidc as
    | { providerUrl: string; audience: string; subjectPattern: string }
    | undefined;
  const domain = args.domain as string | undefined;
  const tracking = args.tracking as
    | {
        enabled?: boolean;
        opens?: boolean;
        clicks?: boolean;
        customRedirectDomain?: string;
        httpsEnabled?: boolean;
        wafEnabled?: boolean;
      }
    | undefined;
  const events = args.events as
    | {
        types?: SESEventType[];
        storeHistory?: boolean;
        retention?: string;
      }
    | undefined;
  const suppressionList = args.suppressionList as
    | { enabled?: boolean; reasons?: SuppressionReason[] }
    | undefined;
  const tags = args.tags as Record<string, string> | undefined;

  const dns = args.dns as DNSConfig | undefined;

  return {
    vercel,
    oidc,
    domain,
    dns,
    mailFromSubdomain: (args.mailFromSubdomain as string) ?? "mail",
    tracking: {
      enabled: tracking?.enabled ?? true,
      opens: tracking?.opens ?? true,
      clicks: tracking?.clicks ?? true,
      customRedirectDomain: tracking?.customRedirectDomain,
      httpsEnabled: tracking?.httpsEnabled ?? false,
      wafEnabled: tracking?.wafEnabled ?? false,
    },
    events: events
      ? {
          types: events.types ?? DEFAULT_EVENT_TYPES,
          storeHistory: events.storeHistory ?? true,
          retention: (events.retention ?? "90days") as ArchiveRetention,
        }
      : undefined,
    archiving: args.archiving as
      | { enabled?: boolean; retention?: ArchiveRetention }
      | undefined,
    smtp: args.smtp as { enabled?: boolean } | undefined,
    suppressionList: {
      enabled: suppressionList?.enabled ?? true,
      reasons: suppressionList?.reasons ?? DEFAULT_SUPPRESSION_REASONS,
    },
    reputationMetrics: (args.reputationMetrics as boolean) ?? true,
    tlsRequired: (args.tlsRequired as boolean) ?? false,
    dedicatedIp: (args.dedicatedIp as boolean) ?? false,
    sendingEnabled: (args.sendingEnabled as boolean) ?? true,
    webhook: args.webhook as
      | { awsAccountNumber: string; webhookSecret: string; webhookUrl?: string }
      | undefined,
    tags: {
      ...DEFAULT_TAGS,
      ManagedBy: "wraps-pulumi",
      ...(tags || {}),
    },
  };
}
