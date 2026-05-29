/**
 * AWS Lambda Handler for Wraps API
 *
 * Wraps the Elysia app for Lambda execution via API Gateway.
 */

// Initialize Sentry before all other imports
import "./lib/sentry";

import { wrapHandler } from "@sentry/aws-serverless";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
} from "aws-lambda";

import { app } from "./index";
import { flushLogger } from "./lib/logger";

export const handler = wrapHandler(async function handler(
  event: APIGatewayProxyEventV2,
  _context: Context
): Promise<APIGatewayProxyResultV2> {
  try {
    // Convert API Gateway event to Request.
    // Normalize rawPath: strip leading double-slashes before building the URL.
    // A trailing slash on NEXT_PUBLIC_API_URL + /v1/path produces //v1/path.
    // new URL("//v1/path", base) treats it as protocol-relative and resolves
    // to https://v1/path — the wrong host and path — causing a 404 NOT_FOUND.
    const safePath = `/${event.rawPath.replace(/^\/+/, "")}`;
    const url = new URL(
      safePath + (event.rawQueryString ? `?${event.rawQueryString}` : ""),
      `https://${event.requestContext.domainName}`
    );

    // Filter out undefined header values (API Gateway v2 can have undefined values)
    const filteredHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(event.headers)) {
      if (value !== undefined) {
        filteredHeaders[key] = value;
      }
    }

    // Propagate API Gateway request ID for log correlation (client-sent header takes priority)
    if (!filteredHeaders["x-request-id"]) {
      filteredHeaders["x-request-id"] = event.requestContext.requestId;
    }

    // Inject trusted client IP from API Gateway (TCP-level, not spoofable via headers)
    filteredHeaders["x-source-ip"] = event.requestContext.http.sourceIp;

    const request = new Request(url.toString(), {
      method: event.requestContext.http.method,
      headers: new Headers(filteredHeaders),
      body:
        event.body && event.requestContext.http.method !== "GET"
          ? event.isBase64Encoded
            ? Buffer.from(event.body, "base64")
            : event.body
          : undefined,
    });

    // Handle request with Elysia
    const response = await app.handle(request);

    // Convert Response to API Gateway format
    const headers: Record<string, string> = {};
    response.headers.forEach((value: string, key: string) => {
      headers[key] = value;
    });

    // Safely read body - clone first to avoid "body already consumed" errors
    let body: string;
    try {
      body = await response.clone().text();
    } catch {
      // If clone fails, try reading directly (body might not have been consumed)
      try {
        body = await response.text();
      } catch {
        body = "";
      }
    }

    return {
      statusCode: response.status,
      headers,
      body,
      isBase64Encoded: false,
    };
  } finally {
    await flushLogger();
  }
});
