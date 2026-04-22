/**
 * Region enforcement for resource existence probes.
 *
 * Each probe function calls an AWS SDK client that lives in a specific
 * region. If the probe silently falls back to `getDefaultRegion()` (us-east-1)
 * when the user selected a different region, the existence check runs
 * against the wrong region — Pulumi then thinks the resource doesn't exist
 * and creates a duplicate in us-east-1.
 *
 * The fix: every regional probe takes `region: string` as a required
 * parameter. These tests pin that contract.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { regionCalls, resetRegionCalls, makeFakeClient } = vi.hoisted(() => {
  const calls: Array<{ client: string; region: unknown }> = [];
  function reset() {
    calls.length = 0;
  }
  function make(clientName: string, defaultResponse: unknown = {}) {
    return class FakeClient {
      config: { region: unknown };
      constructor(config: { region?: unknown } = {}) {
        this.config = { region: config?.region };
        calls.push({ client: clientName, region: config?.region });
      }
      // biome-ignore lint/suspicious/noExplicitAny: test double
      send(_cmd: any): Promise<any> {
        return Promise.resolve(defaultResponse);
      }
    };
  }
  return { regionCalls: calls, resetRegionCalls: reset, makeFakeClient: make };
});

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: makeFakeClient("DynamoDBClient"),
  DescribeTableCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: makeFakeClient("SQSClient", { QueueUrl: "https://sqs/foo" }),
  GetQueueUrlCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

vi.mock("@aws-sdk/client-sns", () => ({
  SNSClient: makeFakeClient("SNSClient", { Topics: [] }),
  ListTopicsCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

vi.mock("@aws-sdk/client-lambda", () => ({
  LambdaClient: makeFakeClient("LambdaClient"),
  GetFunctionCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

import {
  lambdaFunctionExists,
  snsTopicExists,
  sqsQueueExists,
  tableExists,
} from "../resource-checks.js";

const USER_REGION = "us-west-1";

describe("resource-checks region propagation", () => {
  beforeEach(() => {
    resetRegionCalls();
  });

  it("tableExists constructs DynamoDBClient with the caller-provided region", async () => {
    await tableExists("my-table", USER_REGION);
    expect(regionCalls).toEqual([
      { client: "DynamoDBClient", region: USER_REGION },
    ]);
  });

  it("sqsQueueExists constructs SQSClient with the caller-provided region", async () => {
    await sqsQueueExists("my-queue", USER_REGION);
    expect(regionCalls).toEqual([{ client: "SQSClient", region: USER_REGION }]);
  });

  it("snsTopicExists constructs SNSClient with the caller-provided region", async () => {
    await snsTopicExists("my-topic", USER_REGION);
    expect(regionCalls).toEqual([{ client: "SNSClient", region: USER_REGION }]);
  });

  it("lambdaFunctionExists constructs LambdaClient with the caller-provided region", async () => {
    await lambdaFunctionExists("my-fn", USER_REGION);
    expect(regionCalls).toEqual([
      { client: "LambdaClient", region: USER_REGION },
    ]);
  });
});
