import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Plan 114: the SES EventBridge rule's targets need a target DLQ
 * (`deadLetterConfig`) so failed deliveries are retained instead of dropped,
 * and a FailedInvocations alarm so failures are loud. These tests pin both.
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
  function unwrap(value: unknown): unknown {
    if (value && typeof value === "object" && "__value" in value) {
      return (value as FakeOutput<unknown>).__value;
    }
    return value;
  }
  return { makeOutput, unwrap };
});

const awsState = vi.hoisted(() => {
  const created: Record<
    string,
    Array<{ logicalName: string; args: any; opts?: any }>
  > = {};
  function record(kind: string, logicalName: string, args: any, opts?: any) {
    created[kind] ??= [];
    created[kind].push({ logicalName, args, opts });
  }
  function reset() {
    for (const key of Object.keys(created)) {
      created[key] = [];
    }
  }
  return { created, record, reset };
});

vi.mock("@pulumi/pulumi", () => ({
  all: (outputs: unknown[]) => {
    const values = outputs.map((o) => pulumiState.unwrap(o));
    return pulumiState.makeOutput(values);
  },
}));

vi.mock("@pulumi/aws", () => {
  function makeResourceClass(kind: string) {
    return class {
      name: FakeOutput<string>;
      arn: FakeOutput<string>;
      url: FakeOutput<string>;
      constructor(logicalName: string, args: any, opts?: any) {
        awsState.record(kind, logicalName, args, opts);
        this.name = pulumiState.makeOutput(args?.name ?? logicalName);
        this.arn = pulumiState.makeOutput(
          `arn:aws:mock:${kind}:${logicalName}`
        );
        this.url = pulumiState.makeOutput(`https://mock/${logicalName}`);
      }
    };
  }
  return {
    cloudwatch: {
      EventRule: makeResourceClass("EventRule"),
      EventTarget: makeResourceClass("EventTarget"),
      EventConnection: makeResourceClass("EventConnection"),
      EventApiDestination: makeResourceClass("EventApiDestination"),
      MetricAlarm: makeResourceClass("MetricAlarm"),
    },
    iam: {
      Role: makeResourceClass("Role"),
      RolePolicy: makeResourceClass("RolePolicy"),
    },
    sqs: {
      QueuePolicy: makeResourceClass("QueuePolicy"),
    },
  };
});

import { createEventBridgeResources } from "../eventbridge.js";

const DLQ_ARN = "arn:aws:sqs:us-east-1:123456789012:wraps-email-events-dlq";

function baseConfig() {
  return {
    eventBusArn: pulumiState.makeOutput(
      "arn:aws:events:us-east-1:123456789012:event-bus/default"
    ),
    queueArn: pulumiState.makeOutput(
      "arn:aws:sqs:us-east-1:123456789012:wraps-email-events"
    ),
    queueUrl: pulumiState.makeOutput(
      "https://sqs.us-east-1.amazonaws.com/123456789012/wraps-email-events"
    ),
    dlqArn: pulumiState.makeOutput(DLQ_ARN),
  };
}

describe("EventBridge resources", () => {
  beforeEach(() => {
    awsState.reset();
  });

  it("attaches deadLetterConfig to both the SQS target and the webhook target", async () => {
    await createEventBridgeResources({
      ...baseConfig(),
      webhook: {
        awsAccountNumber: "123456789012",
        webhookSecret: "secret",
      },
    });

    const targets = awsState.created.EventTarget ?? [];
    expect(targets).toHaveLength(2);
    for (const target of targets) {
      expect(pulumiState.unwrap(target.args.deadLetterConfig.arn)).toBe(
        DLQ_ARN
      );
    }
  });

  it("attaches deadLetterConfig to the SQS target even without a webhook configured", async () => {
    await createEventBridgeResources(baseConfig());

    const targets = awsState.created.EventTarget ?? [];
    expect(targets).toHaveLength(1);
    expect(pulumiState.unwrap(targets[0]!.args.deadLetterConfig.arn)).toBe(
      DLQ_ARN
    );
  });

  it("creates the FailedInvocations alarm with actions when alertTopicArn is provided", async () => {
    const alertTopicArn =
      "arn:aws:sns:us-east-1:123456789012:wraps-email-alerts";

    await createEventBridgeResources({
      ...baseConfig(),
      alertTopicArn,
    });

    const alarms = awsState.created.MetricAlarm ?? [];
    expect(alarms).toHaveLength(1);
    const alarm = alarms[0]!;
    expect(alarm.args).toMatchObject({
      name: "wraps-email-events-delivery-failures",
      namespace: "AWS/Events",
      metricName: "FailedInvocations",
      dimensions: { RuleName: "wraps-email-events-to-sqs" },
      statistic: "Sum",
      period: 300,
      evaluationPeriods: 3,
      threshold: 1,
      comparisonOperator: "GreaterThanOrEqualToThreshold",
      treatMissingData: "notBreaching",
    });
    expect(alarm.args.alarmActions).toEqual([alertTopicArn]);
    expect(alarm.args.okActions).toEqual([alertTopicArn]);
  });

  it("creates the FailedInvocations alarm without actions when no alert topic is configured", async () => {
    await createEventBridgeResources(baseConfig());

    const alarms = awsState.created.MetricAlarm ?? [];
    expect(alarms).toHaveLength(1);
    expect(alarms[0]!.args.alarmActions).toBeUndefined();
    expect(alarms[0]!.args.okActions).toBeUndefined();
  });

  it("does not touch the existing event pattern or rule name (non-destructive)", async () => {
    await createEventBridgeResources(baseConfig());

    const rules = awsState.created.EventRule ?? [];
    expect(rules).toHaveLength(1);
    expect(rules[0]!.args.name).toBe("wraps-email-events-to-sqs");
  });
});
