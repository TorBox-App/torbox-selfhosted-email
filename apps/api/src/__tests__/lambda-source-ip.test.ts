/**
 * Lambda Handler Source IP Injection Tests
 *
 * Verifies that the Lambda handler injects x-source-ip from
 * API Gateway's sourceIp, preventing client spoofing.
 */

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from "aws-lambda";
import { describe, expect, it, vi } from "vitest";

// Capture the Request passed to app.handle so we can inspect headers
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

function createMockEvent(
  overrides: Partial<APIGatewayProxyEventV2> = {}
): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "ANY /v1/contacts",
    rawPath: "/v1/contacts",
    rawQueryString: "",
    headers: {
      "content-type": "application/json",
      host: "api.wraps.dev",
    },
    requestContext: {
      accountId: "123456789012",
      apiId: "test",
      domainName: "api.wraps.dev",
      domainPrefix: "api",
      http: {
        method: "GET",
        path: "/v1/contacts",
        protocol: "HTTP/1.1",
        sourceIp: "203.0.113.42",
        userAgent: "test",
      },
      requestId: "test-id",
      routeKey: "ANY /v1/contacts",
      stage: "$default",
      time: "01/Jan/2024:00:00:00 +0000",
      timeEpoch: 1_704_067_200_000,
    },
    isBase64Encoded: false,
    ...overrides,
  } as APIGatewayProxyEventV2;
}

const mockContext = {} as Context;

describe("Lambda handler x-source-ip injection", () => {
  it("sets x-source-ip from API Gateway sourceIp", async () => {
    const { handler } = await import("../lambda");

    const event = createMockEvent();
    await handler(event, mockContext);

    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest!.headers.get("x-source-ip")).toBe("203.0.113.42");
  });

  it("overwrites client-sent x-source-ip with API Gateway sourceIp", async () => {
    const { handler } = await import("../lambda");

    const event = createMockEvent({
      headers: {
        "content-type": "application/json",
        host: "api.wraps.dev",
        "x-source-ip": "1.2.3.4", // attacker tries to spoof
      },
    });

    await handler(event, mockContext);

    expect(capturedRequest).not.toBeNull();
    // Must be the real sourceIp, not the spoofed one
    expect(capturedRequest!.headers.get("x-source-ip")).toBe("203.0.113.42");
  });
});
