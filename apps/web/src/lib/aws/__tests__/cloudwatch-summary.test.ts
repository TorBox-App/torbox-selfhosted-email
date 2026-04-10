import { describe, expect, it, vi } from "vitest";

// Mock the credential cache and DB before importing
vi.mock("@wraps/db", () => ({
  db: {
    query: {
      awsAccount: {
        findFirst: vi.fn(async () => ({
          id: "acc-1",
          organizationId: "org-1",
          region: "us-east-1",
          roleArn: "arn:aws:iam::123456789:role/wraps-console-access-role",
          externalId: "ext-1",
        })),
      },
    },
  },
}));

vi.mock("../credential-cache", () => ({
  getOrAssumeRole: vi.fn(async () => ({
    accessKeyId: "AKID",
    secretAccessKey: "SECRET",
    sessionToken: "TOKEN",
    region: "us-east-1",
  })),
}));

// Mock the CloudWatch client
const mockSend = vi.fn();
vi.mock("@aws-sdk/client-cloudwatch", async () => {
  const actual = await vi.importActual("@aws-sdk/client-cloudwatch");
  return {
    ...actual,
    CloudWatchClient: class {
      send = mockSend;
    },
  };
});

import { getSESMetricsSummary, SES_METRICS } from "../cloudwatch";

describe("getSESMetricsSummary", () => {
  it("should return renderingFailures key with CloudWatch data", async () => {
    // Simulate CloudWatch returning data for all 5 metrics
    mockSend.mockResolvedValueOnce({
      MetricDataResults: [
        {
          Id: "m0",
          Label: SES_METRICS.SEND,
          Timestamps: [new Date("2026-04-10")],
          Values: [124],
        },
        {
          Id: "m1",
          Label: SES_METRICS.DELIVERY,
          Timestamps: [new Date("2026-04-10")],
          Values: [110],
        },
        {
          Id: "m2",
          Label: SES_METRICS.BOUNCE,
          Timestamps: [new Date("2026-04-10")],
          Values: [1],
        },
        {
          Id: "m3",
          Label: SES_METRICS.COMPLAINT,
          Timestamps: [new Date("2026-04-10")],
          Values: [0],
        },
        {
          Id: "m4",
          Label: SES_METRICS.RENDERING_FAILURE,
          Timestamps: [new Date("2026-04-10")],
          Values: [13],
        },
      ],
    });

    const result = await getSESMetricsSummary({
      awsAccountId: "acc-1",
      startTime: new Date("2026-04-01"),
      endTime: new Date("2026-04-10"),
    });

    expect(result).toHaveProperty("renderingFailures");
    expect(result.renderingFailures).toBeDefined();
    expect(result.renderingFailures.length).toBeGreaterThan(0);
    expect(result.renderingFailures[0].Values).toContain(13);
  });
});
