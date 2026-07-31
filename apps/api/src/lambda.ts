/**
 * AWS Lambda Handler for Wraps API
 *
 * HTTP only (API Gateway v2 / Lambda Function URL) → Elysia app.
 *
 * This used to also multiplex SQS events to the batch/workflow workers, for the
 * deleted Pulumi selfhost variant that ran the whole control plane on one
 * function. Both the cloud stack (`infra/api.ts`) and the selfhost stack
 * (`infra/selfhost.config.ts`) give every queue its own dedicated worker
 * function, so no event source mapping targets this handler. Do not reintroduce
 * the multiplexer: its SQS branch fell through into the HTTP branch and threw
 * on `rawPath` after every chunk it processed.
 */

// Initialize Sentry before all other imports
import "./lib/sentry";

import { wrapHandler } from "@sentry/aws-serverless";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { app } from "./index";
import { flushLogger } from "./lib/logger";

export const handler = wrapHandler(async function handler(
  httpEvent: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    // Normalize rawPath: strip leading double-slashes before building the URL.
    // A trailing slash on NEXT_PUBLIC_API_URL + /v1/path produces //v1/path.
    // new URL("//v1/path", base) treats it as protocol-relative and resolves
    // to https://v1/path — the wrong host and path — causing a 404 NOT_FOUND.
    const safePath = `/${httpEvent.rawPath.replace(/^\/+/, "")}`;
    const url = new URL(
      safePath +
        (httpEvent.rawQueryString ? `?${httpEvent.rawQueryString}` : ""),
      `https://${httpEvent.requestContext.domainName}`
    );

    // Filter out undefined header values (API Gateway v2 can have undefined values)
    const filteredHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(httpEvent.headers)) {
      if (value !== undefined) {
        filteredHeaders[key] = value;
      }
    }

    // Propagate API Gateway request ID for log correlation (client-sent header takes priority)
    if (!filteredHeaders["x-request-id"]) {
      filteredHeaders["x-request-id"] = httpEvent.requestContext.requestId;
    }

    // Inject trusted client IP from API Gateway (TCP-level, not spoofable via headers)
    filteredHeaders["x-source-ip"] = httpEvent.requestContext.http.sourceIp;

    const request = new Request(url.toString(), {
      method: httpEvent.requestContext.http.method,
      headers: new Headers(filteredHeaders),
      body:
        httpEvent.body && httpEvent.requestContext.http.method !== "GET"
          ? httpEvent.isBase64Encoded
            ? Buffer.from(httpEvent.body, "base64")
            : httpEvent.body
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
