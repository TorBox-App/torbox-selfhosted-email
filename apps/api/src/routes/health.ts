/**
 * Health Check Routes
 */

import { Elysia, t } from "elysia";

export const healthRoutes = new Elysia({ prefix: "" })
  .get(
    "/health",
    () => ({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    }),
    {
      response: t.Object({
        status: t.String({ description: "Health status", examples: ["ok"] }),
        timestamp: t.String({
          description: "ISO 8601 timestamp",
          format: "date-time",
        }),
        version: t.String({ description: "API version", examples: ["1.0.0"] }),
      }),
      detail: {
        tags: ["health"],
        summary: "Health check",
        description: "Returns the health status of the API",
      },
    }
  )
  .get(
    "/",
    () => ({
      name: "Wraps Platform API",
      version: "1.0.0",
      docs: "/swagger",
    }),
    {
      response: t.Object({
        name: t.String({ description: "API name" }),
        version: t.String({ description: "API version" }),
        docs: t.String({ description: "Documentation URL" }),
      }),
      detail: {
        tags: ["health"],
        summary: "API info",
        description: "Returns basic API information",
      },
    }
  );
