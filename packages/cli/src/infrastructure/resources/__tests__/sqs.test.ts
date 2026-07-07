import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Plan 114: the DLQ needs a QueuePolicy granting EventBridge permission to
 * deliver failed-target events (target dead-letter, distinct from the
 * queue's own redrivePolicy which only covers Lambda-consumer failures).
 */

type FakeOutput<T> = {
  __value: T;
  apply<U>(fn: (v: T) => U): FakeOutput<U>;
};

const pulumiState = vi.hoisted(() => {
  function makeOutput<T>(value: T): FakeOutput<T> {
    return {
      __value: value,
      apply<U>(fn: (v: T) => U): FakeOutput<U> {
        return makeOutput(fn(value));
      },
    };
  }
  return { makeOutput };
});

const awsState = vi.hoisted(() => {
  const createdQueues: Array<{ logicalName: string; args: any; opts?: any }> =
    [];
  const createdPolicies: Array<{ logicalName: string; args: any }> = [];
  return { createdQueues, createdPolicies };
});

vi.mock("@pulumi/aws", () => {
  class MockQueue {
    name: FakeOutput<string>;
    arn: FakeOutput<string>;
    url: FakeOutput<string>;
    constructor(logicalName: string, args: any, opts?: any) {
      awsState.createdQueues.push({ logicalName, args, opts });
      const name = args?.name ?? logicalName;
      this.name = pulumiState.makeOutput(name);
      this.arn = pulumiState.makeOutput(
        `arn:aws:sqs:us-east-1:123456789012:${name}`
      );
      this.url = pulumiState.makeOutput(
        `https://sqs.us-east-1.amazonaws.com/123456789012/${name}`
      );
    }
  }
  class MockQueuePolicy {
    constructor(logicalName: string, args: any) {
      awsState.createdPolicies.push({ logicalName, args });
    }
  }
  return {
    sqs: {
      Queue: MockQueue,
      QueuePolicy: MockQueuePolicy,
    },
  };
});

vi.mock("../../shared/resource-checks.js", () => ({
  sqsQueueExists: vi.fn().mockResolvedValue(null),
}));

import { createSQSResources } from "../sqs.js";

function resolvePolicyJson(rawPolicy: unknown): Record<string, unknown> {
  const resolved =
    typeof rawPolicy === "string"
      ? rawPolicy
      : (rawPolicy as FakeOutput<string>).__value;
  return JSON.parse(resolved);
}

describe("SQS resources", () => {
  beforeEach(() => {
    awsState.createdQueues.length = 0;
    awsState.createdPolicies.length = 0;
  });

  it("grants events.amazonaws.com permission to deliver into the DLQ, scoped by the rule ARN", async () => {
    await createSQSResources({
      region: "us-east-1",
      accountId: "123456789012",
    });

    expect(awsState.createdPolicies).toHaveLength(1);
    const policy = awsState.createdPolicies[0]!;
    expect(policy.logicalName).toBe("wraps-email-events-dlq-policy");
    expect(policy.args.queueUrl).toBeDefined();

    const parsed = resolvePolicyJson(policy.args.policy);
    expect(parsed.Version).toBe("2012-10-17");
    const statements = parsed.Statement as Array<Record<string, unknown>>;
    expect(statements).toHaveLength(1);
    expect(statements[0]).toMatchObject({
      Effect: "Allow",
      Principal: { Service: "events.amazonaws.com" },
      Action: "sqs:SendMessage",
      Condition: {
        ArnEquals: {
          "aws:SourceArn":
            "arn:aws:events:us-east-1:123456789012:rule/wraps-email-events-to-sqs",
        },
      },
    });
  });

  it("scopes the DLQ policy's rule ARN by the caller's region and account", async () => {
    await createSQSResources({
      region: "eu-west-1",
      accountId: "987654321098",
    });

    const parsed = resolvePolicyJson(awsState.createdPolicies[0]!.args.policy);
    const statements = parsed.Statement as Array<{
      Condition: { ArnEquals: { "aws:SourceArn": string } };
    }>;
    expect(statements[0]!.Condition.ArnEquals["aws:SourceArn"]).toBe(
      "arn:aws:events:eu-west-1:987654321098:rule/wraps-email-events-to-sqs"
    );
  });

  it("does not create a second QueuePolicy on the DLQ when it already exists in AWS", async () => {
    const { sqsQueueExists } = await import("../../shared/resource-checks.js");
    vi.mocked(sqsQueueExists).mockResolvedValueOnce(
      "https://sqs.us-east-1.amazonaws.com/123456789012/wraps-email-events-dlq"
    );

    await createSQSResources({
      region: "us-east-1",
      accountId: "123456789012",
    });

    // Import-or-create only affects the Queue resource itself; the policy is
    // still declared exactly once (Pulumi reconciles it against existing state).
    expect(awsState.createdPolicies).toHaveLength(1);
  });
});
