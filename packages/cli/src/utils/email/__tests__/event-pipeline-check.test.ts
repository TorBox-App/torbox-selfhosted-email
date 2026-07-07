import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockSesv2Send = vi.fn();
const mockEventBridgeSend = vi.fn();
const mockSqsSend = vi.fn();
const mockLambdaSend = vi.fn();
const mockDynamoSend = vi.fn();

vi.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: class {
    send = mockSesv2Send;
  },
  GetConfigurationSetEventDestinationsCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

vi.mock("@aws-sdk/client-eventbridge", () => ({
  EventBridgeClient: class {
    send = mockEventBridgeSend;
  },
  DescribeRuleCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
  ListTargetsByRuleCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
  DescribeApiDestinationCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
  DescribeConnectionCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: class {
    send = mockSqsSend;
  },
  GetQueueUrlCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
  GetQueueAttributesCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

vi.mock("@aws-sdk/client-lambda", () => ({
  LambdaClient: class {
    send = mockLambdaSend;
  },
  ListEventSourceMappingsCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: class {
    send = mockDynamoSend;
  },
  DescribeTableCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

import { checkEventPipeline } from "../event-pipeline-check.js";

type CmdLike = {
  constructor: { name: string };
  input?: Record<string, unknown>;
};

const QUEUE_ARN = "arn:aws:sqs:us-east-1:123456789012:wraps-email-events";
const WEBHOOK_TARGET_ARN =
  "arn:aws:events:us-east-1:123456789012:api-destination/wraps-webhook-destination/abc123";

function healthySesv2() {
  mockSesv2Send.mockImplementation(() =>
    Promise.resolve({
      EventDestinations: [{ Name: "wraps-email-eventbridge", Enabled: true }],
    })
  );
}

function healthyEventBridge(
  overrides: Partial<{ targets: Array<{ Id: string; Arn: string }> }> = {}
) {
  const targets = overrides.targets ?? [{ Id: "sqs-target", Arn: QUEUE_ARN }];
  mockEventBridgeSend.mockImplementation((cmd: CmdLike) => {
    switch (cmd.constructor.name) {
      case "DescribeRuleCommand":
        return Promise.resolve({ State: "ENABLED" });
      case "ListTargetsByRuleCommand":
        return Promise.resolve({ Targets: targets });
      case "DescribeApiDestinationCommand":
        return Promise.resolve({ ApiDestinationState: "ACTIVE" });
      case "DescribeConnectionCommand":
        return Promise.resolve({ ConnectionState: "AUTHORIZED" });
      default:
        return Promise.resolve({});
    }
  });
}

function healthySqs() {
  mockSqsSend.mockImplementation((cmd: CmdLike) => {
    if (cmd.constructor.name === "GetQueueUrlCommand") {
      const queueName = (cmd.input as { QueueName?: string } | undefined)
        ?.QueueName;
      return Promise.resolve({
        QueueUrl: `https://sqs.us-east-1.amazonaws.com/123456789012/${queueName}`,
      });
    }
    if (cmd.constructor.name === "GetQueueAttributesCommand") {
      return Promise.resolve({
        Attributes: { ApproximateNumberOfMessages: "0" },
      });
    }
    return Promise.resolve({});
  });
}

function healthyLambda() {
  mockLambdaSend.mockImplementation(() =>
    Promise.resolve({
      EventSourceMappings: [{ EventSourceArn: QUEUE_ARN, State: "Enabled" }],
    })
  );
}

function healthyDynamo() {
  mockDynamoSend.mockImplementation(() =>
    Promise.resolve({ Table: { TableStatus: "ACTIVE" } })
  );
}

describe("checkEventPipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    healthySesv2();
    healthyEventBridge();
    healthySqs();
    healthyLambda();
    healthyDynamo();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns all pass when every hop is healthy", async () => {
    const checks = await checkEventPipeline({
      region: "us-east-1",
      domains: ["example.com"],
      expectPlatformWebhook: false,
    });

    expect(checks.length).toBeGreaterThan(0);
    for (const check of checks) {
      expect(check.status).toBe("pass");
    }
  });

  it("fails the SQS queue hop when the queue is missing, mentioning the upgrade command", async () => {
    mockSqsSend.mockImplementation((cmd: CmdLike) => {
      if (cmd.constructor.name === "GetQueueUrlCommand") {
        const queueName = (cmd.input as { QueueName?: string } | undefined)
          ?.QueueName;
        if (queueName === "wraps-email-events") {
          const error = new Error("QueueDoesNotExist");
          error.name = "QueueDoesNotExist";
          return Promise.reject(error);
        }
        return Promise.resolve({
          QueueUrl: `https://sqs.us-east-1.amazonaws.com/123456789012/${queueName}`,
        });
      }
      if (cmd.constructor.name === "GetQueueAttributesCommand") {
        return Promise.resolve({
          Attributes: { ApproximateNumberOfMessages: "0" },
        });
      }
      return Promise.resolve({});
    });

    const checks = await checkEventPipeline({
      region: "us-east-1",
      domains: ["example.com"],
      expectPlatformWebhook: false,
    });

    const queueCheck = checks.find(
      (c) => c.hop === "SQS queue wraps-email-events"
    );
    expect(queueCheck?.status).toBe("fail");
    expect(queueCheck?.details).toContain("wraps email upgrade");
  });

  it("fails the event source mapping hop when the mapping is disabled", async () => {
    mockLambdaSend.mockImplementation(() =>
      Promise.resolve({
        EventSourceMappings: [{ EventSourceArn: QUEUE_ARN, State: "Disabled" }],
      })
    );

    const checks = await checkEventPipeline({
      region: "us-east-1",
      domains: ["example.com"],
      expectPlatformWebhook: false,
    });

    const mappingCheck = checks.find(
      (c) => c.hop === "Lambda event source mapping wraps-email-event-processor"
    );
    expect(mappingCheck?.status).toBe("fail");
  });

  it("fails the connection hop when the webhook connection is deauthorized", async () => {
    mockEventBridgeSend.mockImplementation((cmd: CmdLike) => {
      switch (cmd.constructor.name) {
        case "DescribeRuleCommand":
          return Promise.resolve({ State: "ENABLED" });
        case "ListTargetsByRuleCommand":
          return Promise.resolve({
            Targets: [
              { Id: "sqs-target", Arn: QUEUE_ARN },
              { Id: "webhook-target", Arn: WEBHOOK_TARGET_ARN },
            ],
          });
        case "DescribeApiDestinationCommand":
          return Promise.resolve({ ApiDestinationState: "ACTIVE" });
        case "DescribeConnectionCommand":
          return Promise.resolve({ ConnectionState: "DEAUTHORIZED" });
        default:
          return Promise.resolve({});
      }
    });

    const checks = await checkEventPipeline({
      region: "us-east-1",
      domains: ["example.com"],
      expectPlatformWebhook: true,
    });

    const connectionCheck = checks.find(
      (c) => c.hop === "EventBridge connection wraps-webhook-connection"
    );
    expect(connectionCheck?.status).toBe("fail");
  });

  it("warns on duplicate SQS targets, listing all target ids", async () => {
    mockEventBridgeSend.mockImplementation((cmd: CmdLike) => {
      switch (cmd.constructor.name) {
        case "DescribeRuleCommand":
          return Promise.resolve({ State: "ENABLED" });
        case "ListTargetsByRuleCommand":
          return Promise.resolve({
            Targets: [
              { Id: "target-1", Arn: QUEUE_ARN },
              { Id: "target-2", Arn: QUEUE_ARN },
              { Id: "target-3", Arn: QUEUE_ARN },
            ],
          });
        default:
          return Promise.resolve({});
      }
    });

    const checks = await checkEventPipeline({
      region: "us-east-1",
      domains: ["example.com"],
      expectPlatformWebhook: false,
    });

    const dupCheck = checks.find((c) => c.hop === "EventBridge rule targets");
    expect(dupCheck?.status).toBe("warn");
    expect(dupCheck?.details).toContain("target-1");
    expect(dupCheck?.details).toContain("target-2");
    expect(dupCheck?.details).toContain("target-3");
  });

  it("fails when a platform webhook is expected but no webhook target exists", async () => {
    // Default healthyEventBridge() only registers the SQS target.
    const checks = await checkEventPipeline({
      region: "us-east-1",
      domains: ["example.com"],
      expectPlatformWebhook: true,
    });

    const webhookCheck = checks.find(
      (c) => c.hop === "Platform webhook target"
    );
    expect(webhookCheck?.status).toBe("fail");
    expect(webhookCheck?.details).toContain("wraps email upgrade");
  });

  it("warns when a webhook target exists but metadata has no webhookSecret", async () => {
    healthyEventBridge({
      targets: [
        { Id: "sqs-target", Arn: QUEUE_ARN },
        { Id: "webhook-target", Arn: WEBHOOK_TARGET_ARN },
      ],
    });

    const checks = await checkEventPipeline({
      region: "us-east-1",
      domains: ["example.com"],
      expectPlatformWebhook: false,
    });

    const webhookCheck = checks.find(
      (c) => c.hop === "Platform webhook target"
    );
    expect(webhookCheck?.status).toBe("warn");
  });

  it("isolates a hop's SDK error as a warn and still evaluates the remaining hops", async () => {
    mockEventBridgeSend.mockImplementation((cmd: CmdLike) => {
      if (cmd.constructor.name === "ListTargetsByRuleCommand") {
        const error = new Error("AccessDenied");
        error.name = "Error";
        return Promise.reject(error);
      }
      if (cmd.constructor.name === "DescribeRuleCommand") {
        return Promise.resolve({ State: "ENABLED" });
      }
      return Promise.resolve({});
    });

    const checks = await checkEventPipeline({
      region: "us-east-1",
      domains: ["example.com"],
      expectPlatformWebhook: false,
    });

    const targetsCheck = checks.find(
      (c) => c.hop === "EventBridge rule targets"
    );
    expect(targetsCheck?.status).toBe("warn");
    expect(targetsCheck?.details).toContain("AccessDenied");

    // Remaining independent hops (DLQ, Lambda mapping, DynamoDB table) still ran.
    const dlqCheck = checks.find(
      (c) => c.hop === "SQS DLQ wraps-email-events-dlq"
    );
    const mappingCheck = checks.find(
      (c) => c.hop === "Lambda event source mapping wraps-email-event-processor"
    );
    const tableCheck = checks.find(
      (c) => c.hop === "DynamoDB table wraps-email-history"
    );
    expect(dlqCheck?.status).toBe("pass");
    expect(mappingCheck?.status).toBe("pass");
    expect(tableCheck?.status).toBe("pass");
  });
});
