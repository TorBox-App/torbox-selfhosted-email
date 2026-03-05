/**
 * Wraps Platform API
 *
 * Elysia-based API for batch sending and platform features.
 * Deployed via SST to AWS Lambda + API Gateway.
 */

import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { workflowsRoutes } from "./(ee)/routes/workflows";
import { log } from "./lib/logger";
import { getPostHogClient } from "./lib/posthog";
import type { AuthContext } from "./middleware/auth";
import { batchRoutes } from "./routes/batch";
import { connectionsRoutes } from "./routes/connections";
import { contactsRoutes } from "./routes/contacts";
import { contactsTopicsRoutes } from "./routes/contacts-topics";
import { eventsRoutes } from "./routes/events";
import { healthRoutes } from "./routes/health";
import { preferenceEventsRoutes } from "./routes/preference-events";
import { templatesSyncRoutes } from "./routes/templates-sync";
import { toolsRoutes } from "./routes/tools";
import { unsubscribeRoutes } from "./routes/unsubscribe";
import { webhooksRoutes } from "./routes/webhooks";
import { workflowScheduleRoutes } from "./routes/workflow-schedules";
import { workflowsSyncRoutes } from "./routes/workflows-sync";

/**
 * OpenAPI documentation configuration
 * Shared between swagger UI and OpenAPI spec generation
 */
const openApiDocumentation = {
  openapi: "3.0.3" as const,
  info: {
    title: "Wraps Platform API",
    version: "1.0.0",
    description:
      "REST API for the Wraps email marketing platform. Send emails, manage contacts, trigger workflows, and process events.",
    contact: {
      name: "Wraps Support",
      url: "https://wraps.dev",
      email: "support@wraps.dev",
    },
    license: {
      name: "Proprietary",
      url: "https://wraps.dev/terms",
    },
    termsOfService: "https://wraps.dev/terms",
  },
  servers: [
    {
      url: "https://api.wraps.dev",
      description: "Production API",
    },
  ],
  tags: [
    { name: "health", description: "Health check and API info endpoints" },
    {
      name: "contacts",
      description:
        "Contact management - create, update, delete, and list contacts",
    },
    {
      name: "batch",
      description: "Batch email sending operations for broadcasts",
    },
    {
      name: "events",
      description: "Custom event ingestion for triggering workflows",
    },
    {
      name: "workflows",
      description: "API-triggered workflow execution endpoints",
    },
    {
      name: "connections",
      description: "AWS account connection management",
    },
    {
      name: "webhooks",
      description: "Webhook endpoints for receiving SES events",
    },
    {
      name: "unsubscribe",
      description: "RFC 8058 compliant email unsubscribe endpoints",
    },
    {
      name: "tools",
      description: "Free email deliverability tools (no auth required)",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http" as const,
        scheme: "bearer",
        description:
          "API key (wraps_*) or session token. Use format: Bearer wraps_your_api_key",
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

/**
 * CORS origin allowlist.
 * Production: app.wraps.dev + wraps.dev
 * Dev/staging: also includes NEXT_PUBLIC_APP_URL (e.g. http://localhost:3000)
 */
const allowedOrigins = ["https://app.wraps.dev", "https://wraps.dev"];
const appUrl = process.env.NEXT_PUBLIC_APP_URL;
if (appUrl && !allowedOrigins.includes(appUrl)) {
  allowedOrigins.push(appUrl);
}

export const app = new Elysia()
  .derive(() => ({ startTime: performance.now() }))
  .onAfterResponse(({ request, startTime, set, ...ctx }) => {
    const auth = (ctx as unknown as { auth?: AuthContext }).auth;
    if (!auth) return;

    const url = new URL(request.url);
    log.info("api.request", {
      method: request.method,
      path: url.pathname,
      status: set.status ?? 200,
      durationMs: Math.round(performance.now() - startTime),
      organizationId: auth.organizationId,
      apiKeyId: auth.apiKeyId,
      userId: auth.userId,
      planId: auth.planId,
      authMethod: auth.apiKeyId ? "api_key" : "session",
    });
  })
  .onError(({ error, request, code, set, ...ctx }) => {
    const auth = (ctx as unknown as { auth?: AuthContext }).auth;
    const url = new URL(request.url);
    const status =
      code === "NOT_FOUND"
        ? 404
        : code === "VALIDATION"
          ? 400
          : ((set.status as number) ?? 500);

    log.error(
      "api.error",
      error instanceof Error ? error : new Error(String(error)),
      {
        method: request.method,
        path: url.pathname,
        status,
        code,
        organizationId: auth?.organizationId,
        apiKeyId: auth?.apiKeyId,
        userId: auth?.userId,
        authMethod: auth?.apiKeyId ? "api_key" : auth ? "session" : undefined,
      }
    );

    const posthog = getPostHogClient();
    posthog.captureException(
      error instanceof Error ? error : new Error(String(error)),
      "api-error",
      {
        url: request.url,
        method: request.method,
      }
    );
    if (code === "NOT_FOUND") {
      return { error: "Not found" };
    }

    if (code === "VALIDATION") {
      const message = error instanceof Error ? error.message : String(error);
      return { error: "Validation failed", details: message };
    }

    // 4xx errors from routes are already sanitized — pass through
    if (status >= 400 && status < 500) {
      const message = error instanceof Error ? error.message : String(error);
      return { error: message };
    }

    // 5xx: never leak internal details
    return { error: "Internal server error" };
  })
  .use(
    cors({
      origin: allowedOrigins,
      allowedHeaders: ["Content-Type", "Authorization", "X-Organization-Id"],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    })
  )
  .use(
    swagger({
      path: "/swagger",
      documentation: openApiDocumentation,
      exclude: ["/swagger", "/swagger/json"],
    })
  )
  .use(healthRoutes)
  .use(connectionsRoutes)
  .use(contactsRoutes)
  .use(contactsTopicsRoutes)
  .use(batchRoutes)
  .use(eventsRoutes)
  .use(workflowsRoutes)
  .use(webhooksRoutes)
  .use(unsubscribeRoutes)
  .use(preferenceEventsRoutes)
  .use(templatesSyncRoutes)
  .use(workflowsSyncRoutes)
  .use(toolsRoutes)
  .use(workflowScheduleRoutes);

// Export type for Eden Treaty client
export type App = typeof app;

// For local development (not in Lambda)
// Check for Lambda environment indicators
const isLambda =
  !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.SST_DEV;

if (!isLambda && process.env.NODE_ENV !== "production") {
  app.listen(3002);
}
