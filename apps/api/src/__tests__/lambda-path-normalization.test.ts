/**
 * Lambda Handler Path Normalization Tests
 *
 * A trailing slash on NEXT_PUBLIC_API_URL concatenated with a route path
 * produces a double-slash: https://host/ + /v1/batch → https://host//v1/batch.
 * Lambda receives rawPath="//v1/batch". new URL("//v1/batch", base) treats
 * it as protocol-relative → https://v1/batch, so url.pathname="/batch" → 404.
 * The handler normalizes rawPath to strip leading double-slashes.
 */

import type { APIGatewayProxyEventV2, Context } from "aws-lambda";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/sentry", () => ({}));
vi.mock("@sentry/aws-serverless", () => ({
  wrapHandler: (fn: (...args: unknown[]) => unknown) => fn,
  captureException: vi.fn(),
}));

let capturedRequest: Request | null = null;

vi.mock("../index", () => ({
  app: {
    handle: vi.fn(async (req: Request) => {
      capturedRequest = req;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  },
}));

function makeEvent(rawPath: string): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "$default",
    rawPath,
    rawQueryString: "",
    headers: { host: "xxx.lambda-url.us-east-1.on.aws" },
    requestContext: {
      accountId: "123456789012",
      apiId: "test",
      domainName: "xxx.lambda-url.us-east-1.on.aws",
      domainPrefix: "xxx",
      http: {
        method: "POST",
        path: rawPath,
        protocol: "HTTP/1.1",
        sourceIp: "1.2.3.4",
        userAgent: "node",
      },
      requestId: "req-id",
      routeKey: "$default",
      stage: "$default",
      time: "01/Jan/2024:00:00:00 +0000",
      timeEpoch: 1_704_067_200_000,
    },
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

const mockContext = {} as Context;

describe("Lambda handler path normalization", () => {
  beforeEach(() => {
    capturedRequest = null;
  });

  it("passes a single-slash path through unchanged", async () => {
    const { handler } = await import("../lambda");
    await handler(makeEvent("/v1/batch"), mockContext, () => {});
    expect(new URL(capturedRequest!.url).pathname).toBe("/v1/batch");
  });

  it("normalizes double-slash rawPath to single-slash (trailing-slash API URL bug)", async () => {
    const { handler } = await import("../lambda");
    // Simulates NEXT_PUBLIC_API_URL with trailing slash: .../+ /v1/batch = //v1/batch
    await handler(makeEvent("//v1/batch"), mockContext, () => {});
    expect(new URL(capturedRequest!.url).pathname).toBe("/v1/batch");
  });

  it("normalizes triple-slash rawPath", async () => {
    const { handler } = await import("../lambda");
    await handler(makeEvent("///v1/batch"), mockContext, () => {});
    expect(new URL(capturedRequest!.url).pathname).toBe("/v1/batch");
  });
});
