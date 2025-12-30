/**
 * AWS Lambda Handler for Wraps API
 *
 * Wraps the Elysia app for Lambda execution via API Gateway.
 */

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
} from "aws-lambda";

import { app } from "./index";

export async function handler(
  event: APIGatewayProxyEventV2,
  _context: Context
): Promise<APIGatewayProxyResultV2> {
  // Debug: Check if auth header is present
  const hasAuth = !!event.headers.authorization;
  const authPrefix = event.headers.authorization?.slice(0, 20);

  // Convert API Gateway event to Request
  const url = new URL(
    event.rawPath + (event.rawQueryString ? `?${event.rawQueryString}` : ""),
    `https://${event.requestContext.domainName}`
  );

  // Filter out undefined header values (API Gateway v2 can have undefined values)
  const filteredHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(event.headers)) {
    if (value !== undefined) {
      filteredHeaders[key] = value;
    }
  }

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

  // Debug: Add headers info to failed auth responses
  if (response.status === 401) {
    return {
      statusCode: 401,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        error: body,
        debug: {
          hasAuth,
          authPrefix,
          path: event.rawPath,
          headerKeys: Object.keys(filteredHeaders),
          hasOrgHeader: !!filteredHeaders["x-organization-id"],
        },
      }),
      isBase64Encoded: false,
    };
  }

  return {
    statusCode: response.status,
    headers,
    body,
    isBase64Encoded: false,
  };
}
