/**
 * Structured logging with Pino
 *
 * Usage:
 * ```typescript
 * import { logger, createRequestLogger } from '@/lib/logger';
 *
 * // Basic logging
 * logger.info({ userId: '123' }, 'User logged in');
 *
 * // With request context (in API routes/server actions)
 * const log = createRequestLogger({ requestId, orgSlug, userId });
 * log.info('Processing request');
 * log.error({ err }, 'Operation failed');
 * ```
 *
 * Logs go to stdout. Use Vercel Log Drains to forward to Axiom/Datadog.
 */

import * as Sentry from "@sentry/nextjs";
import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Create the base logger
 *
 * Logs to stdout in all environments. Axiom ingestion is handled by
 * Vercel Log Drains — pino.transport() is incompatible with bundled
 * serverless runtimes (Turbopack/webpack can't resolve transports at runtime).
 */
function createLogger(): pino.Logger {
  return pino({
    level: isDev ? "debug" : "info",
    base: {
      service: "wraps-web",
      env: process.env.NODE_ENV || "development",
    },
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

/**
 * Main logger instance
 */
export const logger = createLogger();

/**
 * Request context for logging
 */
export type RequestContext = {
  requestId?: string;
  orgSlug?: string;
  userId?: string;
  accountId?: string;
  path?: string;
  method?: string;
};

/**
 * Create a child logger with request context
 *
 * @example
 * ```typescript
 * export async function POST(req: Request) {
 *   const log = createRequestLogger({
 *     requestId: req.headers.get('x-request-id'),
 *     orgSlug: 'acme',
 *     userId: session.user.id,
 *   });
 *
 *   log.info('Starting operation');
 *   try {
 *     // ... do work
 *     log.info({ result }, 'Operation completed');
 *   } catch (err) {
 *     log.error({ err }, 'Operation failed');
 *   }
 * }
 * ```
 */
export function createRequestLogger(context: RequestContext): pino.Logger {
  return logger.child({
    ...context,
    // Filter out undefined values
    ...(context.requestId && { requestId: context.requestId }),
    ...(context.orgSlug && { org: context.orgSlug }),
    ...(context.userId && { user: context.userId }),
    ...(context.accountId && { awsAccount: context.accountId }),
  });
}

/**
 * Create a logger for server actions
 *
 * @example
 * ```typescript
 * export async function createContact(formData: FormData) {
 *   const log = createActionLogger('createContact', { orgSlug, userId });
 *   log.info('Creating contact');
 *   // ...
 * }
 * ```
 */
export function createActionLogger(
  actionName: string,
  context: Omit<RequestContext, "path" | "method">
): pino.Logger {
  const base = logger.child({ action: actionName, ...context });

  // Wrap .error() to forward caught errors to Sentry automatically.
  // All server action catch blocks use log.error({ err: serializeError(e) }, ...)
  // so this single hook ensures Sentry sees every swallowed operational failure.
  const originalError = base.error.bind(base);
  const wrappedError = (...args: Parameters<typeof originalError>) => {
    originalError(...args);
    const [firstArg] = args;
    if (firstArg && typeof firstArg === "object" && !Array.isArray(firstArg)) {
      const err = (firstArg as Record<string, unknown>).err;
      if (err instanceof Error) Sentry.captureException(err);
    }
  };
  return Object.assign(base, { error: wrappedError });
}

/**
 * Utility to safely serialize errors for logging
 */
export function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const serialized: Record<string, unknown> = {
      name: error.name,
      message: error.message,
      stack: isDev ? error.stack : undefined,
    };
    // Include any additional properties (like AWS error codes)
    for (const key of Object.keys(error)) {
      if (!(key in serialized)) {
        serialized[key] = (error as unknown as Record<string, unknown>)[key];
      }
    }
    return serialized;
  }
  return { error: String(error) };
}

export type { Logger } from "pino";
