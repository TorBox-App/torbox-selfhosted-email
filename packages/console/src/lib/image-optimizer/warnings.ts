/**
 * Email Size Warnings
 * Contextual warnings for image sizes in email context
 */

import type { SizeWarning, SizeWarningLevel } from "./types";

/**
 * Email size thresholds in KB
 */
const THRESHOLDS = {
  INFO: 500, // >500KB - yellow info
  WARNING: 1024, // >1MB - orange warning
  ERROR: 2048, // >2MB - red error (blocks delivery)
} as const;

/**
 * Get email-specific size warning for an image
 * @param sizeBytes - File size in bytes
 * @returns Warning object or null if size is acceptable
 */
export function getEmailSizeWarning(sizeBytes: number): SizeWarning | null {
  const sizeKb = sizeBytes / 1024;
  const sizeMb = sizeKb / 1024;

  if (sizeMb > 2) {
    return {
      level: "error",
      message: "This image will cause delivery issues (>2MB)",
      suggestion: "Reduce dimensions or increase compression to under 1MB",
    };
  }

  if (sizeMb > 1) {
    return {
      level: "warning",
      message: "Most email clients struggle with images >1MB",
      suggestion: "Consider reducing to under 500KB for best deliverability",
    };
  }

  if (sizeKb > 500) {
    return {
      level: "info",
      message: "Larger than recommended for email (>500KB)",
      suggestion: "This may slow load times on mobile devices",
    };
  }

  return null; // Size is good
}

/**
 * Get warning level color for UI
 */
export function getWarningColor(level: SizeWarningLevel): string {
  switch (level) {
    case "info":
      return "text-yellow-600";
    case "warning":
      return "text-orange-600";
    case "error":
      return "text-red-600";
    default:
      return "text-muted-foreground";
  }
}

/**
 * Get warning background color for UI
 */
export function getWarningBgColor(level: SizeWarningLevel): string {
  switch (level) {
    case "info":
      return "bg-yellow-50 border-yellow-200";
    case "warning":
      return "bg-orange-50 border-orange-200";
    case "error":
      return "bg-red-50 border-red-200";
    default:
      return "bg-muted";
  }
}

/**
 * Check if size warning should block upload
 */
export function shouldBlockUpload(warning: SizeWarning | null): boolean {
  return warning?.level === "error";
}

/**
 * Get recommended target size based on current size
 */
export function getRecommendedTargetSize(currentSizeKb: number): number {
  if (currentSizeKb > THRESHOLDS.ERROR) {
    return THRESHOLDS.INFO; // Recommend 500KB for very large files
  }
  if (currentSizeKb > THRESHOLDS.WARNING) {
    return THRESHOLDS.INFO; // Recommend 500KB for large files
  }
  if (currentSizeKb > THRESHOLDS.INFO) {
    return THRESHOLDS.INFO; // Recommend 500KB
  }
  return currentSizeKb; // Already small enough
}

/**
 * Get size status label
 */
export function getSizeStatus(sizeBytes: number): {
  label: string;
  color: string;
} {
  const warning = getEmailSizeWarning(sizeBytes);

  if (!warning) {
    return { label: "Good", color: "text-green-600" };
  }

  switch (warning.level) {
    case "info":
      return { label: "OK", color: "text-yellow-600" };
    case "warning":
      return { label: "Large", color: "text-orange-600" };
    case "error":
      return { label: "Too Large", color: "text-red-600" };
    default:
      return { label: "Unknown", color: "text-muted-foreground" };
  }
}
