/**
 * Lambda Handler Security Tests
 *
 * Tests that 401 responses do not leak debug information
 * (auth header prefixes, request paths, header keys, etc.)
 */

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from "aws-lambda";
import { describe, expect, it, vi } from "vitest";

// Mock the Elysia app to return a 401 response
vi.mock("../index", () => ({
  app: {
    handle: vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        })
    ),
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
      authorization: "Bearer wraps_live_secret123456789",
      "content-type": "application/json",
      "x-organization-id": "org-123",
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
        sourceIp: "127.0.0.1",
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

describe("Lambda 401 Response Security", () => {
  it("does not include debug object with auth header prefix, path, or header keys", async () => {
    const { handler } = await import("../lambda");

    const event = createMockEvent();
    const result = (await handler(
      event,
      mockContext
    )) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode).toBe(401);

    const body = JSON.parse(result.body as string);

    // Must NOT contain debug information
    expect(body).not.toHaveProperty("debug");
    expect(body).not.toHaveProperty("debug.authPrefix");
    expect(body).not.toHaveProperty("debug.path");
    expect(body).not.toHaveProperty("debug.headerKeys");
    expect(body).not.toHaveProperty("debug.hasAuth");
    expect(body).not.toHaveProperty("debug.hasOrgHeader");

    // Body should not contain the auth header prefix
    const bodyStr = result.body as string;
    expect(bodyStr).not.toContain("wraps_live_secret12345");
    expect(bodyStr).not.toContain("/v1/contacts");
    expect(bodyStr).not.toContain("x-organization-id");
  });

  it("still forwards the error message from the upstream response", async () => {
    const { handler } = await import("../lambda");

    const event = createMockEvent();
    const result = (await handler(
      event,
      mockContext
    )) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode).toBe(401);

    const body = JSON.parse(result.body as string);
    expect(body).toHaveProperty("error", "Unauthorized");
  });
});
