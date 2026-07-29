import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    // Surface a bad WRAPS_AI_PROVIDER / AI_MODEL here rather than leaving the
    // operator to discover it from the first 503. Imported lazily so the AI
    // registry stays out of the edge bundle.
    const { logAIConfigIssuesAtBoot } = await import("@/lib/ai/env");
    logAIConfigIssuesAtBoot();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
