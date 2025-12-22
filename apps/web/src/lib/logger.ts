/**
 * Structured logging with Pino + Axiom
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
 */

import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";
const axiomDataset = process.env.AXIOM_DATASET || "wraps-web";
const axiomToken = process.env.AXIOM_TOKEN;

/**
 * Create the base logger
 */
function createLogger(): pino.Logger {
  const baseConfig: pino.LoggerOptions = {
    level: isDev ? "debug" : "info",
    base: {
      service: "wraps-web",
      env: process.env.NODE_ENV || "development",
    },
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  // In production with Axiom token, send to Axiom
  if (!isDev && axiomToken) {
    const transport = pino.transport({
      target: "@axiomhq/pino",
      options: {
        dataset: axiomDataset,
        token: axiomToken,
      },
    });
    return pino(baseConfig, transport);
  }

  // In dev or without token, just use stdout with pretty printing
  // Note: pino-pretty not installed, using default JSON output
  return pino(baseConfig);
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
  return logger.child({
    action: actionName,
    ...context,
  });
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
