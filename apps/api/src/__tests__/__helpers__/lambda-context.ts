import type { Context, SQSRecord } from "aws-lambda";
import { vi } from "vitest";

/**
 * Build a minimal Lambda `Context` for worker tests. The batch-sender worker
 * reads `context.getRemainingTimeInMillis()` to decide whether to
 * self-reschedule, so every test that calls the handler must pass a context
 * with a sane remaining-time value.
 */
export function makeMockContext(
  overrides: { remainingMs?: number } = {}
): Context {
  const remainingMs = overrides.remainingMs ?? 120_000;
  return {
    callbackWaitsForEmptyEventLoop: false,
    functionName: "test",
    functionVersion: "1",
    invokedFunctionArn: "arn:aws:lambda:us-east-1:000:function:test",
    memoryLimitInMB: "512",
    awsRequestId: "req-test",
    logGroupName: "/aws/lambda/test",
    logStreamName: "test",
    getRemainingTimeInMillis: () => remainingMs,
    done: vi.fn(),
    fail: vi.fn(),
    succeed: vi.fn(),
  };
}

/** Shared default `attributes` block for SQS records in tests. */
export function makeSqsRecordAttributes(
  overrides: Partial<SQSRecord["attributes"]> = {}
): SQSRecord["attributes"] {
  return {
    ApproximateReceiveCount: "1",
    SentTimestamp: "0",
    SenderId: "test",
    ApproximateFirstReceiveTimestamp: "0",
    ...overrides,
  };
}
