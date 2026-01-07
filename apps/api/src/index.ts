/**
 * Wraps Platform API
 *
 * Elysia-based API for batch sending and platform features.
 * Deployed via SST to AWS Lambda + API Gateway.
 */

import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";

import { batchRoutes } from "./routes/batch";
import { contactsRoutes } from "./routes/contacts";
import { eventsRoutes } from "./routes/events";
import { healthRoutes } from "./routes/health";
import { toolsRoutes } from "./routes/tools";
import { unsubscribeRoutes } from "./routes/unsubscribe";
import { webhooksRoutes } from "./routes/webhooks";
import { workflowsRoutes } from "./routes/workflows";

export const app = new Elysia()
  .onError(({ error }) => {
    // Return error message in response body
    const message = error instanceof Error ? error.message : String(error);
    return { error: message };
  })
  .use(
    cors({
      origin: true, // Allow any origin for public API
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "X-Organization-Id"],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    })
  )
  .use(
    swagger({
      documentation: {
        info: {
          title: "Wraps Platform API",
          version: "1.0.0",
          description: "API for batch sending and platform features",
        },
        tags: [
          { name: "health", description: "Health check endpoints" },
          { name: "contacts", description: "Contact management" },
          { name: "batch", description: "Batch sending operations" },
          {
            name: "events",
            description: "Event ingestion for workflow triggers",
          },
          { name: "workflows", description: "Workflow trigger endpoints" },
          {
            name: "webhooks",
            description: "Webhook endpoints for event processing",
          },
          {
            name: "unsubscribe",
            description: "Email unsubscribe endpoints (RFC 8058 compliant)",
          },
        ],
      },
    })
  )
  .use(healthRoutes)
  .use(contactsRoutes)
  .use(batchRoutes)
  .use(eventsRoutes)
  .use(workflowsRoutes)
  .use(webhooksRoutes)
  .use(unsubscribeRoutes)
  .use(toolsRoutes);

// Export type for Eden Treaty client
export type App = typeof app;

// For local development (not in Lambda)
// Check for Lambda environment indicators
const isLambda =
  !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.SST_DEV;

if (!isLambda && process.env.NODE_ENV !== "production") {
  app.listen(3001, () => {
    console.log("Wraps API running at http://localhost:3001");
    console.log("Swagger docs at http://localhost:3001/swagger");
  });
}
