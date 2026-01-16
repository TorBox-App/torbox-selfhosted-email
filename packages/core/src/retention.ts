import type { ArchiveRetention } from "./types.js";

/**
 * Convert retention string to number of days
 */
export function retentionToDays(retention: ArchiveRetention): number {
  switch (retention) {
    case "7days":
      return 7;
    case "30days":
      return 30;
    case "90days":
    case "3months":
      return 90;
    case "6months":
      return 180;
    case "9months":
      return 270;
    case "1year":
      return 365;
    case "18months":
      return 548;
    case "2years":
      return 730;
    case "30months":
      return 913;
    case "3years":
      return 1095;
    case "4years":
      return 1460;
    case "5years":
      return 1825;
    case "6years":
      return 2190;
    case "7years":
      return 2555;
    case "8years":
      return 2920;
    case "9years":
      return 3285;
    case "10years":
      return 3650;
    case "indefinite":
    case "permanent":
      return -1; // No TTL / permanent
    default:
      return 90;
  }
}

/**
 * Convert retention to AWS Mail Manager RetentionPeriod enum value
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
 * Calculate TTL timestamp from retention days
 * @param retentionDays Number of days to retain (-1 for permanent)
 * @returns Unix timestamp in seconds, or undefined for permanent retention
 */
export function calculateTTL(retentionDays: number): number | undefined {
  if (retentionDays < 0) {
    return; // Permanent retention
  }
  return Math.floor(Date.now() / 1000) + retentionDays * 24 * 60 * 60;
}
