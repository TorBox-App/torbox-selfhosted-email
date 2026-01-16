import * as pulumi from "@pulumi/pulumi";
import type { ArchiveRetention } from "../types.js";

/**
 * Mail Manager archive result
 *
 * Note: AWS Mail Manager is not yet fully supported in Pulumi.
 * This module provides placeholder types and will be implemented
 * when Pulumi adds native support or via a custom dynamic provider.
 */
export type MailManagerResult = {
  /** The archive ARN */
  archiveArn: pulumi.Output<string | undefined>;
  /** Whether archiving is enabled */
  enabled: pulumi.Output<boolean>;
};

/**
 * Convert our retention types to AWS SDK RetentionPeriod enum
 */
export function retentionToAWSPeriod(retention: ArchiveRetention): string {
  switch (retention) {
    case "3months":
      return "THREE_MONTHS";
    case "6months":
      return "SIX_MONTHS";
    case "9months":
      return "NINE_MONTHS";
    case "1year":
      return "ONE_YEAR";
    case "18months":
      return "EIGHTEEN_MONTHS";
    case "2years":
      return "TWO_YEARS";
    case "30months":
      return "THIRTY_MONTHS";
    case "3years":
      return "THREE_YEARS";
    case "4years":
      return "FOUR_YEARS";
    case "5years":
      return "FIVE_YEARS";
    case "6years":
      return "SIX_YEARS";
    case "7years":
      return "SEVEN_YEARS";
    case "8years":
      return "EIGHT_YEARS";
    case "9years":
      return "NINE_YEARS";
    case "10years":
      return "TEN_YEARS";
    case "permanent":
    case "indefinite":
      return "PERMANENT";
    default:
      return "THREE_MONTHS";
  }
}

/**
 * Create Mail Manager archive for storing full email content
 *
 * TODO: Implement Mail Manager archive creation.
 * AWS Mail Manager is not yet fully supported in Pulumi.
 * The CLI uses AWS SDK directly for this functionality.
 *
 * For now, this returns placeholder values. Users who need archiving
 * should use the CLI or AWS Console to set it up manually.
 *
 * Cost: $2/GB ingestion + $0.19/GB/month storage
 * See: https://docs.aws.amazon.com/ses/latest/dg/eb-archiving.html
 */
export function createMailManagerArchive(
  _name: string,
  _retention: ArchiveRetention,
  _configSetName: pulumi.Output<string>,
  _accountId: pulumi.Output<string>,
  _region: pulumi.Output<string>,
  _tags: Record<string, string>,
  _opts?: pulumi.ComponentResourceOptions
): MailManagerResult {
  // TODO: Implement using Pulumi dynamic provider or AWS SDK calls
  // For now, return placeholder values
  console.warn(
    "Mail Manager archiving is not yet implemented in @wraps.dev/pulumi. " +
      "Use the Wraps CLI or AWS Console to enable email archiving."
  );

  return {
    archiveArn: pulumi.output(undefined),
    enabled: pulumi.output(false),
  };
}
