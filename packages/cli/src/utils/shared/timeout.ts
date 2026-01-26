import { WrapsError } from "./errors.js";

/**
 * Default timeout for Pulumi operations (10 minutes)
 */
export const DEFAULT_PULUMI_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Error thrown when an operation times out
 */
export class TimeoutError extends WrapsError {
  constructor(operation: string, timeoutMs: number) {
    const timeoutMinutes = Math.round(timeoutMs / 60_000);
    super(
      `Operation "${operation}" timed out after ${timeoutMinutes} minute${timeoutMinutes === 1 ? "" : "s"}`,
      "OPERATION_TIMEOUT",
      "The operation took longer than expected. This can happen due to:\n" +
        "  - Slow network connection\n" +
        "  - AWS API throttling\n" +
        "  - Large number of resources\n\n" +
        "You can try:\n" +
        "  1. Check AWS CloudFormation/Pulumi state for partial deployments\n" +
        "  2. Run the command again (it will resume where it left off)\n" +
        "  3. Check your AWS console for any stuck resources",
      "https://wraps.dev/docs/guides/aws-setup/troubleshooting"
    );
  }
}

/**
 * Wraps a promise with a timeout
 *
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param operation - Description of the operation (for error messages)
 * @returns The result of the promise if it completes before timeout
 * @throws TimeoutError if the operation times out
 *
 * @example
 * ```typescript
 * const result = await withTimeout(
 *   stack.up(),
 *   DEFAULT_PULUMI_TIMEOUT_MS,
 *   "Pulumi deployment"
 * );
 * ```
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(operation, timeoutMs));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
