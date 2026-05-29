/**
 * AWS Lambda Handler for Wraps API
 *
 * Handles two event shapes:
 *   - HTTP  (API Gateway v2 / Lambda Function URL) → Elysia app
 *   - SQS   (batch queue, workflow queue)          → worker handlers
 *
 * The selfhost control-plane Lambda receives all three via a single function:
 * HTTP requests arrive via the Function URL, queue messages arrive via event
 * source mappings on the same function.
 */

// Initialize Sentry before all other imports
import "./lib/sentry";

import { wrapHandler } from "@sentry/aws-serverless";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
  SQSBatchResponse,
  SQSEvent,
} from "aws-lambda";
import { handler as workflowProcessorHandler } from "./(ee)/workers/workflow-processor";
import { app } from "./index";
import { flushLogger } from "./lib/logger";
import { handler as batchSenderHandler } from "./workers/batch-sender";

function isSQSEvent(event: unknown): event is SQSEvent {
  return (
    typeof event === "object" &&
    event !== null &&
    "Records" in event &&
    Array.isArray((event as SQSEvent).Records) &&
    (event as SQSEvent).Records.length > 0 &&
    "eventSource" in (event as SQSEvent).Records[0] &&
    (event as SQSEvent).Records[0].eventSource === "aws:sqs"
  );
}

export const handler = wrapHandler(async function handler(
  event: APIGatewayProxyEventV2 | SQSEvent,
  context: Context
): Promise<APIGatewayProxyResultV2 | SQSBatchResponse> {
  // Route SQS events to the appropriate worker
  if (isSQSEvent(event)) {
    const queueArn = event.Records[0].eventSourceARN ?? "";
    if (queueArn.includes("wraps-selfhost-workflow")) {
      return workflowProcessorHandler(event);
    }
    // batchSenderHandler is typed as SQSHandler (callback-based) but is async
    await (
      batchSenderHandler as unknown as (
        e: SQSEvent,
        c: Context
      ) => Promise<void>
    )(event, context);
  }

  // HTTP event — serve via Elysia
  const httpEvent = event as APIGatewayProxyEventV2;
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
